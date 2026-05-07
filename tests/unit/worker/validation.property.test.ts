/**
 * fast-check property tests — worker/src/utils/validation.ts 
 *
 * Properties under test:
 *  VL1. requireParam throws for missing/empty params, returns trimmed value otherwise.
 *  VL2. requireLat accepts [-90, 90], rejects outside.
 *  VL3. requireLon accepts [-180, 180], rejects outside.
 *  VL4. requireYear accepts [2000, 2100], rejects outside.
 *  VL5. requireSymbol accepts alphanumeric + .-^ up to 20 chars, rejects otherwise.
 *  VL6. requireHttpsUrl accepts valid HTTPS URLs, rejects HTTP/invalid.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ValidationError,
  requireParam,
  requireLat,
  requireLon,
  requireYear,
  requireSymbol,
  requireHttpsUrl,
} from "../../../worker/src/utils/validation";

// ── Helper ────────────────────────────────────────────────────────────────────

function makeUrl(params: Record<string, string>): URL {
  const u = new URL("https://example.com/test");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u;
}

// ── VL1: requireParam ────────────────────────────────────────────────────────

describe("validation — VL1: requireParam", () => {
  it("returns trimmed non-empty values", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (val) => {
          const url = makeUrl({ q: val });
          expect(requireParam(url, "q")).toBe(val.trim());
        },
      ),
      { numRuns: 30 },
    );
  });

  it("throws for missing param", () => {
    const url = makeUrl({});
    expect(() => requireParam(url, "q")).toThrow(ValidationError);
  });

  it("throws for whitespace-only param", () => {
    const url = makeUrl({ q: "   " });
    expect(() => requireParam(url, "q")).toThrow(ValidationError);
  });
});

// ── VL2: requireLat ──────────────────────────────────────────────────────────

describe("validation — VL2: requireLat", () => {
  it("accepts valid latitudes [-90, 90]", () => {
    fc.assert(
      fc.property(fc.double({ min: -90, max: 90, noNaN: true }), (lat) => {
        const url = makeUrl({ lat: String(lat) });
        expect(requireLat(url)).toBeCloseTo(lat, 5);
      }),
      { numRuns: 30 },
    );
  });

  it("rejects out-of-range", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 91, max: 9999, noNaN: true }),
        (lat) => {
          const url = makeUrl({ lat: String(lat) });
          expect(() => requireLat(url)).toThrow(ValidationError);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── VL3: requireLon ──────────────────────────────────────────────────────────

describe("validation — VL3: requireLon", () => {
  it("accepts valid longitudes [-180, 180]", () => {
    fc.assert(
      fc.property(fc.double({ min: -180, max: 180, noNaN: true }), (lon) => {
        const url = makeUrl({ lon: String(lon) });
        expect(requireLon(url)).toBeCloseTo(lon, 5);
      }),
      { numRuns: 30 },
    );
  });

  it("rejects out-of-range", () => {
    const url = makeUrl({ lon: "200" });
    expect(() => requireLon(url)).toThrow(ValidationError);
  });
});

// ── VL4: requireYear ─────────────────────────────────────────────────────────

describe("validation — VL4: requireYear", () => {
  it("accepts 2000..2100", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2000, max: 2100 }), (year) => {
        const url = makeUrl({ year: String(year) });
        expect(requireYear(url)).toBe(year);
      }),
      { numRuns: 30 },
    );
  });

  it("rejects <2000", () => {
    const url = makeUrl({ year: "1999" });
    expect(() => requireYear(url)).toThrow(ValidationError);
  });
});

// ── VL5: requireSymbol ───────────────────────────────────────────────────────

describe("validation — VL5: requireSymbol", () => {
  it("accepts valid symbols", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[\w.\-^]{1,20}$/),
        (sym) => {
          const url = makeUrl({ sym });
          expect(requireSymbol(url)).toBe(sym);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("rejects symbols with invalid chars", () => {
    const url = makeUrl({ sym: "ABC$$$" });
    expect(() => requireSymbol(url)).toThrow(ValidationError);
  });
});

// ── VL6: requireHttpsUrl ─────────────────────────────────────────────────────

describe("validation — VL6: requireHttpsUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ["https"] }), (href) => {
        const url = makeUrl({ target: href });
        const parsed = requireHttpsUrl(url, "target");
        expect(parsed.protocol).toBe("https:");
      }),
      { numRuns: 20 },
    );
  });

  it("rejects HTTP URLs", () => {
    const url = makeUrl({ target: "http://example.com" });
    expect(() => requireHttpsUrl(url, "target")).toThrow(ValidationError);
  });
});
