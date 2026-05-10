/**
 * Property-based tests for sync.ts backoff (SYP1–SYP6)
 *
 * Uses fast-check to verify exponential-backoff invariants for any key string.
 * Uses unique-per-run keys (via fc.uuid()) to avoid module-state bleed.
 */

import fc from "fast-check";
import { afterEach, describe, it, expect } from "vitest";
import { recordFailure, recordSuccess, getBackoffDelay, getFailedPanes } from "@/core/sync";

/** Unique-ish key generator to avoid cross-test state bleed. */
const keyArb = fc.uuid();

/** Small integer representing a number of consecutive failures (1–5 cap). */
const failCountArb = fc.integer({ min: 1, max: 8 });

// ── SYP1: recordFailure always increases delay, capped at 2^5 = 32 ───────────

describe("SYP1: recordFailure monotonically increases delay, capped at 32", () => {
  it("each additional failure either increases delay or keeps it at 32", () => {
    fc.assert(
      fc.property(keyArb, failCountArb, (key, n) => {
        // Clean slate for this key
        recordSuccess(key);

        let prev = getBackoffDelay(key);
        for (let i = 0; i < n; i++) {
          recordFailure(key);
          const next = getBackoffDelay(key);
          if (next < prev) {
            recordSuccess(key);
            return false; // delay must not decrease
          }
          prev = next;
        }
        recordSuccess(key); // cleanup
        return true;
      }),
      { numRuns: 100 },
    );
  });
});

// ── SYP2: recordSuccess resets delay back to 1 (2^0) ─────────────────────────

describe("SYP2: recordSuccess resets delay to 1 for any key", () => {
  it("getBackoffDelay returns 1 immediately after recordSuccess", () => {
    fc.assert(
      fc.property(keyArb, failCountArb, (key, n) => {
        recordSuccess(key);
        for (let i = 0; i < n; i++) recordFailure(key);
        recordSuccess(key);
        const delay = getBackoffDelay(key);
        return delay === 1;
      }),
      { numRuns: 100 },
    );
  });
});

// ── SYP3: getBackoffDelay is always a power of 2 ──────────────────────────────

describe("SYP3: getBackoffDelay is always a power of 2", () => {
  it("delay is 2^n for any failure count n", () => {
    fc.assert(
      fc.property(keyArb, failCountArb, (key, n) => {
        recordSuccess(key);
        for (let i = 0; i < n; i++) recordFailure(key);
        const delay = getBackoffDelay(key);
        recordSuccess(key); // cleanup
        // A power of 2: (x & (x - 1)) === 0 and x > 0
        return delay > 0 && (delay & (delay - 1)) === 0;
      }),
      { numRuns: 100 },
    );
  });
});

// ── SYP4: getBackoffDelay is bounded in [1, 32] ───────────────────────────────

describe("SYP4: getBackoffDelay is bounded between 1 and 32 inclusive", () => {
  it("delay is always in the range [1, 32] regardless of failure count", () => {
    fc.assert(
      fc.property(keyArb, failCountArb, (key, n) => {
        recordSuccess(key);
        for (let i = 0; i < n; i++) recordFailure(key);
        const delay = getBackoffDelay(key);
        recordSuccess(key); // cleanup
        return delay >= 1 && delay <= 32;
      }),
      { numRuns: 100 },
    );
  });
});

// ── SYP5: getFailedPanes includes any key that has ≥1 failure ─────────────────

describe("SYP5: getFailedPanes includes keys with ≥1 failure", () => {
  it("every key with recordFailure appears in getFailedPanes", () => {
    fc.assert(
      fc.property(fc.array(keyArb, { minLength: 1, maxLength: 6 }), (keys) => {
        // Ensure clean slate for each key
        const unique = [...new Set(keys)];
        for (const k of unique) recordSuccess(k);

        // Record at least 1 failure per key
        for (const k of unique) recordFailure(k);

        const failed = new Set(getFailedPanes().map((p) => p.key));
        const allPresent = unique.every((k) => failed.has(k));

        // Cleanup
        for (const k of unique) recordSuccess(k);
        return allPresent;
      }),
      { numRuns: 50 },
    );
  });
});

// ── SYP6: N failures → delay is exactly min(2^N, 32) ──────────────────────────

describe("SYP6: N consecutive failures produce delay = min(2^N, 32)", () => {
  it("delay equals min(2^N, 32) for N failures from a clean slate", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 1, max: 8 }), (key, n) => {
        recordSuccess(key); // reset
        for (let i = 0; i < n; i++) recordFailure(key);
        const delay = getBackoffDelay(key);
        recordSuccess(key); // cleanup
        const expected = Math.min(Math.pow(2, n), 32);
        return delay === expected;
      }),
      { numRuns: 100 },
    );
  });
});

// ── Cleanup guard: ensure no test leaves stale state ─────────────────────────

afterEach(() => {
  // getFailedPanes() returns all dirty keys — reset them all
  const dirty = getFailedPanes().map((p) => p.key);
  for (const key of dirty) recordSuccess(key);
});
