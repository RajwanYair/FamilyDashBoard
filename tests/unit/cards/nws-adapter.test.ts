/**
 * Unit tests — NWS (api.weather.gov) adapter 
 *
 * Covers:
 *  - fToC temperature conversion (via WeatherResponse current.temperature_2m)
 *  - nwsPhraseToWmoCode all 9 branches (thunder/snow/rain/drizzle/fog/overcast/partly cloudy/clear/fallback)
 *  - fetchNWS cache hit path
 *  - fetchNWS full happy-path (point + hourly fetch)
 *  - fetchNWS /points error (non-200)
 *  - fetchNWS hourly error (non-200)
 *  - fetchNWS empty periods (no now period)
 *  - fetchNWS precipitation null → defaults to 0
 *  - fetchNWS hourly data limited to 24 periods
 *  - fetchNWS fewer than 24 periods (short slice)
 *  - fetchNWS cache key uses lat/lon to 4 decimal places
 *  - fetchNWS result is stored in cache (cSet called)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks (must be declared before any import of the SUT) ──────────────

vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

// ── Import SUT and mocks ──────────────────────────────────────────────────────

import { fetchNWS } from "@/cards/weather/nws-adapter";
import { cGet, cSet } from "@/core/cache";

// ── Helpers ───────────────────────────────────────────────────────────────────

type MockedFn = ReturnType<typeof vi.fn>;

/** Build a minimal NWS hourly period */
function makePeriod(
  overrides: {
    temperature?: number;
    windSpeed?: string;
    windDirection?: string;
    shortForecast?: string;
    precipProb?: number | null;
    startTime?: string;
  } = {},
) {
  return {
    temperature: overrides.temperature ?? 68,
    temperatureUnit: "F" as const,
    windSpeed: overrides.windSpeed ?? "10 mph",
    windDirection: overrides.windDirection ?? "NW",
    shortForecast: overrides.shortForecast ?? "Sunny",
    probabilityOfPrecipitation: { value: overrides.precipProb ?? 0 },
    startTime: overrides.startTime ?? "2026-01-01T12:00:00-05:00",
  };
}

/** Build a minimal NWS API point metadata response */
function makePointMeta(hourlyUrl = "https://api.weather.gov/gridpoints/LWX/96,70/forecast/hourly") {
  return {
    properties: {
      forecastHourly: hourlyUrl,
      relativeLocation: { properties: { city: "Reston", state: "VA" } },
    },
  };
}

/** Build a minimal NWS hourly forecast response */
function makeHourlyForecast(periods: ReturnType<typeof makePeriod>[]) {
  return { properties: { periods } };
}

/** Stub global fetch with two sequential responses: point then hourly */
function stubFetch(pointJson: unknown, hourlyJson: unknown, pointOk = true, hourlyOk = true) {
  let callCount = 0;
  global.fetch = vi.fn().mockImplementation(async () => {
    callCount++;
    if (callCount === 1) {
      // Point metadata call
      return {
        ok: pointOk,
        status: pointOk ? 200 : 503,
        json: async () => pointJson,
      };
    }
    // Hourly forecast call
    return {
      ok: hourlyOk,
      status: hourlyOk ? 200 : 404,
      json: async () => hourlyJson,
    };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NWS adapter — ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cGet as MockedFn).mockReturnValue(null);
  });

  // ── fToC (indirect via temperature_2m) ─────────────────────────────────────

  describe("fToC temperature conversion", () => {
    it("converts 32°F (freezing) → 0°C", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod({ temperature: 32 })]));
      const res = await fetchNWS(38.8977, -77.0365);
      expect(res.current.temperature_2m).toBe(0);
    });

    it("converts 68°F (comfortable) → 20°C", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod({ temperature: 68 })]));
      const res = await fetchNWS(38.8977, -77.0365);
      expect(res.current.temperature_2m).toBe(20);
    });

    it("converts 212°F (boiling) → 100°C", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod({ temperature: 212 })]));
      const res = await fetchNWS(38.8977, -77.0365);
      expect(res.current.temperature_2m).toBe(100);
    });

    it("converts negative: 14°F → -10°C", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod({ temperature: 14 })]));
      const res = await fetchNWS(38.8977, -77.0365);
      expect(res.current.temperature_2m).toBe(-10);
    });
  });

  // ── nwsPhraseToWmoCode (indirect via weather_code) ─────────────────────────

  describe("nwsPhraseToWmoCode — all 9 branches", () => {
    async function getWmo(phrase: string): Promise<number> {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod({ shortForecast: phrase })]));
      const res = await fetchNWS(38.0, -77.0);
      return res.current.weather_code;
    }

    it("thunder phrase → 95", async () => {
      expect(await getWmo("Thunderstorm")).toBe(95);
    });

    it("snow phrase → 71", async () => {
      expect(await getWmo("Heavy Snow")).toBe(71);
    });

    it("rain phrase → 61", async () => {
      expect(await getWmo("Rain Showers")).toBe(61);
    });

    it("shower phrase → 61", async () => {
      expect(await getWmo("Scattered Showers")).toBe(61);
    });

    it("drizzle phrase → 51", async () => {
      expect(await getWmo("Light Drizzle")).toBe(51);
    });

    it("fog phrase → 45", async () => {
      expect(await getWmo("Dense Fog Advisory")).toBe(45);
    });

    it("mostly cloudy phrase → 3", async () => {
      expect(await getWmo("Mostly Cloudy")).toBe(3);
    });

    it("overcast phrase → 3", async () => {
      expect(await getWmo("Overcast")).toBe(3);
    });

    it("partly cloudy phrase → 2", async () => {
      expect(await getWmo("Partly Cloudy")).toBe(2);
    });

    it("partly sunny phrase → 2", async () => {
      expect(await getWmo("Partly Sunny")).toBe(2);
    });

    it("sunny phrase → 0", async () => {
      expect(await getWmo("Sunny")).toBe(0);
    });

    it("clear phrase → 0", async () => {
      expect(await getWmo("Clear")).toBe(0);
    });

    it("unknown phrase → 1 (mostly clear fallback)", async () => {
      expect(await getWmo("Windy")).toBe(1);
    });
  });

  // ── fetchNWS — cache hit ────────────────────────────────────────────────────

  describe("fetchNWS — cache hit", () => {
    it("returns cached value and skips fetch when cache is warm", async () => {
      const cached = {
        current: {
          temperature_2m: 25,
          weather_code: 0,
          relative_humidity_2m: 0,
          wind_speed_10m: 0,
          wind_direction_10m: 0,
          wind_gusts_10m: 0,
          apparent_temperature: 25,
          uv_index: 0,
          dew_point_2m: 0,
          cloud_cover: 0,
        },
        hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] },
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          weather_code: [],
          sunrise: [],
          sunset: [],
          precipitation_probability_max: [],
          uv_index_max: [],
        },
      };
      (cGet as MockedFn).mockReturnValue(cached);
      global.fetch = vi.fn();

      const res = await fetchNWS(38.0, -77.0);
      expect(res).toBe(cached);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ── fetchNWS — happy path ───────────────────────────────────────────────────

  describe("fetchNWS — happy path (point + hourly)", () => {
    it("returns correct WeatherResponse shape from 1 period", async () => {
      const period = makePeriod({
        temperature: 77,
        shortForecast: "Sunny",
        precipProb: 10,
        windSpeed: "15 mph",
      });
      stubFetch(makePointMeta(), makeHourlyForecast([period]));

      const res = await fetchNWS(38.8977, -77.0365);

      expect(res.current.temperature_2m).toBe(25); // 77°F → 25°C
      expect(res.current.weather_code).toBe(0); // Sunny → 0
      expect(res.current.wind_speed_10m).toBe(15); // parseFloat("15 mph")
      expect(res.hourly.temperature_2m).toHaveLength(1);
      expect(res.hourly.precipitation_probability[0]).toBe(10);
    });

    it("limits hourly data to 24 periods even if more are returned", async () => {
      const periods = Array.from({ length: 30 }, (_, i) =>
        makePeriod({
          temperature: 60 + i,
          startTime: `2026-01-01T${String(i).padStart(2, "0")}:00:00Z`,
        }),
      );
      stubFetch(makePointMeta(), makeHourlyForecast(periods));

      const res = await fetchNWS(38.0, -77.0);
      expect(res.hourly.time).toHaveLength(24);
      expect(res.hourly.temperature_2m).toHaveLength(24);
      expect(res.hourly.weather_code).toHaveLength(24);
    });

    it("handles fewer than 24 periods gracefully", async () => {
      const periods = [makePeriod({ temperature: 50 }), makePeriod({ temperature: 55 })];
      stubFetch(makePointMeta(), makeHourlyForecast(periods));

      const res = await fetchNWS(38.0, -77.0);
      expect(res.hourly.time).toHaveLength(2);
    });

    it("stores result in cache via cSet", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod()]));

      await fetchNWS(38.8977, -77.0365);
      expect(cSet).toHaveBeenCalledOnce();
    });

    it("daily arrays are empty (NWS adapter stub behaviour)", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod()]));
      const res = await fetchNWS(38.0, -77.0);
      expect(res.daily.time).toHaveLength(0);
      expect(res.daily.temperature_2m_max).toHaveLength(0);
    });

    it("precipitation null value defaults to 0", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod({ precipProb: null })]));
      const res = await fetchNWS(38.0, -77.0);
      expect(res.hourly.precipitation_probability[0]).toBe(0);
    });
  });

  // ── fetchNWS — cache key format ─────────────────────────────────────────────

  describe("fetchNWS — cache key uses 4-decimal lat/lon", () => {
    it("cGet is called with lat,lon rounded to 4 decimal places", async () => {
      (cGet as MockedFn).mockReturnValue(null);
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod()]));

      await fetchNWS(38.12345678, -77.98765432);
      expect(cGet).toHaveBeenCalledWith("nws:38.1235,-77.9877", expect.any(Number));
    });

    it("two calls with same rounded key reuse cache", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([makePeriod()]));
      await fetchNWS(38.0, -77.0); // populates cache

      // Simulate cache now warm
      const fakeResult = {
        current: {
          temperature_2m: 20,
          weather_code: 0,
          relative_humidity_2m: 0,
          wind_speed_10m: 0,
          wind_direction_10m: 0,
          wind_gusts_10m: 0,
          apparent_temperature: 20,
          uv_index: 0,
          dew_point_2m: 0,
          cloud_cover: 0,
        },
        hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] },
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          weather_code: [],
          sunrise: [],
          sunset: [],
          precipitation_probability_max: [],
          uv_index_max: [],
        },
      };
      (cGet as MockedFn).mockReturnValue(fakeResult);
      global.fetch = vi.fn();

      const res2 = await fetchNWS(38.0, -77.0);
      expect(res2).toBe(fakeResult);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ── fetchNWS — error paths ──────────────────────────────────────────────────

  describe("fetchNWS — error paths", () => {
    it("throws when /points returns non-200 status", async () => {
      stubFetch(null, null, false, true);
      await expect(fetchNWS(38.0, -77.0)).rejects.toThrow(/NWS \/points error/);
    });

    it("throws when hourly forecast returns non-200 status", async () => {
      stubFetch(makePointMeta(), null, true, false);
      await expect(fetchNWS(38.0, -77.0)).rejects.toThrow(/NWS hourly error/);
    });

    it("throws when periods array is empty", async () => {
      stubFetch(makePointMeta(), makeHourlyForecast([]));
      await expect(fetchNWS(38.0, -77.0)).rejects.toThrow(/no periods/);
    });

    it("throws when fetch rejects (network error)", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("network timeout"));
      await expect(fetchNWS(38.0, -77.0)).rejects.toThrow("network timeout");
    });
  });

  // ── fetchNWS — hourly weather_code variety in array ────────────────────────

  describe("fetchNWS — hourly weather_code array populated correctly", () => {
    it("each period's shortForecast maps to correct WMO code in hourly array", async () => {
      const periods = [
        makePeriod({ shortForecast: "Thunderstorm" }), // 95
        makePeriod({ shortForecast: "Heavy Snow" }), // 71
        makePeriod({ shortForecast: "Rain" }), // 61
        makePeriod({ shortForecast: "Mostly Cloudy" }), // 3
        makePeriod({ shortForecast: "Clear" }), // 0
      ];
      stubFetch(makePointMeta(), makeHourlyForecast(periods));

      const res = await fetchNWS(38.0, -77.0);
      expect(res.hourly.weather_code).toEqual([95, 71, 61, 3, 0]);
    });
  });
});
