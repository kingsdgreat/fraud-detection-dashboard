import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseComments, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../../middleware';

/**
 * POST /api/v1/cases/:id/assign — Assign case to an analyst
 * Body: { analystId: string }
 */
export const POST = withAuth(async (req, currentUser) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.indexOf('cases') + 1];
  const body = await req.json();

  if (!body.analystId) {
    return NextResponse.json({ error: 'analystId is required' }, { status: 400 });
  }

  const db = getDb();

  // Verify case exists
  const [caseRecord] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!caseRecord) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  // Verify analyst exists and is active
  const [analyst] = await db
    .select()
    .from(users)
    .where(eq(users.id, body.analystId))
    .limit(1);
  if (!analyst || !analyst.isActive) {
    return NextResponse.json({ error: 'Analyst not found or inactive' }, { status: 400 });
  }

  // Update case assignment
  const [updated] = await db
    .update(cases)
    .set({
      assignedTo: body.analystId,
      assignedAt: new Date(),
      status: caseRecord.status === 'open' ? 'in_review' : caseRecord.status,
      updatedAt: new Date(),
    })
    .where(eq(cases.id, id))
    .returning();

  // Log assignment
  await db.insert(caseComments).values({
    caseId: id,
    authorId: currentUser.id,
    type: 'assignment',
    content: `Case assigned to ${analyst.name}`,
    metadata: { analystId: body.analystId, analystName: analyst.name },
  });

  return NextResponse.json(updated);
}, 'manager');
