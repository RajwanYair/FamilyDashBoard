/**
 * fast-check property tests — src/cards/motivation/motivation.ts (Sprint 522)
 *
 * Properties under test:
 *  MO1. pickNextQuoteIndex: poolSize=1 always returns 0
 *  MO2. pickNextQuoteIndex: result ∈ [0, poolSize)
 *  MO3. pickNextQuoteIndex: avoids recently-used indices when possible
 *  MO4. getThemeForDay: always returns a valid MotivationCategory
 *  MO5. getThemeForDay: maps 0–6 weekday to DAY_THEME_MAP
 *  MO6. getQuotesByCategory: null → all quotes
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  pickNextQuoteIndex,
  getThemeForDay,
  getQuotesByCategory,
  DAY_THEME_MAP,
} from "@/cards/motivation/motivation";

const VALID_CATEGORIES = [
  "gratitude", "courage", "calm", "general", "success", "morning", "shabbat",
];

// ── MO1: poolSize=1 → always 0 ──────────────────────────────────────────────

describe("motivation — MO1: poolSize=1", () => {
  it("always returns 0", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 0 }), { minLength: 0, maxLength: 5 }),
        (used) => {
          expect(pickNextQuoteIndex(1, used)).toBe(0);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── MO2: result ∈ [0, poolSize) ──────────────────────────────────────────────

describe("motivation — MO2: result in range", () => {
  it("result is non-negative and < poolSize", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 0, maxLength: 10 }),
        (poolSize, used) => {
          const idx = pickNextQuoteIndex(poolSize, used);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(poolSize);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── MO3: avoids recently-used ────────────────────────────────────────────────

describe("motivation — MO3: avoids used", () => {
  it("does not pick from used when alternatives exist", () => {
    // Pool of 5, used = [0,1,2] → must pick from [3,4]
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(pickNextQuoteIndex(5, [0, 1, 2]));
    }
    // All results should be 3 or 4
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThanOrEqual(4);
    }
  });
});

// ── MO4: getThemeForDay valid category ───────────────────────────────────────

describe("motivation — MO4: getThemeForDay valid", () => {
  it("always returns a valid category", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (d) => {
          const cat = getThemeForDay(d);
          expect(VALID_CATEGORIES).toContain(cat);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── MO5: getThemeForDay maps to DAY_THEME_MAP ───────────────────────────────

describe("motivation — MO5: getThemeForDay day-of-week mapping", () => {
  it("each day maps to the expected theme", () => {
    for (let dow = 0; dow <= 6; dow++) {
      // Create a date that falls on this day-of-week
      // Jan 5, 2025 is Sunday (dow=0)
      const d = new Date(2025, 0, 5 + dow);
      expect(getThemeForDay(d)).toBe(DAY_THEME_MAP[dow]);
    }
  });
});

// ── MO6: getQuotesByCategory null → all ──────────────────────────────────────

describe("motivation — MO6: getQuotesByCategory null", () => {
  it("null returns all quotes (non-empty)", () => {
    const all = getQuotesByCategory(null);
    expect(all.length).toBeGreaterThan(0);
  });

  it("filtered ≤ all", () => {
    const all = getQuotesByCategory(null);
    for (const cat of VALID_CATEGORIES) {
      const filtered = getQuotesByCategory(cat as never);
      expect(filtered.length).toBeLessThanOrEqual(all.length);
    }
  });
});
