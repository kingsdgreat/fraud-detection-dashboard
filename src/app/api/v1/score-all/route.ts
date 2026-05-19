import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { orders, cases } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '../middleware';
import { scoreOneOrder, DEFAULT_ASSUMPTIONS } from '@/lib/engine/scorer';
import { dbOrderToEngineOrder, enrichWithDisconnectData } from '@/lib/engine/pipeline';

/**
 * POST /api/v1/score-all — Score all unscored orders and create cases
 *
 * Finds orders that don't have a corresponding case yet,
 * scores them, and creates cases. Useful for backfilling
 * orders that were uploaded before the scoring pipeline was wired up.
 */
export const POST = withAuth(async (req, user) => {
  const db = getDb();

  // Find all orders that don't have cases yet
  const unscoredOrders = await db
    .select({ order: orders })
    .from(orders)
    .leftJoin(cases, eq(orders.id, cases.orderId))
    .where(sql`${cases.id} IS NULL`);

  if (unscoredOrders.length === 0) {
    return NextResponse.json({
      message: 'All orders already have cases',
      casesCreated: 0,
    });
  }

  // Build the full comparison pool with disconnect data enrichment
  const allOrders = await db.select().from(orders).limit(100000);
  const rawPool = allOrders.map(dbOrderToEngineOrder);
  const enginePool = enrichWithDisconnectData(rawPool);

  // Score each unscored connect order
  const connectOrders = unscoredOrders.filter(r => r.order.orderType === 'connect');
  let casesCreated = 0;
  const errors: string[] = [];

  for (const row of connectOrders) {
    try {
      // Use enriched version from pool (has daysSinceDisconnect)
      const enrichedOrder = enginePool.find(o => o.id === (row.order.externalId || row.order.id));
      const engineOrder = enrichedOrder || dbOrderToEngineOrder(row.order);
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
        orderId: row.order.id,
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
      const isDuplicate = err.message?.includes('unique') || err.message?.includes('duplicate');
      if (!isDuplicate) {
        errors.push(`Order ${row.order.externalId || row.order.id}: ${err.message}`);
      }
    }
  }

  return NextResponse.json({
    totalUnscored: unscoredOrders.length,
    connectOrders: connectOrders.length,
    casesCreated,
    errors: errors.slice(0, 20),
  });
}, 'admin');
