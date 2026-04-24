/**
 * fast-check property tests — NWS normalizer invariants (V13-DATA)
 *
 * Mathematical and structural properties that must hold for any valid input:
 *
 * N1. fToC ∘ cToF ≈ identity (round-trip within floating-point epsilon)
 * N2. mphToKph(v) > v for any positive v (km/h > mph)
 * N3. mphToKph(0) = 0 (zero speed invariant)
 * N4. shortForecastToWmo always returns integer 0–99
 * N5. fToC is monotonically increasing (higher °F → higher °C)
 * N6. parseWindKph("N mph") === mphToKph(N) for any non-negative integer N
 * N7. windDirToDeg output is always in [0, 360)
 * N8. isUsCoordinate is true only for lat ∈ [24.4, 49.4] and lon ∈ [-125, -66.9]
 *
 * V13-DATA
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  fToC,
  mphToKph,
  parseWindKph,
  shortForecastToWmo,
  windDirToDeg,
  isUsCoordinate,
} from "../../../worker/src/utils/nws-normalize";

// ── Inverse helper: cToF ─────────────────────────────────────────────────────

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

// ── N1: fToC ∘ cToF ≈ identity ───────────────────────────────────────────────

describe("NWS normalizer — N1: fToC round-trip identity", () => {
  it("fToC(cToF(c)) ≈ c for any Celsius in [-50, 60]", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 60 }), (c) => {
        expect(fToC(cToF(c))).toBeCloseTo(c, 9);
      }),
      { numRuns: 200 },
    );
  });
});

// ── N2: mphToKph(v) > v for positive v ───────────────────────────────────────

describe("NWS normalizer — N2: mphToKph always larger than mph", () => {
  it("mphToKph(v) > v for any positive wind speed", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300 }), (v) => {
        expect(mphToKph(v)).toBeGreaterThan(v);
      }),
      { numRuns: 100 },
    );
  });
});

// ── N3: mphToKph(0) = 0 ──────────────────────────────────────────────────────

describe("NWS normalizer — N3: zero speed invariant", () => {
  it("mphToKph(0) === 0", () => {
    expect(mphToKph(0)).toBe(0);
  });
});

// ── N4: shortForecastToWmo always returns integer 0–99 ───────────────────────

describe("NWS normalizer — N4: WMO code range invariant", () => {
  const FORECAST_PATTERNS = [
    "Sunny", "Clear", "Mostly Sunny", "Mostly Clear",
    "Partly Sunny", "Partly Cloudy", "Mostly Cloudy",
    "Cloudy", "Overcast", "Foggy", "Rain", "Light Rain",
    "Heavy Rain", "Showers", "Thunderstorms", "Isolated Thunderstorms",
    "Snow", "Light Snow", "Heavy Snow", "Blizzard",
    "Freezing Rain", "Sleet", "Wintry Mix",
    "Breezy", "Windy", "Hot", "Cold",
    "Unknown weather pattern XYZ123",
  ];

  it("shortForecastToWmo returns integer in [0, 99] for all known patterns", () => {
    for (const pattern of FORECAST_PATTERNS) {
      const wmo = shortForecastToWmo(pattern);
      expect(Number.isInteger(wmo)).toBe(true);
      expect(wmo).toBeGreaterThanOrEqual(0);
      expect(wmo).toBeLessThanOrEqual(99);
    }
  });

  it("shortForecastToWmo returns integer in [0, 99] for any string (fast-check)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 80 }), (s) => {
        const wmo = shortForecastToWmo(s);
        expect(Number.isInteger(wmo)).toBe(true);
        expect(wmo).toBeGreaterThanOrEqual(0);
        expect(wmo).toBeLessThanOrEqual(99);
      }),
      { numRuns: 200 },
    );
  });
});

// ── N5: fToC is strictly monotonically increasing ────────────────────────────

describe("NWS normalizer — N5: fToC monotonicity", () => {
  it("fToC(a) < fToC(b) whenever a < b", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -200, max: 200 }),
        fc.integer({ min: 1, max: 50 }),
        (a, delta) => {
          expect(fToC(a)).toBeLessThan(fToC(a + delta));
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── N6: parseWindKph matches mphToKph for whole-number mph strings ────────────

describe("NWS normalizer — N6: parseWindKph matches mphToKph", () => {
  it("parseWindKph('N mph') === mphToKph(N) for integer N ≥ 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (n) => {
        const parsed = parseWindKph(`${n} mph`);
        const direct = mphToKph(n);
        expect(parsed).toBeCloseTo(direct, 9);
      }),
      { numRuns: 100 },
    );
  });
});

// ── N7: windDirToDeg output is always in [0, 360) ────────────────────────────

describe("NWS normalizer — N7: windDirToDeg range invariant", () => {
  const WIND_DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

  it("windDirToDeg is in [0, 360) for all 16 compass directions", () => {
    for (const dir of WIND_DIRS) {
      const deg = windDirToDeg(dir);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(360);
    }
  });
});

// ── N8: isUsCoordinate boundary invariants ────────────────────────────────────

describe("NWS normalizer — N8: isUsCoordinate boundary invariants", () => {
  it("returns true for CONUS center (Dallas, TX)", () => {
    expect(isUsCoordinate(32.7, -96.8)).toBe(true);
  });

  it("returns false for Tel Aviv (outside US)", () => {
    expect(isUsCoordinate(32.0, 34.8)).toBe(false);
  });

  it("returns false for any lat > 50 (north of CONUS)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 50.1, max: 90.0, noNaN: true }),
        fc.double({ min: -125, max: -66.9, noNaN: true }),
        (lat, lon) => {
          expect(isUsCoordinate(lat, lon)).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("returns false for any lon > -65 (clearly east of CONUS)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 24.4, max: 49.4, noNaN: true }),
        fc.double({ min: -64.9, max: 50.0, noNaN: true }),
        (lat, lon) => {
          expect(isUsCoordinate(lat, lon)).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });
});
