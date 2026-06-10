import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../middleware';
import { dbOrderToEngineOrder, enrichWithDisconnectData } from '@/lib/engine/pipeline';
import { scoreComposite } from '@/lib/ml/composite-scorer';
import { scoreOneOrder, DEFAULT_ASSUMPTIONS } from '@/lib/engine/scorer';

/**
 * POST /api/v1/ai/ml-score — Get full ML scoring breakdown for a case
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

  // Build enriched pool
  const allOrders = await db.select().from(orders).limit(100000);
  const rawPool = allOrders.map(dbOrderToEngineOrder);
  const enginePool = enrichWithDisconnectData(rawPool);

  // Get the enriched target order
  const engineOrder = enginePool.find(o => o.id === (order.externalId || order.id)) || dbOrderToEngineOrder(order);

  // Run rule engine to get its score and evidence
  const ruleResult = scoreOneOrder(engineOrder, enginePool, DEFAULT_ASSUMPTIONS);

  // Run composite ML scorer
  const composite = scoreComposite(
    engineOrder,
    enginePool,
    ruleResult.riskScore,
    ruleResult.evidence,
    null, // No GBDT model trained yet
  );

  return NextResponse.json({
    composite,
    ruleEngineScore: ruleResult.riskScore,
    ruleEvidence: ruleResult.evidence,
  });
}, 'analyst');
