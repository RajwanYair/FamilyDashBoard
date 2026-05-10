/**
 * fast-check property tests — src/cards/weather/nws-adapter.ts
 *
 * Properties under test:
 *  NW1. fToC: freezing point invariant (32°F → 0°C)
 *  NW2. fToC: boiling point invariant (212°F → 100°C)
 *  NW3. fToC: monotonically increasing
 *  NW4. fToC: output is always an integer (Math.round)
 *  NW5. nwsPhraseToWmoCode: output always in valid WMO code set
 *  NW6. nwsPhraseToWmoCode: case-insensitive
 *  NW7. nwsPhraseToWmoCode: never throws
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { fToC, nwsPhraseToWmoCode } from "@/cards/weather/nws-adapter";

const VALID_WMO_CODES = new Set([0, 1, 2, 3, 45, 51, 61, 71, 95]);

// ── NW1: fToC freezing point ─────────────────────────────────────────────────

describe("nws-adapter — NW1: fToC freezing point", () => {
  it("32°F → 0°C (exact)", () => {
    expect(fToC(32)).toBe(0);
  });
});

// ── NW2: fToC boiling point ──────────────────────────────────────────────────

describe("nws-adapter — NW2: fToC boiling point", () => {
  it("212°F → 100°C (exact)", () => {
    expect(fToC(212)).toBe(100);
  });
});

// ── NW3: fToC monotonically increasing ──────────────────────────────────────

describe("nws-adapter — NW3: fToC monotonically increasing", () => {
  it("a > b ⟹ fToC(a) >= fToC(b)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -460, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.5, max: 500, noNaN: true, noDefaultInfinity: true }),
        (base, delta) => {
          expect(fToC(base + delta)).toBeGreaterThanOrEqual(fToC(base));
        },
      ),
    );
  });
});

// ── NW4: fToC output is integer ─────────────────────────────────────────────

describe("nws-adapter — NW4: fToC always returns integer", () => {
  it("output is always an integer for any finite input", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -460, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (f) => {
          const result = fToC(f);
          expect(Number.isInteger(result)).toBe(true);
        },
      ),
    );
  });
});

// ── NW5: nwsPhraseToWmoCode output in valid set ─────────────────────────────

describe("nws-adapter — NW5: nwsPhraseToWmoCode valid code set", () => {
  it("output is always a valid WMO code", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (phrase) => {
        const code = nwsPhraseToWmoCode(phrase);
        expect(VALID_WMO_CODES.has(code)).toBe(true);
      }),
    );
  });
});

// ── NW6: nwsPhraseToWmoCode case-insensitive ────────────────────────────────

describe("nws-adapter — NW6: nwsPhraseToWmoCode case-insensitive", () => {
  it("same result regardless of case", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 60 }), (phrase) => {
        expect(nwsPhraseToWmoCode(phrase)).toBe(nwsPhraseToWmoCode(phrase.toUpperCase()));
      }),
    );
  });
});

// ── NW7: nwsPhraseToWmoCode never throws ────────────────────────────────────

describe("nws-adapter — NW7: nwsPhraseToWmoCode never throws", () => {
  it("total function — never throws for any string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (phrase) => {
        expect(() => nwsPhraseToWmoCode(phrase)).not.toThrow();
      }),
    );
  });
});
