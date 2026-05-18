/**
 * fast-check property tests — src/core/temporal.ts (CAL-T / H-T scaffold)
 *
 * Properties under test:
 *  TM1. nowMs(): always a finite, positive integer
 *  TM2. startOfDayMs(): result always has hours/minutes/seconds/ms = 0
 *  TM3. startOfDayMs(): non-mutating — input Date is unchanged after call
 *  TM4. parsePlainDateMs(): always returns local midnight regardless of input hour
 *  TM5. parsePlainDateMs(): month-1 round-trip (ISO 1-indexed → Date 0-indexed → Date.getMonth()+1 = original)
 *  TM6. addYears(): non-mutating; result.getFullYear() = input.getFullYear() + n
 *  TM7. addMonths(): non-mutating; result.getTime() ≠ input.getTime() when n ≠ 0
 *  TM8. toISODateString(): always produces "YYYY-MM-DD" (10-char, digits+hyphens)
 *  TM9. toISODateString() + parsePlainDateMs() round-trip: year/month/day survive
 * TM10. startOfDayMs(): result ≤ input epoch-ms (midnight ≤ that moment)
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  nowMs,
  startOfDayMs,
  parsePlainDateMs,
  addYears,
  addMonths,
  toISODateString,
  addDays,
  diffDays,
  isSameDay,
  daysUntil,
} from "@/core/temporal";

// ── TM1: nowMs is always a finite positive integer ───────────────────────────

describe("temporal — TM1: nowMs returns finite positive integer", () => {
  it("result is a finite positive integer", () => {
    const n = nowMs();
    expect(Number.isFinite(n)).toBe(true);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });
});

// ── TM2: startOfDayMs clears all sub-day components ─────────────────────────

describe("temporal — TM2: startOfDayMs produces local midnight", () => {
  it("hours, minutes, seconds, milliseconds are all zero for arbitrary dates", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary timestamps in years 2000–2099 (MS epoch range)
        fc.integer({ min: 946684800000, max: 4102444800000 }),
        (ms) => {
          const result = new Date(startOfDayMs(new Date(ms)));
          expect(result.getHours()).toBe(0);
          expect(result.getMinutes()).toBe(0);
          expect(result.getSeconds()).toBe(0);
          expect(result.getMilliseconds()).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM3: startOfDayMs does not mutate its input ──────────────────────────────

describe("temporal — TM3: startOfDayMs is non-mutating", () => {
  it("input Date is unchanged after call", () => {
    fc.assert(
      fc.property(fc.integer({ min: 946684800000, max: 4102444800000 }), (ms) => {
        const original = new Date(ms);
        const originalTime = original.getTime();
        startOfDayMs(original);
        expect(original.getTime()).toBe(originalTime);
      }),
      { numRuns: 50 },
    );
  });
});

// ── TM4: parsePlainDateMs returns local midnight for any valid ISO date ───────

describe("temporal — TM4: parsePlainDateMs always yields local midnight", () => {
  it("hours/minutes/seconds/ms are zero for any YYYY-MM-DD string", () => {
    // Generate valid year/month/day combinations
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2099 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }), // stay within all months (28 is safe)
        (year, month, day) => {
          const iso = toISODateString(year, month, day);
          const result = new Date(parsePlainDateMs(iso));
          expect(result.getHours()).toBe(0);
          expect(result.getMinutes()).toBe(0);
          expect(result.getSeconds()).toBe(0);
          expect(result.getMilliseconds()).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM5: parsePlainDateMs month round-trip (ISO 1-indexed ↔ Date 0-indexed) ─

describe("temporal — TM5: parsePlainDateMs month is 1-indexed in ISO", () => {
  it("Date.getMonth()+1 equals the month passed to toISODateString", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2099 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const iso = toISODateString(year, month, day);
          const result = new Date(parsePlainDateMs(iso));
          // Date.getMonth() is 0-indexed; adding 1 should match the ISO month
          expect(result.getMonth() + 1).toBe(month);
          expect(result.getDate()).toBe(day);
          expect(result.getFullYear()).toBe(year);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM6: addYears is non-mutating and advances the year by exactly n ─────────

describe("temporal — TM6: addYears non-mutating, year advances exactly", () => {
  it("input is unchanged; output year = input year + n", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 946684800000, max: 3000000000000 }),
        fc.integer({ min: -50, max: 50 }),
        (ms, n) => {
          const original = new Date(ms);
          const originalTime = original.getTime();
          const result = addYears(original, n);

          // non-mutating
          expect(original.getTime()).toBe(originalTime);

          // year advances by exactly n
          expect(result.getFullYear()).toBe(original.getFullYear() + n);

          // month and day are preserved (as long as leap-year overflow doesn't apply)
          // We only check months that can't overflow: any month other than Feb
          if (original.getMonth() !== 1 || original.getDate() <= 28) {
            expect(result.getMonth()).toBe(original.getMonth());
            expect(result.getDate()).toBe(original.getDate());
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM7: addMonths is non-mutating ───────────────────────────────────────────

describe("temporal — TM7: addMonths is non-mutating", () => {
  it("input is unchanged after addMonths call", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 946684800000, max: 3000000000000 }),
        fc.integer({ min: -24, max: 24 }),
        (ms, n) => {
          const original = new Date(ms);
          const originalTime = original.getTime();
          addMonths(original, n);
          expect(original.getTime()).toBe(originalTime);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM8: toISODateString always produces "YYYY-MM-DD" ────────────────────────

describe("temporal — TM8: toISODateString produces valid YYYY-MM-DD", () => {
  it("result is exactly 10 chars matching /^\\d{4}-\\d{2}-\\d{2}$/", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2199 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        (year, month, day) => {
          const result = toISODateString(year, month, day);
          expect(result).toHaveLength(10);
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM9: toISODateString + parsePlainDateMs round-trip ───────────────────────

describe("temporal — TM9: toISODateString + parsePlainDateMs round-trip", () => {
  it("year/month/day survive the full round-trip", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2099 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }), // day ≤28 avoids month-overflow in all months
        (year, month, day) => {
          const iso = toISODateString(year, month, day);
          const roundTripped = new Date(parsePlainDateMs(iso));
          expect(roundTripped.getFullYear()).toBe(year);
          expect(roundTripped.getMonth() + 1).toBe(month);
          expect(roundTripped.getDate()).toBe(day);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── TM10: startOfDayMs result ≤ input epoch-ms ───────────────────────────────

describe("temporal — TM10: startOfDayMs result ≤ input", () => {
  it("midnight is always ≤ the point-in-time that day", () => {
    fc.assert(
      fc.property(fc.integer({ min: 946684800000, max: 4102444800000 }), (ms) => {
        const midnight = startOfDayMs(new Date(ms));
        expect(midnight).toBeLessThanOrEqual(ms);
      }),
      { numRuns: 50 },
    );
  });
});

// ── TM11: addDays is inverse of negative addDays ─────────────────────────────

describe("temporal — TM11: addDays round-trip", () => {
  it("addDays(d, n) then addDays(result, -n) returns same calendar day", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 946684800000, max: 4102444800000 }),
        fc.integer({ min: -365, max: 365 }),
        (ms, n) => {
          const d = new Date(ms);
          const result = addDays(addDays(d, n), -n);
          expect(isSameDay(d, result)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM12: diffDays is antisymmetric ──────────────────────────────────────────

describe("temporal — TM12: diffDays antisymmetry", () => {
  it("diffDays(a, b) === -diffDays(b, a)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 946684800000, max: 4102444800000 }),
        fc.integer({ min: 946684800000, max: 4102444800000 }),
        (msA, msB) => {
          const a = new Date(msA);
          const b = new Date(msB);
          expect(diffDays(a, b) + diffDays(b, a)).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── TM13: isSameDay reflexive ────────────────────────────────────────────────

describe("temporal — TM13: isSameDay reflexive", () => {
  it("any Date is the same day as itself", () => {
    fc.assert(
      fc.property(fc.integer({ min: 946684800000, max: 4102444800000 }), (ms) => {
        const d = new Date(ms);
        expect(isSameDay(d, d)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

// ── TM14: addDays non-mutating ───────────────────────────────────────────────

describe("temporal — TM14: addDays non-mutating", () => {
  it("input Date is unchanged after addDays", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 946684800000, max: 4102444800000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (ms, n) => {
          const d = new Date(ms);
          const before = d.getTime();
          addDays(d, n);
          expect(d.getTime()).toBe(before);
        },
      ),
      { numRuns: 50 },
    );
  });
});
