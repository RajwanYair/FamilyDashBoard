/**
 * fast-check property tests — src/core/perf.ts (Sprint 479)
 *
 * Properties under test:
 *  PF1. formatVital returns "–" for null regardless of key.
 *  PF2. formatVital for ms-based keys always ends in " ms" for any finite number.
 *  PF3. formatVital for CLS always has exactly 3 decimal places for any finite number.
 *  PF4. rateVital returns "unknown" for null regardless of key.
 *  PF5. rateVital always returns one of the 4 known rating literals for any finite number.
 *  PF6. rateVital boundary monotonicity — higher values never improve the rating.
 *  PF7. checkAllVitalBudgets returns exactly 6 entries (one per PerfVitals key).
 *  PF8. checkAllVitalBudgets with budget=Infinity always passes for any measured value.
 *  PF9. recordCardInitTime rounds to 2 decimal places.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  formatVital,
  rateVital,
  checkAllVitalBudgets,
  _resetPerfObserver,
  recordCardInitTime,
  getCardTimings,
  type PerfVitals,
} from "@/core/perf";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const vitalKeyArb = fc.constantFrom<keyof PerfVitals>(
  "lcp",
  "cls",
  "inp",
  "fcp",
  "ttfb",
  "startup",
);

const msKeyArb = fc.constantFrom<keyof PerfVitals>("lcp", "inp", "fcp", "ttfb", "startup");

const finitePositiveArb = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

const ratingLiterals = ["good", "needs-improvement", "poor", "unknown"] as const;

const cardIdArb = fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0);

// ── PF1: formatVital null → "–" ──────────────────────────────────────────────

describe("perf — PF1: formatVital null always returns –", () => {
  it("any vital key with null returns –", () => {
    fc.assert(
      fc.property(vitalKeyArb, (key) => {
        expect(formatVital(key, null)).toBe("–");
      }),
      { numRuns: 30 },
    );
  });
});

// ── PF2: ms-based keys format as "X ms" ──────────────────────────────────────

describe("perf — PF2: ms-based keys format ends with ' ms'", () => {
  it("lcp/inp/fcp/ttfb/startup always end with ' ms'", () => {
    fc.assert(
      fc.property(msKeyArb, finitePositiveArb, (key, value) => {
        const result = formatVital(key, value);
        expect(result).toMatch(/ ms$/);
      }),
      { numRuns: 100 },
    );
  });
});

// ── PF3: CLS format has 3 decimal places ─────────────────────────────────────

describe("perf — PF3: CLS format has exactly 3 decimal places", () => {
  it("cls values always formatted with 3 decimals", () => {
    fc.assert(
      fc.property(finitePositiveArb, (value) => {
        const result = formatVital("cls", value);
        expect(result).toMatch(/^\d+\.\d{3}$/);
      }),
      { numRuns: 100 },
    );
  });
});

// ── PF4: rateVital null → "unknown" ──────────────────────────────────────────

describe("perf — PF4: rateVital null always returns unknown", () => {
  it("any vital key with null returns unknown", () => {
    fc.assert(
      fc.property(vitalKeyArb, (key) => {
        expect(rateVital(key, null)).toBe("unknown");
      }),
      { numRuns: 30 },
    );
  });
});

// ── PF5: rateVital returns known literals ────────────────────────────────────

describe("perf — PF5: rateVital returns one of 4 known ratings", () => {
  it("any key + finite number → good | needs-improvement | poor", () => {
    fc.assert(
      fc.property(vitalKeyArb, finitePositiveArb, (key, value) => {
        const result = rateVital(key, value);
        expect(ratingLiterals).toContain(result);
        expect(result).not.toBe("unknown"); // not null → never unknown
      }),
      { numRuns: 150 },
    );
  });
});

// ── PF6: rateVital monotonicity ──────────────────────────────────────────────

describe("perf — PF6: higher values never improve rating", () => {
  const ratingOrder = { good: 0, "needs-improvement": 1, poor: 2, unknown: -1 };

  it("for any key, value+delta never rates better than value", () => {
    fc.assert(
      fc.property(
        vitalKeyArb,
        finitePositiveArb,
        fc.double({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true }),
        (key, base, delta) => {
          const rateBase = rateVital(key, base);
          const rateHigher = rateVital(key, base + delta);
          expect(ratingOrder[rateHigher]).toBeGreaterThanOrEqual(ratingOrder[rateBase]);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── PF7: checkAllVitalBudgets always returns 6 entries ───────────────────────

describe("perf — PF7: checkAllVitalBudgets returns 6 entries", () => {
  beforeEach(() => {
    _resetPerfObserver();
  });

  it("always has exactly 6 budget results", () => {
    const results = checkAllVitalBudgets();
    expect(results).toHaveLength(6);
    const keys = results.map((r) => r.key);
    expect(keys).toContain("lcp");
    expect(keys).toContain("cls");
    expect(keys).toContain("inp");
    expect(keys).toContain("fcp");
    expect(keys).toContain("ttfb");
    expect(keys).toContain("startup");
  });
});

// ── PF8: budget=Infinity always passes ───────────────────────────────────────

describe("perf — PF8: budget=Infinity always passes", () => {
  beforeEach(() => {
    _resetPerfObserver();
  });

  it("all entries are pass or pending with infinite budgets", () => {
    const infiniteBudgets: Record<keyof PerfVitals, number> = {
      lcp: Infinity,
      cls: Infinity,
      inp: Infinity,
      fcp: Infinity,
      ttfb: Infinity,
      startup: Infinity,
    };
    const results = checkAllVitalBudgets(infiniteBudgets);
    for (const r of results) {
      expect(["pass", "pending"]).toContain(r.status);
    }
  });
});

// ── PF9: recordCardInitTime rounds to 2 decimals ────────────────────────────

describe("perf — PF9: recordCardInitTime rounds to 2 decimal places", () => {
  it("stored timing has at most 2 decimal digits", () => {
    fc.assert(
      fc.property(
        cardIdArb,
        fc.double({ min: 0, max: 60_000, noNaN: true, noDefaultInfinity: true }),
        (id, duration) => {
          recordCardInitTime(id, duration);
          const stored = getCardTimings().get(id);
          expect(stored).toBeDefined();
          // Check at most 2 decimal places
          const parts = String(stored).split(".");
          if (parts[1]) {
            expect(parts[1].length).toBeLessThanOrEqual(2);
          }
        },
      ),
      { numRuns: 80 },
    );
  });
});
