import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders } from '@/lib/db/schema';
import { eq, count, sql, and, gte, isNull } from 'drizzle-orm';
import { withAuth } from '../middleware';

/**
 * GET /api/v1/dashboard — Dashboard summary KPIs
 *
 * Returns: open cases, risk band breakdown, resolution stats, SLA health
 */
export const GET = withAuth(async (req) => {
  const db = getDb();

  // Total cases by status
  const statusCounts = await db
    .select({
      status: cases.status,
      count: count(),
    })
    .from(cases)
    .groupBy(cases.status);

  // Cases by risk band
  const riskBandCounts = await db
    .select({
      riskBand: cases.riskBand,
      count: count(),
    })
    .from(cases)
    .groupBy(cases.riskBand);

  // Resolution breakdown (for resolved cases)
  const resolutionCounts = await db
    .select({
      resolution: cases.resolution,
      count: count(),
    })
    .from(cases)
    .where(eq(cases.status, 'resolved'))
    .groupBy(cases.resolution);

  // SLA health: overdue cases (slaDueAt < now and not resolved)
  const [{ overdue }] = await db
    .select({ overdue: count() })
    .from(cases)
    .where(
      and(
        sql`${cases.slaDueAt} < NOW()`,
        sql`${cases.status} NOT IN ('resolved', 'dismissed')`
      )
    );

  // Unassigned open cases
  const [{ unassigned }] = await db
    .select({ unassigned: count() })
    .from(cases)
    .where(
      and(
        eq(cases.status, 'open'),
        isNull(cases.assignedTo)
      )
    );

  // Average risk score
  const [{ avgScore }] = await db
    .select({ avgScore: sql<number>`ROUND(AVG(${cases.riskScore}))` })
    .from(cases);

  // Total orders ingested
  const [{ totalOrders }] = await db
    .select({ totalOrders: count() })
    .from(orders);

  return NextResponse.json({
    totalOrders,
    totalCases: statusCounts.reduce((sum, s) => sum + s.count, 0),
    averageRiskScore: avgScore || 0,
    slaOverdue: overdue,
    unassignedOpen: unassigned,
    byStatus: Object.fromEntries(statusCounts.map(s => [s.status, s.count])),
    byRiskBand: Object.fromEntries(riskBandCounts.map(r => [r.riskBand, r.count])),
    byResolution: Object.fromEntries(resolutionCounts.map(r => [r.resolution, r.count])),
  });
});
