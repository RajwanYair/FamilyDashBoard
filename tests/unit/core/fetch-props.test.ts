/**
 * Property-based tests for src/core/fetch.ts (FP1–FP10)
 *
 * Uses fast-check to verify lock and network-failure-streak invariants
 * for any key string / failure count, and classifyFetchError categorization.
 */

import fc from "fast-check";
import { beforeEach, describe, it, expect } from "vitest";
import {
  acquireLock,
  releaseLock,
  clearFetchLocks,
  recordFetchSuccess,
  recordFetchFailure,
  getConsecutiveFailures,
  isNetworkOffline,
  classifyFetchError,
} from "@/core/fetch";
import type { FetchErrorCategory } from "@/core/fetch";

beforeEach(() => {
  clearFetchLocks();
  recordFetchSuccess(); // resets consecutive-failure counter
});

/** Arbitrary lock-name strings. */
const lockNameArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim() === s);

// ── FP1: first acquireLock for any fresh key returns true ─────────────────────

describe("FP1: acquireLock returns true for any previously-unseen key", () => {
  it("fresh key acquires successfully", () => {
    fc.assert(
      fc.property(lockNameArb, (name) => {
        clearFetchLocks();
        return acquireLock(name) === true;
      }),
      { numRuns: 60 },
    );
  });
});

// ── FP2: second acquireLock for the same key (without release) returns false ──

describe("FP2: duplicate acquireLock without release returns false", () => {
  it("second call for the same key returns false", () => {
    fc.assert(
      fc.property(lockNameArb, (name) => {
        clearFetchLocks();
        acquireLock(name); // first — should succeed
        return acquireLock(name) === false; // second — must fail
      }),
      { numRuns: 60 },
    );
  });
});

// ── FP3: acquireLock succeeds after releaseLock for the same key ──────────────

describe("FP3: acquireLock succeeds again after releaseLock", () => {
  it("acquire → release → acquire is always true for any key", () => {
    fc.assert(
      fc.property(lockNameArb, (name) => {
        clearFetchLocks();
        acquireLock(name);
        releaseLock(name);
        return acquireLock(name) === true;
      }),
      { numRuns: 60 },
    );
  });
});

// ── FP4: clearFetchLocks allows any previously-held key to be re-acquired ─────

describe("FP4: clearFetchLocks re-enables all previously-held keys", () => {
  it("every key can be acquired after clearFetchLocks", () => {
    fc.assert(
      fc.property(fc.array(lockNameArb, { minLength: 1, maxLength: 10 }), (names) => {
        clearFetchLocks();
        const unique = [...new Set(names)];
        // Lock all unique names
        for (const n of unique) acquireLock(n);
        // After clear, all must be re-acquirable
        clearFetchLocks();
        return unique.every((n) => acquireLock(n) === true);
      }),
      { numRuns: 100 },
    );
  });
});

// ── FP5: N consecutive recordFetchFailure → getConsecutiveFailures = N ────────

describe("FP5: recordFetchFailure increments consecutive count exactly", () => {
  it("N failures from clean state → getConsecutiveFailures === N", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        recordFetchSuccess(); // reset
        for (let i = 0; i < n; i++) recordFetchFailure();
        const count = getConsecutiveFailures();
        const offline = isNetworkOffline();
        recordFetchSuccess(); // cleanup
        return count === n && (n >= 3 ? offline : !offline);
      }),
      { numRuns: 100 },
    );
  });
});

// ── FP6: classifyFetchError always returns a valid FetchErrorCategory ─────────

const validCategories: FetchErrorCategory[] = [
  "timeout",
  "network",
  "http-error",
  "invalid-json",
  "cors",
  "unknown",
];

describe("FP6: classifyFetchError always returns a valid category", () => {
  it("arbitrary Error messages produce a valid category", () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const result = classifyFetchError(new Error(msg));
        return validCategories.includes(result);
      }),
      { numRuns: 60 },
    );
  });
});

// ── FP7: classifyFetchError on non-Error values returns 'unknown' ─────────────

describe("FP7: classifyFetchError on non-Error values", () => {
  it("number, string, null, undefined → unknown", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.string(), fc.constant(null), fc.constant(undefined)),
        (val) => {
          return classifyFetchError(val) === "unknown";
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── FP8: classifyFetchError — DOMException AbortError always → timeout ────────

describe("FP8: DOMException AbortError always classifies as timeout", () => {
  it("any message with AbortError name → timeout", () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const err = new DOMException(msg, "AbortError");
        return classifyFetchError(err) === "timeout";
      }),
      { numRuns: 50 },
    );
  });
});

// ── FP9: classifyFetchError — SyntaxError always → invalid-json ───────────────

describe("FP9: SyntaxError always classifies as invalid-json", () => {
  it("any SyntaxError message → invalid-json", () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        return classifyFetchError(new SyntaxError(msg)) === "invalid-json";
      }),
      { numRuns: 50 },
    );
  });
});

// ── FP10: classifyFetchError — TypeError with 'Failed to fetch' → network ────

describe("FP10: TypeError 'Failed to fetch' variants → network", () => {
  it("message containing 'failed to fetch' → network", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (prefix) => {
        const err = new TypeError(`${prefix} Failed to fetch`);
        return classifyFetchError(err) === "network";
      }),
      { numRuns: 50 },
    );
  });
});
