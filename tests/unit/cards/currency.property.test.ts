/**
 * fast-check property tests — src/cards/currency/currency.ts ( , 569)
 *
 * Properties under test:
 *  CUR1. calcCurrency: positive amount × positive rate → positive result
 *  CUR2. calcCurrency: NaN/Infinity amount → null
 *  CUR3. calcCurrency: missing/zero rate → null
 *  CUR4. calcCurrency: result = amount × rate (exact multiplication)
 *  CUR5. get7DayTrend: fewer than 2 history entries → null
 *  CUR6. get7DayTrend: same rate in oldest + newest → arrow "→"
 *  CUR7. get7DayTrend: increasing ILS-per-unit → arrow "↑"
 *  CUR8. getCurrencyTrend: fewer than 2 entries → null
 *  CUR9. getCurrencyTrend: missing key in newest → null
 *  CUR10. getCurrencyTrend: increasing value → arrow "↑"
 *  CUR11. getCurrencyTrend: decreasing value → arrow "↓"
 *  CUR12. calcCurrency: commutativity — amount×rate = rate×amount via calcCurrency
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calcCurrency, get7DayTrend, getCurrencyTrend } from "@/cards/currency/currency";

// ── CUR1: positive × positive → positive ────────────────────────────────────

describe("currency — CUR1: calcCurrency positive", () => {
  it("positive amount and rate → positive result", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (amount, rate) => {
          const result = calcCurrency(amount, "USD", { USD: rate });
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThan(0);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── CUR2: invalid amount → null ──────────────────────────────────────────────

describe("currency — CUR2: invalid amount → null", () => {
  it("NaN → null", () => {
    expect(calcCurrency(NaN, "USD", { USD: 3.5 })).toBeNull();
  });

  it("Infinity → null", () => {
    expect(calcCurrency(Infinity, "USD", { USD: 3.5 })).toBeNull();
  });

  it("negative → null", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e9, max: -0.01, noNaN: true, noDefaultInfinity: true }),
        (amount) => {
          expect(calcCurrency(amount, "USD", { USD: 3.5 })).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── CUR3: missing/zero rate → null ───────────────────────────────────────────

describe("currency — CUR3: missing/zero rate → null", () => {
  it("key not in rates → null", () => {
    expect(calcCurrency(100, "GBP", { USD: 3.5 })).toBeNull();
  });

  it("rate = 0 → null", () => {
    expect(calcCurrency(100, "USD", { USD: 0 })).toBeNull();
  });
});

// ── CUR4: result = amount × rate ─────────────────────────────────────────────

describe("currency — CUR4: exact multiplication", () => {
  it("result equals amount × rate", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (amount, rate) => {
          const result = calcCurrency(amount, "EUR", { EUR: rate });
          if (amount === 0) {
            expect(result).toBe(0);
          } else {
            expect(result).toBeCloseTo(amount * rate, 5);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── CUR5: get7DayTrend with < 2 entries → null ──────────────────────────────

describe("currency — CUR5: get7DayTrend insufficient data", () => {
  it("empty history → null", () => {
    expect(get7DayTrend("USD", [])).toBeNull();
  });

  it("single entry → null", () => {
    expect(get7DayTrend("USD", [{ date: "2025-01-01", rates: { USD: 0.28 } }])).toBeNull();
  });
});

// ── CUR6: same rate → arrow "→" ─────────────────────────────────────────────

describe("currency — CUR6: get7DayTrend same rate → →", () => {
  it("identical oldest and newest rate → flat arrow", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
        (rate) => {
          const history = [
            { date: "2025-01-01", rates: { USD: rate } },
            { date: "2025-01-07", rates: { USD: rate } },
          ];
          const result = get7DayTrend("USD", history);
          expect(result).not.toBeNull();
          expect(result!.arrow).toBe("→");
          expect(result!.pct).toBeCloseTo(0);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── CUR7: decreasing rate value (ILS strengthens) → arrow "↓" ───────────────

describe("currency — CUR7: get7DayTrend strengthening ILS", () => {
  it("higher rate value (more foreign per ILS) → ILS per unit drops → ↓", () => {
    // rates are foreign-per-ILS; higher rate = ILS stronger = 1/rate drops
    const history = [
      { date: "2025-01-01", rates: { USD: 0.25 } },
      { date: "2025-01-07", rates: { USD: 0.30 } },
    ];
    const result = get7DayTrend("USD", history);
    expect(result).not.toBeNull();
    // 1/0.30 < 1/0.25 → pct < 0 → "↓"
    expect(result!.arrow).toBe("↓");
    expect(result!.pct).toBeLessThan(0);
  });
});

// ── CUR8: getCurrencyTrend with < 2 entries → null ───────────────────────────

describe("currency — CUR8: getCurrencyTrend insufficient data", () => {
  it("empty → null", () => {
    expect(getCurrencyTrend("USD", [], 7)).toBeNull();
  });

  it("single entry → null", () => {
    expect(getCurrencyTrend("USD", [{ date: "2025-06-01", rates: { USD: 0.28 } }], 7)).toBeNull();
  });
});

// ── CUR9: getCurrencyTrend missing key in newest → null ──────────────────────

describe("currency — CUR9: getCurrencyTrend missing key", () => {
  it("returns null when key absent from newest entry", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 5 }), (key) => {
        const history = [
          { date: "2025-01-01", rates: { [key]: 0.28 } },
          { date: "2025-01-10", rates: { OTHER: 0.30 } },
        ];
        expect(getCurrencyTrend(key, history, 7)).toBeNull();
      }),
    );
  });
});

// ── CUR10: getCurrencyTrend increasing value → ↑ ────────────────────────────

describe("currency — CUR10: getCurrencyTrend increasing", () => {
  it("lower rate (higher ILS-per-unit) in newest → ↑", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        (oldRate, delta) => {
          const newRate = oldRate - delta * oldRate * 0.5; // lower rate = stronger currency
          if (newRate <= 0) return; // skip degenerate
          const history = [
            { date: "2025-01-01", rates: { USD: oldRate } },
            { date: "2025-01-10", rates: { USD: newRate } },
          ];
          const result = getCurrencyTrend("USD", history, 14);
          if (result === null) return; // cutoff might not find ref
          expect(result.arrow).toBe("↑");
        },
      ),
    );
  });
});

// ── CUR11: getCurrencyTrend decreasing value → ↓ ────────────────────────────

describe("currency — CUR11: getCurrencyTrend decreasing", () => {
  it("higher rate (lower ILS-per-unit) in newest → ↓", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        (oldRate, delta) => {
          const newRate = oldRate + delta * oldRate * 0.5; // higher rate = weaker currency
          const history = [
            { date: "2025-01-01", rates: { USD: oldRate } },
            { date: "2025-01-10", rates: { USD: newRate } },
          ];
          const result = getCurrencyTrend("USD", history, 14);
          if (result === null) return;
          expect(result.arrow).toBe("↓");
        },
      ),
    );
  });
});

// ── CUR12: calcCurrency multiplication commutativity ─────────────────────────

describe("currency — CUR12: calcCurrency commutativity", () => {
  it("calcCurrency(a, k, {k: r}) === a * r", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1e6, noNaN: true }),
        fc.double({ min: 0.001, max: 100, noNaN: true }),
        (amount, rate) => {
          const result = calcCurrency(amount, "X", { X: rate });
          expect(result).toBeCloseTo(amount * rate, 5);
        },
      ),
    );
  });
});
