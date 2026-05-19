import { getDb } from '@/lib/db';
import { orders, cases } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { scoreOneOrder, DEFAULT_ASSUMPTIONS } from './scorer';
import type { Order, ScoredCase, Channel, RiskBand } from '../types';

/**
 * Map a DB channel string to the engine's Channel enum value.
 */
export function mapChannel(channel: string | null): Channel {
  const validChannels: Channel[] = [
    'third_party_door_to_door',
    'third_party_retail',
    'third_party_telemarketing',
    'internal_online',
    'internal_call_center',
    'retention',
  ];
  if (channel && validChannels.includes(channel as Channel)) {
    return channel as Channel;
  }
  return 'internal_online';
}

/**
 * Convert a database order row to the engine's Order type.
 */
export function dbOrderToEngineOrder(dbOrder: any): Order {
  const name = dbOrder.customerName || '';
  const address = dbOrder.address || '';
  const dateStr = dbOrder.orderDate instanceof Date
    ? dbOrder.orderDate.toISOString().split('T')[0]
    : String(dbOrder.orderDate);

  // For disconnect orders, their orderDate IS the disconnect date
  const isDisconnect = dbOrder.orderType === 'disconnect';
  const disconnectDate = isDisconnect ? dateStr : undefined;

  return {
    id: dbOrder.externalId || dbOrder.id,
    orderDate: dateStr,
    customerName: name,
    normalizedName: name.toUpperCase().trim(),
    address: address,
    normalizedAddress: address.toUpperCase().trim(),
    city: dbOrder.city || '',
    state: dbOrder.state || '',
    zip: dbOrder.zip || '',
    region: dbOrder.region || '',
    channel: mapChannel(dbOrder.channel),
    agentCode: dbOrder.agentId || '',
    companyCode: dbOrder.agentId || '',  // Use agentId as company grouping for agent cluster detection
    companyName: '',
    accountNumber: dbOrder.accountNumber || '',
    priorAccountNumber: undefined,
    disconnectDate,
    disconnectReason: dbOrder.disconnectReason || undefined,
    delinquentBalance: dbOrder.delinquentBalance
      ? parseFloat(dbOrder.delinquentBalance)
      : undefined,
    identitySignals: {
      phoneHash: dbOrder.phoneHash || undefined,
      emailHash: dbOrder.emailHash || undefined,
      paymentMethodHash: dbOrder.paymentMethodHash || undefined,
      ssnLast4Hash: dbOrder.ssnLast4Hash || undefined,
      equipmentSerialHistory: dbOrder.equipmentId ? [dbOrder.equipmentId] : undefined,
    },
    commissionAmount: 150,    // Default commission for risk calculation
    monthlyRecurring: 89.99,  // Default MRR for financial impact
    _isFraud: false,
  };
}

/**
 * Enrich connect orders with daysSinceDisconnect by finding
 * prior disconnects at the same normalized address.
 */
export function enrichWithDisconnectData(engineOrders: Order[]): Order[] {
  // Build a map of normalized address → most recent disconnect date
  const disconnectsByAddress = new Map<string, { date: string; accountNumber: string }>();

  for (const order of engineOrders) {
    if (order.disconnectDate && order.normalizedAddress) {
      const existing = disconnectsByAddress.get(order.normalizedAddress);
      if (!existing || order.disconnectDate > existing.date) {
        disconnectsByAddress.set(order.normalizedAddress, {
          date: order.disconnectDate,
          accountNumber: order.accountNumber || '',
        });
      }
    }
  }

  // Enrich connect orders with daysSinceDisconnect
  return engineOrders.map(order => {
    if (order.disconnectDate) return order; // Skip disconnect orders

    const priorDisconnect = disconnectsByAddress.get(order.normalizedAddress);
    if (priorDisconnect) {
      const orderDate = new Date(order.orderDate);
      const discDate = new Date(priorDisconnect.date);
      const daysDiff = Math.floor((orderDate.getTime() - discDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 0 && daysDiff <= 365) {
        return {
          ...order,
          daysSinceDisconnect: daysDiff,
          priorAccountNumber: priorDisconnect.accountNumber || order.priorAccountNumber,
        };
      }
    }
    return order;
  });
}

/**
 * Map engine RiskBand (title-case) to DB enum (lowercase).
 */
function riskBandToDb(band: RiskBand): 'low' | 'medium' | 'high' | 'critical' {
  return band.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Map risk score to case priority.
 */
function scoreToPriority(score: number): 'low' | 'normal' | 'high' | 'urgent' {
  if (score >= 80) return 'urgent';
  if (score >= 60) return 'high';
  if (score >= 35) return 'normal';
  return 'low';
}

/**
 * Score a batch of newly-uploaded orders and create cases for them.
 *
 * This is the core pipeline that connects CSV ingestion to the case queue.
 * It fetches all orders in the batch, builds a comparison pool from all
 * orders in the DB, scores each "connect" order, and inserts cases.
 *
 * @param batchId - The ingestion batch ID to score
 * @returns Number of cases created
 */
export async function scoreBatch(batchId: string): Promise<{ casesCreated: number; errors: string[] }> {
  const db = getDb();
  const errors: string[] = [];

  // 1. Fetch all orders in this batch
  const batchOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.batchId, batchId));

  if (batchOrders.length === 0) {
    return { casesCreated: 0, errors: ['No orders found in batch'] };
  }

  // 2. Build the comparison pool: ALL orders in the DB (for cross-referencing)
  //    This includes both the new batch orders and historical ones
  const allOrders = await db
    .select()
    .from(orders)
    .limit(100000);

  const rawPool = allOrders.map(dbOrderToEngineOrder);
  const enginePool = enrichWithDisconnectData(rawPool);

  // 3. Score each "connect" order (disconnects are reference data, not cases)
  const connectOrders = batchOrders.filter(o => o.orderType === 'connect');
  let casesCreated = 0;

  for (const dbOrder of connectOrders) {
    try {
      // Use the enriched version from the pool (has daysSinceDisconnect computed)
      const enrichedOrder = enginePool.find(o => o.id === (dbOrder.externalId || dbOrder.id));
      const engineOrder = enrichedOrder || dbOrderToEngineOrder(dbOrder);
      const scored = scoreOneOrder(engineOrder, enginePool, DEFAULT_ASSUMPTIONS);

      // 4. Calculate SLA due date (48 hours from now for critical/high, 7 days for others)
      const now = new Date();
      const slaDueAt = scored.riskScore >= 60
        ? new Date(now.getTime() + 48 * 60 * 60 * 1000)  // 48 hours
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // 5. Insert case
      await db.insert(cases).values({
        orderId: dbOrder.id,
        riskScore: scored.riskScore,
        riskBand: riskBandToDb(scored.riskBand),
        evidence: scored.evidence,
        identitySignals: engineOrder.identitySignals,
        financialImpact: {
          commissionAtRisk: scored.commissionAtRisk,
          mrrLoss: scored.mrrLoss,
          annualizedExposure: scored.annualizedExposure,
        },
        status: 'open',
        priority: scoreToPriority(scored.riskScore),
        slaDueAt,
      });
      casesCreated++;
    } catch (err: any) {
      const isDuplicate = err.message?.includes('unique') || err.message?.includes('duplicate');
      if (isDuplicate) {
        // Order already has a case — skip silently
        continue;
      }
      errors.push(`Order ${dbOrder.externalId || dbOrder.id}: ${err.message}`);
    }
  }

  return { casesCreated, errors };
}
