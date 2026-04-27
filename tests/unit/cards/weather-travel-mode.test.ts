/**
 * Sprint 78 — Weather NWS travel-mode integration tests
 *
 * Tests the three branches of fetchWeather() added in Sprint 68:
 *   1. weatherUsTravelMode=true + fetchNWS succeeds → returns NWS data
 *   2. weatherUsTravelMode=true + fetchNWS throws  → falls back to Open-Meteo
 *   3. weatherUsTravelMode=false                   → skips NWS entirely
 *
 * Also covers weatherConfigSchema structure validation (Sprint 68 fields).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WeatherResponse } from "@/types/api";

// ── Module mocks (hoisted) ──

vi.mock("@/cards/weather/nws-adapter", () => ({
  fetchNWS: vi.fn(),
}));

vi.mock("@/core/fetch", () => ({
  fetchJSONWithWorker: vi.fn(),
  isWorkerEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
}));

// ── Helpers ──

function makeWeather(overrides?: Partial<WeatherResponse["current"]>): WeatherResponse {
  return {
    current: {
      temperature_2m: 20,
      relative_humidity_2m: 50,
      weather_code: 0,
      wind_speed_10m: 10,
      wind_direction_10m: 90,
      wind_gusts_10m: 15,
      apparent_temperature: 18,
      uv_index: 4,
      dew_point_2m: 12,
      ...overrides,
    },
    hourly: {
      time: [],
      temperature_2m: [],
      precipitation_probability: [],
      weather_code: [],
    },
    daily: {
      time: [
        "2029-01-01",
        "2029-01-02",
        "2029-01-03",
        "2029-01-04",
        "2029-01-05",
        "2029-01-06",
        "2029-01-07",
        "2029-01-08",
      ],
      temperature_2m_max: [25, 26, 24, 23, 22, 21, 20, 19],
      temperature_2m_min: [15, 16, 14, 13, 12, 11, 10, 9],
      weather_code: [0, 1, 2, 3, 0, 1, 2, 3],
      sunrise: ["2029-01-01T06:00:00", "2029-01-02T06:00:00"],
      sunset: ["2029-01-01T17:00:00", "2029-01-02T17:00:00"],
      precipitation_probability_max: [0, 10, 20, 30, 40, 50, 60, 0],
      uv_index_max: [5, 6, 4, 3, 5, 6, 4, 3],
    },
  };
}

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="top-temp"></div>
    <div id="wx-temp"></div>
    <div id="wx-desc"></div>
    <div id="wx-icon"></div>
    <div id="wx-wind"></div>
    <div id="wx-hum"></div>
    <div id="wx-uv"></div>
    <div id="wx-rise"></div>
    <div id="wx-hourly"></div>
    <div id="wx-forecast"></div>
    <div id="wx-minmax"></div>
    <div id="wx-week-summary"></div>
    <div id="wx-feels"></div>
  `;
}

// ── Tests ──

describe("Weather — fetchWeather NWS travel-mode branch", () => {
  beforeEach(() => {
    localStorage.clear();
    setupDOM();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("calls fetchNWS when weatherUsTravelMode=true and NWS succeeds", async () => {
    const nwsData = makeWeather({ temperature_2m: 15 });
    const { fetchNWS } = await import("@/cards/weather/nws-adapter");
    vi.mocked(fetchNWS).mockResolvedValueOnce(nwsData);

    // Set travel mode in localStorage
    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherUsTravelMode: true }));

    const { switchWeatherCity, cacheDom } = await import("@/cards/weather/weather");
    cacheDom();
    await switchWeatherCity(31.7683, 35.2137);

    expect(fetchNWS).toHaveBeenCalledWith(31.7683, 35.2137);
  });

  it("fetchNWS not called when weatherUsTravelMode=false (default)", async () => {
    const { fetchNWS } = await import("@/cards/weather/nws-adapter");
    const { fetchJSONWithWorker } = await import("@/core/fetch");
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(makeWeather());

    // weatherUsTravelMode defaults to false
    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherUsTravelMode: false }));

    const { switchWeatherCity, cacheDom } = await import("@/cards/weather/weather");
    cacheDom();
    await switchWeatherCity(31.7683, 35.2137);

    expect(fetchNWS).not.toHaveBeenCalled();
    expect(fetchJSONWithWorker).toHaveBeenCalled();
  });

  it("falls back to Open-Meteo when weatherUsTravelMode=true but fetchNWS throws", async () => {
    const { fetchNWS } = await import("@/cards/weather/nws-adapter");
    const { fetchJSONWithWorker } = await import("@/core/fetch");
    vi.mocked(fetchNWS).mockRejectedValueOnce(new Error("NWS network error"));
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(makeWeather());

    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherUsTravelMode: true }));

    const { switchWeatherCity, cacheDom } = await import("@/cards/weather/weather");
    cacheDom();
    await switchWeatherCity(31.7683, 35.2137);

    expect(fetchNWS).toHaveBeenCalled();
    // After NWS fails, falls back to Open-Meteo via fetchJSONWithWorker
    expect(fetchJSONWithWorker).toHaveBeenCalled();
  });

  it("diagLog is called when NWS falls back to Open-Meteo", async () => {
    const { fetchNWS } = await import("@/cards/weather/nws-adapter");
    const { fetchJSONWithWorker } = await import("@/core/fetch");
    const { diagLog } = await import("@/core/diag");
    vi.mocked(fetchNWS).mockRejectedValueOnce(new Error("NWS 404"));
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(makeWeather());

    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherUsTravelMode: true }));

    const { switchWeatherCity, cacheDom } = await import("@/cards/weather/weather");
    cacheDom();
    await switchWeatherCity(31.7683, 35.2137);

    expect(diagLog).toHaveBeenCalledWith(expect.stringContaining("NWS fetch failed"));
  });
});

// ── weatherConfigSchema structure (Sprint 68) ──

describe("Weather — weatherConfigSchema Sprint 68 fields", () => {
  it("includes weatherShowDetails field in the schema", async () => {
    const { weatherConfigSchema } = await import("@/cards/weather/weather");
    const field = weatherConfigSchema.find((f) => f.key === "weatherShowDetails");
    expect(field).toBeDefined();
    expect(field?.type).toBe("boolean");
  });

  it("weatherConfigSchema has at least 5 fields", async () => {
    const { weatherConfigSchema } = await import("@/cards/weather/weather");
    expect(weatherConfigSchema.length).toBeGreaterThanOrEqual(5);
  });

  it("all schema fields have key, label, and type", async () => {
    const { weatherConfigSchema } = await import("@/cards/weather/weather");
    for (const field of weatherConfigSchema) {
      expect(typeof field.key).toBe("string");
      expect(typeof field.labelHe).toBe("string");
      expect(typeof field.type).toBe("string");
    }
  });
});
