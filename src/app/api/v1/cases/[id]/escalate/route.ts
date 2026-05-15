import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseComments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../../middleware';

/**
 * POST /api/v1/cases/:id/escalate — Escalate case to manager
 * Body: { reason: string }
 */
export const POST = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.indexOf('cases') + 1];
  const body = await req.json();

  if (!body.reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const db = getDb();

  const [caseRecord] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!caseRecord) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  if (caseRecord.status === 'resolved' || caseRecord.status === 'dismissed') {
    return NextResponse.json({ error: 'Cannot escalate a closed case' }, { status: 400 });
  }

  const [updated] = await db
    .update(cases)
    .set({
      status: 'escalated',
      priority: 'urgent',
      updatedAt: new Date(),
    })
    .where(eq(cases.id, id))
    .returning();

  await db.insert(caseComments).values({
    caseId: id,
    authorId: user.id,
    type: 'escalation',
    content: body.reason,
    metadata: { previousStatus: caseRecord.status },
  });

  return NextResponse.json(updated);
}, 'analyst');
