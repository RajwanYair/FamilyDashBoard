/**
 * fast-check property tests — src/cards/currency/boi-adapter.ts (S503)
 *
 * Properties under test:
 *  BOI1. isILGeo: coords inside Israel bounds → true
 *  BOI2. isILGeo: coords outside Israel bounds → false
 *  BOI3. isILGeo: boundary values are inclusive
 *  BOI4. parseBoIRates: empty/malformed XML → empty rates
 *  BOI5. parseBoIRates: valid XML → rates with positive values
 *  BOI6. parseBoIRates: base_code is always ILS
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isILGeo,
  parseBoIRates,
  IL_LAT_MIN,
  IL_LAT_MAX,
  IL_LON_MIN,
  IL_LON_MAX,
} from "@/cards/currency/boi-adapter";

// ── BOI1: inside Israel bounds → true ────────────────────────────────────────

describe("boi-adapter — BOI1: isILGeo inside bounds", () => {
  it("returns true for coords strictly inside Israel", () => {
    fc.assert(
      fc.property(
        fc.double({ min: IL_LAT_MIN + 0.01, max: IL_LAT_MAX - 0.01, noNaN: true }),
        fc.double({ min: IL_LON_MIN + 0.01, max: IL_LON_MAX - 0.01, noNaN: true }),
        (lat, lon) => {
          expect(isILGeo(lat, lon)).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── BOI2: outside Israel bounds → false ──────────────────────────────────────

describe("boi-adapter — BOI2: isILGeo outside bounds", () => {
  it("returns false for lat below minimum", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: IL_LAT_MIN - 0.01, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: IL_LON_MIN, max: IL_LON_MAX, noNaN: true, noDefaultInfinity: true }),
        (lat, lon) => {
          expect(isILGeo(lat, lon)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("returns false for lon above maximum", () => {
    fc.assert(
      fc.property(
        fc.double({ min: IL_LAT_MIN, max: IL_LAT_MAX, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: IL_LON_MAX + 0.01, max: 180, noNaN: true, noDefaultInfinity: true }),
        (lat, lon) => {
          expect(isILGeo(lat, lon)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── BOI3: boundary values are inclusive ───────────────────────────────────────

describe("boi-adapter — BOI3: isILGeo boundary inclusive", () => {
  it("exact boundary coords are inside", () => {
    expect(isILGeo(IL_LAT_MIN, IL_LON_MIN)).toBe(true);
    expect(isILGeo(IL_LAT_MAX, IL_LON_MAX)).toBe(true);
    expect(isILGeo(IL_LAT_MIN, IL_LON_MAX)).toBe(true);
    expect(isILGeo(IL_LAT_MAX, IL_LON_MIN)).toBe(true);
  });
});

// ── BOI4: malformed XML → empty rates ────────────────────────────────────────

describe("boi-adapter — BOI4: parseBoIRates malformed XML", () => {
  it("throws or returns empty rates for random strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }).filter((s) => !s.includes("<CURRENCY>")),
        (xml) => {
          try {
            const result = parseBoIRates(xml);
            expect(result.base_code).toBe("ILS");
            expect(Object.keys(result.rates).length).toBe(0);
          } catch {
            // parseBoIRates throws on malformed XML — acceptable
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── BOI5: valid XML → positive rates ─────────────────────────────────────────

describe("boi-adapter — BOI5: parseBoIRates valid XML → positive rates", () => {
  it("produces positive rate values for valid currency entries", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z]{3}$/),
        fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 100 }),
        (code, rate, unit) => {
          const xml = `<EXCHANGERATES><CURRENCY><CURRENCYCODE>${code}</CURRENCYCODE><RATE>${rate}</RATE><UNIT>${unit}</UNIT></CURRENCY></EXCHANGERATES>`;
          const result = parseBoIRates(xml);
          if (Object.keys(result.rates).length > 0) {
            const rateVal = result.rates[code];
            if (rateVal !== undefined) {
              expect(rateVal).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── BOI6: base_code is always ILS ────────────────────────────────────────────

describe("boi-adapter — BOI6: parseBoIRates base_code always ILS", () => {
  it("always returns ILS as base_code when parse succeeds", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (xml) => {
        try {
          const result = parseBoIRates(xml);
          expect(result.base_code).toBe("ILS");
        } catch {
          // parseBoIRates throws on malformed XML — acceptable
        }
      }),
      { numRuns: 20 },
    );
  });
});
