/**
 * Encoder Embedding Layer for Fuzzy String Matching
 *
 * Uses character n-gram (trigram) vectorization to detect address spoofing
 * and name manipulation in telecom fraud. Pure TypeScript — no external
 * ML libraries or API calls.
 */

// ── Interfaces ─────────────────────────────────────────────────

export interface SimilarMatch {
  id: string;
  value: string;
  similarity: number;
  isDisconnected: boolean;
}

export interface EmbeddingResult {
  score: number; // 0-100
  addressMatches: SimilarMatch[];
  nameMatches: SimilarMatch[];
  details: string[];
}

// ── Abbreviation Expansion Map ─────────────────────────────────

const ABBREVIATION_MAP: Record<string, string> = {
  'ST': 'STREET',
  'AVE': 'AVENUE',
  'DR': 'DRIVE',
  'BLVD': 'BOULEVARD',
  'RD': 'ROAD',
  'LN': 'LANE',
  'APT': 'APARTMENT',
  'CT': 'COURT',
  'CIR': 'CIRCLE',
  'PL': 'PLACE',
  'TER': 'TERRACE',
  'TERR': 'TERRACE',
  'STE': 'SUITE',
  'HWY': 'HIGHWAY',
  'PKY': 'PARKWAY',
  'PKWY': 'PARKWAY',
  'WAY': 'WAY',
  'TRL': 'TRAIL',
  'SQ': 'SQUARE',
  'EXPY': 'EXPRESSWAY',
  'FWY': 'FREEWAY',
  'N': 'NORTH',
  'S': 'SOUTH',
  'E': 'EAST',
  'W': 'WEST',
  'NE': 'NORTHEAST',
  'NW': 'NORTHWEST',
  'SE': 'SOUTHEAST',
  'SW': 'SOUTHWEST',
  'FL': 'FLOOR',
  'RM': 'ROOM',
  'BLDG': 'BUILDING',
  'DEPT': 'DEPARTMENT',
};

// ── Normalization ──────────────────────────────────────────────

/**
 * Normalize a string for embedding comparison. Uppercases, expands common
 * abbreviations, strips punctuation, and collapses whitespace.
 */
function normalizeForEmbedding(text: string): string {
  let normalized = text.toUpperCase().trim();

  // Remove punctuation except spaces
  normalized = normalized.replace(/[.,#\-'"/\\()]/g, ' ');

  // Expand abbreviations (word-boundary-aware)
  const tokens = normalized.split(/\s+/);
  const expanded = tokens.map(token => ABBREVIATION_MAP[token] ?? token);
  normalized = expanded.join(' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// ── N-Gram Extraction ──────────────────────────────────────────

/**
 * Extract character n-grams from text with frequency counts.
 * Pads the string with boundary markers so edge characters are represented.
 *
 * @param text - Input string to vectorize
 * @param n - N-gram size (default 3 for trigrams)
 * @returns Map of n-gram strings to their frequency counts
 */
export function computeNGrams(text: string, n: number = 3): Map<string, number> {
  const normalized = normalizeForEmbedding(text);
  const grams = new Map<string, number>();

  if (normalized.length === 0) return grams;

  // Pad with boundary markers so "ABC" produces "$AB", "ABC", "BC$"
  const padded = '$'.repeat(n - 1) + normalized + '$'.repeat(n - 1);

  for (let i = 0; i <= padded.length - n; i++) {
    const gram = padded.substring(i, i + n);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }

  return grams;
}

// ── Cosine Similarity ──────────────────────────────────────────

/**
 * Compute cosine similarity between two n-gram frequency vectors.
 * Returns a value between 0 (completely different) and 1 (identical).
 *
 * @param a - First n-gram frequency vector
 * @param b - Second n-gram frequency vector
 * @returns Cosine similarity in [0, 1]
 */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Dot product: only iterate the smaller map for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [gram, countSmall] of smaller) {
    const countLarge = larger.get(gram);
    if (countLarge !== undefined) {
      dotProduct += countSmall * countLarge;
    }
  }

  // Norms
  for (const count of a.values()) {
    normA += count * count;
  }
  for (const count of b.values()) {
    normB += count * count;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ── Address Similarity Search ──────────────────────────────────

/**
 * Find addresses in the pool that are similar to the target address,
 * using trigram cosine similarity.
 *
 * @param targetAddress - The address to compare against the pool
 * @param pool - Array of records with id, address, and optional disconnectDate
 * @param threshold - Minimum similarity to include (default 0.75)
 * @returns Matches sorted by similarity descending
 */
export function findSimilarAddresses(
  targetAddress: string,
  pool: Array<{ id: string; address: string; disconnectDate?: string }>,
  threshold: number = 0.75,
): SimilarMatch[] {
  const targetGrams = computeNGrams(targetAddress);
  const matches: SimilarMatch[] = [];

  for (const entry of pool) {
    const entryGrams = computeNGrams(entry.address);
    const similarity = cosineSimilarity(targetGrams, entryGrams);

    if (similarity >= threshold) {
      matches.push({
        id: entry.id,
        value: entry.address,
        similarity,
        isDisconnected: !!entry.disconnectDate,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches;
}

// ── Name Similarity Search ─────────────────────────────────────

/**
 * Find names in the pool that are similar to the target name,
 * using trigram cosine similarity.
 *
 * @param targetName - The name to compare against the pool
 * @param pool - Array of records with id and name
 * @param threshold - Minimum similarity to include (default 0.75)
 * @returns Matches sorted by similarity descending
 */
export function findSimilarNames(
  targetName: string,
  pool: Array<{ id: string; name: string }>,
  threshold: number = 0.75,
): SimilarMatch[] {
  const targetGrams = computeNGrams(targetName);
  const matches: SimilarMatch[] = [];

  for (const entry of pool) {
    const entryGrams = computeNGrams(entry.name);
    const similarity = cosineSimilarity(targetGrams, entryGrams);

    if (similarity >= threshold) {
      matches.push({
        id: entry.id,
        value: entry.name,
        similarity,
        isDisconnected: false,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches;
}

// ── Main Scoring Function ──────────────────────────────────────

/**
 * Score an order's address and name against a pool of existing orders
 * using embedding similarity. Returns a 0-100 fraud risk score based on
 * how similar the order's fields are to known records, with heavy weight
 * on disconnected address matches (reconnect fraud indicator).
 *
 * @param order - The order to evaluate (must have address, customerName, id, zip, normalizedAddress, normalizedName)
 * @param pool - Array of existing orders to compare against
 * @returns EmbeddingResult with score, matches, and audit details
 */
export function scoreEmbeddingSimilarity(
  order: {
    id: string;
    address: string;
    customerName: string;
    normalizedAddress?: string;
    normalizedName?: string;
    zip?: string;
    [key: string]: unknown;
  },
  pool: Array<{
    id: string;
    address: string;
    customerName: string;
    normalizedAddress?: string;
    normalizedName?: string;
    zip?: string;
    disconnectDate?: string;
    [key: string]: unknown;
  }>,
): EmbeddingResult {
  const details: string[] = [];

  // Build address pool (exclude the order itself)
  const addressPool = pool
    .filter(p => p.id !== order.id)
    .map(p => ({
      id: p.id,
      address: p.address,
      disconnectDate: p.disconnectDate,
    }));

  // Build name pool (exclude the order itself)
  const namePool = pool
    .filter(p => p.id !== order.id)
    .map(p => ({
      id: p.id,
      name: p.customerName,
    }));

  // Find similar addresses (lower threshold to catch subtle spoofing)
  const addressMatches = findSimilarAddresses(order.address, addressPool, 0.70);

  // Find similar names
  const nameMatches = findSimilarNames(order.customerName, namePool, 0.70);

  // ── Score Calculation ──────────────────────────────────────────
  let score = 0;

  // Address matches contribute to score
  const disconnectedAddressMatches = addressMatches.filter(m => m.isDisconnected);
  const activeAddressMatches = addressMatches.filter(m => !m.isDisconnected);

  if (disconnectedAddressMatches.length > 0) {
    // Disconnected address matches are the strongest signal — they indicate
    // someone is reusing a disconnected service address with slight variations
    // (e.g., "123 Main St" vs "123 Main Street Apt A")
    const bestDisconnectedSim = disconnectedAddressMatches[0].similarity;

    // Scale: 0.70 similarity -> 20 points, 1.0 similarity -> 60 points
    const disconnectScore = Math.min(60, Math.round(
      20 + (bestDisconnectedSim - 0.70) * (40 / 0.30),
    ));
    score += disconnectScore;

    // Additional penalty for multiple disconnected matches
    if (disconnectedAddressMatches.length > 1) {
      score += Math.min(10, disconnectedAddressMatches.length * 3);
    }

    details.push(
      `Found ${disconnectedAddressMatches.length} disconnected address match(es). ` +
      `Best similarity: ${(bestDisconnectedSim * 100).toFixed(1)}% with "${disconnectedAddressMatches[0].value}". ` +
      `This is a strong indicator of address spoofing for reconnect fraud.`,
    );
  }

  if (activeAddressMatches.length > 0) {
    // Active (non-disconnected) address matches are weaker signals — could be
    // apartment buildings, nearby addresses, etc.
    const bestActiveSim = activeAddressMatches[0].similarity;
    const activeScore = Math.min(15, Math.round(
      5 + (bestActiveSim - 0.70) * (10 / 0.30),
    ));
    score += activeScore;

    details.push(
      `Found ${activeAddressMatches.length} active address match(es). ` +
      `Best similarity: ${(bestActiveSim * 100).toFixed(1)}% with "${activeAddressMatches[0].value}".`,
    );
  }

  // Name matches
  if (nameMatches.length > 0) {
    const bestNameSim = nameMatches[0].similarity;

    // Check if any name match corresponds to an address match — this is the
    // "same person, slightly different name" pattern
    const nameAddressOverlap = nameMatches.filter(nm =>
      addressMatches.some(am => am.id === nm.id),
    );

    if (nameAddressOverlap.length > 0) {
      // Name AND address both fuzzy-match the same record — very suspicious
      const overlapScore = Math.min(25, Math.round(
        10 + (bestNameSim - 0.70) * (15 / 0.30),
      ));
      score += overlapScore;

      details.push(
        `Name similarity detected with ${nameAddressOverlap.length} record(s) that also match by address. ` +
        `Best name similarity: ${(bestNameSim * 100).toFixed(1)}% with "${nameMatches[0].value}". ` +
        `Combined name+address fuzzy match is a hallmark of identity manipulation.`,
      );
    } else {
      // Name match without address overlap — moderate signal
      const nameScore = Math.min(10, Math.round(
        3 + (bestNameSim - 0.70) * (7 / 0.30),
      ));
      score += nameScore;

      details.push(
        `Found ${nameMatches.length} similar name(s). ` +
        `Best similarity: ${(bestNameSim * 100).toFixed(1)}% with "${nameMatches[0].value}".`,
      );
    }
  }

  // Cap at 100
  score = Math.min(100, score);

  if (score === 0) {
    details.push(
      'No significant address or name similarity detected against the comparison pool.',
    );
  }

  return {
    score,
    addressMatches,
    nameMatches,
    details,
  };
}
