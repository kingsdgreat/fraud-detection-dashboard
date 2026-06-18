'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { RiskBadge, Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ScoredCase } from '@/lib/types';
import { useData } from '@/lib/data-context';
import {
  formatCurrency, formatDate, evidenceTypeLabel, channelLabel,
  archetypeLabel, formatPercent,
} from '@/lib/utils';
import {
  Clock, MapPin, User, Shield, DollarSign, Link2, AlertTriangle,
  ArrowLeft, ArrowRight, Fingerprint, Package, CreditCard, Mail, Phone, Hash,
  Calendar,
} from 'lucide-react';

// ── Timeline ────────────────────────────────────────────────────
function Timeline({ scoredCase }: { scoredCase: ScoredCase }) {
  const order = scoredCase.order;
  const events: { date: string; label: string; detail: string; color: string }[] = [];

  if (order.disconnectDate) {
    events.push({
      date: order.disconnectDate,
      label: 'Disconnect',
      detail: `Reason: ${order.disconnectReason || 'Unknown'}${order.delinquentBalance ? ` | Balance: ${formatCurrency(order.delinquentBalance)}` : ''}`,
      color: 'bg-gray-400',
    });
  }

  events.push({
    date: order.orderDate,
    label: 'New Order',
    detail: `${channelLabel(order.channel)} via ${order.agentCode}${order.daysSinceDisconnect !== undefined ? ` (${order.daysSinceDisconnect} days after disconnect)` : ''}`,
    color: scoredCase.riskBand === 'Critical' ? 'bg-red-500' : scoredCase.riskBand === 'High' ? 'bg-orange-500' : 'bg-blue-500',
  });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${event.color} mt-1`} />
                {idx < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-4">
                <p className="text-sm font-semibold text-gray-900">{event.label}</p>
                <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                <p className="text-xs text-gray-600 mt-0.5">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Keys to hide from evidence detail grids (shown in Prior Account Comparison instead)
const HIDDEN_EVIDENCE_KEYS = new Set([
  'closestDisconnectName', 'closestDisconnectAddress', 'closestDisconnectCity',
  'closestDisconnectState', 'closestDisconnectZip', 'closestDisconnectAccountNumber',
  'closestDisconnectReason', 'closestDisconnectOrderId',
  'priorAccountName', 'priorAccountAddress', 'priorAccountCity',
  'priorAccountState', 'priorAccountZip', 'priorAccountNumber',
  'priorDisconnectDate', 'priorDisconnectReason', 'priorOrderId',
]);

// ── Prior Account Comparison ───────────────────────────────────
function PriorAccountComparison({ scoredCase }: { scoredCase: ScoredCase }) {
  const order = scoredCase.order;
  const addrEvidence = scoredCase.evidence.find(e => e.type === 'address_disconnect_reuse');
  const payEvidence = scoredCase.evidence.find(e => e.type === 'payment_method_reuse');
  const phoneEvidence = scoredCase.evidence.find(e => e.type === 'phone_reuse');

  const priorName = (addrEvidence?.details.closestDisconnectName || payEvidence?.details.priorAccountName || phoneEvidence?.details.priorAccountName) as string | undefined;
  const priorAddress = (addrEvidence?.details.closestDisconnectAddress || payEvidence?.details.priorAccountAddress || phoneEvidence?.details.priorAccountAddress) as string | undefined;
  const priorCity = (addrEvidence?.details.closestDisconnectCity || payEvidence?.details.priorAccountCity || phoneEvidence?.details.priorAccountCity) as string | undefined;
  const priorState = (addrEvidence?.details.closestDisconnectState || payEvidence?.details.priorAccountState || phoneEvidence?.details.priorAccountState) as string | undefined;
  const priorZip = (addrEvidence?.details.closestDisconnectZip || payEvidence?.details.priorAccountZip || phoneEvidence?.details.priorAccountZip) as string | undefined;
  const priorAcctNum = (addrEvidence?.details.closestDisconnectAccountNumber || payEvidence?.details.priorAccountNumber || phoneEvidence?.details.priorAccountNumber) as string | undefined;
  const priorDisconnectDate = (addrEvidence?.details.closestDisconnectDate || payEvidence?.details.priorDisconnectDate || phoneEvidence?.details.priorDisconnectDate) as string | undefined;
  const priorDisconnectReason = (addrEvidence?.details.closestDisconnectReason || payEvidence?.details.priorDisconnectReason) as string | undefined;
  const nameChanged = (addrEvidence?.details.nameChanged as boolean) || false;

  if (!priorName) return null;

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-red-600" />
          Prior Account Comparison
        </CardTitle>
        <CardDescription className="text-xs">
          Disconnected account linked to this new order by address, payment method, or phone
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          {/* Prior Account */}
          <div className="bg-white rounded-lg border border-red-200 p-3 space-y-2">
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Disconnected Account</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className={`text-sm font-semibold ${nameChanged ? 'text-red-700' : 'text-gray-900'}`}>{priorName}</span>
              </div>
              {priorAddress && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-700">{priorAddress}{priorCity ? `, ${priorCity}` : ''}{priorState ? `, ${priorState}` : ''} {priorZip || ''}</span>
                </div>
              )}
              {priorAcctNum && (
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-gray-600">{priorAcctNum}</span>
                </div>
              )}
              {priorDisconnectDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600">Disconnected {formatDate(priorDisconnectDate)}{priorDisconnectReason ? ` (${priorDisconnectReason})` : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center pt-8">
            <ArrowRight className="h-5 w-5 text-red-400" />
          </div>

          {/* New Order */}
          <div className="bg-white rounded-lg border border-orange-200 p-3 space-y-2">
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">New Order</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className={`text-sm font-semibold ${nameChanged ? 'text-orange-700' : 'text-gray-900'}`}>{order.customerName}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-700">{order.address}, {order.city}, {order.state} {order.zip}</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-xs font-mono text-gray-600">{order.accountNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600">Ordered {formatDate(order.orderDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {nameChanged && (
          <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-800">
              <span className="font-semibold">Different name at the same address.</span> The prior account under &ldquo;{priorName}&rdquo; was disconnected, and this new order under &ldquo;{order.customerName}&rdquo; shares the same payment method and/or phone number.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Evidence Panel ──────────────────────────────────────────────
function EvidencePanel({ scoredCase }: { scoredCase: ScoredCase }) {
  const sorted = [...scoredCase.evidence].sort((a, b) => b.confidence * b.weight - a.confidence * a.weight);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Evidence ({scoredCase.evidence.length} signals)</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500">No suspicious evidence detected.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((e, idx) => {
              const visibleDetails = Object.entries(e.details).filter(([key]) => !HIDDEN_EVIDENCE_KEYS.has(key));
              return (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{evidenceTypeLabel(e.type)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Confidence: {Math.round(e.confidence * 100)}%</span>
                      <span className="text-xs text-gray-500">Weight: {Math.round(e.weight * 100)}%</span>
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                    <div
                      className={`h-full rounded-full ${e.confidence >= 0.8 ? 'bg-red-500' : e.confidence >= 0.6 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                      style={{ width: `${e.confidence * 100}%` }}
                    />
                  </div>
                  {/* Details */}
                  <div className="grid grid-cols-2 gap-1">
                    {visibleDetails.map(([key, value]) => (
                      <div key={key} className="text-xs overflow-hidden">
                        <span className="text-gray-500">{key}: </span>
                        <span className="text-gray-700 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Identity Resolution Panel ───────────────────────────────────
function IdentityPanel({ scoredCase }: { scoredCase: ScoredCase }) {
  const signals = scoredCase.order.identitySignals;

  // Derive matched signals from ALL evidence types
  const matchedSignals = new Set<string>();
  const matchSources = new Map<string, string>();

  const identityEvidence = scoredCase.evidence.find(e => e.type === 'identity_match');
  if (identityEvidence) {
    for (const s of (identityEvidence.details.matchedSignals as string[]) || []) {
      matchedSignals.add(s);
      matchSources.set(s, 'Identity Match');
    }
  }
  if (scoredCase.evidence.find(e => e.type === 'payment_method_reuse')) {
    matchedSignals.add('paymentMethodHash');
    if (!matchSources.has('paymentMethodHash')) matchSources.set('paymentMethodHash', 'Payment Reuse');
  }
  if (scoredCase.evidence.find(e => e.type === 'phone_reuse')) {
    matchedSignals.add('phoneHash');
    if (!matchSources.has('phoneHash')) matchSources.set('phoneHash', 'Phone Reuse');
  }

  const effectiveCount = matchedSignals.size;
  const confidenceLabel = effectiveCount >= 3 ? 'high' : effectiveCount >= 2 ? 'medium' : effectiveCount >= 1 ? 'low' : 'none';

  const signalEntries = [
    { icon: <Phone className="h-3 w-3" />, label: 'Phone', key: 'phoneHash', value: signals.phoneHash || '—' },
    { icon: <Mail className="h-3 w-3" />, label: 'Email', key: 'emailHash', value: signals.emailHash || '—' },
    { icon: <CreditCard className="h-3 w-3" />, label: 'Payment', key: 'paymentMethodHash', value: signals.paymentMethodHash || '—' },
    { icon: <Package className="h-3 w-3" />, label: 'Equipment', key: 'equipmentSerialHistory', value: signals.equipmentSerialHistory?.join(', ') || '—' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4" /> Identity Resolution
        </CardTitle>
        <CardDescription>
          {effectiveCount} of 5 signals matched —
          <Badge variant={confidenceLabel === 'high' ? 'critical' : confidenceLabel === 'medium' ? 'medium' : confidenceLabel === 'low' ? 'low' : 'outline'} className="ml-1">
            {confidenceLabel} confidence
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {signalEntries.map((s, idx) => {
            const matched = matchedSignals.has(s.key);
            const source = matchSources.get(s.key);
            return (
              <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${matched ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                <div className={matched ? 'text-red-600' : 'text-gray-400'}>{s.icon}</div>
                <span className="w-20 text-gray-600 font-medium">{s.label}</span>
                <span className="font-mono text-xs text-gray-500 flex-1 truncate">{s.value}</span>
                {matched && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="critical">Match</Badge>
                    {source && <span className="text-[10px] text-red-500">{source}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Financial Panel ─────────────────────────────────────────────
function FinancialPanel({ scoredCase }: { scoredCase: ScoredCase }) {
  const { assumptions } = useData();
  const order = scoredCase.order;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financial Impact</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Commission at Risk</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(scoredCase.commissionAtRisk)}</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">MRR Loss</p>
              <p className="text-xl font-bold text-orange-700">{formatCurrency(scoredCase.mrrLoss)}/mo</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Annualized Exposure</p>
              <p className="text-xl font-bold text-purple-700">{formatCurrency(scoredCase.annualizedExposure)}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Methodology</p>
            <div className="space-y-1 text-xs text-gray-500 font-mono bg-gray-50 p-3 rounded-lg">
              <p>Commission at risk = {formatCurrency(order.commissionAmount)} × (1 - {formatPercent(assumptions.recoveryProbability)}) = {formatCurrency(scoredCase.commissionAtRisk)}</p>
              <p>MRR loss = ({formatCurrency(order.priorBillAmount || assumptions.avgMonthlyBill)} - {formatCurrency(order.newPromoBillAmount || assumptions.avgPromoBill)}) × {formatPercent(assumptions.recoveryProbability)} = {formatCurrency(scoredCase.mrrLoss)}</p>
              <p>Annualized = {formatCurrency(scoredCase.mrrLoss)} × {assumptions.annualizationMonths} = {formatCurrency(scoredCase.annualizedExposure)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Similar Cases ───────────────────────────────────────────────
function SimilarCases({ scoredCase }: { scoredCase: ScoredCase }) {
  const { getCaseById } = useData();
  const similar = scoredCase.similarCaseIds.map(id => getCaseById(id)).filter(Boolean) as ScoredCase[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Similar Cases ({similar.length})</CardTitle>
        <CardDescription>Cases sharing the same agent, company, or address</CardDescription>
      </CardHeader>
      <CardContent>
        {similar.length === 0 ? (
          <p className="text-sm text-gray-500">No similar cases found.</p>
        ) : (
          <div className="space-y-2">
            {similar.map(c => (
              <Link
                key={c.order.id}
                href={`/cases/${c.order.id}`}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RiskBadge band={c.riskBand} />
                  <span className="text-sm font-medium">{c.order.id}</span>
                  <span className="text-xs text-gray-500">{c.order.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{c.order.agentCode}</span>
                  <span className="text-xs text-gray-500">Score: {c.riskScore}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Case Detail View ───────────────────────────────────────
export function CaseDetailView({ caseId }: { caseId: string }) {
  const { getCaseById } = useData();
  const scoredCase = getCaseById(caseId);

  if (!scoredCase) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Case not found: {caseId}</p>
        <Link href="/queue" className="text-blue-600 hover:text-blue-800 text-sm mt-2 block">
          Back to Review Queue
        </Link>
      </div>
    );
  }

  const order = scoredCase.order;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/queue" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back to Queue
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.id}</h1>
            <RiskBadge band={scoredCase.riskBand} />
            <span className="text-sm text-gray-500">Score: {scoredCase.riskScore}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{order.customerName} · {order.address}, {order.city}, {order.state} {order.zip}</p>
        </div>
        <div className="text-right">
          {order._archetype && (
            <Badge variant="outline" className="mb-1">{archetypeLabel(order._archetype)}</Badge>
          )}
          <p className="text-xs text-gray-500 mt-1">{formatDate(order.orderDate)}</p>
        </div>
      </div>

      {/* Analyst Summary */}
      <Card className="border-l-4 border-l-orange-400">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Analyst Summary</p>
              <p className="text-sm text-gray-700">{scoredCase.analystSummary}</p>
              <p className="text-xs text-gray-500 mt-2">Recommended: {scoredCase.recommendedAction}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Sections */}
      <Tabs defaultValue="evidence">
        <TabsList>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="similar">Similar Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="evidence">
          <div className="space-y-4">
            <PriorAccountComparison scoredCase={scoredCase} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Timeline scoredCase={scoredCase} />
              <EvidencePanel scoredCase={scoredCase} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="identity">
          <IdentityPanel scoredCase={scoredCase} />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialPanel scoredCase={scoredCase} />
        </TabsContent>

        <TabsContent value="similar">
          <SimilarCases scoredCase={scoredCase} />
        </TabsContent>
      </Tabs>

      {/* Order Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Account</p>
              <p className="font-mono">{order.accountNumber}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Prior Account</p>
              <p className="font-mono">{order.priorAccountNumber || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Channel</p>
              <p>{channelLabel(order.channel)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Region</p>
              <p>{order.region}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Promo</p>
              <p>{order.promoName || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Commission</p>
              <p className="font-medium">{formatCurrency(order.commissionAmount)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Prior Bill</p>
              <p>{order.priorBillAmount ? formatCurrency(order.priorBillAmount) : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">New Bill</p>
              <p>{order.newPromoBillAmount ? formatCurrency(order.newPromoBillAmount) : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
