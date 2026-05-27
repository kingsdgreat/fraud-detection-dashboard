import { NextResponse } from 'next/server';
import { withAuth } from '../../middleware';
import { isAIEnabled } from '@/lib/ai/client';

/**
 * GET /api/v1/ai/status — Check if AI features are enabled
 */
export const GET = withAuth(async () => {
  return NextResponse.json({
    enabled: isAIEnabled(),
    model: 'claude-sonnet-4-20250514',
  });
}, 'analyst');
