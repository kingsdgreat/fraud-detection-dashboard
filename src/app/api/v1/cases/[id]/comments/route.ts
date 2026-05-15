import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseComments, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withAuth } from '../../../middleware';

/**
 * GET /api/v1/cases/:id/comments — List all comments/activity for a case
 */
export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.indexOf('cases') + 1];

  const db = getDb();

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

  return NextResponse.json({ data: comments });
});

/**
 * POST /api/v1/cases/:id/comments — Add a note to a case
 * Body: { content: string }
 */
export const POST = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.indexOf('cases') + 1];
  const body = await req.json();

  if (!body.content || body.content.trim().length === 0) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const db = getDb();

  // Verify case exists
  const [caseRecord] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!caseRecord) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const [comment] = await db
    .insert(caseComments)
    .values({
      caseId: id,
      authorId: user.id,
      type: 'note',
      content: body.content.trim(),
    })
    .returning();

  return NextResponse.json(comment, { status: 201 });
}, 'analyst');
