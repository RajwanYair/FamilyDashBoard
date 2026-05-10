/**
 * fast-check property tests — src/cards/countdown/countdown.ts ( , extended )
 *
 * Properties under test:
 *  CD1. urgencyClass: days ≤ 1 → "cd-urgent-pulse"
 *  CD2. urgencyClass: 2–7 → "cd-urgent-amber"
 *  CD3. urgencyClass: > 7 → ""
 *  CD4. daysLabel: 0 → "היום! 🎉", 1 → "מחר", N≥2 → includes N
 *  CD5. advanceAnnualDate always returns a future or today date
 *  CD6. advanceMonthlyDate always returns a future or today date
 *  CD7. computeProgress: null when start >= target
 *  CD8. computeProgress: result ∈ [0, 1] when valid
 *  CD9. hebrewDayOfWeek: always returns non-empty string
 *  CD10. daysLabel: 0 → "היום", 1 → "מחר", N≥2 → includes digits
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  urgencyClass,
  daysLabel,
  advanceAnnualDate,
  advanceMonthlyDate,
  computeProgress,
  hebrewDayOfWeek,
} from "@/cards/countdown/countdown";

// ── CD1: urgencyClass ≤ 1 → "cd-urgent-pulse" ───────────────────────────────

describe("countdown — CD1: urgencyClass ≤ 1", () => {
  it("days 0 or 1 → cd-urgent-pulse", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 1 }), (d) => {
        expect(urgencyClass(d)).toBe("cd-urgent-pulse");
      }),
      { numRuns: 20 },
    );
  });
});

// ── CD2: urgencyClass 2–7 → "cd-urgent-amber" ───────────────────────────────

describe("countdown — CD2: urgencyClass 2–7", () => {
  it("days 2–7 → cd-urgent-amber", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 7 }), (d) => {
        expect(urgencyClass(d)).toBe("cd-urgent-amber");
      }),
      { numRuns: 20 },
    );
  });
});

// ── CD3: urgencyClass > 7 → "" ──────────────────────────────────────────────

describe("countdown — CD3: urgencyClass > 7", () => {
  it("days > 7 → empty string", () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 10000 }), (d) => {
        expect(urgencyClass(d)).toBe("");
      }),
      { numRuns: 20 },
    );
  });
});

// ── CD4: daysLabel ───────────────────────────────────────────────────────────

describe("countdown — CD4: daysLabel", () => {
  it("0 → 'היום! 🎉'", () => {
    expect(daysLabel(0)).toBe("היום! 🎉");
  });

  it("1 → 'מחר'", () => {
    expect(daysLabel(1)).toBe("מחר");
  });

  it("N≥2 → contains N", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 9999 }), (d) => {
        const label = daysLabel(d);
        expect(label).toContain(String(d));
        expect(label).toContain("ימים");
      }),
      { numRuns: 30 },
    );
  });
});

// ── CD5: advanceAnnualDate always in future ──────────────────────────────────

describe("countdown — CD5: advanceAnnualDate future", () => {
  it("returned date is ≥ today", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2024 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (y, m, d) => {
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const result = advanceAnnualDate(dateStr);
          const resultDate = new Date(`${result}T00:00:00`);
          // Must be today or in the future
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          expect(resultDate.getTime()).toBeGreaterThanOrEqual(todayStart.getTime());
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── CD6: advanceMonthlyDate always in future ─────────────────────────────────

describe("countdown — CD6: advanceMonthlyDate future", () => {
  it("returned date is ≥ today", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2024 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (y, m, d) => {
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const result = advanceMonthlyDate(dateStr);
          const resultDate = new Date(`${result}T00:00:00`);
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          expect(resultDate.getTime()).toBeGreaterThanOrEqual(todayStart.getTime());
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── CD7: computeProgress null when start >= target ───────────────────────────

describe("countdown — CD7: computeProgress null on invalid range", () => {
  it("returns null when startMs >= targetMs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 2_000_000_000_000 }),
        fc.integer({ min: 0, max: 1000 }),
        (target, offset) => {
          const start = target + offset; // start >= target
          expect(computeProgress(start, target)).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── CD8: computeProgress ∈ [0, 1] when valid ────────────────────────────────

describe("countdown — CD8: computeProgress bounds", () => {
  it("result is between 0 and 1 when start < target and target in future", () => {
    const now = Date.now();
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.integer({ min: 1, max: 100_000_000 }),
        (pastOffset, futureOffset) => {
          const start = now - pastOffset;
          const target = now + futureOffset;
          const result = computeProgress(start, target);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(0);
          expect(result!).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── CD9: hebrewDayOfWeek always non-empty ────────────────────────────────────

describe("countdown — CD9: hebrewDayOfWeek non-empty", () => {
  it("returns a non-empty string for any valid date", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), (dayOffset) => {
        const d = new Date(2025, 0, 5 + dayOffset); // Sun-Sat
        const result = hebrewDayOfWeek(d);
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 7 },
    );
  });
});

// ── CD10: daysLabel content check ────────────────────────────────────────────

describe("countdown — CD10: daysLabel content", () => {
  it("N≥2 includes digits in the label", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 999 }), (n) => {
        const label = daysLabel(n);
        expect(label).toContain(String(n));
      }),
      { numRuns: 20 },
    );
  });
});
