import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders, users, caseComments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withAuth } from '../../middleware';

/**
 * GET /api/v1/cases/:id — Full case detail with evidence, comments, and order data
 */
export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop()!;

  const db = getDb();

  // Get case with order data
  const [result] = await db
    .select()
    .from(cases)
    .innerJoin(orders, eq(cases.orderId, orders.id))
    .where(eq(cases.id, id))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  // Get assignee info if assigned
  let assignee = null;
  if (result.cases.assignedTo) {
    const [a] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, result.cases.assignedTo))
      .limit(1);
    assignee = a || null;
  }

  // Get comments/activity timeline
  const comments = await db
    .select({
      id: caseComments.id,
      type: caseComments.type,
      content: caseComments.content,
      metadata: caseComments.metadata,
      createdAt: caseComments.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(caseComments)
    .leftJoin(users, eq(caseComments.authorId, users.id))
    .where(eq(caseComments.caseId, id))
    .orderBy(desc(caseComments.createdAt));

  return NextResponse.json({
    case: result.cases,
    order: result.orders,
    assignee,
    comments,
  });
});

/**
 * PATCH /api/v1/cases/:id — Update case status, priority, or assignment
 */
export const PATCH = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop()!;
  const body = await req.json();

  const db = getDb();

  // Validate case exists
  const [existing] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  // Build update object from allowed fields
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.status) updates.status = body.status;
  if (body.priority) updates.priority = body.priority;
  if (body.assignedTo !== undefined) {
    updates.assignedTo = body.assignedTo;
    updates.assignedAt = body.assignedTo ? new Date() : null;
  }

  const [updated] = await db
    .update(cases)
    .set(updates)
    .where(eq(cases.id, id))
    .returning();

  // Log the change as a comment
  await db.insert(caseComments).values({
    caseId: id,
    authorId: user.id,
    type: 'status_change',
    content: `Case updated`,
    metadata: { changes: body, previousStatus: existing.status },
  });

  return NextResponse.json(updated);
}, 'analyst');
