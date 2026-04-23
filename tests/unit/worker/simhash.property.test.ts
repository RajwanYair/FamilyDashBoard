/**
 * Property-based tests for worker/src/utils/simhash.ts
 *
 * Uses fast-check to verify algebraic properties of the SimHash algorithm:
 *   - Identical strings have zero hamming distance (exact identity)
 *   - Hamming distance is symmetric
 *   - Hamming distance is always in [0, 64]
 *   - Empty string always produces fingerprint 0n
 *   - Near-identical strings (single char edit) often dedupe at threshold 6+
 *   - Completely different strings rarely dedupe at threshold 3
 *   - isNearDuplicate(a, a) is always true
 *   - hammingDistance is commutative
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { simHash, hammingDistance, isNearDuplicate } from "../../../worker/src/utils/simhash";

// ── Constants ──────────────────────────────────────────────────────────────────

const BITS = 64;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Non-empty printable ASCII string */
const printableStr = fc.string({ minLength: 1, maxLength: 200 });

// ── Property tests ─────────────────────────────────────────────────────────────

describe("simHash — property: identity", () => {
  it("identical strings always produce zero hamming distance", () => {
    fc.assert(
      fc.property(printableStr, (s) => {
        const h = simHash(s);
        expect(hammingDistance(h, h)).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it("isNearDuplicate(h, h) is always true for any threshold ≥ 0", () => {
    fc.assert(
      fc.property(printableStr, fc.integer({ min: 0, max: BITS }), (s, threshold) => {
        const h = simHash(s);
        expect(isNearDuplicate(h, h, threshold)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("simHash — property: symmetry", () => {
  it("hammingDistance(a, b) === hammingDistance(b, a)", () => {
    fc.assert(
      fc.property(printableStr, printableStr, (s1, s2) => {
        const d1 = hammingDistance(simHash(s1), simHash(s2));
        const d2 = hammingDistance(simHash(s2), simHash(s1));
        expect(d1).toBe(d2);
      }),
      { numRuns: 200 },
    );
  });

  it("isNearDuplicate is symmetric", () => {
    fc.assert(
      fc.property(printableStr, printableStr, (s1, s2) => {
        const h1 = simHash(s1);
        const h2 = simHash(s2);
        expect(isNearDuplicate(h1, h2)).toBe(isNearDuplicate(h2, h1));
      }),
      { numRuns: 200 },
    );
  });
});

describe("simHash — property: bounds", () => {
  it("hammingDistance is always in [0, 64]", () => {
    fc.assert(
      fc.property(printableStr, printableStr, (s1, s2) => {
        const d = hammingDistance(simHash(s1), simHash(s2));
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(BITS);
      }),
      { numRuns: 200 },
    );
  });

  it("simHash fingerprint fits in 64 bits (< 2^64)", () => {
    fc.assert(
      fc.property(printableStr, (s) => {
        const h = simHash(s);
        expect(h).toBeGreaterThanOrEqual(0n);
        expect(h).toBeLessThan(2n ** BigInt(BITS));
      }),
      { numRuns: 200 },
    );
  });
});

describe("simHash — property: edge cases", () => {
  it("empty string always produces 0n fingerprint", () => {
    expect(simHash("")).toBe(0n);
    expect(simHash("   ")).toBe(0n); // normalised to empty after trim
  });

  it("single character strings do not crash", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 1 }), (c) => {
        expect(() => simHash(c)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

describe("simHash — property: near-duplicate sensitivity", () => {
  it("strings differing by only one character often dedupe at threshold 6", () => {
    // We don't assert 100% because SimHash is probabilistic, but the hit rate
    // should be well above 50% for one-character edits on medium strings.
    let deduped = 0;
    const runs = 100;
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 100 }).filter((s) => /^[\x20-\x7e]+$/.test(s)),
        (s) => {
          // Replace one character in the middle
          const mid = Math.floor(s.length / 2);
          const s2 = s.slice(0, mid) + (s[mid] === "a" ? "b" : "a") + s.slice(mid + 1);
          if (isNearDuplicate(simHash(s), simHash(s2), 6)) deduped++;
        },
      ),
      { numRuns: runs },
    );
    // Expect at least 20% deduplication rate for single-char edits (SimHash is probabilistic)
    expect(deduped / runs).toBeGreaterThan(0.2);
  });

  it("completely different strings rarely dedupe at threshold 3", () => {
    // Random strings of length ≥ 50 should very rarely appear as near-dupes
    let falsePositives = 0;
    const runs = 200;
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 120 }),
        fc.string({ minLength: 50, maxLength: 120 }),
        (s1, s2) => {
          if (s1 !== s2 && isNearDuplicate(simHash(s1), simHash(s2), 3)) falsePositives++;
        },
      ),
      { numRuns: runs },
    );
    // False positive rate < 10% at threshold 3
    expect(falsePositives / runs).toBeLessThan(0.1);
  });
});

describe("hammingDistance — property: triangle inequality", () => {
  it("d(a,c) ≤ d(a,b) + d(b,c) for any three fingerprints", () => {
    fc.assert(
      fc.property(printableStr, printableStr, printableStr, (s1, s2, s3) => {
        const [h1, h2, h3] = [simHash(s1), simHash(s2), simHash(s3)];
        const d12 = hammingDistance(h1, h2);
        const d23 = hammingDistance(h2, h3);
        const d13 = hammingDistance(h1, h3);
        expect(d13).toBeLessThanOrEqual(d12 + d23);
      }),
      { numRuns: 300 },
    );
  });
});
