/**
 * FamilyDashBoard Worker — SimHash-based near-duplicate detection
 *
 * v1: character-level 4-gram fingerprinting (original, kept for compatibility)
 * v2: word-bigram fingerprinting with multilingual normalization (new)
 *
 * All operations run in O(n·k) time where n = token count, k = hash bits (64).
 * No external dependencies — pure TypeScript.
 *
 * Reference: Charikar 2002 "Similarity Estimation Techniques from Rounding
 * Algorithms" <https://www.cs.princeton.edu/courses/archive/spr04/cos598B/bib/CharikarEstim.pdf>
 */

/** Number of bits used for the SimHash fingerprint. */
const BITS = 64;

/**
 * Compute a 64-bit SimHash fingerprint for an input string.
 *
 * Steps:
 *  1. Tokenise into overlapping character 4-grams (catches minor edits).
 *  2. Hash each token with a simple 64-bit integer hash.
 *  3. For each bit position, accumulate +1 or -1 weighted by the bit value.
 *  4. Finalise: bit = 1 if count > 0, else 0.
 *
 * The result is returned as a `bigint` so we keep the full 64 bits without
 * floating-point precision loss.
 */
export function simHash(text: string): bigint {
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (norm.length === 0) return 0n;

  // Generate 4-gram tokens
  const tokens: string[] = [];
  if (norm.length <= 4) {
    tokens.push(norm);
  } else {
    for (let i = 0; i <= norm.length - 4; i++) {
      tokens.push(norm.slice(i, i + 4));
    }
  }

  // Accumulate bit vectors
  const v: number[] = new Array<number>(BITS).fill(0);

  for (const token of tokens) {
    const h = hash64(token);
    for (let i = 0; i < BITS; i++) {
      if ((h >> BigInt(i)) & 1n) {
        v[i]!++;
      } else {
        v[i]!--;
      }
    }
  }

  // Finalise
  let fingerprint = 0n;
  for (let i = 0; i < BITS; i++) {
    if (v[i]! > 0) fingerprint |= 1n << BigInt(i);
  }
  return fingerprint;
}

/**
 * Count the number of differing bits between two SimHash fingerprints.
 * A lower count means the two strings are more similar.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor !== 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * Return `true` when two strings are considered near-duplicates.
 *
 * @param a          First fingerprint (from `simHash()`).
 * @param b          Second fingerprint.
 * @param threshold  Maximum hamming distance to treat as duplicate. Default: 3.
 *                   Empirical values: 3 = tight, 6 = loose.
 */
export function isNearDuplicate(a: bigint, b: bigint, threshold = 3): boolean {
  return hammingDistance(a, b) <= threshold;
}

// ── Internal 64-bit hash ─────────────────────────────────────────────────────

/**
 * FNV-1a-inspired 64-bit hash for short token strings.
 *
 * Uses BigInt arithmetic to stay within 64-bit range.
 * This is NOT a cryptographic hash — collision resistance is not needed here.
 */
function hash64(s: string): bigint {
  const FNV_PRIME = 1099511628211n;
  const OFFSET_BASIS = 14695981039346656037n;
  const MASK64 = 0xffff_ffff_ffff_ffffn;

  let hash = OFFSET_BASIS;
  for (let i = 0; i < s.length; i++) {
    hash ^= BigInt(s.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
}

// ── SimHash v2 — word-bigram with multilingual normalization ─────────────────

/**
 * Normalize text for v2 fingerprinting.
 *
 * Steps:
 *  1. Lowercase.
 *  2. Strip HTML entities (numeric + named ampersand sequences).
 *  3. Strip Hebrew nikud (U+05B0–U+05C7 combining diacritics).
 *  4. Strip Arabic diacritics (U+064B–U+065F, U+0670, U+06D6–U+06DC, U+06DF–U+06E4).
 *  5. Collapse whitespace.
 */
function normalizeV2(text: string): string {
  return text
    .toLowerCase()
    .replace(/&#?\w+;/g, " ") // HTML entities
    .replace(/[\u05B0-\u05C7]/g, "") // Hebrew nikud
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4]/g, "") // Arabic diacritics
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenise normalised text into adjacent word-pair bigrams.
 *
 * Example: "the quick brown fox" → ["the quick", "quick brown", "brown fox"]
 *
 * Single-word texts produce ["<word>"] as a fallback.
 * Empty input produces [].
 */
function wordBigrams(norm: string): string[] {
  if (norm.length === 0) return [];
  const words = norm.split(" ").filter((w) => w.length > 0);
  if (words.length === 1) return [words[0]!];
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]!} ${words[i + 1]!}`);
  }
  return bigrams;
}

/**
 * Compute a 64-bit SimHash fingerprint using **word-bigram** tokens.
 *
 * Compared with `simHash()` (char 4-grams), `simHashV2()`:
 * - Is more robust to word-order preservation (bigrams capture adjacency).
 * - Handles multilingual text better via explicit nikud/diacritic stripping.
 * - Produces fewer tokens for long texts, making it faster for headlines.
 *
 * Use `isNearDuplicateV2()` with this function (same hamming distance logic,
 * different token granularity — consider threshold 4–8 for headlines).
 */
export function simHashV2(text: string): bigint {
  const norm = normalizeV2(text);
  const tokens = wordBigrams(norm);
  if (tokens.length === 0) return 0n;

  const v: number[] = new Array<number>(BITS).fill(0);
  for (const token of tokens) {
    const h = hash64(token);
    for (let i = 0; i < BITS; i++) {
      if ((h >> BigInt(i)) & 1n) {
        v[i]!++;
      } else {
        v[i]!--;
      }
    }
  }

  let fingerprint = 0n;
  for (let i = 0; i < BITS; i++) {
    if (v[i]! > 0) fingerprint |= 1n << BigInt(i);
  }
  return fingerprint;
}

/**
 * Return `true` when two strings are considered near-duplicates using v2 fingerprints.
 *
 * Recommended thresholds for news headlines:
 * - 4 = tight (essentially reworded same sentence)
 * - 8 = moderate (same story, different framing)
 *
 * @param a          First fingerprint (from `simHashV2()`).
 * @param b          Second fingerprint.
 * @param threshold  Maximum hamming distance. Default: 4.
 */
export function isNearDuplicateV2(a: bigint, b: bigint, threshold = 4): boolean {
  return hammingDistance(a, b) <= threshold;
}
