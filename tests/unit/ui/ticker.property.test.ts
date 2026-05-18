/**
 * fast-check property tests — src/ui/ticker.ts (halacha ticker module)
 *
 * Properties under test:
 *  HT1. getHalachaData() returns null before init (module fresh-import state)
 *  HT2. applyTickerSpeed idempotence: calling twice with same value → same CSS
 *  HT3. applyTickerSpeed range [1..5] always produces a valid integer-second duration
 *  HT4. speed out of range [min, max]: CSS still set (clamped behaviour)
 *  HT5. initTicker with missing DOM element does not throw
 *  HT6. applyTickerSpeed monotonicity: higher speed → shorter or equal duration
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { applyTickerSpeed, getHalachaData } from "@/ui/ticker";

// ── HT1: getHalachaData returns null before any fetch ────────────────────────

describe("ticker — HT1: getHalachaData initial state", () => {
  it("returns null before ticker has loaded data", () => {
    // Module state is fresh per test file (vitest isolates)
    expect(getHalachaData()).toBeNull();
  });
});

// ── HT2: applyTickerSpeed idempotence ────────────────────────────────────────

describe("ticker — HT2: applyTickerSpeed idempotence", () => {
  it("calling twice with the same value produces identical CSS", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (speed) => {
        applyTickerSpeed(speed);
        const first = document.documentElement.style.getPropertyValue("--ticker-duration");
        applyTickerSpeed(speed);
        const second = document.documentElement.style.getPropertyValue("--ticker-duration");
        expect(first).toBe(second);
      }),
      { numRuns: 5 },
    );
  });
});

// ── HT3: valid range produces integer-second string ──────────────────────────

describe("ticker — HT3: valid speed → integer seconds CSS", () => {
  it("result matches /^\\d+s$/", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (speed) => {
        applyTickerSpeed(speed);
        const val = document.documentElement.style.getPropertyValue("--ticker-duration");
        expect(val).toMatch(/^\d+s$/);
      }),
      { numRuns: 5 },
    );
  });
});

// ── HT4: out-of-range speed still sets CSS (clamped) ─────────────────────────

describe("ticker — HT4: out-of-range speed clamped", () => {
  it("extreme values still produce a valid CSS duration", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -100, max: 0 }), fc.integer({ min: 6, max: 100 })),
        (speed) => {
          applyTickerSpeed(speed);
          const val = document.documentElement.style.getPropertyValue("--ticker-duration");
          expect(val).toMatch(/^\d+s$/);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── HT5: initTicker does not throw without DOM ───────────────────────────────

describe("ticker — HT5: initTicker safe without DOM", () => {
  beforeEach(() => {
    // Ensure no ticker element exists
    document.getElementById("ticker")?.remove();
  });

  it("does not throw when #ticker is missing", async () => {
    const { initTicker } = await import("@/ui/ticker");
    expect(() => initTicker()).not.toThrow();
  });
});

// ── HT6: applyTickerSpeed monotonicity ───────────────────────────────────────

describe("ticker — HT6: higher speed → shorter duration", () => {
  it("speed n+1 produces duration ≤ speed n", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (speed) => {
        applyTickerSpeed(speed);
        const durA = parseInt(document.documentElement.style.getPropertyValue("--ticker-duration"), 10);
        applyTickerSpeed(speed + 1);
        const durB = parseInt(document.documentElement.style.getPropertyValue("--ticker-duration"), 10);
        expect(durB).toBeLessThanOrEqual(durA);
      }),
      { numRuns: 4 },
    );
  });
});
