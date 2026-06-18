/**
 * Isolation Forest — Pure TypeScript Implementation
 *
 * Unsupervised anomaly detection for telecom fraud scoring.
 * Identifies orders that are statistically unusual compared to the rest
 * of the order pool, without requiring labelled training data.
 *
 * No external ML libraries or API calls — everything runs in-process.
 */

import type { Channel } from '../types';

// ── Interfaces ─────────────────────────────────────────────────

export interface IsolationForestOptions {
  numTrees?: number;
  sampleSize?: number;
  seed?: number;
}

export interface IsolationForestResult {
  score: number;            // 0-100 scaled score
  anomalyScore: number;     // Raw 0-1 anomaly score
  isAnomaly: boolean;       // true if anomalyScore > threshold
  featureImportance: Array<{
    feature: string;
    value: number;
    contribution: string;
  }>;
}

// ── Seeded PRNG ────────────────────────────────────────────────

/**
 * Simple linear congruential generator for reproducible randomness.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Isolation Tree Node ────────────────────────────────────────

interface ITreeNode {
  /** Split feature index (undefined for external/leaf nodes) */
  splitFeature?: number;
  /** Split value (undefined for external/leaf nodes) */
  splitValue?: number;
  /** Left child (values < splitValue) */
  left?: ITreeNode;
  /** Right child (values >= splitValue) */
  right?: ITreeNode;
  /** Size of data at this leaf (for external node adjustment) */
  size: number;
}

// ── Harmonic Number & c(n) ─────────────────────────────────────

const EULER_CONSTANT = 0.5772156649;

/**
 * Harmonic number approximation: H(i) = ln(i) + Euler-Mascheroni constant
 */
function harmonicNumber(i: number): number {
  if (i <= 0) return 0;
  return Math.log(i) + EULER_CONSTANT;
}

/**
 * Average path length of an unsuccessful search in a BST with n elements.
 * c(n) = 2*H(n-1) - 2*(n-1)/n
 */
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * harmonicNumber(n - 1) - (2 * (n - 1)) / n;
}

// ── Isolation Forest Class ─────────────────────────────────────

export class IsolationForest {
  private numTrees: number;
  private sampleSize: number;
  private seed: number;
  private trees: ITreeNode[] = [];
  private maxDepth: number = 0;
  private actualSampleSize: number = 0;

  constructor(options: IsolationForestOptions = {}) {
    this.numTrees = options.numTrees ?? 100;
    this.sampleSize = options.sampleSize ?? 256;
    this.seed = options.seed ?? 42;
  }

  /**
   * Build the isolation forest from a 2D numeric dataset.
   * Each row is a data point, each column is a feature.
   *
   * @param data - 2D array of numeric features [numPoints x numFeatures]
   */
  fit(data: number[][]): void {
    if (data.length === 0) return;

    this.actualSampleSize = Math.min(this.sampleSize, data.length);
    this.maxDepth = Math.ceil(Math.log2(this.actualSampleSize));
    this.trees = [];

    const random = seededRandom(this.seed);

    for (let t = 0; t < this.numTrees; t++) {
      // Subsample
      const sample = this.subsample(data, this.actualSampleSize, random);
      // Build tree
      const tree = this.buildTree(sample, 0, random);
      this.trees.push(tree);
    }
  }

  /**
   * Compute the anomaly score for a single data point.
   * Returns a value between 0 and 1 where:
   *   - Scores close to 1 indicate anomalies
   *   - Scores close to 0.5 indicate normal points
   *   - Scores close to 0 indicate very common patterns
   *
   * @param point - Feature vector (same dimensionality as training data)
   * @returns Anomaly score in [0, 1]
   */
  score(point: number[]): number {
    if (this.trees.length === 0) return 0.5;

    // Average path length across all trees
    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += this.pathLength(point, tree, 0);
    }
    const avgPathLength = totalPathLength / this.trees.length;

    // Normalize using c(n)
    const cn = averagePathLength(this.actualSampleSize);
    if (cn === 0) return 0.5;

    // Anomaly score: s = 2^(-avgPathLength / c(n))
    const anomalyScore = Math.pow(2, -avgPathLength / cn);

    return anomalyScore;
  }

  /**
   * Predict whether a point is anomalous.
   * Uses 0.6 as the default threshold (standard for isolation forests).
   *
   * @param point - Feature vector
   * @returns true if the point is anomalous
   */
  predict(point: number[]): boolean {
    return this.score(point) > 0.6;
  }

  // ── Private Methods ────────────────────────────────────────────

  /**
   * Random subsample without replacement using Fisher-Yates.
   */
  private subsample(
    data: number[][],
    size: number,
    random: () => number,
  ): number[][] {
    // Copy indices
    const indices = Array.from({ length: data.length }, (_, i) => i);

    // Fisher-Yates partial shuffle
    for (let i = 0; i < size && i < indices.length; i++) {
      const j = i + Math.floor(random() * (indices.length - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices.slice(0, size).map(i => data[i]);
  }

  /**
   * Recursively build an isolation tree.
   */
  private buildTree(
    data: number[][],
    depth: number,
    random: () => number,
  ): ITreeNode {
    // External node conditions: single point, or max depth reached
    if (data.length <= 1 || depth >= this.maxDepth) {
      return { size: data.length };
    }

    const numFeatures = data[0].length;
    if (numFeatures === 0) {
      return { size: data.length };
    }

    // Pick a random feature
    const featureIdx = Math.floor(random() * numFeatures);

    // Find min and max of this feature
    let min = Infinity;
    let max = -Infinity;
    for (const point of data) {
      const val = point[featureIdx];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    // If all values are the same, cannot split further
    if (min === max) {
      return { size: data.length };
    }

    // Pick a random split value between min and max (exclusive of boundaries
    // to ensure both partitions are non-empty in common cases)
    const splitValue = min + random() * (max - min);

    // Partition
    const left: number[][] = [];
    const right: number[][] = [];
    for (const point of data) {
      if (point[featureIdx] < splitValue) {
        left.push(point);
      } else {
        right.push(point);
      }
    }

    // Edge case: if partition produces an empty side, make it a leaf
    if (left.length === 0 || right.length === 0) {
      return { size: data.length };
    }

    return {
      splitFeature: featureIdx,
      splitValue,
      left: this.buildTree(left, depth + 1, random),
      right: this.buildTree(right, depth + 1, random),
      size: data.length,
    };
  }

  /**
   * Traverse a tree to find the path length (number of edges) for a point.
   * When reaching an external node with size > 1, add the expected
   * additional path length c(node.size).
   */
  private pathLength(
    point: number[],
    node: ITreeNode,
    currentDepth: number,
  ): number {
    // External node: return current depth + adjustment for remaining data
    if (
      node.splitFeature === undefined ||
      node.splitValue === undefined ||
      !node.left ||
      !node.right
    ) {
      return currentDepth + averagePathLength(node.size);
    }

    // Internal node: traverse based on split
    if (point[node.splitFeature] < node.splitValue) {
      return this.pathLength(point, node.left, currentDepth + 1);
    } else {
      return this.pathLength(point, node.right, currentDepth + 1);
    }
  }
}

// ── Feature Extraction ─────────────────────────────────────────

/** Channel risk scores for feature extraction */
const CHANNEL_RISK_SCORES: Record<string, number> = {
  third_party_door_to_door: 1.0,
  third_party_telemarketing: 0.8,
  third_party_retail: 0.6,
  internal_call_center: 0.3,
  retention: 0.2,
  internal_online: 0.1,
};

/** Feature names for interpretability */
const FEATURE_NAMES = [
  'shared_address_count',
  'shared_phone_count',
  'shared_email_count',
  'shared_payment_count',
  'agent_order_count',
  'days_since_disconnect_norm',
  'channel_risk',
  'has_delinquent_balance',
  'identity_signal_overlap',
];

/**
 * Convert an order into a numeric feature vector for the Isolation Forest.
 * Extracts 10 features that capture various dimensions of fraud risk.
 *
 * @param order - The order to extract features from
 * @param pool - The pool of all orders for computing relative features
 * @returns 10-element numeric feature vector
 */
export function extractFeatures(
  order: {
    id: string;
    normalizedAddress?: string;
    address?: string;
    zip?: string;
    agentCode?: string;
    channel?: string;
    daysSinceDisconnect?: number;
    delinquentBalance?: number;
    identitySignals?: {
      phoneHash?: string;
      emailHash?: string;
      paymentMethodHash?: string;
      equipmentSerialHistory?: string[];
    };
    [key: string]: unknown;
  },
  pool: Array<{
    id: string;
    normalizedAddress?: string;
    address?: string;
    zip?: string;
    agentCode?: string;
    channel?: string;
    identitySignals?: {
      phoneHash?: string;
      emailHash?: string;
      paymentMethodHash?: string;
      equipmentSerialHistory?: string[];
    };
    [key: string]: unknown;
  }>,
): number[] {
  const others = pool.filter(p => p.id !== order.id);

  // Feature 1: Number of orders sharing this address
  const orderAddr = order.normalizedAddress ?? order.address ?? '';
  const orderZip = order.zip ?? '';
  const sharedAddress = orderAddr
    ? others.filter(p => {
        const pAddr = p.normalizedAddress ?? p.address ?? '';
        const pZip = p.zip ?? '';
        return pAddr === orderAddr && pZip === orderZip;
      }).length
    : 0;

  // Feature 2: Number of orders sharing this phone hash
  const phoneHash = order.identitySignals?.phoneHash;
  const sharedPhone = phoneHash
    ? others.filter(p => p.identitySignals?.phoneHash === phoneHash).length
    : 0;

  // Feature 3: Number of orders sharing this email hash
  const emailHash = order.identitySignals?.emailHash;
  const sharedEmail = emailHash
    ? others.filter(p => p.identitySignals?.emailHash === emailHash).length
    : 0;

  // Feature 4: Number of orders sharing this payment method hash
  const paymentHash = order.identitySignals?.paymentMethodHash;
  const sharedPayment = paymentHash
    ? others.filter(p => p.identitySignals?.paymentMethodHash === paymentHash).length
    : 0;

  // Feature 5: Number of orders from this agent
  const agentCode = order.agentCode;
  const agentOrders = agentCode
    ? others.filter(p => p.agentCode === agentCode).length
    : 0;

  // Feature 7: Days since disconnect (normalized to 0-1 with 365 as max)
  const daysSinceDisconnect = (order as { daysSinceDisconnect?: number }).daysSinceDisconnect;
  const daysSinceDisconnectNorm = daysSinceDisconnect !== undefined && daysSinceDisconnect > 0
    ? Math.min(1, daysSinceDisconnect / 365)
    : 0;

  // Feature 8: Channel risk score
  const channel = order.channel ?? '';
  const channelRisk = CHANNEL_RISK_SCORES[channel] ?? 0.5;

  // Feature 9: Whether delinquent balance exists
  const hasDelinquent = (order as { delinquentBalance?: number }).delinquentBalance !== undefined
    && (order as { delinquentBalance?: number }).delinquentBalance! > 0
    ? 1
    : 0;

  // Feature 10: Number of identity signals matching any other order in pool
  let identityOverlap = 0;
  for (const other of others) {
    let matchCount = 0;
    if (phoneHash && other.identitySignals?.phoneHash === phoneHash) matchCount++;
    if (emailHash && other.identitySignals?.emailHash === emailHash) matchCount++;
    if (paymentHash && other.identitySignals?.paymentMethodHash === paymentHash) matchCount++;
    if (matchCount > identityOverlap) {
      identityOverlap = matchCount;
    }
  }

  return [
    sharedAddress,
    sharedPhone,
    sharedEmail,
    sharedPayment,
    agentOrders,
    daysSinceDisconnectNorm,
    channelRisk,
    hasDelinquent,
    identityOverlap,
  ];
}

// ── Main Scoring Function ──────────────────────────────────────

/**
 * Score an order using Isolation Forest anomaly detection.
 *
 * Extracts features for all orders in the pool, fits an Isolation Forest,
 * and scores the target order. Returns a structured result with the
 * anomaly score, scaled 0-100 score, and feature importance breakdown.
 *
 * @param order - The order to score
 * @param pool - The pool of all orders (used for both training and feature context)
 * @returns IsolationForestResult with score, anomaly status, and feature importance
 */
export function scoreIsolationForest(
  order: Parameters<typeof extractFeatures>[0],
  pool: Parameters<typeof extractFeatures>[1],
): IsolationForestResult {
  // Need at least a few data points for meaningful anomaly detection
  if (pool.length < 5) {
    return {
      score: 0,
      anomalyScore: 0.5,
      isAnomaly: false,
      featureImportance: FEATURE_NAMES.map(name => ({
        feature: name,
        value: 0,
        contribution: 'Insufficient data for analysis',
      })),
    };
  }

  // Extract features for all pool members
  const poolFeatures = pool.map(p => extractFeatures(p, pool));

  // Extract features for the target order
  const orderFeatures = extractFeatures(order, pool);

  // Fit the forest on pool features
  const forest = new IsolationForest({
    numTrees: 100,
    sampleSize: Math.min(256, pool.length),
    seed: 42,
  });
  forest.fit(poolFeatures);

  // Score the target order
  const anomalyScore = forest.score(orderFeatures);
  const isAnomaly = anomalyScore > 0.6;

  // Scale to 0-100
  // Map the anomaly score range [0.4, 0.7] to [0, 100] for better spread
  // Below 0.4 is definitely normal (0), above 0.7 is definitely anomalous (100)
  let scaledScore: number;
  if (anomalyScore <= 0.4) {
    scaledScore = 0;
  } else if (anomalyScore >= 0.7) {
    scaledScore = 100;
  } else {
    scaledScore = Math.round(((anomalyScore - 0.4) / 0.3) * 100);
  }

  // Compute feature importance by measuring each feature's deviation
  // from the pool mean (z-score-like contribution analysis)
  const featureImportance = FEATURE_NAMES.map((name, i) => {
    const featureValues = poolFeatures.map(f => f[i]);
    const mean = featureValues.reduce((a, b) => a + b, 0) / featureValues.length;

    // Standard deviation
    const variance = featureValues.reduce(
      (sum, v) => sum + (v - mean) * (v - mean),
      0,
    ) / featureValues.length;
    const stdDev = Math.sqrt(variance);

    const value = orderFeatures[i];
    const zScore = stdDev > 0 ? (value - mean) / stdDev : 0;

    let contribution: string;
    if (Math.abs(zScore) < 0.5) {
      contribution = 'Normal range';
    } else if (zScore > 2) {
      contribution = `Very high (${value.toFixed(2)} vs mean ${mean.toFixed(2)}) — major anomaly contributor`;
    } else if (zScore > 1) {
      contribution = `Elevated (${value.toFixed(2)} vs mean ${mean.toFixed(2)}) — moderate anomaly contributor`;
    } else if (zScore > 0.5) {
      contribution = `Slightly elevated (${value.toFixed(2)} vs mean ${mean.toFixed(2)})`;
    } else if (zScore < -2) {
      contribution = `Very low (${value.toFixed(2)} vs mean ${mean.toFixed(2)}) — unusual absence`;
    } else if (zScore < -1) {
      contribution = `Below average (${value.toFixed(2)} vs mean ${mean.toFixed(2)})`;
    } else {
      contribution = `Slightly below average (${value.toFixed(2)} vs mean ${mean.toFixed(2)})`;
    }

    return { feature: name, value, contribution };
  });

  return {
    score: scaledScore,
    anomalyScore,
    isAnomaly,
    featureImportance,
  };
}
