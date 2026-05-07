/**
 * fast-check property tests — src/core/sync.ts backoff logic (Sprint 498)
 *
 * Properties under test:
 *  SY1. recordFailure increases backoff delay (up to 2^5 = 32x).
 *  SY2. recordSuccess resets backoff delay to 1x (2^0).
 *  SY3. getBackoffDelay is 2^(failure count), capped at 2^5.
 *  SY4. getFailedPanes returns only panes with failures > 0.
 *  SY5. getBackoffDelay is 1 (2^0) for unknown keys.
 *  SY6. getFailedPanes count matches number of distinct failure-recorded keys (Sprint 599)
 *  SY7. clearSyncDots does not affect backoff state (Sprint 599)
 *  SY8. Interleaved fail/success sequences — last action determines state (Sprint 599)
 *  SY9. Backoff is always >= 1 and <= 32 for any failure sequence (Sprint 599)
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  recordFailure,
  recordSuccess,
  getBackoffDelay,
  getFailedPanes,
  clearSyncDots,
} from "@/core/sync";

// ── Setup ─────────────────────────────────────────────────────────────────────

// sync.ts uses an internal Map for backoff. recordSuccess clears the key.
// clearSyncDots only clears DOM refs but not backoff map. We need a workaround:
// recordSuccess for each key before each test.
function resetBackoff(keys: string[]): void {
  for (const k of keys) recordSuccess(k);
}

beforeEach(() => {
  clearSyncDots();
  // Reset known test keys
  resetBackoff(["test-a", "test-b", "test-c", "wx", "cur", "stocks"]);
});

// ── Arbitraries ───────────────────────────────────────────────────────────────

const keyArb = fc.constantFrom("test-a", "test-b", "test-c");

// ── SY1: recordFailure increases delay ───────────────────────────────────────

describe("sync — SY1: recordFailure increases backoff", () => {
  it("each failure increases getBackoffDelay", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 1, max: 10 }), (key, n) => {
        recordSuccess(key);
        let prevDelay = getBackoffDelay(key);
        for (let i = 0; i < n; i++) {
          recordFailure(key);
          const newDelay = getBackoffDelay(key);
          expect(newDelay).toBeGreaterThanOrEqual(prevDelay);
          prevDelay = newDelay;
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── SY2: recordSuccess resets delay ──────────────────────────────────────────

describe("sync — SY2: recordSuccess resets backoff", () => {
  it("after success, delay returns to 1", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 1, max: 8 }), (key, failures) => {
        recordSuccess(key);
        for (let i = 0; i < failures; i++) recordFailure(key);
        recordSuccess(key);
        expect(getBackoffDelay(key)).toBe(1);
      }),
      { numRuns: 30 },
    );
  });
});

// ── SY3: getBackoffDelay is 2^failures capped at 32 ─────────────────────────

describe("sync — SY3: getBackoffDelay is 2^(min(failures, 5))", () => {
  it("returns expected exponential value", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 0, max: 10 }), (key, n) => {
        recordSuccess(key);
        for (let i = 0; i < n; i++) recordFailure(key);
        const expected = Math.pow(2, Math.min(n, 5));
        expect(getBackoffDelay(key)).toBe(expected);
      }),
      { numRuns: 40 },
    );
  });
});

// ── SY4: getFailedPanes only returns keys with failures ──────────────────────

describe("sync — SY4: getFailedPanes filters out zero-failure keys", () => {
  it("only keys with recorded failures appear", () => {
    recordSuccess("test-a");
    recordSuccess("test-b");
    recordFailure("test-a");
    const panes = getFailedPanes();
    const keys = panes.map((p) => p.key);
    expect(keys).toContain("test-a");
    expect(keys).not.toContain("test-b");
  });
});

// ── SY5: unknown key has delay 1 ────────────────────────────────────────────

describe("sync — SY5: unknown key defaults to delay 1", () => {
  it("returns 1 for never-seen key", () => {
    expect(getBackoffDelay("never-registered-xyz")).toBe(1);
  });
});

// ── SY6: getFailedPanes count matches distinct failed keys ───────────────────

describe("sync — SY6: getFailedPanes count matches failed keys", () => {
  it("N distinct failed keys → at least N entries in getFailedPanes", () => {
    fc.assert(
      fc.property(
        fc.subarray(["test-a", "test-b", "test-c"], { minLength: 1, maxLength: 3 }),
        (keys) => {
          resetBackoff(["test-a", "test-b", "test-c"]);
          for (const k of keys) recordFailure(k);
          const panes = getFailedPanes();
          const failedKeys = panes.map((p) => p.key);
          for (const k of keys) {
            expect(failedKeys).toContain(k);
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── SY7: clearSyncDots does not reset backoff ────────────────────────────────

describe("sync — SY7: clearSyncDots preserves backoff", () => {
  it("delay is unchanged after clearSyncDots", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 1, max: 5 }), (key, failures) => {
        recordSuccess(key);
        for (let i = 0; i < failures; i++) recordFailure(key);
        const before = getBackoffDelay(key);
        clearSyncDots();
        expect(getBackoffDelay(key)).toBe(before);
      }),
      { numRuns: 20 },
    );
  });
});

// ── SY8: interleaved fail/success — last action determines ───────────────────

describe("sync — SY8: last action determines state", () => {
  it("ending with success → delay 1; ending with failure → delay > 1", () => {
    fc.assert(
      fc.property(
        keyArb,
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        (key, actions) => {
          recordSuccess(key);
          for (const isSuccess of actions) {
            if (isSuccess) recordSuccess(key);
            else recordFailure(key);
          }
          const lastWasSuccess = actions[actions.length - 1];
          if (lastWasSuccess) {
            expect(getBackoffDelay(key)).toBe(1);
          } else {
            expect(getBackoffDelay(key)).toBeGreaterThanOrEqual(2);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

// ── SY9: backoff always in [1, 32] ──────────────────────────────────────────

describe("sync — SY9: backoff bounded [1, 32]", () => {
  it("regardless of failure count, delay is between 1 and 32", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 0, max: 100 }), (key, failures) => {
        recordSuccess(key);
        for (let i = 0; i < failures; i++) recordFailure(key);
        const delay = getBackoffDelay(key);
        expect(delay).toBeGreaterThanOrEqual(1);
        expect(delay).toBeLessThanOrEqual(32);
      }),
      { numRuns: 50 },
    );
  });
});
