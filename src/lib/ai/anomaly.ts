import type { Order } from '../types';

interface AnomalySignal {
  feature: string;
  value: number;
  populationMean: number;
  populationStdDev: number;
  zScore: number;
  isAnomaly: boolean;
  description: string;
}

interface AnomalyResult {
  anomalyScore: number; // 0-100
  signals: AnomalySignal[];
  isAnomalous: boolean;
}

/**
 * Compute population statistics for a numeric array
 */
function computeStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Count how many orders share a specific signal value
 */
function countSignalOccurrences(pool: Order[], signalKey: string, value: string | undefined): number {
  if (!value) return 0;
  return pool.filter(o => {
    const signals = o.identitySignals as any;
    return signals?.[signalKey] === value;
  }).length;
}

/**
 * Detect statistical anomalies in an order compared to the population.
 * This catches fraud patterns that rule-based scoring might miss.
 */
export function detectAnomalies(order: Order, pool: Order[]): AnomalyResult {
  const signals: AnomalySignal[] = [];
  const connectOrders = pool.filter(o => !o.disconnectDate);

  // 1. Identity signal sharing frequency
  // How many other orders share each of this order's identity signals?
  const identityKeys = ['phoneHash', 'emailHash', 'paymentMethodHash', 'ssnLast4Hash'] as const;

  for (const key of identityKeys) {
    const value = (order.identitySignals as any)?.[key];
    if (!value) continue;

    const occurrences = countSignalOccurrences(pool, key, value);
    const allCounts = pool.map(o => {
      const v = (o.identitySignals as any)?.[key];
      return v ? countSignalOccurrences(pool, key, v) : 0;
    }).filter(c => c > 0);

    const stats = computeStats(allCounts);
    const zScore = stats.stdDev > 0 ? (occurrences - stats.mean) / stats.stdDev : 0;

    if (zScore > 2) {
      signals.push({
        feature: `${key}_frequency`,
        value: occurrences,
        populationMean: Math.round(stats.mean * 100) / 100,
        populationStdDev: Math.round(stats.stdDev * 100) / 100,
        zScore: Math.round(zScore * 100) / 100,
        isAnomaly: true,
        description: `This ${key.replace('Hash', '')} appears on ${occurrences} orders, which is ${zScore.toFixed(1)} standard deviations above average (${stats.mean.toFixed(1)})`,
      });
    }
  }

  // 2. Address reuse frequency
  const addressCount = pool.filter(o =>
    o.normalizedAddress === order.normalizedAddress && o.id !== order.id
  ).length;

  const allAddressCounts = connectOrders.map(o =>
    pool.filter(p => p.normalizedAddress === o.normalizedAddress && p.id !== o.id).length
  );
  const addressStats = computeStats(allAddressCounts);
  const addressZScore = addressStats.stdDev > 0 ? (addressCount - addressStats.mean) / addressStats.stdDev : 0;

  if (addressZScore > 2) {
    signals.push({
      feature: 'address_frequency',
      value: addressCount,
      populationMean: Math.round(addressStats.mean * 100) / 100,
      populationStdDev: Math.round(addressStats.stdDev * 100) / 100,
      zScore: Math.round(addressZScore * 100) / 100,
      isAnomaly: true,
      description: `This address appears on ${addressCount + 1} orders, which is ${addressZScore.toFixed(1)} standard deviations above average`,
    });
  }

  // 3. Agent order velocity (orders per agent in time window)
  if (order.agentCode) {
    const agentOrders = connectOrders.filter(o => o.agentCode === order.agentCode);
    const allAgentCounts = [...new Set(connectOrders.map(o => o.agentCode).filter(Boolean))].map(
      agent => connectOrders.filter(o => o.agentCode === agent).length
    );
    const agentStats = computeStats(allAgentCounts);
    const agentZScore = agentStats.stdDev > 0 ? (agentOrders.length - agentStats.mean) / agentStats.stdDev : 0;

    if (agentZScore > 2) {
      signals.push({
        feature: 'agent_order_velocity',
        value: agentOrders.length,
        populationMean: Math.round(agentStats.mean * 100) / 100,
        populationStdDev: Math.round(agentStats.stdDev * 100) / 100,
        zScore: Math.round(agentZScore * 100) / 100,
        isAnomaly: true,
        description: `Agent ${order.agentCode} has ${agentOrders.length} orders, which is ${agentZScore.toFixed(1)} standard deviations above average (${agentStats.mean.toFixed(1)})`,
      });
    }
  }

  // 4. Geographic concentration (multiple orders from same zip in short window)
  if (order.zip) {
    const zipOrders = connectOrders.filter(o => o.zip === order.zip);
    const allZipCounts = [...new Set(connectOrders.map(o => o.zip).filter(Boolean))].map(
      zip => connectOrders.filter(o => o.zip === zip).length
    );
    const zipStats = computeStats(allZipCounts);
    const zipZScore = zipStats.stdDev > 0 ? (zipOrders.length - zipStats.mean) / zipStats.stdDev : 0;

    if (zipZScore > 2.5) {
      signals.push({
        feature: 'geographic_concentration',
        value: zipOrders.length,
        populationMean: Math.round(zipStats.mean * 100) / 100,
        populationStdDev: Math.round(zipStats.stdDev * 100) / 100,
        zScore: Math.round(zipZScore * 100) / 100,
        isAnomaly: true,
        description: `ZIP ${order.zip} has ${zipOrders.length} orders, which is unusually concentrated`,
      });
    }
  }

  // Calculate composite anomaly score (0-100)
  const maxZScore = signals.length > 0 ? Math.max(...signals.map(s => s.zScore)) : 0;
  const avgZScore = signals.length > 0 ? signals.reduce((a, s) => a + s.zScore, 0) / signals.length : 0;

  // Score: combine max z-score with signal count
  const anomalyScore = Math.min(100, Math.round(
    (maxZScore * 15) + (signals.length * 10) + (avgZScore * 5)
  ));

  return {
    anomalyScore,
    signals,
    isAnomalous: signals.length > 0 && anomalyScore >= 20,
  };
}
