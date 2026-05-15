'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/lib/data-context';
import { formatPercent } from '@/lib/utils';
import { FlaskConical, AlertTriangle } from 'lucide-react';

export function ValidationView() {
  const { validationMetrics, cases } = useData();
  if (!validationMetrics) return null;

  const m = validationMetrics;

  // Archetype breakdown
  const archetypeBreakdown = cases.reduce((acc, c) => {
    if (!c.order._isFraud || !c.order._archetype) return acc;
    const key = c.order._archetype;
    if (!acc[key]) acc[key] = { total: 0, detected: 0 };
    acc[key].total++;
    if (c.flagged) acc[key].detected++;
    return acc;
  }, {} as Record<string, { total: number; detected: number }>);

  // Legit edge case breakdown
  const edgeCaseBreakdown = cases.reduce((acc, c) => {
    if (c.order._isFraud || !c.order._legitEdgeCase) return acc;
    const key = c.order._legitEdgeCase;
    if (!acc[key]) acc[key] = { total: 0, falsePositives: 0 };
    acc[key].total++;
    if (c.flagged) acc[key].falsePositives++;
    return acc;
  }, {} as Record<string, { total: number; falsePositives: number }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Synthetic Validation Only</p>
          <p className="text-xs text-amber-700">
            These metrics are computed against synthetic generator labels, not production ground truth.
            They measure scoring engine performance on known test data.
          </p>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500 mb-1">Precision</p>
            <p className="text-3xl font-bold text-gray-900">{formatPercent(m.precision)}</p>
            <p className="text-xs text-gray-500 mt-1">Of flagged cases, how many are actually fraud</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500 mb-1">Recall</p>
            <p className="text-3xl font-bold text-gray-900">{formatPercent(m.recall)}</p>
            <p className="text-xs text-gray-500 mt-1">Of actual fraud cases, how many were flagged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-gray-500 mb-1">F1 Score</p>
            <p className="text-3xl font-bold text-gray-900">{formatPercent(m.f1)}</p>
            <p className="text-xs text-gray-500 mt-1">Harmonic mean of precision and recall</p>
          </CardContent>
        </Card>
      </div>

      {/* Confusion Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Confusion Matrix</CardTitle>
          <CardDescription>Predicted vs actual fraud labels from the synthetic generator</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  <th className="p-2" />
                  <th colSpan={2} className="p-2 text-center font-semibold text-gray-600 border-b">Predicted</th>
                </tr>
                <tr>
                  <th className="p-2" />
                  <th className="p-2" />
                  <th className="p-2 text-center text-xs text-gray-500">Flagged</th>
                  <th className="p-2 text-center text-xs text-gray-500">Not Flagged</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowSpan={2} className="p-2 font-semibold text-gray-600 border-r align-middle" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Actual</td>
                  <td className="p-2 text-xs text-gray-500 text-right">Fraud</td>
                  <td className="p-3 text-center bg-green-50 border border-green-200 rounded-tl-lg">
                    <p className="text-lg font-bold text-green-700">{m.truePositives}</p>
                    <p className="text-xs text-green-600">True Positive</p>
                  </td>
                  <td className="p-3 text-center bg-red-50 border border-red-200 rounded-tr-lg">
                    <p className="text-lg font-bold text-red-700">{m.falseNegatives}</p>
                    <p className="text-xs text-red-600">False Negative</p>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-xs text-gray-500 text-right">Legit</td>
                  <td className="p-3 text-center bg-orange-50 border border-orange-200 rounded-bl-lg">
                    <p className="text-lg font-bold text-orange-700">{m.falsePositives}</p>
                    <p className="text-xs text-orange-600">False Positive</p>
                  </td>
                  <td className="p-3 text-center bg-green-50 border border-green-200 rounded-br-lg">
                    <p className="text-lg font-bold text-green-700">{m.trueNegatives}</p>
                    <p className="text-xs text-green-600">True Negative</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-center text-xs text-gray-500">
            Total: {m.totalCases} cases · {m.actualFraudCount} actual fraud · {m.flaggedCount} flagged
          </div>
        </CardContent>
      </Card>

      {/* Archetype Detection Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Detection Rate by Fraud Archetype</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(archetypeBreakdown).sort((a, b) => b[1].total - a[1].total).map(([archetype, data]) => (
              <div key={archetype} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-48 truncate">{archetype.replace(/_/g, ' ')}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full"
                    style={{ width: `${(data.detected / data.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-24 text-right">
                  {data.detected}/{data.total} ({Math.round(data.detected / data.total * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legit Edge Case False Positive Rates */}
      <Card>
        <CardHeader>
          <CardTitle>False Positive Rate by Edge Case</CardTitle>
          <CardDescription>Lower is better — legitimate edge cases that were incorrectly flagged</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(edgeCaseBreakdown).sort((a, b) => b[1].falsePositives - a[1].falsePositives).map(([edgeCase, data]) => (
              <div key={edgeCase} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-48 truncate">{edgeCase.replace(/_/g, ' ')}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange-500 h-full rounded-full"
                    style={{ width: `${(data.falsePositives / data.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-24 text-right">
                  {data.falsePositives}/{data.total} ({Math.round(data.falsePositives / data.total * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
