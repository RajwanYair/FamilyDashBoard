/**
 * FamilyDashBoard Worker — SimHash-based near-duplicate detection
 *
 * Implementation uses a character-level 4-gram fingerprinting scheme
 * based on the Charikar SimHash algorithm.
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
