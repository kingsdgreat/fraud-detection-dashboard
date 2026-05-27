import { NextResponse } from 'next/server';
import { withAuth } from '../../middleware';
import { analyzeScoringAccuracy, getWeightAdjustments } from '@/lib/ai/feedback';

/**
 * GET /api/v1/ai/feedback — Get scoring accuracy analytics
 */
export const GET = withAuth(async () => {
  const [accuracy, weightAdjustments] = await Promise.all([
    analyzeScoringAccuracy(),
    getWeightAdjustments(),
  ]);

  return NextResponse.json({
    accuracy,
    weightAdjustments,
    message: accuracy.totalResolved === 0
      ? 'No resolved cases yet. Resolve cases as confirmed_fraud or false_positive to start training the feedback loop.'
      : `Based on ${accuracy.totalResolved} resolved cases with ${accuracy.precisionRate}% precision.`,
  });
}, 'analyst');
