/**
 * fast-check property tests — src/cards/countdown/countdown.ts (Sprint 512)
 *
 * Properties under test:
 *  CD1. urgencyClass: days ≤ 1 → "cd-urgent-pulse"
 *  CD2. urgencyClass: 2–7 → "cd-urgent-amber"
 *  CD3. urgencyClass: > 7 → ""
 *  CD4. daysLabel: 0 → "היום! 🎉", 1 → "מחר", N≥2 → includes N
 *  CD5. advanceAnnualDate always returns a future or today date
 *  CD6. advanceMonthlyDate always returns a future or today date
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { urgencyClass, daysLabel, advanceAnnualDate, advanceMonthlyDate } from "@/cards/countdown/countdown";

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
