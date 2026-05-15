import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { orders, ingestionBatches } from '@/lib/db/schema';
import { eq, desc, count, and, gte, lte } from 'drizzle-orm';
import { withAuth, parsePagination, paginatedResponse } from '../middleware';
import { z } from 'zod';

/**
 * GET /api/v1/orders — List orders with filters and pagination
 */
export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const { page, pageSize, offset } = parsePagination(url);

  const db = getDb();

  const conditions = [];

  const orderType = url.searchParams.get('orderType');
  if (orderType) conditions.push(eq(orders.orderType, orderType as any));

  const region = url.searchParams.get('region');
  if (region) conditions.push(eq(orders.region, region));

  const dateFrom = url.searchParams.get('dateFrom');
  if (dateFrom) conditions.push(gte(orders.orderDate, new Date(dateFrom)));

  const dateTo = url.searchParams.get('dateTo');
  if (dateTo) conditions.push(lte(orders.orderDate, new Date(dateTo)));

  const batchId = url.searchParams.get('batchId');
  if (batchId) conditions.push(eq(orders.batchId, batchId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);

  const results = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.orderDate))
    .limit(pageSize)
    .offset(offset);

  return paginatedResponse(results, total, page, pageSize);
});

// Zod schema for order ingestion validation
const OrderIngestionSchema = z.object({
  externalId: z.string().min(1),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderType: z.enum(['connect', 'disconnect', 'transfer']),
  customerName: z.string().min(1),
  address: z.string().min(1),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(10).optional(),
  phoneHash: z.string().optional(),
  emailHash: z.string().optional(),
  paymentMethodHash: z.string().optional(),
  ssnLast4Hash: z.string().optional(),
  equipmentId: z.string().optional(),
  channel: z.string().optional(),
  agentId: z.string().optional(),
  region: z.string().optional(),
  promoCode: z.string().optional(),
  accountNumber: z.string().optional(),
  disconnectReason: z.string().optional(),
  delinquentBalance: z.number().optional(),
});

const BatchIngestionSchema = z.object({
  orders: z.array(OrderIngestionSchema).min(1).max(10000),
});

/**
 * POST /api/v1/orders/batch — Ingest a batch of orders via JSON API
 * Body: { orders: Order[] }
 */
export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = BatchIngestionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = getDb();

  // Create ingestion batch record
  const [batch] = await db
    .insert(ingestionBatches)
    .values({
      source: 'api',
      uploadedBy: user.id,
      totalRecords: parsed.data.orders.length,
      status: 'processing',
      startedAt: new Date(),
    })
    .returning();

  let processedCount = 0;
  let failedCount = 0;
  const errors: Array<{ index: number; externalId: string; error: string }> = [];

  // Insert orders (skip duplicates by externalId)
  for (let i = 0; i < parsed.data.orders.length; i++) {
    const orderData = parsed.data.orders[i];
    try {
      await db.insert(orders).values({
        externalId: orderData.externalId,
        orderDate: new Date(orderData.orderDate),
        orderType: orderData.orderType,
        customerName: orderData.customerName,
        address: orderData.address,
        city: orderData.city,
        state: orderData.state,
        zip: orderData.zip,
        phoneHash: orderData.phoneHash,
        emailHash: orderData.emailHash,
        paymentMethodHash: orderData.paymentMethodHash,
        ssnLast4Hash: orderData.ssnLast4Hash,
        equipmentId: orderData.equipmentId,
        channel: orderData.channel,
        agentId: orderData.agentId,
        region: orderData.region,
        promoCode: orderData.promoCode,
        accountNumber: orderData.accountNumber,
        disconnectReason: orderData.disconnectReason,
        delinquentBalance: orderData.delinquentBalance?.toString(),
        batchId: batch.id,
      });
      processedCount++;
    } catch (err: any) {
      failedCount++;
      errors.push({
        index: i,
        externalId: orderData.externalId,
        error: err.message?.includes('unique') ? 'Duplicate externalId' : err.message,
      });
    }
  }

  // Update batch status
  await db
    .update(ingestionBatches)
    .set({
      processedRecords: processedCount,
      failedRecords: failedCount,
      status: failedCount === parsed.data.orders.length ? 'failed' : 'completed',
      errorLog: errors.length > 0 ? errors : null,
      completedAt: new Date(),
    })
    .where(eq(ingestionBatches.id, batch.id));

  // TODO: Trigger async scoring job via Inngest here
  // await inngest.send({ name: 'scoring/batch', data: { batchId: batch.id } });

  return NextResponse.json(
    {
      batchId: batch.id,
      totalRecords: parsed.data.orders.length,
      processed: processedCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    },
    { status: 201 }
  );
}, 'analyst');
