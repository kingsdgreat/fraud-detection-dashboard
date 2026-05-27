import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../middleware';
import { dbOrderToEngineOrder, enrichWithDisconnectData } from '@/lib/engine/pipeline';
import { detectAnomalies } from '@/lib/ai/anomaly';

/**
 * POST /api/v1/ai/anomaly — Run anomaly detection on a specific case
 *
 * Body: { caseId: string }
 */
export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const { caseId } = body;

  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  const db = getDb();

  const [caseData] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);

  if (!caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, caseData.orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Build the comparison pool
  const allOrders = await db.select().from(orders).limit(100000);
  const rawPool = allOrders.map(dbOrderToEngineOrder);
  const enginePool = enrichWithDisconnectData(rawPool);

  const engineOrder = enginePool.find(o => o.id === (order.externalId || order.id)) || dbOrderToEngineOrder(order);

  const result = detectAnomalies(engineOrder, enginePool);

  return NextResponse.json(result);
}, 'analyst');
