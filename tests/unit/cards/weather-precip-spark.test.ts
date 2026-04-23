/**
 * Tests for V13-DATA: 7-day precipitation probability sparkline in weather.ts
 *
 * Isolates @/core/history with vi.mock so assertions are deterministic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock history module ───────────────────────────────────────────────────────

const mockAppend = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue([]);

vi.mock("@/core/history", () => ({
  historyAppend: (...args: unknown[]) => mockAppend(...args),
  historyGet: (...args: unknown[]) => mockGet(...args),
  sparklineSvg: vi.fn().mockReturnValue('<polyline points="0,12 22,6 44,0"/>'),
  _resetHistoryDb: vi.fn(),
}));

// ── Minimal WeatherResponse fixture ──────────────────────────────────────────

function makeWeather(precipMax0 = 35) {
  return {
    current: {
      temperature_2m: 22,
      relative_humidity_2m: 55,
      weather_code: 0,
      wind_speed_10m: 10,
      wind_direction_10m: 90,
      wind_gusts_10m: 15,
      apparent_temperature: 20,
      uv_index: 2,
      dew_point_2m: 12,
      cloud_cover: 20,
    },
    hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] },
    daily: {
      time: [
        "2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04",
        "2024-01-05", "2024-01-06", "2024-01-07", "2024-01-08",
      ],
      temperature_2m_max: [25, 26, 24, 23, 22, 21, 20, 19],
      temperature_2m_min: [15, 16, 14, 13, 12, 11, 10, 9],
      weather_code: [0, 1, 2, 3, 0, 1, 2, 3],
      sunrise: ["2024-01-01T06:00:00"],
      sunset: ["2024-01-01T17:00:00"],
      precipitation_probability_max: [precipMax0, 10, 20, 30, 40, 50, 60, 0],
      uv_index_max: [5, 6, 4, 3, 5, 6, 4, 3],
    },
  };
}

function buildDom() {
  document.body.innerHTML = `
    <div id="top-temp"></div>
    <div id="wx-temp"></div>
    <div id="wx-desc"></div>
    <div id="wx-icon"></div>
    <div id="wx-wind"></div>
    <div id="wx-wind-heb"></div>
    <div id="wx-gust"></div>
    <div id="wx-hum"></div>
    <div id="wx-uv"></div>
    <div id="wx-rise"></div>
    <div id="wx-set"></div>
    <div id="wx-feels"></div>
    <div id="wx-dew"></div>
    <div id="wx-precip"></div>
    <svg id="wx-precip-spark" viewBox="0 0 44 12"></svg>
    <div id="wx-cloud"></div>
    <div id="wx-minmax"></div>
    <div id="wx-sky-pill"></div>
    <div id="wx-sky"></div>
    <svg id="wx-temp-spark" viewBox="0 0 60 18"></svg>
    <div id="wx-hourly"></div>
    <div id="wx-forecast"></div>
    <div id="wx-week-summary"></div>
    <div id="wx-hourly-strip"></div>
  `;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Weather — precipitation sparkline (V13-DATA)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAppend.mockClear();
    mockGet.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("cacheDom binds wx-precip-spark to el.wxPrecipSpark", async () => {
    buildDom();
    const { cacheDom } = await import("@/cards/weather/weather");
    cacheDom();
    const el = document.getElementById("wx-precip-spark");
    expect(el).not.toBeNull();
    expect(el?.tagName.toLowerCase()).toBe("svg");
  });

  it("renderWeather sets wx-precip text with percentage + label", async () => {
    buildDom();
    const { cacheDom, renderWeather } = await import("@/cards/weather/weather");
    cacheDom();
    renderWeather(makeWeather(35) as Parameters<typeof renderWeather>[0]);
    const txt = document.getElementById("wx-precip")?.textContent ?? "";
    expect(txt).toMatch(/35%/);
  });

  it("historyAppend is called with 'weather:precip' and the precip value", async () => {
    buildDom();
    mockGet.mockResolvedValue([]);
    const { cacheDom, renderWeather } = await import("@/cards/weather/weather");
    cacheDom();
    renderWeather(makeWeather(42) as Parameters<typeof renderWeather>[0]);
    // Flush microtasks so the async IIFE completes
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockAppend).toHaveBeenCalledWith("weather:precip", 42);
  });

  it("sparkline SVG gets innerHTML when historyGet returns ≥2 values", async () => {
    buildDom();
    mockGet.mockResolvedValue([10, 20, 35]);
    const { cacheDom, renderWeather } = await import("@/cards/weather/weather");
    cacheDom();
    renderWeather(makeWeather(35) as Parameters<typeof renderWeather>[0]);
    await new Promise<void>((r) => setTimeout(r, 0));
    const sparkEl = document.getElementById("wx-precip-spark");
    expect(sparkEl?.innerHTML).not.toBe("");
  });

  it("sparkline SVG remains empty when historyGet returns <2 values", async () => {
    buildDom();
    mockGet.mockResolvedValue([10]); // only 1 point — not enough
    const { cacheDom, renderWeather } = await import("@/cards/weather/weather");
    cacheDom();
    renderWeather(makeWeather(35) as Parameters<typeof renderWeather>[0]);
    await new Promise<void>((r) => setTimeout(r, 0));
    const sparkEl = document.getElementById("wx-precip-spark");
    expect(sparkEl?.innerHTML).toBe("");
  });
});
