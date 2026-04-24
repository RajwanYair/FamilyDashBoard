/**
 * Worker unit tests — NWS (api.weather.gov) normalizer (V13-DATA)
 *
 * Verifies that the NWS-to-WeatherSchema normalization functions produce
 * correct Open-Meteo-compatible output from NWS forecast period data.
 */

import { describe, it, expect } from "vitest";
import {
  fToC,
  mphToKph,
  parseWindKph,
  windDirToDeg,
  shortForecastToWmo,
  buildDailyEntries,
  normalizeNwsToWeatherSchema,
  isUsCoordinate,
} from "../../../worker/src/utils/nws-normalize";

// ── fToC ─────────────────────────────────────────────────────────────────────

describe("fToC", () => {
  it("converts 32°F to 0°C", () => expect(fToC(32)).toBe(0));
  it("converts 212°F to 100°C", () => expect(fToC(212)).toBe(100));
  it("converts 68°F to 20°C", () => expect(fToC(68)).toBe(20));
  it("converts negative: 14°F to -10°C", () => expect(fToC(14)).toBe(-10));
});

// ── mphToKph ──────────────────────────────────────────────────────────────────

describe("mphToKph", () => {
  it("converts 0 mph to 0 kph", () => expect(mphToKph(0)).toBe(0));
  it("converts 10 mph to ≈16.1 kph", () => expect(mphToKph(10)).toBeCloseTo(16.1, 0));
  it("converts 62 mph to ≈99.8 kph", () => expect(mphToKph(62)).toBeCloseTo(99.8, 0));
});

// ── parseWindKph ──────────────────────────────────────────────────────────────

describe("parseWindKph", () => {
  it('parses "5 mph"', () => expect(parseWindKph("5 mph")).toBeCloseTo(8.0, 0));
  it('parses "5 to 10 mph" (lower bound)', () => expect(parseWindKph("5 to 10 mph")).toBeCloseTo(8.0, 0));
  it('parses "Calm" → 0', () => expect(parseWindKph("Calm")).toBe(0));
  it('parses "0 mph" → 0', () => expect(parseWindKph("0 mph")).toBe(0));
});

// ── windDirToDeg ──────────────────────────────────────────────────────────────

describe("windDirToDeg", () => {
  it('N → 0', () => expect(windDirToDeg("N")).toBe(0));
  it('S → 180', () => expect(windDirToDeg("S")).toBe(180));
  it('E → 90', () => expect(windDirToDeg("E")).toBe(90));
  it('W → 270', () => expect(windDirToDeg("W")).toBe(270));
  it('NW → 315', () => expect(windDirToDeg("NW")).toBe(315));
  it('SW → 225', () => expect(windDirToDeg("SW")).toBe(225));
  it('NNE → 22.5', () => expect(windDirToDeg("NNE")).toBe(22.5));
  it('unknown → 0', () => expect(windDirToDeg("XYZ")).toBe(0));
  it('case-insensitive: "nw" → 315', () => expect(windDirToDeg("nw")).toBe(315));
});

// ── shortForecastToWmo ────────────────────────────────────────────────────────

describe("shortForecastToWmo", () => {
  it('"Clear" → 0', () => expect(shortForecastToWmo("Clear")).toBe(0));
  it('"Sunny" → 0', () => expect(shortForecastToWmo("Sunny")).toBe(0));
  it('"Mostly Sunny" → 1', () => expect(shortForecastToWmo("Mostly Sunny")).toBe(1));
  it('"Partly Cloudy" → 2', () => expect(shortForecastToWmo("Partly Cloudy")).toBe(2));
  it('"Overcast" → 3', () => expect(shortForecastToWmo("Overcast")).toBe(3));
  it('"Light Rain" → 61', () => expect(shortForecastToWmo("Light Rain")).toBe(61));
  it('"Rain Showers" → 80', () => expect(shortForecastToWmo("Rain Showers")).toBe(80));
  it('"Light Snow" → 71', () => expect(shortForecastToWmo("Light Snow")).toBe(71));
  it('"Heavy Snow" → 73', () => expect(shortForecastToWmo("Heavy Snow")).toBe(73));
  it('"Thunderstorm" → 95', () => expect(shortForecastToWmo("Thunderstorm")).toBe(95));
  it('"Fog" → 45', () => expect(shortForecastToWmo("Fog")).toBe(45));
  it('"Freezing Rain" → 66', () => expect(shortForecastToWmo("Freezing Rain")).toBe(66));
});

// ── buildDailyEntries ─────────────────────────────────────────────────────────

function makePeriod(opts: {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  shortForecast?: string;
  precipPct?: number;
}) {
  return {
    number: 1,
    startTime: opts.startTime,
    endTime: opts.startTime,
    isDaytime: opts.isDaytime,
    temperature: opts.temperature,
    temperatureUnit: "F",
    windSpeed: "5 mph",
    windDirection: "N",
    shortForecast: opts.shortForecast ?? "Sunny",
    probabilityOfPrecipitation: { value: opts.precipPct ?? 10, unitCode: "wmoUnit:percent" },
    dewpoint: undefined,
    relativeHumidity: undefined,
  };
}

describe("buildDailyEntries", () => {
  it("pairs a Day and Night period into one daily entry", () => {
    const periods = [
      makePeriod({ startTime: "2025-01-01T06:00:00", isDaytime: true, temperature: 68 }),
      makePeriod({ startTime: "2025-01-01T18:00:00", isDaytime: false, temperature: 45 }),
    ];
    const daily = buildDailyEntries(periods);
    expect(daily).toHaveLength(1);
    expect(daily[0]!.date).toBe("2025-01-01");
    expect(daily[0]!.maxC).toBeCloseTo(fToC(68), 1);
    expect(daily[0]!.minC).toBeCloseTo(fToC(45), 1);
  });

  it("uses higher precipPct from day/night pair", () => {
    const periods = [
      makePeriod({ startTime: "2025-01-02T06:00:00", isDaytime: true, temperature: 70, precipPct: 20 }),
      makePeriod({ startTime: "2025-01-02T18:00:00", isDaytime: false, temperature: 50, precipPct: 80 }),
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.precipPct).toBe(80);
  });

  it("returns up to 8 daily entries", () => {
    const periods = Array.from({ length: 16 }, (_, i) => ({
      ...makePeriod({
        startTime: `2025-01-${String(Math.floor(i / 2) + 1).padStart(2, "0")}T${i % 2 === 0 ? "06" : "18"}:00:00`,
        isDaytime: i % 2 === 0,
        temperature: 70 - i,
      }),
    }));
    const daily = buildDailyEntries(periods);
    expect(daily.length).toBeLessThanOrEqual(8);
  });

  it("handles night-only period (no daytime counterpart)", () => {
    const periods = [
      makePeriod({ startTime: "2025-01-03T18:00:00", isDaytime: false, temperature: 42 }),
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.maxC).toBe(daily[0]!.minC); // both set to the single temp
  });
});

// ── normalizeNwsToWeatherSchema ───────────────────────────────────────────────

function makeHourlyPeriods(count = 24) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    startTime: `2025-01-01T${String(i).padStart(2, "0")}:00:00-06:00`,
    endTime: `2025-01-01T${String(i + 1).padStart(2, "0")}:00:00-06:00`,
    isDaytime: i >= 6 && i < 18,
    temperature: 60 + i,
    temperatureUnit: "F",
    windSpeed: "10 mph",
    windDirection: "SW",
    shortForecast: "Mostly Sunny",
    probabilityOfPrecipitation: { value: 10, unitCode: "wmoUnit:percent" },
    dewpoint: { value: 12.5, unitCode: "wmoUnit:degC" },
    relativeHumidity: { value: 55, unitCode: "wmoUnit:percent" },
  }));
}

function makeDailyPeriods() {
  return [
    makePeriod({ startTime: "2025-01-01T06:00:00", isDaytime: true, temperature: 72, precipPct: 15 }),
    makePeriod({ startTime: "2025-01-01T18:00:00", isDaytime: false, temperature: 48, precipPct: 5 }),
    makePeriod({ startTime: "2025-01-02T06:00:00", isDaytime: true, temperature: 65, precipPct: 30 }),
    makePeriod({ startTime: "2025-01-02T18:00:00", isDaytime: false, temperature: 45, precipPct: 20 }),
  ];
}

describe("normalizeNwsToWeatherSchema", () => {
  it("returns an object with current, hourly, and daily keys", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("hourly");
    expect(result).toHaveProperty("daily");
  });

  it("converts current temperature from °F to °C", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    // first hourly period has temperature 60°F = 15.6°C
    expect(result.current.temperature_2m).toBeCloseTo(fToC(60), 1);
  });

  it("current.relative_humidity_2m taken from first period", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    expect(result.current.relative_humidity_2m).toBe(55);
  });

  it("current.dew_point_2m taken from dewpoint.value", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    expect(result.current.dew_point_2m).toBe(12.5);
  });

  it("hourly arrays have same length (up to 24)", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    const len = result.hourly.time.length;
    expect(len).toBeLessThanOrEqual(24);
    expect(result.hourly.temperature_2m).toHaveLength(len);
    expect(result.hourly.precipitation_probability).toHaveLength(len);
    expect(result.hourly.weather_code).toHaveLength(len);
  });

  it("hourly time is ISO substring (first 16 chars)", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    expect(result.hourly.time[0]).toHaveLength(16);
    expect(result.hourly.time[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("daily has consistent parallel array lengths", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    const len = result.daily.time.length;
    expect(result.daily.temperature_2m_max).toHaveLength(len);
    expect(result.daily.temperature_2m_min).toHaveLength(len);
    expect(result.daily.weather_code).toHaveLength(len);
    expect(result.daily.sunrise).toHaveLength(len);
    expect(result.daily.sunset).toHaveLength(len);
    expect(result.daily.precipitation_probability_max).toHaveLength(len);
    expect(result.daily.uv_index_max).toHaveLength(len);
  });

  it("daily maxC > minC for normal day/night pairs", () => {
    const result = normalizeNwsToWeatherSchema(makeHourlyPeriods(), makeDailyPeriods());
    for (const [i, maxC] of result.daily.temperature_2m_max.entries()) {
      expect(maxC).toBeGreaterThanOrEqual(result.daily.temperature_2m_min[i]!);
    }
  });
});

// ── isUsCoordinate ────────────────────────────────────────────────────────────

describe("isUsCoordinate", () => {
  it("accepts continental US coordinates", () => {
    expect(isUsCoordinate(40.7128, -74.006)).toBe(true); // New York
    expect(isUsCoordinate(34.0522, -118.2437)).toBe(true); // Los Angeles
    expect(isUsCoordinate(41.8781, -87.6298)).toBe(true); // Chicago
  });

  it("accepts Alaska coordinates", () => {
    expect(isUsCoordinate(61.2181, -149.9003)).toBe(true); // Anchorage
  });

  it("accepts Hawaii coordinates", () => {
    expect(isUsCoordinate(21.3069, -157.8583)).toBe(true); // Honolulu
  });

  it("rejects non-US coordinates", () => {
    expect(isUsCoordinate(31.7683, 35.2137)).toBe(false); // Jerusalem
    expect(isUsCoordinate(51.5074, -0.1278)).toBe(false); // London
    expect(isUsCoordinate(35.6762, 139.6503)).toBe(false); // Tokyo
    expect(isUsCoordinate(-33.8688, 151.2093)).toBe(false); // Sydney
  });
});
