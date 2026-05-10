/**
 * fast-check property tests — src/cards/stocks/tase-adapter.ts (S503)
 *
 * Properties under test:
 *  TA1. isTASETicker: ".TA" suffix + no caret → true
 *  TA2. isTASETicker: index tickers (^TA…) → false
 *  TA3. isTASETicker: no ".TA" suffix → false
 *  TA4. stripTASESuffix: removes ".TA" suffix
 *  TA5. stripTASESuffix: no-op for strings without ".TA"
 *  TA6. taseToYahooResponse: always returns chart.result array
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isTASETicker, stripTASESuffix, taseToYahooResponse } from "@/cards/stocks/tase-adapter";

// ── TA1: ".TA" suffix + no caret → true ─────────────────────────────────────

describe("tase-adapter — TA1: isTASETicker with .TA suffix", () => {
  it("returns true for non-index tickers ending in .TA", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z]{2,8}$/).filter((s) => !s.startsWith("^")),
        (base) => {
          expect(isTASETicker(`${base}.TA`)).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── TA2: index tickers → false ───────────────────────────────────────────────

describe("tase-adapter — TA2: isTASETicker index tickers", () => {
  it("returns false for index tickers starting with ^", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z0-9]{2,8}$/), (base) => {
        expect(isTASETicker(`^${base}.TA`)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});

// ── TA3: no ".TA" suffix → false ────────────────────────────────────────────

describe("tase-adapter — TA3: isTASETicker without .TA", () => {
  it("returns false for tickers without .TA suffix", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.toUpperCase().endsWith(".TA")),
        (symbol) => {
          expect(isTASETicker(symbol)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── TA4: stripTASESuffix removes ".TA" ───────────────────────────────────────

describe("tase-adapter — TA4: stripTASESuffix removes suffix", () => {
  it("strips .TA from end of symbol", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z]{2,8}$/), (base) => {
        expect(stripTASESuffix(`${base}.TA`)).toBe(base);
      }),
      { numRuns: 20 },
    );
  });
});

// ── TA5: stripTASESuffix no-op without .TA ───────────────────────────────────

describe("tase-adapter — TA5: stripTASESuffix no-op", () => {
  it("returns same string if no .TA suffix", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.toUpperCase().endsWith(".TA")),
        (symbol) => {
          expect(stripTASESuffix(symbol)).toBe(symbol);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── TA6: taseToYahooResponse always returns chart.result ─────────────────────

describe("tase-adapter — TA6: taseToYahooResponse structure", () => {
  it("returns a valid chart response shape", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.option(fc.integer({ min: 1, max: 99999 }), { nil: undefined }),
          name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
          symbol: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
          lastPrice: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), {
            nil: undefined,
          }),
          changePercent: fc.option(fc.double({ min: -100, max: 100, noNaN: true }), {
            nil: undefined,
          }),
          closingPrice: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), {
            nil: undefined,
          }),
          high52W: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), { nil: undefined }),
          low52W: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), { nil: undefined }),
          volume: fc.option(fc.integer({ min: 0, max: 1_000_000_000 }), { nil: undefined }),
        }),
        (share) => {
          const result = taseToYahooResponse(share);
          expect(result).toHaveProperty("chart");
          expect(result.chart).toHaveProperty("result");
          expect(Array.isArray(result.chart.result)).toBe(true);
          expect(result.chart.result.length).toBe(1);
        },
      ),
      { numRuns: 20 },
    );
  });
});
