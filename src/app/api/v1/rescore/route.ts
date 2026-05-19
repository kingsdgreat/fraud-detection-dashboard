import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { orders, cases } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '../middleware';
import { scoreOneOrder, DEFAULT_ASSUMPTIONS } from '@/lib/engine/scorer';
import { dbOrderToEngineOrder, enrichWithDisconnectData } from '@/lib/engine/pipeline';

/**
 * POST /api/v1/rescore — Delete all existing cases and re-score all orders
 *
 * Useful when the scoring pipeline has been updated and you want to
 * regenerate all cases with the new logic.
 */
export const POST = withAuth(async (req, user) => {
  const db = getDb();

  // 1. Delete all existing cases
  const deleted = await db.delete(cases).returning({ id: cases.id });

  // 2. Get all orders
  const allOrders = await db.select().from(orders).limit(100000);

  // 3. Build enriched pool
  const rawPool = allOrders.map(dbOrderToEngineOrder);
  const enginePool = enrichWithDisconnectData(rawPool);

  // 4. Score each connect order
  const connectOrders = allOrders.filter(o => o.orderType === 'connect');
  let casesCreated = 0;
  const errors: string[] = [];

  for (const dbOrder of connectOrders) {
    try {
      const enrichedOrder = enginePool.find(o => o.id === (dbOrder.externalId || dbOrder.id));
      const engineOrder = enrichedOrder || dbOrderToEngineOrder(dbOrder);
      const scored = scoreOneOrder(engineOrder, enginePool, DEFAULT_ASSUMPTIONS);

      const now = new Date();
      const slaDueAt = scored.riskScore >= 60
        ? new Date(now.getTime() + 48 * 60 * 60 * 1000)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const priority = scored.riskScore >= 80 ? 'urgent' as const
        : scored.riskScore >= 60 ? 'high' as const
        : scored.riskScore >= 35 ? 'normal' as const
        : 'low' as const;

      await db.insert(cases).values({
        orderId: dbOrder.id,
        riskScore: scored.riskScore,
        riskBand: scored.riskBand.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
        evidence: scored.evidence,
        identitySignals: engineOrder.identitySignals,
        financialImpact: {
          commissionAtRisk: scored.commissionAtRisk,
          mrrLoss: scored.mrrLoss,
          annualizedExposure: scored.annualizedExposure,
        },
        status: 'open',
        priority,
        slaDueAt,
      });
      casesCreated++;
    } catch (err: any) {
      errors.push(`Order ${dbOrder.externalId || dbOrder.id}: ${err.message}`);
    }
  }

  return NextResponse.json({
    deletedCases: deleted.length,
    totalOrders: allOrders.length,
    connectOrders: connectOrders.length,
    casesCreated,
    errors: errors.slice(0, 20),
  });
}, 'admin');
