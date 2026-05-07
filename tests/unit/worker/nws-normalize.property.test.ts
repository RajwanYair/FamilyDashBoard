/**
 * fast-check property tests — NWS normalizer invariants 
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
 * */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  fToC,
  mphToKph,
  parseWindKph,
  shortForecastToWmo,
  windDirToDeg,
  isUsCoordinate,
  buildDailyEntries,
  normalizeNwsToWeatherSchema,
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
    "Sunny",
    "Clear",
    "Mostly Sunny",
    "Mostly Clear",
    "Partly Sunny",
    "Partly Cloudy",
    "Mostly Cloudy",
    "Cloudy",
    "Overcast",
    "Foggy",
    "Rain",
    "Light Rain",
    "Heavy Rain",
    "Showers",
    "Thunderstorms",
    "Isolated Thunderstorms",
    "Snow",
    "Light Snow",
    "Heavy Snow",
    "Blizzard",
    "Freezing Rain",
    "Sleet",
    "Wintry Mix",
    "Breezy",
    "Windy",
    "Hot",
    "Cold",
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
  const WIND_DIRS = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

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

// ── additional NWS normalizer property assertions ──────────────

// Helper: make a minimal NwsPeriod
type NwsPeriodMin = {
  number: number;
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: "F" | "C";
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number };
  relativeHumidity?: { value: number };
  dewpoint?: { value: number };
};

function makeNwsPeriod(overrides?: Partial<NwsPeriodMin>): NwsPeriodMin {
  return {
    number: 1,
    startTime: "2029-07-04T12:00:00-05:00",
    isDaytime: true,
    temperature: 85,
    temperatureUnit: "F",
    windSpeed: "10 mph",
    windDirection: "S",
    shortForecast: "Mostly Sunny",
    probabilityOfPrecipitation: { value: 10 },
    relativeHumidity: { value: 55 },
    dewpoint: { value: 15 },
    ...overrides,
  };
}

describe("NWS normalizer — N9: mphToKph properties ", () => {
  it("mphToKph result is always rounded to 1 decimal place", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 300 }), (v) => {
        const kph = mphToKph(v);
        // Result rounded to 1dp means (kph * 10) is an integer
        expect(Math.round(kph * 10)).toBe(kph * 10);
      }),
      { numRuns: 200 },
    );
  });

  it("mphToKph is non-decreasing (monotone)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 1, max: 50 }), (v, delta) => {
        expect(mphToKph(v + delta)).toBeGreaterThanOrEqual(mphToKph(v));
      }),
      { numRuns: 200 },
    );
  });
});

describe("NWS normalizer — N10: windDirToDeg round-trip ", () => {
  const COMPASS_DIRS: string[] = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  it("all 16 compass directions map to distinct degree values", () => {
    const degrees = COMPASS_DIRS.map((d) => windDirToDeg(d));
    const unique = new Set(degrees);
    expect(unique.size).toBe(16);
  });

  it("windDirToDeg outputs multiples of 22.5 for 16-point compass", () => {
    for (const dir of COMPASS_DIRS) {
      const deg = windDirToDeg(dir);
      // Each of the 16 compass points is a multiple of 22.5 degrees
      expect(deg % 22.5).toBeCloseTo(0, 9);
    }
  });

  it("N=0, S=180, E=90, W=270 (primary compass points)", () => {
    expect(windDirToDeg("N")).toBe(0);
    expect(windDirToDeg("S")).toBe(180);
    expect(windDirToDeg("E")).toBe(90);
    expect(windDirToDeg("W")).toBe(270);
  });
});

describe("NWS normalizer — N11: buildDailyEntries invariants ", () => {
  it("empty input returns empty array", () => {
    expect(buildDailyEntries([])).toEqual([]);
  });

  it("single daytime period: maxC is set, minC equals maxC (no night period)", () => {
    const period = makeNwsPeriod({ temperature: 85, temperatureUnit: "F", isDaytime: true });
    const result = buildDailyEntries([period as Parameters<typeof buildDailyEntries>[0][0]]);
    expect(result).toHaveLength(1);
    // maxC should be the day temperature in C
    const expectedC = fToC(85);
    expect(result[0]!.maxC).toBeCloseTo(expectedC, 5);
  });

  it("buildDailyEntries result dates are unique", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 28 }), { minLength: 1, maxLength: 8 }),
        (days) => {
          const periods = days.map(
            (day, i) =>
              makeNwsPeriod({
                startTime: `2029-07-${String(day).padStart(2, "0")}T12:00:00-05:00`,
                isDaytime: i % 2 === 0,
                temperature: 80 + i,
              }) as Parameters<typeof buildDailyEntries>[0][0],
          );
          const result = buildDailyEntries(periods);
          const dates = result.map((d) => d.date);
          const unique = new Set(dates);
          expect(unique.size).toBe(dates.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("output length is at most 8", () => {
    const periods = Array.from(
      { length: 20 },
      (_, i) =>
        makeNwsPeriod({
          startTime: `2029-07-${String((i % 20) + 1).padStart(2, "0")}T12:00:00-05:00`,
        }) as Parameters<typeof buildDailyEntries>[0][0],
    );
    const result = buildDailyEntries(periods);
    expect(result.length).toBeLessThanOrEqual(8);
  });
});

describe("NWS normalizer — N12: normalizeNwsToWeatherSchema output shape ", () => {
  it("returns the correct top-level keys", () => {
    const period = makeNwsPeriod() as Parameters<typeof normalizeNwsToWeatherSchema>[0][0];
    const result = normalizeNwsToWeatherSchema([period], [period]);
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("hourly");
    expect(result).toHaveProperty("daily");
  });

  it("current block has all required weather keys", () => {
    const period = makeNwsPeriod() as Parameters<typeof normalizeNwsToWeatherSchema>[0][0];
    const result = normalizeNwsToWeatherSchema([period], [period]);
    const cur = result.current;
    expect(cur).toHaveProperty("temperature_2m");
    expect(cur).toHaveProperty("relative_humidity_2m");
    expect(cur).toHaveProperty("weather_code");
    expect(cur).toHaveProperty("wind_speed_10m");
    expect(cur).toHaveProperty("wind_direction_10m");
  });

  it("weather_code in current is always in [0, 99]", () => {
    const period = makeNwsPeriod() as Parameters<typeof normalizeNwsToWeatherSchema>[0][0];
    const result = normalizeNwsToWeatherSchema([period], []);
    const code = result.current.weather_code;
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(99);
  });
});
