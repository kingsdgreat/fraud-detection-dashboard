import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseComments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../../middleware';

/**
 * POST /api/v1/cases/:id/resolve — Resolve a case with disposition
 * Body: { resolution: 'confirmed_fraud' | 'false_positive' | 'inconclusive', note: string }
 */
export const POST = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.indexOf('cases') + 1];
  const body = await req.json();

  const validResolutions = ['confirmed_fraud', 'false_positive', 'inconclusive'];
  if (!body.resolution || !validResolutions.includes(body.resolution)) {
    return NextResponse.json(
      { error: 'resolution must be one of: confirmed_fraud, false_positive, inconclusive' },
      { status: 400 }
    );
  }

  if (!body.note) {
    return NextResponse.json({ error: 'A resolution note is required' }, { status: 400 });
  }

  const db = getDb();

  const [caseRecord] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!caseRecord) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  if (caseRecord.status === 'resolved' || caseRecord.status === 'dismissed') {
    return NextResponse.json({ error: 'Case is already closed' }, { status: 400 });
  }

  const [updated] = await db
    .update(cases)
    .set({
      status: 'resolved',
      resolution: body.resolution,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cases.id, id))
    .returning();

  await db.insert(caseComments).values({
    caseId: id,
    authorId: user.id,
    type: 'status_change',
    content: body.note,
    metadata: {
      action: 'resolve',
      resolution: body.resolution,
      previousStatus: caseRecord.status,
    },
  });

  return NextResponse.json(updated);
}, 'analyst');
