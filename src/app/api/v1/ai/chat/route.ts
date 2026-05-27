import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '../../middleware';
import { getAIClient, isAIEnabled } from '@/lib/ai/client';
import { ANALYST_CHAT_SYSTEM, buildChatContextPrompt } from '@/lib/ai/prompts';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/v1/ai/chat — Chat with AI about a specific case
 *
 * Body: { caseId: string, message: string, history?: ChatMessage[] }
 */
export const POST = withAuth(async (req, user) => {
  if (!isAIEnabled()) {
    return NextResponse.json({
      reply: null,
      fallback: true,
      message: 'AI features require an ANTHROPIC_API_KEY environment variable.',
    });
  }

  const body = await req.json();
  const { caseId, message, history = [] } = body;

  if (!caseId || !message) {
    return NextResponse.json({ error: 'caseId and message are required' }, { status: 400 });
  }

  const db = getDb();

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

  const client = getAIClient()!;
  const contextPrompt = buildChatContextPrompt(caseData, order);

  // Build messages array with history
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // First message includes the case context
  if (history.length === 0) {
    messages.push({ role: 'user', content: contextPrompt + '\n\nAnalyst question: ' + message });
  } else {
    // Include context in first message of history
    messages.push({
      role: 'user',
      content: contextPrompt + '\n\nAnalyst question: ' + history[0].content,
    });
    // Add rest of history
    for (let i = 1; i < history.length; i++) {
      messages.push({ role: history[i].role, content: history[i].content });
    }
    // Add new message
    messages.push({ role: 'user', content: message });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: ANALYST_CHAT_SYSTEM,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ reply, fallback: false });
  } catch (err: any) {
    console.error('[AI Chat] Error:', err.message);
    return NextResponse.json({
      reply: null,
      fallback: true,
      message: `AI chat failed: ${err.message}`,
    });
  }
}, 'analyst');
