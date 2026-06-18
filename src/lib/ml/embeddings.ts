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
 * on name similarity (the strongest signal for identity manipulation).
 * Address similarity is supplementary since Spectrum handles address
 * validation externally via USPS.
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
  // Name similarity is the strongest signal — it catches "Kingsley" vs "Kings",
  // reversed names, spelling variations, and other identity manipulation.
  // Address similarity is supplementary since Spectrum already handles address
  // validation externally via USPS.
  let score = 0;

  // Partition address matches for use in name overlap detection
  const disconnectedAddressMatches = addressMatches.filter(m => m.isDisconnected);
  const activeAddressMatches = addressMatches.filter(m => !m.isDisconnected);

  // ── Name matches (primary signal) ──────────────────────────────
  if (nameMatches.length > 0) {
    const bestNameSim = nameMatches[0].similarity;

    // Check if any name match corresponds to a disconnected address match —
    // this is the strongest signal: similar name at an address with a recent
    // disconnect (e.g., "Kingsley" vs "Kings" at a previously disconnected address)
    const nameDisconnectOverlap = nameMatches.filter(nm =>
      disconnectedAddressMatches.some(am => am.id === nm.id),
    );

    if (nameDisconnectOverlap.length > 0) {
      // Name match with disconnected address overlap — the strongest signal
      // Scale: 0.70 similarity -> 22 points, 1.0 similarity -> 55 points
      const overlapScore = Math.min(55, Math.round(
        22 + (bestNameSim - 0.70) * (33 / 0.30),
      ));
      score += overlapScore;

      details.push(
        `Name similarity detected with ${nameDisconnectOverlap.length} disconnected account(s) at a similar address. ` +
        `Best name similarity: ${(bestNameSim * 100).toFixed(1)}% with "${nameMatches[0].value}". ` +
        `Similar name at a previously disconnected address is a hallmark of identity manipulation.`,
      );
    } else {
      // Name match without disconnect overlap — still very valuable as a
      // standalone signal for catching name variations and identity tricks
      // Scale: 0.70 similarity -> 10 points, 1.0 similarity -> 30 points
      const nameScore = Math.min(30, Math.round(
        10 + (bestNameSim - 0.70) * (20 / 0.30),
      ));
      score += nameScore;

      details.push(
        `Found ${nameMatches.length} similar name(s). ` +
        `Best similarity: ${(bestNameSim * 100).toFixed(1)}% with "${nameMatches[0].value}". ` +
        `Name similarity is a key indicator of potential identity manipulation.`,
      );
    }
  }

  // ── Address matches (supplementary signal) ─────────────────────
  // Address validation is handled externally by Spectrum (USPS), so address
  // embedding similarity carries less weight here — it supplements name signals.
  if (disconnectedAddressMatches.length > 0) {
    const bestDisconnectedSim = disconnectedAddressMatches[0].similarity;

    // Scale: 0.70 similarity -> 5 points, 1.0 similarity -> 15 points
    const disconnectScore = Math.min(15, Math.round(
      5 + (bestDisconnectedSim - 0.70) * (10 / 0.30),
    ));
    score += disconnectScore;

    // Small additional penalty for multiple disconnected matches
    if (disconnectedAddressMatches.length > 1) {
      score += Math.min(5, disconnectedAddressMatches.length * 2);
    }

    details.push(
      `Found ${disconnectedAddressMatches.length} disconnected address match(es). ` +
      `Best similarity: ${(bestDisconnectedSim * 100).toFixed(1)}% with "${disconnectedAddressMatches[0].value}". ` +
      `Address similarity supplements the name-based signal (address validation is handled externally by Spectrum).`,
    );
  }

  if (activeAddressMatches.length > 0) {
    // Active (non-disconnected) address matches are minimal signals — could be
    // apartment buildings, nearby addresses, etc. Address validation is external.
    const bestActiveSim = activeAddressMatches[0].similarity;
    const activeScore = Math.min(5, Math.round(
      1 + (bestActiveSim - 0.70) * (4 / 0.30),
    ));
    score += activeScore;

    details.push(
      `Found ${activeAddressMatches.length} active address match(es). ` +
      `Best similarity: ${(bestActiveSim * 100).toFixed(1)}% with "${activeAddressMatches[0].value}".`,
    );
  }

  // Cap at 100
  score = Math.min(100, score);

  if (score === 0) {
    details.push(
      'No significant name or address similarity detected against the comparison pool.',
    );
  }

  return {
    score,
    addressMatches,
    nameMatches,
    details,
  };
}
