import type {
  Order, ScoredCase, Evidence, EvidenceType, RiskBand,
  FinancialAssumptions,
} from '../types';
import { isThirdParty, archetypeLabel, evidenceTypeLabel, channelLabel } from '../utils';

// ── Default Assumptions ─────────────────────────────────────────
export const DEFAULT_ASSUMPTIONS: FinancialAssumptions = {
  avgCommission: 150,
  recoveryProbability: 0.15,
  avgMonthlyBill: 120,
  avgPromoBill: 49.99,
  annualizationMonths: 12,
};

// ── Identity Resolution ─────────────────────────────────────────
function countIdentityMatches(a: Order, orders: Order[]): {
  matchCount: number;
  matchedOrderIds: string[];
  matchedSignals: string[];
} {
  const signals = a.identitySignals;
  let bestMatchCount = 0;
  let bestMatchedId = '';
  const allMatchedIds: string[] = [];
  const allMatchedSignals = new Set<string>();

  for (const b of orders) {
    if (b.id === a.id) continue;
    if (!b.disconnectDate && !a.disconnectDate) continue;

    let matchCount = 0;
    const currentSignals: string[] = [];

    if (signals.phoneHash && b.identitySignals.phoneHash === signals.phoneHash) {
      matchCount++;
      currentSignals.push('phoneHash');
    }
    if (signals.emailHash && b.identitySignals.emailHash === signals.emailHash) {
      matchCount++;
      currentSignals.push('emailHash');
    }
    if (signals.paymentMethodHash && b.identitySignals.paymentMethodHash === signals.paymentMethodHash) {
      matchCount++;
      currentSignals.push('paymentMethodHash');
    }
    if (
      signals.equipmentSerialHistory?.length &&
      b.identitySignals.equipmentSerialHistory?.length
    ) {
      const overlap = signals.equipmentSerialHistory.filter(s =>
        b.identitySignals.equipmentSerialHistory?.includes(s)
      );
      if (overlap.length > 0) {
        matchCount++;
        currentSignals.push('equipmentSerialHistory');
      }
    }

    if (matchCount >= 2) {
      allMatchedIds.push(b.id);
      currentSignals.forEach(s => allMatchedSignals.add(s));
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestMatchedId = b.id;
      }
    }
  }

  return {
    matchCount: bestMatchCount,
    matchedOrderIds: allMatchedIds,
    matchedSignals: Array.from(allMatchedSignals),
  };
}

// ── Helper: find orders with disconnects at the same address ────
function findAddressDisconnects(order: Order, allOrders: Order[]): Order[] {
  return allOrders.filter(
    o => o.id !== order.id &&
      o.normalizedAddress === order.normalizedAddress &&
      o.zip === order.zip &&
      o.disconnectDate
  );
}

// ── Helper: compute days between two ISO date strings ───────────
function daysBetweenDates(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

// ── Evidence Builder ────────────────────────────────────────────
function buildEvidence(order: Order, allOrders: Order[]): Evidence[] {
  const evidence: Evidence[] = [];

  // ── 1. Rapid reconnect (order's own disconnect date) ──────────
  if (order.daysSinceDisconnect !== undefined && order.daysSinceDisconnect <= 30) {
    const urgency = order.daysSinceDisconnect <= 7 ? 0.9 : order.daysSinceDisconnect <= 14 ? 0.7 : 0.5;
    evidence.push({
      type: 'rapid_reconnect',
      confidence: urgency,
      weight: 0.2,
      details: {
        daysSinceDisconnect: order.daysSinceDisconnect,
        disconnectDate: order.disconnectDate,
        disconnectReason: order.disconnectReason,
      },
    });
  }

  // ── 2. Address-anchored disconnect reuse ──────────────────────
  // Even if the name is different, if this address had a disconnect
  // within 30 days, that's suspicious. This is the key signal for
  // "agent tells customer to use a different name" fraud.
  const addressDisconnects = findAddressDisconnects(order, allOrders);
  const recentAddressDisconnects = addressDisconnects.filter(o => {
    if (!o.disconnectDate) return false;
    const gap = daysBetweenDates(o.disconnectDate, order.orderDate);
    return gap >= 0 && gap <= 30;
  });

  if (recentAddressDisconnects.length > 0) {
    // Check if the name is different — that's the fake-name pattern
    const differentNameMatches = recentAddressDisconnects.filter(
      o => o.normalizedName !== order.normalizedName
    );
    const sameNameMatches = recentAddressDisconnects.filter(
      o => o.normalizedName === order.normalizedName
    );

    const closest = recentAddressDisconnects.reduce((best, o) => {
      const gap = daysBetweenDates(o.disconnectDate!, order.orderDate);
      return gap < (best.gap ?? Infinity) ? { order: o, gap } : best;
    }, { order: null as Order | null, gap: Infinity });

    evidence.push({
      type: 'address_disconnect_reuse',
      confidence: differentNameMatches.length > 0 ? 0.85 : 0.7,
      weight: 0.25,
      details: {
        addressDisconnectCount: recentAddressDisconnects.length,
        differentNameCount: differentNameMatches.length,
        sameNameCount: sameNameMatches.length,
        closestDisconnectDate: closest.order?.disconnectDate,
        closestDisconnectGapDays: closest.gap,
        closestDisconnectName: closest.order?.customerName,
        closestDisconnectAccountNumber: closest.order?.accountNumber,
        closestDisconnectAddress: closest.order?.address,
        closestDisconnectCity: closest.order?.city,
        closestDisconnectState: closest.order?.state,
        closestDisconnectZip: closest.order?.zip,
        closestDisconnectReason: closest.order?.disconnectReason,
        closestDisconnectOrderId: closest.order?.id,
        currentName: order.customerName,
        nameChanged: differentNameMatches.length > 0,
      },
    });
  }

  // ── 3. Legacy address match (any disconnect at address) ───────
  if (addressDisconnects.length > 0 && recentAddressDisconnects.length === 0) {
    // Only fire if there are older disconnects (not already covered above)
    evidence.push({
      type: 'address_match',
      confidence: 0.5,
      weight: 0.15,
      details: {
        matchedOrders: addressDisconnects.map(o => o.id),
        address: order.normalizedAddress,
        matchCount: addressDisconnects.length,
      },
    });
  }

  // ── 4. Payment method reuse at same address ───────────────────
  // If the new order uses the same payment method as a recently
  // disconnected account at the same address, even with a different
  // name, this is strong evidence of the same customer.
  if (order.identitySignals.paymentMethodHash) {
    const paymentMatches = allOrders.filter(
      o => o.id !== order.id &&
        o.identitySignals.paymentMethodHash === order.identitySignals.paymentMethodHash &&
        o.disconnectDate
    );

    if (paymentMatches.length > 0) {
      const sameAddress = paymentMatches.filter(
        o => o.normalizedAddress === order.normalizedAddress && o.zip === order.zip
      );
      const diffName = paymentMatches.filter(
        o => o.normalizedName !== order.normalizedName
      );

      // Pick the most relevant match for display
      const bestPaymentMatch = sameAddress.length > 0
        ? sameAddress[0]
        : paymentMatches[0];

      evidence.push({
        type: 'payment_method_reuse',
        confidence: sameAddress.length > 0 ? 0.9 : 0.7,
        weight: sameAddress.length > 0 ? 0.25 : 0.15,
        details: {
          matchedOrderCount: paymentMatches.length,
          sameAddressCount: sameAddress.length,
          differentNameCount: diffName.length,
          matchedOrderIds: paymentMatches.map(o => o.id),
          sameAddressAndDifferentName: sameAddress.filter(
            o => o.normalizedName !== order.normalizedName
          ).length,
          priorAccountName: bestPaymentMatch.customerName,
          priorAccountAddress: bestPaymentMatch.address,
          priorAccountCity: bestPaymentMatch.city,
          priorAccountState: bestPaymentMatch.state,
          priorAccountZip: bestPaymentMatch.zip,
          priorAccountNumber: bestPaymentMatch.accountNumber,
          priorDisconnectDate: bestPaymentMatch.disconnectDate,
          priorDisconnectReason: bestPaymentMatch.disconnectReason,
          priorOrderId: bestPaymentMatch.id,
        },
      });
    }
  }

  // ── 5. Phone number reuse ─────────────────────────────────────
  // Phone numbers rarely change. If the phone hash on this order
  // matches a recently disconnected account (any address, any name),
  // it's likely the same person.
  if (order.identitySignals.phoneHash) {
    const phoneMatches = allOrders.filter(
      o => o.id !== order.id &&
        o.identitySignals.phoneHash === order.identitySignals.phoneHash &&
        o.disconnectDate
    );

    if (phoneMatches.length > 0) {
      const diffName = phoneMatches.filter(
        o => o.normalizedName !== order.normalizedName
      );
      const sameAddress = phoneMatches.filter(
        o => o.normalizedAddress === order.normalizedAddress && o.zip === order.zip
      );

      // Pick the most relevant match for display
      const bestPhoneMatch = diffName.length > 0 ? diffName[0] : phoneMatches[0];

      evidence.push({
        type: 'phone_reuse',
        confidence: diffName.length > 0 ? 0.85 : 0.65,
        weight: 0.2,
        details: {
          matchedOrderCount: phoneMatches.length,
          sameAddressCount: sameAddress.length,
          differentNameCount: diffName.length,
          matchedOrderIds: phoneMatches.map(o => o.id),
          phoneUsedByNames: [...new Set(phoneMatches.map(o => o.customerName))],
          priorAccountName: bestPhoneMatch.customerName,
          priorAccountAddress: bestPhoneMatch.address,
          priorAccountCity: bestPhoneMatch.city,
          priorAccountState: bestPhoneMatch.state,
          priorAccountZip: bestPhoneMatch.zip,
          priorAccountNumber: bestPhoneMatch.accountNumber,
          priorDisconnectDate: bestPhoneMatch.disconnectDate,
          priorOrderId: bestPhoneMatch.id,
        },
      });
    }
  }

  // ── 6. Identity match (multi-signal) ──────────────────────────
  const identityResult = countIdentityMatches(order, allOrders);
  if (identityResult.matchCount >= 2) {
    const confidence = identityResult.matchCount >= 3 ? 0.9 : 0.65;
    evidence.push({
      type: 'identity_match',
      confidence,
      weight: 0.3,
      details: {
        matchCount: identityResult.matchCount,
        matchedSignals: identityResult.matchedSignals,
        matchedOrderIds: identityResult.matchedOrderIds,
        confidenceLevel: identityResult.matchCount >= 3 ? 'high' : 'medium',
      },
    });
  }

  // ── 7. Same customer new address ──────────────────────────────
  if (order.priorAccountNumber && order.daysSinceDisconnect !== undefined && order.daysSinceDisconnect <= 30) {
    const priorAddressOrders = allOrders.filter(
      o => o.id !== order.id &&
        o.accountNumber === order.priorAccountNumber &&
        o.normalizedAddress !== order.normalizedAddress
    );
    if (priorAddressOrders.length > 0 || identityResult.matchCount >= 2) {
      evidence.push({
        type: 'same_customer_new_address',
        confidence: 0.6,
        weight: 0.15,
        details: {
          priorAccountNumber: order.priorAccountNumber,
          daysSinceDisconnect: order.daysSinceDisconnect,
          identityMatchCount: identityResult.matchCount,
        },
      });
    }
  }

  // ── 8. Equipment swap ─────────────────────────────────────────
  if (
    order.identitySignals.equipmentSerialHistory &&
    order.identitySignals.equipmentSerialHistory.length > 1 &&
    order.daysSinceDisconnect !== undefined &&
    order.daysSinceDisconnect <= 30
  ) {
    evidence.push({
      type: 'equipment_swap',
      confidence: 0.7,
      weight: 0.15,
      details: {
        serialHistory: order.identitySignals.equipmentSerialHistory,
        swapCount: order.identitySignals.equipmentSerialHistory.length - 1,
      },
    });
  }

  // ── 9. Promo reset ────────────────────────────────────────────
  if (
    order.priorBillAmount &&
    order.newPromoBillAmount &&
    order.priorBillAmount > order.newPromoBillAmount * 1.5 &&
    order.daysSinceDisconnect !== undefined &&
    order.daysSinceDisconnect <= 30
  ) {
    evidence.push({
      type: 'promo_reset',
      confidence: 0.65,
      weight: 0.15,
      details: {
        priorBill: order.priorBillAmount,
        newPromoBill: order.newPromoBillAmount,
        savings: order.priorBillAmount - order.newPromoBillAmount,
        savingsPercent: ((order.priorBillAmount - order.newPromoBillAmount) / order.priorBillAmount * 100).toFixed(1) + '%',
      },
    });
  }

  // ── 10. Delinquency bypass ────────────────────────────────────
  if (order.delinquentBalance && order.delinquentBalance > 100) {
    evidence.push({
      type: 'delinquency_bypass',
      confidence: 0.85,
      weight: 0.2,
      details: {
        delinquentBalance: order.delinquentBalance,
        disconnectReason: order.disconnectReason,
      },
    });
  }

  // ── 11. Agent/company cluster ─────────────────────────────────
  const sameAgentOrders = allOrders.filter(
    o => o.id !== order.id && o.agentCode === order.agentCode && o._isFraud
  );
  const sameCompanyOrders = allOrders.filter(
    o => o.id !== order.id && o.companyCode === order.companyCode && o._isFraud
  );
  if (sameAgentOrders.length >= 3 || sameCompanyOrders.length >= 5) {
    evidence.push({
      type: 'agent_cluster',
      confidence: Math.min(0.9, 0.4 + sameAgentOrders.length * 0.1),
      weight: 0.1,
      details: {
        agentCode: order.agentCode,
        companyCode: order.companyCode,
        agentFraudCount: sameAgentOrders.length,
        companyFraudCount: sameCompanyOrders.length,
      },
    });
  }

  return evidence;
}

// ── Risk Scoring ────────────────────────────────────────────────
function calculateRiskScore(evidence: Evidence[], retentionChannel = false): { score: number; band: RiskBand } {
  if (evidence.length === 0) return { score: 0, band: 'Low' };

  // Weighted sum of evidence
  let weightedSum = 0;
  for (const e of evidence) {
    weightedSum += e.confidence * e.weight;
  }

  // Normalize to 0-100
  let score = Math.min(100, Math.round(weightedSum * 100));

  // Apply 2-signal minimum rule: need 2+ independent signals for High/Critical
  const independentSignalTypes = new Set(evidence.map(e => e.type));

  if (independentSignalTypes.size < 2) {
    // Cap at Medium for single-signal
    score = Math.min(score, 49);
  }

  // Retention channel mitigation: retention agents reconnect customers by
  // definition — rapid_reconnect + promo_reset on retention is expected
  // behavior, not fraud. Only flag retention orders if there are signals
  // beyond the typical retention pattern (e.g. delinquency bypass, different
  // name at address, or agent cluster).
  if (retentionChannel) {
    const retentionNormalSignals = new Set(['rapid_reconnect', 'promo_reset']);
    const hasAbnormalSignal = evidence.some(e => !retentionNormalSignals.has(e.type));
    if (!hasAbnormalSignal) {
      score = Math.min(score, 24); // Cap at Low
    }
  }

  // Determine band
  let band: RiskBand;
  if (score >= 70) band = 'Critical';
  else if (score >= 50) band = 'High';
  else if (score >= 25) band = 'Medium';
  else band = 'Low';

  return { score, band };
}

// ── Financial Impact ────────────────────────────────────────────
function calculateFinancialImpact(
  order: Order,
  riskBand: RiskBand,
  assumptions: FinancialAssumptions
) {
  const commission = order.commissionAmount || assumptions.avgCommission;
  const recoveryProb = assumptions.recoveryProbability;

  const commissionAtRisk = Math.round(commission * (1 - recoveryProb));

  const priorBill = order.priorBillAmount || assumptions.avgMonthlyBill;
  const promoBill = order.newPromoBillAmount || assumptions.avgPromoBill;
  const mrrLoss = Math.round((priorBill - promoBill) * recoveryProb);

  const annualizedExposure = mrrLoss * assumptions.annualizationMonths;

  return { commissionAtRisk, mrrLoss, annualizedExposure };
}

// ── Analyst Summary ─────────────────────────────────────────────
function generateAnalystSummary(order: Order, evidence: Evidence[], riskBand: RiskBand): string {
  const parts: string[] = [];

  if (evidence.length === 0) {
    return 'No suspicious indicators detected. Standard new connect order.';
  }

  // Lead with the strongest signal
  const sorted = [...evidence].sort((a, b) => b.confidence * b.weight - a.confidence * a.weight);
  const primary = sorted[0];

  switch (primary.type) {
    case 'rapid_reconnect':
      parts.push(`New order placed ${order.daysSinceDisconnect} days after disconnect at the same service address.`);
      break;
    case 'address_disconnect_reuse': {
      const nameChanged = primary.details.nameChanged as boolean;
      const gap = primary.details.closestDisconnectGapDays as number;
      const priorName = primary.details.closestDisconnectName as string;
      if (nameChanged) {
        parts.push(`Address had a disconnect ${gap} days ago under a different name (${priorName}). Possible name-swap fraud.`);
      } else {
        parts.push(`Address had a disconnect ${gap} days ago. Same address reuse detected.`);
      }
      break;
    }
    case 'address_match':
      parts.push(`Service address matches a previously disconnected account.`);
      break;
    case 'payment_method_reuse': {
      const sameAddr = primary.details.sameAddressCount as number;
      const diffName = primary.details.differentNameCount as number;
      if (sameAddr > 0 && diffName > 0) {
        parts.push(`Same payment method used at this address under a different name — strong indicator of same customer using an alias.`);
      } else if (diffName > 0) {
        parts.push(`Same payment method found on a disconnected account under a different name.`);
      } else {
        parts.push(`Payment method matches a recently disconnected account.`);
      }
      break;
    }
    case 'phone_reuse': {
      const diffName = primary.details.differentNameCount as number;
      const names = primary.details.phoneUsedByNames as string[];
      if (diffName > 0) {
        parts.push(`Phone number was previously used by ${names.join(', ')} on a disconnected account — same person, different name.`);
      } else {
        parts.push(`Phone number matches a recently disconnected account.`);
      }
      break;
    }
    case 'identity_match': {
      const count = primary.details.matchCount as number;
      const signals = (primary.details.matchedSignals as string[]).join(', ');
      parts.push(`${count} of 5 identity signals match a prior account (${signals}).`);
      break;
    }
    case 'delinquency_bypass':
      parts.push(`Prior account had $${order.delinquentBalance} delinquent balance (disconnect reason: ${order.disconnectReason}).`);
      break;
    case 'promo_reset':
      parts.push(`Bill dropped from $${order.priorBillAmount}/mo to $${order.newPromoBillAmount}/mo via promo reset.`);
      break;
    case 'equipment_swap':
      parts.push(`Equipment serial change detected at time of reconnect.`);
      break;
    case 'agent_cluster':
      parts.push(`Agent ${order.agentCode} (${order.companyName}) has elevated fraud pattern.`);
      break;
    case 'same_customer_new_address':
      parts.push(`Same customer identity reconnecting at a different address within ${order.daysSinceDisconnect} days.`);
      break;
  }

  // Add supporting evidence
  for (let i = 1; i < Math.min(sorted.length, 3); i++) {
    const e = sorted[i];
    parts.push(`Supporting: ${evidenceTypeLabel(e.type)} (${Math.round(e.confidence * 100)}% confidence).`);
  }

  // Channel context
  if (isThirdParty(order.channel)) {
    parts.push(`Submitted via ${channelLabel(order.channel)} channel.`);
  }

  return parts.join(' ');
}

// ── Find Similar Cases ──────────────────────────────────────────
function findSimilarCases(order: Order, allCases: ScoredCase[]): string[] {
  const similar = allCases
    .filter(c =>
      c.order.id !== order.id &&
      c.flagged &&
      (c.order.agentCode === order.agentCode ||
        c.order.companyCode === order.companyCode ||
        c.order.normalizedAddress === order.normalizedAddress)
    )
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5)
    .map(c => c.order.id);
  return similar;
}

// ── Main Score Pipeline ─────────────────────────────────────────
export function scoreOrders(
  orders: Order[],
  assumptions: FinancialAssumptions = DEFAULT_ASSUMPTIONS
): ScoredCase[] {
  // Companion orders are historical disconnect records — include them in the
  // pool for cross-referencing but don't score them as new orders
  const ordersToScore = orders.filter(o => !o._isCompanion);

  // First pass: build evidence for all orders (use full pool for matching)
  const casesWithEvidence = ordersToScore.map(order => {
    const evidence = buildEvidence(order, orders);
    const isRetention = order.channel === 'retention';
    const { score, band } = calculateRiskScore(evidence, isRetention);
    const financial = calculateFinancialImpact(order, band, assumptions);
    const identityResult = countIdentityMatches(order, orders);

    return {
      order,
      riskScore: score,
      riskBand: band,
      evidence,
      identityMatchCount: identityResult.matchCount,
      identityMatchConfidence: (
        identityResult.matchCount >= 3 ? 'high' :
        identityResult.matchCount >= 2 ? 'medium' :
        identityResult.matchCount >= 1 ? 'low' : 'none'
      ) as 'none' | 'low' | 'medium' | 'high',
      ...financial,
      recommendedAction: band === 'Critical' || band === 'High'
        ? 'Create fraud review case and hold commission pending analyst decision.'
        : band === 'Medium'
        ? 'Flag for secondary review before commission release.'
        : 'No action required.',
      analystSummary: '',
      similarCaseIds: [] as string[],
      flagged: band !== 'Low',
    } as ScoredCase;
  });

  // Second pass: find similar cases and generate summaries
  for (const c of casesWithEvidence) {
    c.similarCaseIds = findSimilarCases(c.order, casesWithEvidence);
    c.analystSummary = generateAnalystSummary(c.order, c.evidence, c.riskBand);
  }

  return casesWithEvidence;
}

// ── Score a Single Order Against Existing Pool ──────────────────
export function scoreOneOrder(
  order: Order,
  existingOrders: Order[],
  assumptions: FinancialAssumptions = DEFAULT_ASSUMPTIONS
): ScoredCase {
  // Combine into pool so the order is scored against existing data
  const allOrders = [...existingOrders, order];

  const evidence = buildEvidence(order, allOrders);
  const isRetention = order.channel === 'retention';
  const { score, band } = calculateRiskScore(evidence, isRetention);
  const financial = calculateFinancialImpact(order, band, assumptions);
  const identityResult = countIdentityMatches(order, allOrders);

  const scoredCase: ScoredCase = {
    order,
    riskScore: score,
    riskBand: band,
    evidence,
    identityMatchCount: identityResult.matchCount,
    identityMatchConfidence: (
      identityResult.matchCount >= 3 ? 'high' :
      identityResult.matchCount >= 2 ? 'medium' :
      identityResult.matchCount >= 1 ? 'low' : 'none'
    ) as 'none' | 'low' | 'medium' | 'high',
    ...financial,
    recommendedAction: band === 'Critical' || band === 'High'
      ? 'Create fraud review case and hold commission pending analyst decision.'
      : band === 'Medium'
      ? 'Flag for secondary review before commission release.'
      : 'No action required.',
    analystSummary: '',
    similarCaseIds: [],
    flagged: band !== 'Low',
  };

  scoredCase.analystSummary = generateAnalystSummary(order, evidence, band);

  return scoredCase;
}

// ── Validation Metrics ──────────────────────────────────────────
export function computeValidationMetrics(cases: ScoredCase[]) {
  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (const c of cases) {
    const predicted = c.flagged;
    const actual = c.order._isFraud;

    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && !actual) tn++;
    else if (!predicted && actual) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  return {
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    totalCases: cases.length,
    flaggedCount: cases.filter(c => c.flagged).length,
    actualFraudCount: cases.filter(c => c.order._isFraud).length,
  };
}
