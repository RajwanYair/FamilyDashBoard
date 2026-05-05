/**
 * fast-check property tests — src/core/utils.ts (Sprint 470)
 *
 * Properties under test:
 *  UT1. clamp: result is always in [min, max] for any finite triple.
 *  UT2. clamp: identity when value ∈ [min, max].
 *  UT3. clamp: min ≤ max constraint is respected (edge: min === max).
 *  UT4. pad2: result always has at least 2 characters for any non-negative integer.
 *  UT5. decomposeDuration: reconstruction invariant — d*86400 + h*3600 + m*60 + s ≡ floor(ms/1000) for ms ≥ 0.
 *  UT6. decomposeDuration: each part is within valid calendar ranges (0 ≤ h < 24, 0 ≤ m < 60, 0 ≤ s < 60).
 *  UT7. computeMoonPhase: result always has a non-empty emoji and non-empty label.
 *  UT8. computeMoonPhase: result is one of the 8 known phase objects (emoji ∈ MOON_EMOJIS).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { clamp, pad2, decomposeDuration, computeMoonPhase } from "@/core/utils";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Finite double in a reasonable range (avoids NaN / ±Infinity). */
const finiteArb = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 });

/** A valid (min, max) pair where min ≤ max, and a value in any position. */
const clampTripleArb = fc
  .tuple(finiteArb, finiteArb, finiteArb)
  .map(([a, b, c]) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return { value: c, min: lo, max: hi };
  });

/** A value already in [min, max]. */
const inRangeTripleArb = fc
  .tuple(finiteArb, finiteArb)
  .map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) }))
  .chain(({ min, max }) =>
    fc.double({ noNaN: true, noDefaultInfinity: true, min, max }).map((value) => ({
      value,
      min,
      max,
    })),
  );

/** Non-negative integer up to 365 days in ms. */
const durationMsArb = fc.integer({ min: 0, max: 365 * 24 * 3600 * 1000 });

/** Any Date representable as a safe integer timestamp. */
const anyDateArb = fc
  .integer({ min: 0, max: 2_000_000_000_000 })
  .map((ms) => new Date(ms));

// ── UT1: clamp — result always in [min, max] ──────────────────────────────────

describe("utils — UT1: clamp result is always in [min, max]", () => {
  it("clamp(v, lo, hi) ∈ [lo, hi] for any finite triple", () => {
    fc.assert(
      fc.property(clampTripleArb, ({ value, min, max }) => {
        const result = clamp(value, min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
      }),
      { numRuns: 200 },
    );
  });
});

// ── UT2: clamp — identity when value already in range ────────────────────────

describe("utils — UT2: clamp is identity when value ∈ [min, max]", () => {
  it("clamp(v, lo, hi) === v when lo ≤ v ≤ hi", () => {
    fc.assert(
      fc.property(inRangeTripleArb, ({ value, min, max }) => {
        expect(clamp(value, min, max)).toBe(value);
      }),
      { numRuns: 200 },
    );
  });
});

// ── UT3: clamp — min === max edge case ───────────────────────────────────────

describe("utils — UT3: clamp(v, k, k) === k for any v and k", () => {
  it("degenerate [k, k] range always returns k", () => {
    fc.assert(
      fc.property(finiteArb, finiteArb, (value, k) => {
        expect(clamp(value, k, k)).toBe(k);
      }),
      { numRuns: 200 },
    );
  });
});

// ── UT4: pad2 — result always ≥ 2 characters ─────────────────────────────────

describe("utils — UT4: pad2 always returns at least 2 characters", () => {
  it("pad2(n).length >= 2 for any non-negative integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9999 }), (n) => {
        expect(pad2(n).length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 200 },
    );
  });

  it("pad2(n) starts with '0' for single-digit inputs", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (n) => {
        expect(pad2(n)).toBe(`0${n}`);
      }),
      { numRuns: 10 },
    );
  });
});

// ── UT5: decomposeDuration — reconstruction invariant ────────────────────────

describe("utils — UT5: decomposeDuration reconstruction invariant", () => {
  it("d*86400 + h*3600 + m*60 + s === floor(ms/1000) for any ms >= 0", () => {
    fc.assert(
      fc.property(durationMsArb, (ms) => {
        const { days, hours, minutes, seconds } = decomposeDuration(ms);
        const reconstructed = days * 86_400 + hours * 3600 + minutes * 60 + seconds;
        expect(reconstructed).toBe(Math.floor(ms / 1000));
      }),
      { numRuns: 500 },
    );
  });

  it("negative ms clamps to 0 (all parts === 0)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: -1 }), (ms) => {
        const parts = decomposeDuration(ms);
        expect(parts.days).toBe(0);
        expect(parts.hours).toBe(0);
        expect(parts.minutes).toBe(0);
        expect(parts.seconds).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ── UT6: decomposeDuration — valid calendar ranges ───────────────────────────

describe("utils — UT6: decomposeDuration parts are in valid calendar ranges", () => {
  it("hours ∈ [0, 23], minutes ∈ [0, 59], seconds ∈ [0, 59]", () => {
    fc.assert(
      fc.property(durationMsArb, (ms) => {
        const { hours, minutes, seconds } = decomposeDuration(ms);
        expect(hours).toBeGreaterThanOrEqual(0);
        expect(hours).toBeLessThanOrEqual(23);
        expect(minutes).toBeGreaterThanOrEqual(0);
        expect(minutes).toBeLessThanOrEqual(59);
        expect(seconds).toBeGreaterThanOrEqual(0);
        expect(seconds).toBeLessThanOrEqual(59);
      }),
      { numRuns: 500 },
    );
  });
});

// ── UT7: computeMoonPhase — always returns non-empty emoji + label ────────────

describe("utils — UT7: computeMoonPhase always returns valid emoji + label", () => {
  it("emoji and label are non-empty strings for any date", () => {
    fc.assert(
      fc.property(anyDateArb, (date) => {
        const { emoji, label } = computeMoonPhase(date);
        expect(typeof emoji).toBe("string");
        expect(emoji.length).toBeGreaterThan(0);
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });
});

// ── UT8: computeMoonPhase — result is one of 8 known phases ──────────────────

describe("utils — UT8: computeMoonPhase result emoji is one of the 8 moon phase emojis", () => {
  const MOON_EMOJIS = new Set(["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"]);

  it("emoji ∈ {🌑, 🌒, 🌓, 🌔, 🌕, 🌖, 🌗, 🌘} for any date", () => {
    fc.assert(
      fc.property(anyDateArb, (date) => {
        const { emoji } = computeMoonPhase(date);
        expect(MOON_EMOJIS.has(emoji)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
