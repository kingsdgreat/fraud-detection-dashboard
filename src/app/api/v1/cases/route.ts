import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders, users } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, count, sql, ilike } from 'drizzle-orm';
import { withAuth, parsePagination, paginatedResponse } from '../middleware';

/**
 * GET /api/v1/cases — List cases with filters and pagination
 *
 * Query params:
 *   status — filter by case status
 *   riskBand — filter by risk band
 *   assignedTo — filter by assigned analyst UUID
 *   search — search by case number or customer name
 *   dateFrom / dateTo — date range filter
 *   page / pageSize — pagination
 *   sortBy — field to sort by (default: createdAt)
 *   sortDir — asc or desc (default: desc)
 */
export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const { page, pageSize, offset } = parsePagination(url);

  const db = getDb();

  // Build filter conditions
  const conditions = [];

  const status = url.searchParams.get('status');
  if (status) conditions.push(eq(cases.status, status as any));

  const riskBand = url.searchParams.get('riskBand');
  if (riskBand) conditions.push(eq(cases.riskBand, riskBand as any));

  const assignedTo = url.searchParams.get('assignedTo');
  if (assignedTo) conditions.push(eq(cases.assignedTo, assignedTo));

  const dateFrom = url.searchParams.get('dateFrom');
  if (dateFrom) conditions.push(gte(cases.createdAt, new Date(dateFrom)));

  const dateTo = url.searchParams.get('dateTo');
  if (dateTo) conditions.push(lte(cases.createdAt, new Date(dateTo)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(cases)
    .where(where);

  // Get paginated results with joined order and assignee data
  const results = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      riskScore: cases.riskScore,
      riskBand: cases.riskBand,
      status: cases.status,
      priority: cases.priority,
      resolution: cases.resolution,
      slaDueAt: cases.slaDueAt,
      createdAt: cases.createdAt,
      // Order fields
      customerName: orders.customerName,
      orderDate: orders.orderDate,
      orderType: orders.orderType,
      address: orders.address,
      city: orders.city,
      state: orders.state,
      region: orders.region,
      channel: orders.channel,
      // Assignee fields
      assigneeName: users.name,
      assigneeEmail: users.email,
    })
    .from(cases)
    .innerJoin(orders, eq(cases.orderId, orders.id))
    .leftJoin(users, eq(cases.assignedTo, users.id))
    .where(where)
    .orderBy(desc(cases.createdAt))
    .limit(pageSize)
    .offset(offset);

  return paginatedResponse(results, total, page, pageSize);
});
