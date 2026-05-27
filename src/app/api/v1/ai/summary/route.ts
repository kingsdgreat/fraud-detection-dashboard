import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '../../middleware';
import { getAIClient, isAIEnabled } from '@/lib/ai/client';
import { CASE_SUMMARY_SYSTEM, buildCaseSummaryPrompt } from '@/lib/ai/prompts';

/**
 * POST /api/v1/ai/summary — Generate an AI summary for a case
 *
 * Body: { caseId: string }
 */
export const POST = withAuth(async (req, user) => {
  if (!isAIEnabled()) {
    return NextResponse.json({
      summary: null,
      fallback: true,
      message: 'AI features require an ANTHROPIC_API_KEY environment variable. Add it to your Vercel project settings to enable AI-powered case summaries.',
    });
  }

  const body = await req.json();
  const { caseId } = body;

  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  const db = getDb();

  // Fetch case with order
  const [caseData] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);

  if (!caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, caseData.orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Get agent stats if agent exists
  let agentStats = null;
  if (order.agentId) {
    const agentOrders = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.agentId, order.agentId));

    const agentCases = await db
      .select({
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`coalesce(avg(${cases.riskScore}), 0)::int`,
      })
      .from(cases)
      .innerJoin(orders, eq(cases.orderId, orders.id))
      .where(eq(orders.agentId, order.agentId));

    const totalOrders = agentOrders[0]?.count || 0;
    const flaggedCases = agentCases[0]?.count || 0;
    const avgScore = agentCases[0]?.avgScore || 0;

    agentStats = {
      totalOrders,
      flaggedCases,
      fraudRate: totalOrders > 0 ? ((flaggedCases / totalOrders) * 100).toFixed(1) : '0',
      avgRiskScore: avgScore,
    };
  }

  const client = getAIClient()!;
  const prompt = buildCaseSummaryPrompt(caseData, order, agentStats);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CASE_SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ summary, fallback: false });
  } catch (err: any) {
    console.error('[AI Summary] Error:', err.message);
    return NextResponse.json({
      summary: null,
      fallback: true,
      message: `AI summary generation failed: ${err.message}`,
    });
  }
}, 'analyst');
