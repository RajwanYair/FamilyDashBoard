/**
 * FamilyDashBoard — Client-side SimHash for news deduplication (P3 Feed Intelligence)
 *
 * Lightweight 64-bit SimHash using word-bigram tokenization with Hebrew/Arabic
 * normalization. Used by the news card to detect near-duplicate headlines across feeds.
 *
 * Algorithm: Charikar 2002 "Similarity Estimation Techniques from Rounding Algorithms"
 */

const BITS = 64;

// ── Normalization ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&#?\w+;/g, " ")
    .replace(/[\u05B0-\u05C7]/g, "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Tokenization ───────────────────────────────────────────────────────────────

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

// ── FNV-1a 64-bit hash ─────────────────────────────────────────────────────────

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

// ── SimHash ────────────────────────────────────────────────────────────────────

/** Compute a 64-bit SimHash fingerprint using word-bigram tokens. */
export function simHash(text: string): bigint {
  const norm = normalize(text);
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

/** Count the number of differing bits between two SimHash fingerprints. */
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
 * Return true when two fingerprints are considered near-duplicates.
 *
 * Thresholds: 4 = tight (reworded same sentence), 8 = moderate (same story).
 */
export function isNearDuplicate(a: bigint, b: bigint, threshold = 4): boolean {
  return hammingDistance(a, b) <= threshold;
}

/**
 * Deduplicate an array of items by SimHash similarity of their text content.
 * Items are processed in order; the first occurrence of near-duplicate content wins.
 *
 * @param items     Array of items to deduplicate.
 * @param getText   Extractor for the text content to fingerprint.
 * @param threshold Hamming distance threshold (default 4).
 * @returns         Filtered array with near-duplicates removed.
 */
export function deduplicateBySimHash<T>(
  items: T[],
  getText: (item: T) => string,
  threshold = 4,
): T[] {
  const fingerprints: bigint[] = [];
  return items.filter((item) => {
    const fp = simHash(getText(item));
    for (const existing of fingerprints) {
      if (isNearDuplicate(fp, existing, threshold)) return false;
    }
    fingerprints.push(fp);
    return true;
  });
}
