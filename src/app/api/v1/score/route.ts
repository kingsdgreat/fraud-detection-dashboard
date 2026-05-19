import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../middleware';
import { scoreOneOrder, DEFAULT_ASSUMPTIONS } from '@/lib/engine/scorer';
import { dbOrderToEngineOrder, enrichWithDisconnectData } from '@/lib/engine/pipeline';
import type { Order } from '@/lib/types';

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

    // Convert DB orders to engine Order format with disconnect enrichment
    const rawPool = pool.map(dbOrderToEngineOrder);
    const enginePool = enrichWithDisconnectData(rawPool);
    const enrichedTarget = enginePool.find(o => o.id === (targetOrder.externalId || targetOrder.id));
    const engineTarget = enrichedTarget || dbOrderToEngineOrder(targetOrder);

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

// dbOrderToEngineOrder and mapChannel are imported from @/lib/engine/pipeline
