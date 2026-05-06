/**
 * fast-check property tests — src/ui/ticker.ts applyTickerSpeed (Sprint 541)
 *
 * Properties under test:
 *  TK1. applyTickerSpeed clamps input to [1,5]
 *  TK2. CSS --ticker-duration is set for valid speeds
 *  TK3. speeds outside [1,5] do not throw
 *  TK4. speed maps: 1→60s, 2→45s, 3→30s, 4→20s, 5→12s
 *  TK5. injectScrollKeyframes creates a style element
 *  TK6. injectScrollKeyframes content includes translateY
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { applyTickerSpeed } from "@/ui/ticker";
import { injectScrollKeyframes } from "@/ui/scroll";

// ── TK1: applyTickerSpeed clamps ─────────────────────────────────────────────

describe("ticker — TK1: applyTickerSpeed clamp", () => {
  it("values below 1 result in 60s (speed 1)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 0 }),
        (speed) => {
          applyTickerSpeed(speed);
          const val = document.documentElement.style.getPropertyValue("--ticker-duration");
          expect(val).toBe("60s");
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── TK2: valid speed sets CSS property ───────────────────────────────────────

describe("ticker — TK2: valid speed CSS", () => {
  it("sets --ticker-duration", () => {
    applyTickerSpeed(3);
    const val = document.documentElement.style.getPropertyValue("--ticker-duration");
    expect(val).toBe("30s");
  });
});

// ── TK3: extreme values do not throw ─────────────────────────────────────────

describe("ticker — TK3: extreme speeds safe", () => {
  it("does not throw for any integer", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (speed) => {
          expect(() => applyTickerSpeed(speed)).not.toThrow();
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── TK4: speed → duration mapping ───────────────────────────────────────────

describe("ticker — TK4: speed-duration map", () => {
  it("maps 1→60, 2→45, 3→30, 4→20, 5→12", () => {
    const expected: Record<number, string> = { 1: "60s", 2: "45s", 3: "30s", 4: "20s", 5: "12s" };
    for (const [speed, dur] of Object.entries(expected)) {
      applyTickerSpeed(Number(speed));
      expect(document.documentElement.style.getPropertyValue("--ticker-duration")).toBe(dur);
    }
  });
});

// ── TK5: injectScrollKeyframes creates style element ─────────────────────────

describe("scroll — TK5: injectScrollKeyframes", () => {
  it("creates a style element with given id", () => {
    injectScrollKeyframes("test-scroll-style", "testScroll", 200);
    const el = document.getElementById("test-scroll-style");
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("STYLE");
  });
});

// ── TK6: keyframe content includes translateY ────────────────────────────────

describe("scroll — TK6: keyframe content", () => {
  it("content includes translateY with the distance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 5000 }),
        (distance) => {
          const id = `scroll-prop-${distance}`;
          injectScrollKeyframes(id, `scrollAnim${distance}`, distance);
          const el = document.getElementById(id) as HTMLStyleElement | null;
          expect(el?.textContent).toContain(`translateY(-${distance}px)`);
        },
      ),
      { numRuns: 5 },
    );
  });
});
