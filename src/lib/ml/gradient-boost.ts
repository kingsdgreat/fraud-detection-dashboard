/**
 * Gradient Boosted Decision Tree Classifier — Pure TypeScript
 *
 * Supervised fraud prediction for telecom orders. Trains on resolved cases
 * (confirmed_fraud vs false_positive) and predicts fraud probability for
 * new orders. No external ML libraries or API calls.
 *
 * Algorithm:
 *   1. Initialize predictions to log-odds of base rate
 *   2. For each boosting round:
 *      a. Compute residuals (negative gradient of log-loss)
 *      b. Fit a regression tree to the residuals
 *      c. Subsample training data by subsampleRate
 *      d. Update predictions += learningRate * tree_prediction
 *   3. Prediction = sigmoid(sum of all tree predictions + base prediction)
 */

// ── Interfaces ─────────────────────────────────────────────────

export interface GBDTOptions {
  numTrees?: number;        // default 50
  maxDepth?: number;        // default 4
  learningRate?: number;    // default 0.1
  minSamplesLeaf?: number;  // default 3
  subsampleRate?: number;   // default 0.8
}

export interface TrainingExample {
  features: number[];
  label: number; // 1 = confirmed fraud, 0 = not fraud
}

export interface PredictionResult {
  probability: number;      // 0-1 fraud probability
  score: number;            // 0-100 risk score
  featureContributions: Array<{ feature: string; contribution: number }>;
  modelInfo: {
    trained: boolean;
    trainingSize: number;
    accuracy: number;
  };
}

// ── Seeded PRNG ────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Sigmoid ────────────────────────────────────────────────────

function sigmoid(x: number): number {
  if (x >= 0) {
    return 1 / (1 + Math.exp(-x));
  }
  // Numerically stable variant for negative inputs
  const expX = Math.exp(x);
  return expX / (1 + expX);
}

// ── Decision Tree Node ─────────────────────────────────────────

interface TreeNode {
  splitFeature?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
  leafValue: number;
}

interface SerializedTreeNode {
  sf?: number;  // splitFeature
  sv?: number;  // splitValue
  l?: SerializedTreeNode;  // left
  r?: SerializedTreeNode;  // right
  lv: number;  // leafValue
}

// ── Decision Tree Builder ──────────────────────────────────────

function buildRegressionTree(
  features: number[][],
  targets: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesLeaf: number,
): TreeNode {
  // Leaf node conditions
  if (indices.length <= minSamplesLeaf || depth >= maxDepth) {
    const mean = indices.length > 0
      ? indices.reduce((s, i) => s + targets[i], 0) / indices.length
      : 0;
    return { leafValue: mean };
  }

  const numFeatures = features[0].length;
  let bestFeature = -1;
  let bestSplit = 0;
  let bestScore = Infinity;
  let bestLeftIndices: number[] = [];
  let bestRightIndices: number[] = [];

  // Try each feature to find the best split
  for (let f = 0; f < numFeatures; f++) {
    // Gather feature values for current indices
    const values: Array<{ val: number; idx: number }> = [];
    for (const i of indices) {
      values.push({ val: features[i][f], idx: i });
    }
    values.sort((a, b) => a.val - b.val);

    // Try split points between consecutive distinct values
    let leftSum = 0;
    let leftCount = 0;
    let rightSum = indices.reduce((s, i) => s + targets[i], 0);
    let rightCount = indices.length;

    for (let v = 0; v < values.length - 1; v++) {
      leftSum += targets[values[v].idx];
      leftCount++;
      rightSum -= targets[values[v].idx];
      rightCount--;

      // Skip if the next value is the same (no split possible)
      if (values[v].val === values[v + 1].val) continue;

      // Check minimum leaf size
      if (leftCount < minSamplesLeaf || rightCount < minSamplesLeaf) continue;

      // Squared error reduction
      const leftMean = leftSum / leftCount;
      const rightMean = rightSum / rightCount;

      // Compute weighted variance (MSE) for this split
      let leftMSE = 0;
      for (let k = 0; k <= v; k++) {
        const diff = targets[values[k].idx] - leftMean;
        leftMSE += diff * diff;
      }
      let rightMSE = 0;
      for (let k = v + 1; k < values.length; k++) {
        const diff = targets[values[k].idx] - rightMean;
        rightMSE += diff * diff;
      }

      const totalMSE = leftMSE + rightMSE;

      if (totalMSE < bestScore) {
        bestScore = totalMSE;
        bestFeature = f;
        bestSplit = (values[v].val + values[v + 1].val) / 2;
        bestLeftIndices = values.slice(0, v + 1).map(x => x.idx);
        bestRightIndices = values.slice(v + 1).map(x => x.idx);
      }
    }
  }

  // If no valid split was found, make a leaf
  if (bestFeature === -1) {
    const mean = indices.reduce((s, i) => s + targets[i], 0) / indices.length;
    return { leafValue: mean };
  }

  const leftChild = buildRegressionTree(
    features, targets, bestLeftIndices, depth + 1, maxDepth, minSamplesLeaf,
  );
  const rightChild = buildRegressionTree(
    features, targets, bestRightIndices, depth + 1, maxDepth, minSamplesLeaf,
  );

  return {
    splitFeature: bestFeature,
    splitValue: bestSplit,
    left: leftChild,
    right: rightChild,
    leafValue: 0, // unused for internal nodes
  };
}

function predictTree(node: TreeNode, features: number[]): number {
  if (node.splitFeature === undefined || node.splitValue === undefined || !node.left || !node.right) {
    return node.leafValue;
  }
  if (features[node.splitFeature] < node.splitValue) {
    return predictTree(node.left, features);
  }
  return predictTree(node.right, features);
}

// ── Feature Importance from a single tree ──────────────────────

function accumulateImportance(
  node: TreeNode,
  importance: number[],
  sampleCount: number,
): void {
  if (node.splitFeature === undefined || !node.left || !node.right) {
    return;
  }
  // Importance proportional to the fact that this feature was chosen for splitting
  importance[node.splitFeature] += 1 / (sampleCount || 1);
  accumulateImportance(node.left, importance, sampleCount);
  accumulateImportance(node.right, importance, sampleCount);
}

// ── Serialization helpers ──────────────────────────────────────

function serializeTreeNode(node: TreeNode): SerializedTreeNode {
  const out: SerializedTreeNode = { lv: node.leafValue };
  if (node.splitFeature !== undefined) out.sf = node.splitFeature;
  if (node.splitValue !== undefined) out.sv = node.splitValue;
  if (node.left) out.l = serializeTreeNode(node.left);
  if (node.right) out.r = serializeTreeNode(node.right);
  return out;
}

function deserializeTreeNode(data: SerializedTreeNode): TreeNode {
  const node: TreeNode = { leafValue: data.lv };
  if (data.sf !== undefined) node.splitFeature = data.sf;
  if (data.sv !== undefined) node.splitValue = data.sv;
  if (data.l) node.left = deserializeTreeNode(data.l);
  if (data.r) node.right = deserializeTreeNode(data.r);
  return node;
}

// ── Feature Names ──────────────────────────────────────────────

/** Feature names matching isolation-forest.ts extractFeatures output */
export const FEATURE_NAMES: string[] = [
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

// ── Channel risk scores (matching isolation-forest.ts) ─────────

const CHANNEL_RISK_SCORES: Record<string, number> = {
  third_party_door_to_door: 1.0,
  third_party_telemarketing: 0.8,
  third_party_retail: 0.6,
  internal_call_center: 0.3,
  retention: 0.2,
  internal_online: 0.1,
};

// ── GradientBoostedClassifier ──────────────────────────────────

export class GradientBoostedClassifier {
  private numTrees: number;
  private maxDepth: number;
  private learningRate: number;
  private minSamplesLeaf: number;
  private subsampleRate: number;

  private trees: TreeNode[] = [];
  private basePrediction: number = 0;
  private trained: boolean = false;
  private trainingSize: number = 0;
  private trainingAccuracy: number = 0;
  private featureImportanceMap: Map<string, number> = new Map();

  constructor(options?: GBDTOptions) {
    this.numTrees = options?.numTrees ?? 50;
    this.maxDepth = options?.maxDepth ?? 4;
    this.learningRate = options?.learningRate ?? 0.1;
    this.minSamplesLeaf = options?.minSamplesLeaf ?? 3;
    this.subsampleRate = options?.subsampleRate ?? 0.8;
  }

  /**
   * Train the GBDT model on labelled examples.
   * Uses gradient boosting with log-loss (binary cross-entropy).
   */
  train(examples: TrainingExample[]): void {
    if (examples.length < 2) return;

    this.trainingSize = examples.length;
    this.trees = [];

    const features = examples.map(e => e.features);
    const labels = examples.map(e => e.label);
    const n = examples.length;

    // Initialize to log-odds of the base rate
    const positiveCount = labels.filter(l => l === 1).length;
    const baseRate = Math.max(0.001, Math.min(0.999, positiveCount / n));
    this.basePrediction = Math.log(baseRate / (1 - baseRate));

    // Current raw predictions (logit space) for each training example
    const rawPredictions = new Array(n).fill(this.basePrediction);

    const random = seededRandom(42);

    // Feature importance accumulator
    const numFeatures = features[0].length;
    const importanceAccum = new Array(numFeatures).fill(0);

    for (let t = 0; t < this.numTrees; t++) {
      // Compute residuals: negative gradient of log-loss
      // For log-loss: residual_i = label_i - sigmoid(rawPrediction_i)
      const residuals = new Array(n);
      for (let i = 0; i < n; i++) {
        const p = sigmoid(rawPredictions[i]);
        residuals[i] = labels[i] - p;
      }

      // Subsample training data
      const subsampleSize = Math.max(1, Math.floor(n * this.subsampleRate));
      const subsampleIndices: number[] = [];
      const allIndices = Array.from({ length: n }, (_, i) => i);

      // Fisher-Yates partial shuffle for subsampling
      for (let i = 0; i < subsampleSize; i++) {
        const j = i + Math.floor(random() * (allIndices.length - i));
        [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
        subsampleIndices.push(allIndices[i]);
      }

      // Fit a regression tree to the residuals on the subsample
      const tree = buildRegressionTree(
        features,
        residuals,
        subsampleIndices,
        0,
        this.maxDepth,
        this.minSamplesLeaf,
      );

      this.trees.push(tree);

      // Accumulate feature importance from this tree
      accumulateImportance(tree, importanceAccum, n);

      // Update raw predictions for ALL training examples (not just subsample)
      for (let i = 0; i < n; i++) {
        rawPredictions[i] += this.learningRate * predictTree(tree, features[i]);
      }
    }

    // Normalize feature importance
    const totalImportance = importanceAccum.reduce((a, b) => a + b, 0);
    this.featureImportanceMap = new Map();
    for (let f = 0; f < numFeatures; f++) {
      const name = f < FEATURE_NAMES.length ? FEATURE_NAMES[f] : `feature_${f}`;
      this.featureImportanceMap.set(
        name,
        totalImportance > 0 ? importanceAccum[f] / totalImportance : 0,
      );
    }

    // Compute training accuracy
    let correct = 0;
    for (let i = 0; i < n; i++) {
      const prob = sigmoid(rawPredictions[i]);
      const predicted = prob >= 0.5 ? 1 : 0;
      if (predicted === labels[i]) correct++;
    }
    this.trainingAccuracy = correct / n;
    this.trained = true;
  }

  /**
   * Predict fraud probability for a single feature vector.
   * @returns probability in [0, 1]
   */
  predict(features: number[]): number {
    if (!this.trained || this.trees.length === 0) {
      return 0.5;
    }

    let raw = this.basePrediction;
    for (const tree of this.trees) {
      raw += this.learningRate * predictTree(tree, features);
    }

    return sigmoid(raw);
  }

  /**
   * Get feature importance as a map of feature name to normalized importance.
   */
  getFeatureImportance(): Map<string, number> {
    return new Map(this.featureImportanceMap);
  }

  /**
   * Check if the model has been trained.
   */
  isReady(): boolean {
    return this.trained;
  }

  /**
   * Serialize the model to a JSON string for persistence.
   */
  serialize(): string {
    const data = {
      numTrees: this.numTrees,
      maxDepth: this.maxDepth,
      learningRate: this.learningRate,
      minSamplesLeaf: this.minSamplesLeaf,
      subsampleRate: this.subsampleRate,
      basePrediction: this.basePrediction,
      trained: this.trained,
      trainingSize: this.trainingSize,
      trainingAccuracy: this.trainingAccuracy,
      featureImportance: Array.from(this.featureImportanceMap.entries()),
      trees: this.trees.map(serializeTreeNode),
    };
    return JSON.stringify(data);
  }

  /**
   * Deserialize a model from a JSON string.
   */
  static deserialize(json: string): GradientBoostedClassifier {
    const data = JSON.parse(json);
    const model = new GradientBoostedClassifier({
      numTrees: data.numTrees,
      maxDepth: data.maxDepth,
      learningRate: data.learningRate,
      minSamplesLeaf: data.minSamplesLeaf,
      subsampleRate: data.subsampleRate,
    });
    model.basePrediction = data.basePrediction;
    model.trained = data.trained;
    model.trainingSize = data.trainingSize;
    model.trainingAccuracy = data.trainingAccuracy;
    model.featureImportanceMap = new Map(data.featureImportance);
    model.trees = data.trees.map(deserializeTreeNode);
    return model;
  }
}

// ── Feature Extraction (consistent with isolation-forest.ts) ───

/**
 * Extract 10 numeric features from an order, matching the isolation forest
 * feature extraction for consistency across ML layers.
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

  // Feature 1: Shared address count
  const orderAddr = order.normalizedAddress ?? order.address ?? '';
  const orderZip = order.zip ?? '';
  const sharedAddress = orderAddr
    ? others.filter(p => {
        const pAddr = p.normalizedAddress ?? p.address ?? '';
        const pZip = p.zip ?? '';
        return pAddr === orderAddr && pZip === orderZip;
      }).length
    : 0;

  // Feature 2: Shared phone count
  const phoneHash = order.identitySignals?.phoneHash;
  const sharedPhone = phoneHash
    ? others.filter(p => p.identitySignals?.phoneHash === phoneHash).length
    : 0;

  // Feature 3: Shared email count
  const emailHash = order.identitySignals?.emailHash;
  const sharedEmail = emailHash
    ? others.filter(p => p.identitySignals?.emailHash === emailHash).length
    : 0;

  // Feature 4: Shared payment method count
  const paymentHash = order.identitySignals?.paymentMethodHash;
  const sharedPayment = paymentHash
    ? others.filter(p => p.identitySignals?.paymentMethodHash === paymentHash).length
    : 0;

  // Feature 5: Agent order count
  const agentCode = order.agentCode;
  const agentOrders = agentCode
    ? others.filter(p => p.agentCode === agentCode).length
    : 0;

  // Feature 7: Days since disconnect (normalized 0-1, 365 max)
  const daysSinceDisconnect = order.daysSinceDisconnect;
  const daysSinceDisconnectNorm =
    daysSinceDisconnect !== undefined && daysSinceDisconnect > 0
      ? Math.min(1, daysSinceDisconnect / 365)
      : 0;

  // Feature 8: Channel risk score
  const channel = order.channel ?? '';
  const channelRisk = CHANNEL_RISK_SCORES[channel] ?? 0.5;

  // Feature 9: Has delinquent balance
  const hasDelinquent =
    order.delinquentBalance !== undefined && order.delinquentBalance > 0
      ? 1
      : 0;

  // Feature 10: Identity signal overlap (max matching signals with any single order)
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

// ── Build Training Data ────────────────────────────────────────

/**
 * Convert resolved cases into training examples for the GBDT.
 *
 * @param resolvedCases - Cases with a resolution and pre-computed features
 * @returns Array of TrainingExample with labels derived from resolution
 */
export function buildTrainingData(
  resolvedCases: Array<{ resolution: string; features: number[] }>,
): TrainingExample[] {
  return resolvedCases
    .filter(c => c.resolution === 'confirmed_fraud' || c.resolution === 'false_positive')
    .map(c => ({
      features: c.features,
      label: c.resolution === 'confirmed_fraud' ? 1 : 0,
    }));
}

// ── Score with GBDT ────────────────────────────────────────────

/**
 * Score an order using the Gradient Boosted Decision Tree model.
 * Handles the case where the model is null or not yet trained by
 * returning a neutral result.
 *
 * @param order - The order to score
 * @param pool - The pool of all orders for feature extraction context
 * @param model - The trained GBDT model (or null)
 * @returns PredictionResult with probability, score, contributions, and model info
 */
export function scoreGradientBoost(
  order: Parameters<typeof extractFeatures>[0],
  pool: Parameters<typeof extractFeatures>[1],
  model: GradientBoostedClassifier | null,
): PredictionResult {
  // Return neutral result if model is unavailable
  if (!model || !model.isReady()) {
    return {
      probability: 0.5,
      score: 50,
      featureContributions: [],
      modelInfo: {
        trained: false,
        trainingSize: 0,
        accuracy: 0,
      },
    };
  }

  const features = extractFeatures(order, pool);
  const probability = model.predict(features);

  // Scale probability to 0-100 risk score
  // Apply a slight stretch so that 0.5 maps to 50 and extremes are emphasized
  const score = Math.round(Math.min(100, Math.max(0, probability * 100)));

  // Compute per-feature contributions via leave-one-out approximation
  const featureContributions: Array<{ feature: string; contribution: number }> = [];
  const baseProbability = probability;

  for (let i = 0; i < features.length; i++) {
    // Create a modified feature vector with feature i zeroed out
    const modified = [...features];
    modified[i] = 0;
    const modifiedProb = model.predict(modified);
    const contribution = baseProbability - modifiedProb;
    const name = i < FEATURE_NAMES.length ? FEATURE_NAMES[i] : `feature_${i}`;
    featureContributions.push({ feature: name, contribution });
  }

  // Sort by absolute contribution descending
  featureContributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Get model info via serialization round-trip for accuracy
  const modelData = JSON.parse(model.serialize());

  return {
    probability,
    score,
    featureContributions,
    modelInfo: {
      trained: true,
      trainingSize: modelData.trainingSize as number,
      accuracy: modelData.trainingAccuracy as number,
    },
  };
}
