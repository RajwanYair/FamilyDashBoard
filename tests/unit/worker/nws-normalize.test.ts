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
  it('parses "5 to 10 mph" (lower bound)', () =>
    expect(parseWindKph("5 to 10 mph")).toBeCloseTo(8.0, 0));
  it('parses "Calm" → 0', () => expect(parseWindKph("Calm")).toBe(0));
  it('parses "0 mph" → 0', () => expect(parseWindKph("0 mph")).toBe(0));
});

// ── windDirToDeg ──────────────────────────────────────────────────────────────

describe("windDirToDeg", () => {
  it("N → 0", () => expect(windDirToDeg("N")).toBe(0));
  it("S → 180", () => expect(windDirToDeg("S")).toBe(180));
  it("E → 90", () => expect(windDirToDeg("E")).toBe(90));
  it("W → 270", () => expect(windDirToDeg("W")).toBe(270));
  it("NW → 315", () => expect(windDirToDeg("NW")).toBe(315));
  it("SW → 225", () => expect(windDirToDeg("SW")).toBe(225));
  it("NNE → 22.5", () => expect(windDirToDeg("NNE")).toBe(22.5));
  it("unknown → 0", () => expect(windDirToDeg("XYZ")).toBe(0));
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
      makePeriod({
        startTime: "2025-01-02T06:00:00",
        isDaytime: true,
        temperature: 70,
        precipPct: 20,
      }),
      makePeriod({
        startTime: "2025-01-02T18:00:00",
        isDaytime: false,
        temperature: 50,
        precipPct: 80,
      }),
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

  it("second night period for same date uses lower min (existing.minC !== POSITIVE_INFINITY branch)", () => {
    // Day, Night1 (sets minC), Night2 (should update to lower min)
    const periods = [
      makePeriod({ startTime: "2025-01-04T06:00:00", isDaytime: true, temperature: 70 }),
      makePeriod({ startTime: "2025-01-04T18:00:00", isDaytime: false, temperature: 45 }),
      makePeriod({ startTime: "2025-01-04T21:00:00", isDaytime: false, temperature: 40 }), // 40°F < 45°F
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.date).toBe("2025-01-04");
    expect(daily[0]!.minC).toBeCloseTo(fToC(40), 1); // second night period wins
  });

  it("night-only then night again (existing.maxC === NEGATIVE_INFINITY both times)", () => {
    // Two night periods — first sets minC, second triggers maxC = tempC branch
    const periods = [
      makePeriod({ startTime: "2025-01-05T18:00:00", isDaytime: false, temperature: 50 }),
      makePeriod({ startTime: "2025-01-05T22:00:00", isDaytime: false, temperature: 55 }),
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.date).toBe("2025-01-05");
    // First night: minC = fToC(50), maxC = NEGATIVE_INFINITY
    // Second night: minC = min(fToC(50), fToC(55)) = fToC(50); maxC was NEGATIVE_INFINITY → set to fToC(55)
    expect(daily[0]!.minC).toBeCloseTo(fToC(50), 1);
    expect(daily[0]!.maxC).toBeCloseTo(fToC(55), 1);
  });

  it("night period first then day period updates maxC and code (covers lines 97-98)", () => {
    // Night creates entry with maxC=NEGATIVE_INFINITY; Day updates existing.maxC + existing.code
    const periods = [
      makePeriod({
        startTime: "2025-01-06T18:00:00",
        isDaytime: false,
        temperature: 50,
        shortForecast: "Light Rain",
      }),
      makePeriod({
        startTime: "2025-01-06T06:00:00",
        isDaytime: true,
        temperature: 72,
        shortForecast: "Sunny",
      }),
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.date).toBe("2025-01-06");
    expect(daily[0]!.maxC).toBeCloseTo(fToC(72), 1); // day updates maxC
    expect(daily[0]!.minC).toBeCloseTo(fToC(50), 1);
    expect(daily[0]!.code).toBe(0); // "Sunny" → code 0 (day takes precedence)
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
    makePeriod({
      startTime: "2025-01-01T06:00:00",
      isDaytime: true,
      temperature: 72,
      precipPct: 15,
    }),
    makePeriod({
      startTime: "2025-01-01T18:00:00",
      isDaytime: false,
      temperature: 48,
      precipPct: 5,
    }),
    makePeriod({
      startTime: "2025-01-02T06:00:00",
      isDaytime: true,
      temperature: 65,
      precipPct: 30,
    }),
    makePeriod({
      startTime: "2025-01-02T18:00:00",
      isDaytime: false,
      temperature: 45,
      precipPct: 20,
    }),
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

// ── Sprint 46: missing branch coverage ───────────────────────────────────────

describe("parseWindKph — null match branch (line 33 `: 0` path)", () => {
  it('returns 0 for non-numeric non-calm string "Variable"', () => {
    expect(parseWindKph("Variable")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseWindKph("")).toBe(0);
  });
});

describe("buildDailyEntries — Celsius temperatureUnit branch (line 83 else path)", () => {
  function makeCelsiusPeriod(opts: {
    startTime: string;
    isDaytime: boolean;
    temperature: number;
    precipPct?: number;
    shortForecast?: string;
  }) {
    return {
      number: 1,
      startTime: opts.startTime,
      endTime: opts.startTime,
      isDaytime: opts.isDaytime,
      temperature: opts.temperature,
      temperatureUnit: "C" as const, // ← Celsius, not Fahrenheit
      windSpeed: "5 mph",
      windDirection: "N",
      shortForecast: opts.shortForecast ?? "Sunny",
      probabilityOfPrecipitation:
        opts.precipPct !== undefined
          ? { value: opts.precipPct, unitCode: "wmoUnit:percent" }
          : undefined,
      dewpoint: undefined,
      relativeHumidity: undefined,
    };
  }

  it("passes temperature through as-is when temperatureUnit is C (line 83 else branch)", () => {
    const periods = [
      makeCelsiusPeriod({
        startTime: "2025-01-01T06:00:00",
        isDaytime: true,
        temperature: 20,
        precipPct: 10,
      }),
      makeCelsiusPeriod({
        startTime: "2025-01-01T18:00:00",
        isDaytime: false,
        temperature: 8,
        precipPct: 5,
      }),
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.maxC).toBe(20); // not converted — stays as-is
    expect(daily[0]!.minC).toBe(8);
  });

  it("uses 0 when probabilityOfPrecipitation is undefined (line 84 ?? 0 branch)", () => {
    const periods = [
      makeCelsiusPeriod({ startTime: "2025-01-02T06:00:00", isDaytime: true, temperature: 15 }), // no precipPct
    ];
    const daily = buildDailyEntries(periods);
    expect(daily[0]!.precipPct).toBe(0); // ?? 0 path
  });
});

describe("normalizeNwsToWeatherSchema — Celsius + missing optional fields (lines 116-184 branches)", () => {
  function makeCelsiusHourly(count = 24) {
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      startTime: `2025-01-01T${String(i).padStart(2, "0")}:00:00Z`,
      endTime: `2025-01-01T${String(i + 1).padStart(2, "0")}:00:00Z`,
      isDaytime: i >= 6 && i < 18,
      temperature: 15 + i, // already in Celsius
      temperatureUnit: "C" as const, // ← triggers else branch in normalizer
      windSpeed: "10 mph",
      windDirection: "SW",
      shortForecast: "Mostly Sunny",
      probabilityOfPrecipitation: undefined, // ← triggers ?? 0 in hourly map
      dewpoint: undefined, // ← triggers ?? 0 for dew_point_2m
      relativeHumidity: undefined, // ← triggers ?? 50 for relative_humidity_2m
    }));
  }

  function makeCelsiusDailyPeriods() {
    return [
      {
        number: 1,
        startTime: "2025-01-01T06:00:00Z",
        endTime: "2025-01-01T18:00:00Z",
        isDaytime: true,
        temperature: 20,
        temperatureUnit: "C" as const,
        windSpeed: "5 mph",
        windDirection: "N",
        shortForecast: "Sunny",
        probabilityOfPrecipitation: undefined,
        dewpoint: undefined,
        relativeHumidity: undefined,
      },
      {
        number: 2,
        startTime: "2025-01-01T18:00:00Z",
        endTime: "2025-01-02T06:00:00Z",
        isDaytime: false,
        temperature: 8,
        temperatureUnit: "C" as const,
        windSpeed: "5 mph",
        windDirection: "N",
        shortForecast: "Clear",
        probabilityOfPrecipitation: undefined,
        dewpoint: undefined,
        relativeHumidity: undefined,
      },
    ];
  }

  it("uses Celsius temperature directly (no fToC) for hourlyPeriods[0]", () => {
    const hourly = makeCelsiusHourly();
    const result = normalizeNwsToWeatherSchema(hourly, makeCelsiusDailyPeriods());
    // temperature stays as-is (15 + 0 = 15), not converted via fToC
    expect(result.current.temperature_2m).toBe(15);
  });

  it("uses ?? 50 for relative_humidity when relativeHumidity is undefined", () => {
    const result = normalizeNwsToWeatherSchema(makeCelsiusHourly(), makeCelsiusDailyPeriods());
    expect(result.current.relative_humidity_2m).toBe(50);
  });

  it("uses ?? 0 for dew_point_2m when dewpoint is undefined", () => {
    const result = normalizeNwsToWeatherSchema(makeCelsiusHourly(), makeCelsiusDailyPeriods());
    expect(result.current.dew_point_2m).toBe(0);
  });

  it("uses ?? 0 for hourly precipitation_probability when field is undefined", () => {
    const result = normalizeNwsToWeatherSchema(makeCelsiusHourly(), makeCelsiusDailyPeriods());
    expect(result.hourly.precipitation_probability[0]).toBe(0);
  });

  it("uses Celsius in hourly temperature_2m map (else branch)", () => {
    const hourly = makeCelsiusHourly(1);
    const result = normalizeNwsToWeatherSchema(hourly, makeCelsiusDailyPeriods());
    expect(result.hourly.temperature_2m[0]).toBe(15);
  });
});
