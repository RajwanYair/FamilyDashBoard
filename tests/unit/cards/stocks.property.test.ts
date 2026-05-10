/**
 * fast-check property tests — src/cards/stocks/stocks.ts ( , 570)
 *
 * Properties under test:
 *  ST1. fmtPrice: ≥1000 → no decimals, comma-formatted
 *  ST2. fmtPrice: 10–999 → 2 decimal places
 *  ST3. fmtPrice: < 10 → 4 decimal places (unless ^VIX)
 *  ST4. formatVolume: ≥ 1B → suffix "B"
 *  ST5. formatVolume: ≥ 1M → suffix "M"
 *  ST6. formatVolume: ≥ 1K → suffix "K"
 *  ST7. priceInRange52w: result ∈ [0, 1] when range is valid
 *  ST8. priceInRange52w: low ≥ high → null
 *  ST9. portfolioChange: empty → null
 *  ST10. portfolioChange: same prev and cur → 0%
 *  ST11. sectorEmoji: known symbol → specific emoji, unknown → "📈"
 *  ST12. portfolioChange: all prev=0 → null
 *  ST13. portfolioChange: positive gain → positive percentage
 *  ST14. fmtPrice: VIX always 2 decimals
 *  ST15. priceInRange52w: price at low → 0, at high → 1
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  fmtPrice,
  formatVolume,
  priceInRange52w,
  portfolioChange,
  sectorEmoji,
} from "@/cards/stocks/stocks";

// ── ST1: fmtPrice ≥ 1000 ────────────────────────────────────────────────────

describe("stocks — ST1: fmtPrice ≥ 1000", () => {
  it("no decimal point in output", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 999999 }), (p) => {
        const result = fmtPrice(p, "AAPL");
        expect(result).not.toContain(".");
      }),
      { numRuns: 20 },
    );
  });
});

// ── ST2: fmtPrice 10–999 ────────────────────────────────────────────────────

describe("stocks — ST2: fmtPrice 10–999", () => {
  it("exactly 2 decimal places", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 999.99, noNaN: true, noDefaultInfinity: true }),
        (p) => {
          const result = fmtPrice(p, "MSFT");
          const parts = result.split(".");
          expect(parts.length).toBe(2);
          expect(parts[1]!.length).toBe(2);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ST3: fmtPrice < 10, not VIX ─────────────────────────────────────────────

describe("stocks — ST3: fmtPrice < 10", () => {
  it("4 decimal places for non-VIX symbols", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 9.99, noNaN: true, noDefaultInfinity: true }),
        (p) => {
          const result = fmtPrice(p, "PENNY");
          const parts = result.split(".");
          expect(parts.length).toBe(2);
          expect(parts[1]!.length).toBe(4);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("^VIX still gets 2 decimal places below 10", () => {
    const result = fmtPrice(9.123456, "^VIX");
    expect(result).toBe("9.12");
  });
});

// ── ST4: formatVolume ≥ 1B ───────────────────────────────────────────────────

describe("stocks — ST4: formatVolume B", () => {
  it("≥ 1B → ends with 'B'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1_000_000_000, max: 100_000_000_000 }), (v) => {
        expect(formatVolume(v)).toMatch(/B$/);
      }),
      { numRuns: 15 },
    );
  });
});

// ── ST5: formatVolume ≥ 1M ───────────────────────────────────────────────────

describe("stocks — ST5: formatVolume M", () => {
  it("1M–999M → ends with 'M'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1_000_000, max: 999_999_999 }), (v) => {
        expect(formatVolume(v)).toMatch(/M$/);
      }),
      { numRuns: 15 },
    );
  });
});

// ── ST6: formatVolume ≥ 1K ───────────────────────────────────────────────────

describe("stocks — ST6: formatVolume K", () => {
  it("1K–999K → ends with 'K'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1_000, max: 999_999 }), (v) => {
        expect(formatVolume(v)).toMatch(/K$/);
      }),
      { numRuns: 15 },
    );
  });
});

// ── ST7: priceInRange52w ∈ [0,1] ─────────────────────────────────────────────

describe("stocks — ST7: priceInRange52w in [0,1]", () => {
  it("valid range → result in [0,1]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 500, noNaN: true, noDefaultInfinity: true }),
        (spread, low) => {
          const high = low + spread;
          const price = low + Math.random() * spread;
          const result = priceInRange52w(price, low, high);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(0);
          expect(result!).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── ST8: priceInRange52w invalid range ───────────────────────────────────────

describe("stocks — ST8: priceInRange52w invalid", () => {
  it("low ≥ high → null", () => {
    fc.assert(
      fc.property(fc.double({ min: 10, max: 500, noNaN: true, noDefaultInfinity: true }), (val) => {
        expect(priceInRange52w(val, val, val)).toBeNull();
        expect(priceInRange52w(val, val + 1, val)).toBeNull();
      }),
      { numRuns: 15 },
    );
  });
});

// ── ST9: portfolioChange empty ───────────────────────────────────────────────

describe("stocks — ST9: portfolioChange empty", () => {
  it("empty quotes → null", () => {
    expect(portfolioChange([])).toBeNull();
  });
});

// ── ST10: portfolioChange same prev/cur → 0% ────────────────────────────────

describe("stocks — ST10: portfolioChange flat", () => {
  it("prev === cur → 0%", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }), {
          minLength: 1,
          maxLength: 5,
        }),
        (prices) => {
          const quotes = prices.map((p) => ({ prev: p, cur: p }));
          expect(portfolioChange(quotes)).toBeCloseTo(0);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ST11: sectorEmoji ─────────────────────────────────────────────────────────

describe("stocks — ST11: sectorEmoji", () => {
  it("known symbols → specific emoji", () => {
    expect(sectorEmoji("AAPL")).toBe("🍎");
    expect(sectorEmoji("INTC")).toBe("🔵");
  });

  it("unknown symbol → 📈", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s)),
        (sym) => {
          expect(sectorEmoji(sym)).toBe("📈");
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ST12: portfolioChange all prev=0 → null ─────────────────────────────────

describe("stocks — ST12: portfolioChange zero prev", () => {
  it("all prev=0 → null", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }), {
          minLength: 1,
          maxLength: 5,
        }),
        (curs) => {
          const quotes = curs.map((c) => ({ prev: 0, cur: c }));
          expect(portfolioChange(quotes)).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ST13: portfolioChange positive gain ──────────────────────────────────────

describe("stocks — ST13: portfolioChange positive gain", () => {
  it("cur > prev → positive percentage", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
            fc.double({ min: 0.01, max: 1, noNaN: true }),
          ),
          { minLength: 1, maxLength: 5 },
        ),
        (pairs) => {
          const quotes = pairs.map(([prev, gain]) => ({ prev, cur: prev * (1 + gain) }));
          const result = portfolioChange(quotes);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThan(0);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── ST14: fmtPrice VIX always 2 decimals ────────────────────────────────────

describe("stocks — ST14: fmtPrice VIX", () => {
  it("^VIX always gets 2 decimal places", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 99, noNaN: true, noDefaultInfinity: true }),
        (price) => {
          const result = fmtPrice(price, "^VIX");
          expect(result).toMatch(/\.\d{2}$/);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── ST15: priceInRange52w boundary values ────────────────────────────────────

describe("stocks — ST15: priceInRange52w boundaries", () => {
  it("price at low → 0, price at high → 1", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }),
        (a, b) => {
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          if (high <= low) return;
          expect(priceInRange52w(low, low, high)).toBeCloseTo(0);
          expect(priceInRange52w(high, low, high)).toBeCloseTo(1);
        },
      ),
      { numRuns: 30 },
    );
  });
});
