import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { orders, ingestionBatches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../middleware';
import { z } from 'zod';

// Expected CSV column headers (case-insensitive mapping)
const COLUMN_MAP: Record<string, string> = {
  'external_id': 'externalId',
  'externalid': 'externalId',
  'order_id': 'externalId',
  'orderid': 'externalId',
  'order_date': 'orderDate',
  'orderdate': 'orderDate',
  'date': 'orderDate',
  'order_type': 'orderType',
  'ordertype': 'orderType',
  'type': 'orderType',
  'customer_name': 'customerName',
  'customername': 'customerName',
  'name': 'customerName',
  'address': 'address',
  'service_address': 'address',
  'city': 'city',
  'state': 'state',
  'zip': 'zip',
  'zipcode': 'zip',
  'zip_code': 'zip',
  'phone_hash': 'phoneHash',
  'phonehash': 'phoneHash',
  'phone': 'phoneHash',
  'email_hash': 'emailHash',
  'emailhash': 'emailHash',
  'email': 'emailHash',
  'payment_method_hash': 'paymentMethodHash',
  'paymentmethodhash': 'paymentMethodHash',
  'payment_hash': 'paymentMethodHash',
  'ssn_last4_hash': 'ssnLast4Hash',
  'ssnlast4hash': 'ssnLast4Hash',
  'ssn_hash': 'ssnLast4Hash',
  'equipment_id': 'equipmentId',
  'equipmentid': 'equipmentId',
  'equipment': 'equipmentId',
  'channel': 'channel',
  'agent_id': 'agentId',
  'agentid': 'agentId',
  'agent': 'agentId',
  'region': 'region',
  'promo_code': 'promoCode',
  'promocode': 'promoCode',
  'promo': 'promoCode',
  'account_number': 'accountNumber',
  'accountnumber': 'accountNumber',
  'account': 'accountNumber',
  'disconnect_reason': 'disconnectReason',
  'disconnectreason': 'disconnectReason',
  'delinquent_balance': 'delinquentBalance',
  'delinquentbalance': 'delinquentBalance',
  'balance': 'delinquentBalance',
};

const RowSchema = z.object({
  externalId: z.string().min(1, 'external_id is required'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  orderType: z.enum(['connect', 'disconnect', 'transfer']),
  customerName: z.string().min(1, 'customer_name is required'),
  address: z.string().min(1, 'address is required'),
});

/**
 * POST /api/v1/orders/upload — Upload a CSV file of orders
 *
 * Expects multipart/form-data with a "file" field containing a CSV.
 */
export const POST = withAuth(async (req, user) => {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!file.name.endsWith('.csv')) {
    return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 });
  }

  // Read file content
  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
  const columnMapping: Record<number, string> = {};

  for (let i = 0; i < headers.length; i++) {
    const mapped = COLUMN_MAP[headers[i]];
    if (mapped) {
      columnMapping[i] = mapped;
    }
  }

  // Validate required columns exist
  const mappedFields = new Set(Object.values(columnMapping));
  const required = ['externalId', 'orderDate', 'orderType', 'customerName', 'address'];
  const missing = required.filter(r => !mappedFields.has(r));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}` },
      { status: 400 }
    );
  }

  const db = getDb();

  // Create batch record
  const [batch] = await db.insert(ingestionBatches).values({
    source: 'csv_upload',
    filename: file.name,
    uploadedBy: user.id,
    totalRecords: lines.length - 1,
    status: 'processing',
    startedAt: new Date(),
  }).returning();

  let processedCount = 0;
  let failedCount = 0;
  const errors: Array<{ row: number; error: string; data?: string }> = [];

  // Parse and insert each row
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      for (let j = 0; j < values.length; j++) {
        if (columnMapping[j]) {
          row[columnMapping[j]] = values[j].trim();
        }
      }

      // Validate required fields
      const validation = RowSchema.safeParse(row);
      if (!validation.success) {
        failedCount++;
        errors.push({
          row: i + 1,
          error: validation.error.issues.map((e: { message: string }) => e.message).join('; '),
          data: values.slice(0, 3).join(', '),
        });
        continue;
      }

      // Normalize address
      const normalizedAddress = (row.address || '').toUpperCase().trim();

      await db.insert(orders).values({
        externalId: row.externalId,
        orderDate: new Date(row.orderDate),
        orderType: row.orderType as 'connect' | 'disconnect' | 'transfer',
        customerName: row.customerName,
        address: normalizedAddress,
        city: row.city || null,
        state: row.state || null,
        zip: row.zip || null,
        phoneHash: row.phoneHash || null,
        emailHash: row.emailHash || null,
        paymentMethodHash: row.paymentMethodHash || null,
        ssnLast4Hash: row.ssnLast4Hash || null,
        equipmentId: row.equipmentId || null,
        channel: row.channel || null,
        agentId: row.agentId || null,
        region: row.region || null,
        promoCode: row.promoCode || null,
        accountNumber: row.accountNumber || null,
        disconnectReason: row.disconnectReason || null,
        delinquentBalance: row.delinquentBalance || null,
        batchId: batch.id,
      });
      processedCount++;
    } catch (err: any) {
      failedCount++;
      const isDuplicate = err.message?.includes('unique') || err.message?.includes('duplicate');
      errors.push({
        row: i + 1,
        error: isDuplicate ? 'Duplicate external_id (already exists)' : (err.message || 'Unknown error'),
      });
    }
  }

  // Update batch status
  const finalStatus = failedCount === (lines.length - 1) ? 'failed' : 'completed';
  await db.update(ingestionBatches).set({
    processedRecords: processedCount,
    failedRecords: failedCount,
    status: finalStatus,
    errorLog: errors.length > 0 ? errors : null,
    completedAt: new Date(),
  }).where(eq(ingestionBatches.id, batch.id));

  // TODO: Trigger scoring job for new orders

  return NextResponse.json({
    batchId: batch.id,
    filename: file.name,
    totalRows: lines.length - 1,
    processed: processedCount,
    failed: failedCount,
    errors: errors.slice(0, 50), // Limit error output
    status: finalStatus,
  }, { status: 201 });
}, 'analyst');

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
