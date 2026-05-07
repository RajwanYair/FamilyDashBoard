/**
 * fast-check property tests — src/cards/motivation/motivation.ts ( , 571)
 *
 * Properties under test:
 *  MO1. pickNextQuoteIndex: poolSize=1 always returns 0
 *  MO2. pickNextQuoteIndex: result ∈ [0, poolSize)
 *  MO3. pickNextQuoteIndex: avoids recently-used indices when possible
 *  MO4. getThemeForDay: always returns a valid MotivationCategory
 *  MO5. getThemeForDay: maps 0–6 weekday to DAY_THEME_MAP
 *  MO6. getQuotesByCategory: null → all quotes
 *  MO7. pickNextQuoteIndex: result is always integer
 *  MO8. getQuotesByCategory: specific category → all quotes have that category
 *  MO9. pickNextQuoteIndex: full window → still returns valid index
 *  MO10. DAY_THEME_MAP: length is exactly 7
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  pickNextQuoteIndex,
  getThemeForDay,
  getQuotesByCategory,
  DAY_THEME_MAP,
  SOURCE_META,
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

// ── MO7: pickNextQuoteIndex always returns integer ───────────────────────────

describe("motivation — MO7: pickNextQuoteIndex integer result", () => {
  it("result is always a non-negative integer", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 0, maxLength: 10 }),
        (poolSize, used) => {
          const result = pickNextQuoteIndex(poolSize, used);
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── MO8: getQuotesByCategory specific category ──────────────────────────────

describe("motivation — MO8: getQuotesByCategory filtering", () => {
  it("specific category → all returned quotes match", () => {
    for (const cat of VALID_CATEGORIES) {
      const quotes = getQuotesByCategory(cat as never);
      for (const q of quotes) {
        expect(q.category).toBe(cat);
      }
    }
  });
});

// ── MO9: pickNextQuoteIndex full window ──────────────────────────────────────

describe("motivation — MO9: pickNextQuoteIndex full window", () => {
  it("when all indices used, still returns valid index", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (poolSize) => {
          const allUsed = Array.from({ length: poolSize }, (_, i) => i);
          const result = pickNextQuoteIndex(poolSize, allUsed);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThan(poolSize);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── MO10: DAY_THEME_MAP and SOURCE_META structural invariants ────────────────

describe("motivation — MO10: structural invariants", () => {
  it("DAY_THEME_MAP has exactly 7 entries", () => {
    expect(DAY_THEME_MAP).toHaveLength(7);
  });

  it("SOURCE_META has label and cls for each source", () => {
    for (const meta of Object.values(SOURCE_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.cls.length).toBeGreaterThan(0);
    }
  });
});
