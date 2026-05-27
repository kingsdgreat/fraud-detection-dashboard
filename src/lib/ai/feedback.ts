import { getDb } from '@/lib/db';
import { cases, orders } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';

interface ScoringAccuracy {
  totalResolved: number;
  confirmedFraud: number;
  falsePositives: number;
  inconclusive: number;
  precisionRate: number;
  avgScoreConfirmedFraud: number;
  avgScoreFalsePositive: number;
  recommendedThresholdAdjustment: number;
  riskBandAccuracy: Record<string, { total: number; confirmed: number; rate: number }>;
  topFalsePositivePatterns: string[];
}

/**
 * Analyze scoring accuracy based on analyst resolutions.
 * This is the "learning" component — it shows how well the scoring
 * engine performs and recommends threshold adjustments.
 */
export async function analyzeScoringAccuracy(): Promise<ScoringAccuracy> {
  const db = getDb();

  // Get all resolved cases with their resolutions
  const resolvedCases = await db
    .select({
      riskScore: cases.riskScore,
      riskBand: cases.riskBand,
      resolution: cases.resolution,
      evidence: cases.evidence,
    })
    .from(cases)
    .where(
      sql`${cases.resolution} IS NOT NULL`
    );

  const confirmedFraud = resolvedCases.filter(c => c.resolution === 'confirmed_fraud');
  const falsePositives = resolvedCases.filter(c => c.resolution === 'false_positive');
  const inconclusive = resolvedCases.filter(c => c.resolution === 'inconclusive');

  // Average scores by resolution type
  const avgScoreConfirmedFraud = confirmedFraud.length > 0
    ? Math.round(confirmedFraud.reduce((a, c) => a + c.riskScore, 0) / confirmedFraud.length)
    : 0;

  const avgScoreFalsePositive = falsePositives.length > 0
    ? Math.round(falsePositives.reduce((a, c) => a + c.riskScore, 0) / falsePositives.length)
    : 0;

  // Risk band accuracy
  const bands = ['low', 'medium', 'high', 'critical'];
  const riskBandAccuracy: Record<string, { total: number; confirmed: number; rate: number }> = {};

  for (const band of bands) {
    const bandCases = resolvedCases.filter(c => c.riskBand === band);
    const bandConfirmed = bandCases.filter(c => c.resolution === 'confirmed_fraud');
    riskBandAccuracy[band] = {
      total: bandCases.length,
      confirmed: bandConfirmed.length,
      rate: bandCases.length > 0 ? Math.round((bandConfirmed.length / bandCases.length) * 100) : 0,
    };
  }

  // Find common evidence types in false positives
  const fpEvidenceTypes: Record<string, number> = {};
  for (const fp of falsePositives) {
    const evidence = Array.isArray(fp.evidence) ? fp.evidence : [];
    for (const e of evidence as any[]) {
      fpEvidenceTypes[e.type] = (fpEvidenceTypes[e.type] || 0) + 1;
    }
  }
  const topFalsePositivePatterns = Object.entries(fpEvidenceTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => `${type} (${count} false positives)`);

  // Recommended threshold adjustment
  // If FP rate is high and avg FP score is close to avg confirmed score, recommend raising threshold
  const precisionRate = resolvedCases.length > 0
    ? Math.round((confirmedFraud.length / (confirmedFraud.length + falsePositives.length)) * 100) || 0
    : 0;

  let recommendedThresholdAdjustment = 0;
  if (falsePositives.length > 0 && confirmedFraud.length > 0) {
    const gap = avgScoreConfirmedFraud - avgScoreFalsePositive;
    if (gap < 15) {
      recommendedThresholdAdjustment = Math.round(gap / 2);
    }
  }

  return {
    totalResolved: resolvedCases.length,
    confirmedFraud: confirmedFraud.length,
    falsePositives: falsePositives.length,
    inconclusive: inconclusive.length,
    precisionRate,
    avgScoreConfirmedFraud,
    avgScoreFalsePositive,
    recommendedThresholdAdjustment,
    riskBandAccuracy,
    topFalsePositivePatterns,
  };
}

/**
 * Get scoring weight adjustments based on feedback.
 * Returns recommended multipliers for each evidence type.
 */
export async function getWeightAdjustments(): Promise<Record<string, number>> {
  const db = getDb();

  const resolvedCases = await db
    .select({
      resolution: cases.resolution,
      evidence: cases.evidence,
    })
    .from(cases)
    .where(sql`${cases.resolution} IS NOT NULL`);

  // Count how often each evidence type appears in confirmed vs false positive
  const evidenceStats: Record<string, { confirmed: number; falsePositive: number }> = {};

  for (const c of resolvedCases) {
    const evidence = Array.isArray(c.evidence) ? c.evidence : [];
    for (const e of evidence as any[]) {
      if (!evidenceStats[e.type]) {
        evidenceStats[e.type] = { confirmed: 0, falsePositive: 0 };
      }
      if (c.resolution === 'confirmed_fraud') {
        evidenceStats[e.type].confirmed++;
      } else if (c.resolution === 'false_positive') {
        evidenceStats[e.type].falsePositive++;
      }
    }
  }

  // Calculate weight adjustments
  // Evidence types that appear more in confirmed fraud get boosted
  // Evidence types that appear more in false positives get dampened
  const adjustments: Record<string, number> = {};

  for (const [type, stats] of Object.entries(evidenceStats)) {
    const total = stats.confirmed + stats.falsePositive;
    if (total < 3) continue; // Not enough data

    const precision = stats.confirmed / total;
    // 1.0 = no adjustment, >1 = boost, <1 = dampen
    adjustments[type] = Math.round(precision * 200) / 100; // Range: 0-2x
  }

  return adjustments;
}
