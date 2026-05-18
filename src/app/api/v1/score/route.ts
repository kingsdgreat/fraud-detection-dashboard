import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../middleware';
import { scoreOneOrder, DEFAULT_ASSUMPTIONS } from '@/lib/engine/scorer';
import type { Order, Channel } from '@/lib/types';

/**
 * POST /api/v1/score/single — Score a single order against the order pool
 *
 * This endpoint reuses the same scoring engine from the demo,
 * but pulls the comparison pool from the real database instead of synthetic data.
 *
 * Body: { orderId: string } — score an existing order
 *   OR
 * Body: { order: Order } — score an ad-hoc test order (must match full Order schema)
 */
export const POST = withAuth(async (req, user) => {
  const body = await req.json();

  // If scoring an existing order by ID
  if (body.orderId) {
    const db = getDb();

    // Get the target order
    const [targetOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, body.orderId))
      .limit(1);

    if (!targetOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get the comparison pool (same region, last 12 months)
    // TODO: optimize with proper date windowing and indexed queries
    const pool = await db
      .select()
      .from(orders)
      .where(eq(orders.region, targetOrder.region || ''))
      .limit(50000);

    // Convert DB orders to engine Order format
    const enginePool = pool.map(dbOrderToEngineOrder);
    const engineTarget = dbOrderToEngineOrder(targetOrder);

    const result = scoreOneOrder(engineTarget, enginePool, DEFAULT_ASSUMPTIONS);
    return NextResponse.json(result);
  }

  // If scoring an ad-hoc test order (must already be in full engine Order format)
  // Optionally accepts companionOrders[] to simulate prior accounts in the scoring pool
  if (body.order) {
    const pool: Order[] = Array.isArray(body.companionOrders) ? body.companionOrders : [];
    const result = scoreOneOrder(body.order as Order, pool, DEFAULT_ASSUMPTIONS);
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: 'Provide either orderId or order in request body' },
    { status: 400 }
  );
}, 'analyst');

/**
 * Map a DB channel string to the engine's Channel enum value.
 * Falls back to 'internal_online' if unknown.
 */
function mapChannel(channel: string | null): Channel {
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
 *
 * The engine Order type has many fields that don't exist in the DB
 * (normalizedName, normalizedAddress, identitySignals, commission, etc.)
 * We synthesize them from available DB columns.
 */
function dbOrderToEngineOrder(dbOrder: any): Order {
  const name = dbOrder.customerName || '';
  const address = dbOrder.address || '';
  const dateStr = dbOrder.orderDate instanceof Date
    ? dbOrder.orderDate.toISOString().split('T')[0]
    : String(dbOrder.orderDate);

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
    companyCode: '',
    companyName: '',
    accountNumber: dbOrder.accountNumber || '',
    priorAccountNumber: undefined,
    disconnectDate: undefined,
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
    commissionAmount: 0,
    monthlyRecurring: 0,
    _isFraud: false, // Unknown for real data
  };
}
