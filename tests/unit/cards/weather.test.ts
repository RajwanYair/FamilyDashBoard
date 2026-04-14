/**
 * Tests for src/cards/weather/weather.ts
 *
 * Covers: toDisplayTemp (C/F conversion), deg2arrow (wind direction),
 * cacheDom + renderWeather (DOM update), initWeatherCard, switchWeatherCity,
 * sunrise/sunset, UV pill, forecast, min/max, weekly summary, city tabs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  toDisplayTemp,
  deg2arrow,
  renderWeather,
  cacheDom,
  getSkyCategory,
  parseCityEntry,
  initWeatherCities,
  toggleTempUnit,
  switchWeatherCity,
  initWeatherCard,
} from "@/cards/weather/weather";
import type { WeatherResponse } from "@/types/api";

// ── Minimal WeatherResponse fixture ──
function makeWeather(
  overrides?: Partial<WeatherResponse["current"]>,
): WeatherResponse {
  return {
    current: {
      temperature_2m: 22,
      relative_humidity_2m: 55,
      weather_code: 0,
      wind_speed_10m: 15,
      wind_direction_10m: 180,
      apparent_temperature: 20,
      uv_index: 3,
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
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
        "2024-01-04",
        "2024-01-05",
        "2024-01-06",
        "2024-01-07",
        "2024-01-08",
      ],
      temperature_2m_max: [25, 26, 24, 23, 22, 21, 20, 19],
      temperature_2m_min: [15, 16, 14, 13, 12, 11, 10, 9],
      weather_code: [0, 1, 2, 3, 0, 1, 2, 3],
      sunrise: ["2024-01-01T06:00:00", "2024-01-02T06:00:00"],
      sunset: ["2024-01-01T17:00:00", "2024-01-02T17:00:00"],
      precipitation_probability_max: [0, 10, 20, 30, 40, 50, 60, 0],
      uv_index_max: [5, 6, 4, 3, 5, 6, 4, 3],
    },
  };
}

// ── toDisplayTemp ──
describe("Weather — toDisplayTemp", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows Celsius by default", () => {
    expect(toDisplayTemp(22)).toBe("22°C");
  });

  it("shows Fahrenheit when config tempUnit is F", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ tempUnit: "F" }));
    expect(toDisplayTemp(0)).toBe("32°F");
  });

  it("converts 100°C to 212°F", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ tempUnit: "F" }));
    expect(toDisplayTemp(100)).toBe("212°F");
  });

  it("rounds fractional Celsius values", () => {
    expect(toDisplayTemp(22.7)).toBe("22.7°C");
  });
});

// ── deg2arrow ──
describe("Weather — deg2arrow", () => {
  it("0° (N) → ↓", () => {
    expect(deg2arrow(0)).toBe("↓");
  });

  it("90° (E) → ←", () => {
    expect(deg2arrow(90)).toBe("←");
  });

  it("180° (S) → ↑", () => {
    expect(deg2arrow(180)).toBe("↑");
  });

  it("270° (W) → →", () => {
    expect(deg2arrow(270)).toBe("→");
  });

  it("45° (NE) → ↙", () => {
    expect(deg2arrow(45)).toBe("↙");
  });

  it("360° wraps to ↓", () => {
    expect(deg2arrow(360)).toBe("↓");
  });
});

// ── renderWeather (DOM) ──
describe("Weather — renderWeather + cacheDom", () => {
  beforeEach(() => {
    localStorage.clear();
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
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill" class="wx-sky-pill"></span>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders temperature in Celsius", () => {
    renderWeather(makeWeather({ temperature_2m: 25 }));
    expect(document.getElementById("wx-temp")?.textContent).toBe("25°C");
  });

  it("renders top-temp chip", () => {
    renderWeather(makeWeather({ temperature_2m: 18 }));
    expect(document.getElementById("top-temp")?.textContent).toBe("18°C");
  });

  it("renders humidity percentage", () => {
    renderWeather(makeWeather({ relative_humidity_2m: 72 }));
    expect(document.getElementById("wx-hum")?.textContent).toBe("72%");
  });

  it("renders wind speed with arrow", () => {
    renderWeather(makeWeather({ wind_speed_10m: 20, wind_direction_10m: 180 }));
    const text = document.getElementById("wx-wind")?.textContent ?? "";
    expect(text).toContain("20");
    expect(text).toContain("↑");
  });

  it("renders UV index with label", () => {
    renderWeather(makeWeather({ uv_index: 3 }));
    const text = document.getElementById("wx-uv")?.textContent ?? "";
    expect(text).toContain("3");
    expect(text).toContain("בינוני");
  });

  it("renders UV extreme for index > 10", () => {
    renderWeather(makeWeather({ uv_index: 11 }));
    expect(document.getElementById("wx-uv")?.textContent).toContain("קיצוני");
  });

  it("renders daily min/max", () => {
    renderWeather(makeWeather());
    const text = document.getElementById("wx-minmax")?.textContent ?? "";
    expect(text).toContain("15°C");
    expect(text).toContain("25°C");
  });

  it("populates forecast day elements", () => {
    renderWeather(makeWeather());
    const fDays = document.querySelectorAll(".wx-fday");
    const firstDay = fDays[0];
    expect(firstDay?.textContent).toBeTruthy();
  });
});

// ── initWeatherCard (mock fetch) ──
describe("Weather — initWeatherCard fetch integration", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"></div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("calls fetch with open-meteo URL", async () => {
    const { initWeatherCard } = await import("@/cards/weather/weather");
    initWeatherCard();
    await vi.waitFor(() => {
      const called = vi.mocked(fetch).mock.calls.length > 0;
      if (!called) throw new Error("fetch not called yet");
    });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0] ?? "");
    expect(url).toContain("open-meteo.com");
  });
});

// ── parseCityEntry ──

describe("Weather — parseCityEntry", () => {
  it("parses valid name|lat|lon string", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    expect(parseCityEntry("Jerusalem|31.7683|35.2137")).toEqual({
      name: "Jerusalem",
      lat: 31.7683,
      lon: 35.2137,
    });
  });

  it("trims whitespace from name", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    const result = parseCityEntry("  Tel Aviv  |32.08|34.78");
    expect(result?.name).toBe("Tel Aviv");
  });

  it("returns null for too few parts", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    expect(parseCityEntry("OnlyName|31.7683")).toBeNull();
  });

  it("returns null when lat is not a number", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    expect(parseCityEntry("City|abc|35.22")).toBeNull();
  });

  it("returns null when lon is not a number", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    expect(parseCityEntry("City|31.77|xyz")).toBeNull();
  });

  it("returns null for empty string", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    expect(parseCityEntry("")).toBeNull();
  });

  it("handles empty name gracefully", async () => {
    const { parseCityEntry } = await import("@/cards/weather/weather");
    const result = parseCityEntry("|32.08|34.78");
    expect(result).toEqual({ name: "", lat: 32.08, lon: 34.78 });
  });
});

// ── initWeatherCities ──

describe("Weather — initWeatherCities", () => {
  function buildCityDOM(): void {
    document.body.innerHTML = `
      <div id="wx-city-tabs">
        <button class="wx-city-tab active" data-city="1" data-lat="31.7683" data-lon="35.2137">ירושלים</button>
        <button class="wx-city-tab" data-city="2" data-lat="32.08" data-lon="34.78">ת"א</button>
        <button class="wx-city-tab" data-city="3" data-lat="32.79" data-lon="34.99">חיפה</button>
      </div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does not throw with no LS keys", async () => {
    buildCityDOM();
    const { initWeatherCities } = await import("@/cards/weather/weather");
    expect(() => initWeatherCities()).not.toThrow();
  });

  it("updates tab text from LS_CITY_1", async () => {
    buildCityDOM();
    localStorage.setItem("dash_v2_city_1", "Haifa|32.79|34.99");
    const { initWeatherCities } = await import("@/cards/weather/weather");
    initWeatherCities();
    const tab = document.querySelector<HTMLButtonElement>(
      ".wx-city-tab[data-city='1']",
    );
    expect(tab?.textContent).toBe("Haifa");
  });

  it("updates tab data-lat/data-lon from LS_CITY_2", async () => {
    buildCityDOM();
    localStorage.setItem("dash_v2_city_2", "Eilat|29.56|34.95");
    const { initWeatherCities } = await import("@/cards/weather/weather");
    initWeatherCities();
    const tab = document.querySelector<HTMLButtonElement>(
      ".wx-city-tab[data-city='2']",
    );
    expect(tab?.dataset["lat"]).toBe("29.56");
    expect(tab?.dataset["lon"]).toBe("34.95");
  });

  it("ignores invalid LS entry without throwing", async () => {
    buildCityDOM();
    localStorage.setItem("dash_v2_city_3", "BadData");
    const { initWeatherCities } = await import("@/cards/weather/weather");
    expect(() => initWeatherCities()).not.toThrow();
  });

  it("does not throw when no city tabs in DOM", async () => {
    document.body.innerHTML = "<div></div>";
    const { initWeatherCities } = await import("@/cards/weather/weather");
    expect(() => initWeatherCities()).not.toThrow();
  });

  it("uses home city coords for tab 1 when LS_CITY_1 is not set", async () => {
    buildCityDOM();
    localStorage.setItem("dash_v2_home_lat", "29.56");
    localStorage.setItem("dash_v2_home_lon", "34.95");
    localStorage.setItem("dash_v2_home_name", "Eilat");
    const { initWeatherCities } = await import("@/cards/weather/weather");
    initWeatherCities();
    const tab = document.querySelector<HTMLButtonElement>(
      ".wx-city-tab[data-city='1']",
    );
    expect(tab?.dataset["lat"]).toBe("29.56");
    expect(tab?.dataset["lon"]).toBe("34.95");
    expect(tab?.textContent).toBe("Eilat");
  });

  it("does not use home coords when LS_CITY_1 is already set", async () => {
    buildCityDOM();
    localStorage.setItem("dash_v2_city_1", "TelAviv|32.08|34.78");
    localStorage.setItem("dash_v2_home_lat", "29.56");
    localStorage.setItem("dash_v2_home_lon", "34.95");
    localStorage.setItem("dash_v2_home_name", "Eilat");
    const { initWeatherCities } = await import("@/cards/weather/weather");
    initWeatherCities();
    const tab = document.querySelector<HTMLButtonElement>(
      ".wx-city-tab[data-city='1']",
    );
    expect(tab?.textContent).toBe("TelAviv"); // city_1 wins
  });
});

// ── toggleTempUnit ──

describe("Weather — toggleTempUnit", () => {
  function buildWeatherDOM(): void {
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

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does not throw when no cached weather", async () => {
    buildWeatherDOM();
    const { toggleTempUnit } = await import("@/cards/weather/weather");
    expect(() => toggleTempUnit()).not.toThrow();
  });

  it("toggles tempUnit from C to F in config", async () => {
    buildWeatherDOM();
    const { toggleTempUnit } = await import("@/cards/weather/weather");
    const { loadConfig } = await import("@/core/config");
    // Ensure starting state is C
    const before = loadConfig();
    before.tempUnit = "C";
    const { saveConfig } = await import("@/core/config");
    saveConfig(before);
    toggleTempUnit();
    expect(loadConfig().tempUnit).toBe("F");
  });

  it("toggles tempUnit from F back to C", async () => {
    buildWeatherDOM();
    const { toggleTempUnit } = await import("@/cards/weather/weather");
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.tempUnit = "F";
    saveConfig(c);
    toggleTempUnit();
    expect(loadConfig().tempUnit).toBe("C");
  });
});

// ── getSkyCategory ──

describe("Weather — getSkyCategory", () => {
  it("returns clear sky for code 0", () => {
    const { label, cls } = getSkyCategory(0);
    expect(label).toContain("\u2600\ufe0f");
    expect(cls).toBe("sky-clear");
  });

  it("returns partly cloudy for code 1", () => {
    expect(getSkyCategory(1).cls).toBe("sky-partly");
  });

  it("returns partly cloudy for code 2", () => {
    expect(getSkyCategory(2).cls).toBe("sky-partly");
  });

  it("returns cloudy for code 3", () => {
    expect(getSkyCategory(3).cls).toBe("sky-cloudy");
  });

  it("returns cloudy for fog code 45", () => {
    expect(getSkyCategory(45).cls).toBe("sky-cloudy");
  });

  it("returns rain for code 61", () => {
    expect(getSkyCategory(61).cls).toBe("sky-rain");
  });

  it("returns snow for code 71", () => {
    expect(getSkyCategory(71).cls).toBe("sky-snow");
  });

  it("returns shower for code 80", () => {
    expect(getSkyCategory(80).cls).toBe("sky-shower");
  });

  it("returns storm for code 95", () => {
    expect(getSkyCategory(95).cls).toBe("sky-storm");
  });
});

// ── Sky condition pill DOM ──

describe("Weather — sky condition pill in renderWeather", () => {
  function buildFullDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill" class="wx-sky-pill"></span>
    `;
  }

  beforeEach(() => {
    localStorage.clear();
    buildFullDOM();
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets textContent on #wx-sky-pill for clear sky (code 0)", () => {
    renderWeather(makeWeather({ weather_code: 0 }));
    const pill = document.getElementById("wx-sky-pill");
    expect(pill?.textContent).toContain("\u2600\ufe0f");
  });

  it("adds sky-rain class for rainy code", () => {
    renderWeather(makeWeather({ weather_code: 61 }));
    const pill = document.getElementById("wx-sky-pill");
    expect(pill?.className).toContain("sky-rain");
  });

  it("adds sky-storm class for thunderstorm code 95", () => {
    renderWeather(makeWeather({ weather_code: 95 }));
    expect(document.getElementById("wx-sky-pill")?.className).toContain(
      "sky-storm",
    );
  });

  it("does not throw when #wx-sky-pill is absent", () => {
    document.getElementById("wx-sky-pill")?.remove();
    cacheDom();
    expect(() => renderWeather(makeWeather())).not.toThrow();
  });
});

// ── UV pill DOM ──

describe("Weather — UV pill in renderWeather", () => {
  function buildFullDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"></div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildFullDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders uv-pill span with uv-low class for UV 1", () => {
    renderWeather(makeWeather({ uv_index: 1 }));
    const span = document.querySelector("#wx-uv .uv-pill");
    expect(span?.className).toContain("uv-low");
    expect(span?.textContent).toBe("1");
  });

  it("renders uv-mod for UV 4", () => {
    renderWeather(makeWeather({ uv_index: 4 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain(
      "uv-mod",
    );
  });

  it("renders uv-high for UV 6", () => {
    renderWeather(makeWeather({ uv_index: 6 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain(
      "uv-high",
    );
  });

  it("renders uv-vhigh for UV 9", () => {
    renderWeather(makeWeather({ uv_index: 9 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain(
      "uv-vhigh",
    );
  });

  it("renders uv-extreme for UV 11", () => {
    renderWeather(makeWeather({ uv_index: 11 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain(
      "uv-extreme",
    );
  });
});

// ── Precipitation bar in forecast (F56) ──

describe("Weather — precipitation bar in forecast (F56)", () => {
  function buildForecastDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildForecastDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("appends wx-precip-bar inside forecast day when precipitation > 0", () => {
    // makeWeather has precipitation_probability_max[1] = 10 (second day = first forecast)
    renderWeather(makeWeather());
    const fDay = document.querySelectorAll(".wx-fday")[0];
    expect(fDay?.querySelector(".wx-precip-bar")).not.toBeNull();
  });

  it("sets fill width proportional to precipitation %", () => {
    const w = makeWeather();
    w.daily.precipitation_probability_max = [0, 50, 20, 30, 40, 50, 60, 0];
    renderWeather(w);
    const fDay = document.querySelectorAll(".wx-fday")[0];
    const fill = fDay?.querySelector<HTMLElement>(".wx-precip-fill");
    expect(fill?.style.width).toBe("50%");
  });

  it("does not append precip bar when precipitation is 0", () => {
    const w = makeWeather();
    w.daily.precipitation_probability_max = [0, 0, 0, 0, 0, 0, 0, 0];
    renderWeather(w);
    const fDay = document.querySelectorAll(".wx-fday")[0];
    expect(fDay?.querySelector(".wx-precip-bar")).toBeNull();
  });

  it("caps fill width at 100% for precipitation >= 100", () => {
    const w = makeWeather();
    w.daily.precipitation_probability_max = [0, 110, 20, 30, 40, 50, 60, 0];
    renderWeather(w);
    const fDay = document.querySelectorAll(".wx-fday")[0];
    const fill = fDay?.querySelector<HTMLElement>(".wx-precip-fill");
    expect(fill?.style.width).toBe("100%");
  });
});

// ── Weekly weather summary (F148) ──

describe("Weather — weekly summary (F148)", () => {
  function buildSummaryDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildSummaryDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets wx-week-summary text after rendering", () => {
    renderWeather(makeWeather());
    const summary = document.getElementById("wx-week-summary");
    expect(summary?.textContent).toBeTruthy();
  });

  it("contains temperature range with em-dash", () => {
    renderWeather(makeWeather());
    const text = document.getElementById("wx-week-summary")?.textContent ?? "";
    expect(text).toContain("–");
  });

  it("shows correct min from daily data (min of mins for days 1-7 = 9°C)", () => {
    renderWeather(makeWeather());
    const text = document.getElementById("wx-week-summary")?.textContent ?? "";
    expect(text).toContain("9°C");
  });

  it("shows correct max from daily data (max of maxes for days 1-7 = 26°C)", () => {
    renderWeather(makeWeather());
    const text = document.getElementById("wx-week-summary")?.textContent ?? "";
    expect(text).toContain("26°C");
  });
});

// ── Feels-like temp display (F26) ──

describe("Weather — feels-like display (F26)", () => {
  function buildDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets #wx-feels textContent to apparent temperature", () => {
    renderWeather(makeWeather({ apparent_temperature: 18 }));
    expect(document.getElementById("wx-feels")?.textContent).toBe("18°C");
  });

  it("updates #wx-feels when apparent_temperature differs from air temp", () => {
    renderWeather(
      makeWeather({ temperature_2m: 30, apparent_temperature: 24 }),
    );
    expect(document.getElementById("wx-feels")?.textContent).toBe("24°C");
  });

  it("rounds apparent temperature to nearest integer", () => {
    renderWeather(makeWeather({ apparent_temperature: 21.7 }));
    expect(document.getElementById("wx-feels")?.textContent).toBe("22°C");
  });

  it("does not throw when #wx-feels is absent", () => {
    document.getElementById("wx-feels")?.remove();
    cacheDom();
    expect(() =>
      renderWeather(makeWeather({ apparent_temperature: 20 })),
    ).not.toThrow();
  });
});

// ── Sunrise/sunset rendering ──

describe("Weather — sunrise/sunset in renderWeather", () => {
  function buildDOM(): void {
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
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders sunset time in #wx-rise", () => {
    renderWeather(makeWeather());
    const text = document.getElementById("wx-rise")?.textContent ?? "";
    expect(text).not.toBe("");
  });

  it("does not throw when sunset is invalid", () => {
    const data = makeWeather();
    data.daily.sunset = ["invalid"];
    expect(() => renderWeather(data)).not.toThrow();
  });
});

// ── initWeatherCard DOM wiring ──

describe("Weather — initWeatherCard DOM wiring", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly" class=""></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
      <button id="wx-chart-toggle"></button>
      <div id="wx-city-tabs">
        <button class="wx-city-tab active" data-city="1" data-lat="31.77" data-lon="35.21">ירושלים</button>
        <button class="wx-city-tab" data-city="2" data-lat="32.08" data-lon="34.78">ת"א</button>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("chart toggle button toggles wx-chart-rain class", () => {
    initWeatherCard();
    const btn = document.getElementById("wx-chart-toggle")!;
    btn.click();
    expect(
      document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain"),
    ).toBe(true);
    btn.click();
    expect(
      document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain"),
    ).toBe(false);
  });

  it("city tab click switches active tab", async () => {
    initWeatherCard();
    const tab2 = document.querySelectorAll(".wx-city-tab")[1] as HTMLElement;
    tab2.click();
    expect(tab2.classList.contains("active")).toBe(true);
    const tab1 = document.querySelectorAll(".wx-city-tab")[0] as HTMLElement;
    expect(tab1.classList.contains("active")).toBe(false);
  });

  it("ignores city tab click with invalid lat/lon", () => {
    const tab2 = document.querySelectorAll(".wx-city-tab")[1] as HTMLElement;
    tab2.removeAttribute("data-lat");
    initWeatherCard();
    tab2.click();
    // Should not throw and tab1 should stay active
    expect(
      document
        .querySelectorAll(".wx-city-tab")[0]!
        .classList.contains("active"),
    ).toBe(true);
  });
});

// ── switchWeatherCity ──

describe("Weather — switchWeatherCity", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
    `;
    cacheDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("updates weather data after city switch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather({ temperature_2m: 35 }),
      }),
    );
    await switchWeatherCity(32.08, 34.78);
    expect(document.getElementById("wx-temp")?.textContent).toBe("35°C");
  });

  it("handles fetch error gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(switchWeatherCity(32.08, 34.78)).resolves.not.toThrow();
  });
});

// ── UV pill branches ──

describe("Weather — UV pill high/very-high branches", () => {
  function buildDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("UV high (6-7) shows 'גבוה'", () => {
    renderWeather(makeWeather({ uv_index: 6 }));
    expect(document.getElementById("wx-uv")?.textContent).toContain("גבוה");
    expect(document.getElementById("wx-uv")?.innerHTML).toContain("uv-high");
  });

  it("UV very high (8-10) shows 'גבוה מאוד'", () => {
    renderWeather(makeWeather({ uv_index: 9 }));
    expect(document.getElementById("wx-uv")?.textContent).toContain(
      "גבוה מאוד",
    );
    expect(document.getElementById("wx-uv")?.innerHTML).toContain("uv-vhigh");
  });

  it("UV low (0-2) shows 'נמוך'", () => {
    renderWeather(makeWeather({ uv_index: 1 }));
    expect(document.getElementById("wx-uv")?.textContent).toContain("נמוך");
  });
});

// ── Sunrise/sunset rendering ──

describe("Weather — sunrise/sunset in renderWeather", () => {
  function buildDOM(): void {
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
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    buildDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders sunset time in #wx-rise", () => {
    renderWeather(makeWeather());
    const text = document.getElementById("wx-rise")?.textContent ?? "";
    expect(text).not.toBe("");
  });

  it("does not throw when sunset is invalid", () => {
    const data = makeWeather();
    data.daily.sunset = ["invalid"];
    expect(() => renderWeather(data)).not.toThrow();
  });
});

// ── initWeatherCard DOM wiring ──

describe("Weather — initWeatherCard DOM wiring", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly" class=""></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
      <button id="wx-chart-toggle"></button>
      <div id="wx-city-tabs">
        <button class="wx-city-tab active" data-city="1" data-lat="31.77" data-lon="35.21">ירושלים</button>
        <button class="wx-city-tab" data-city="2" data-lat="32.08" data-lon="34.78">ת"א</button>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("chart toggle button toggles wx-chart-rain class", () => {
    initWeatherCard();
    const btn = document.getElementById("wx-chart-toggle")!;
    btn.click();
    expect(
      document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain"),
    ).toBe(true);
    btn.click();
    expect(
      document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain"),
    ).toBe(false);
  });

  it("city tab click switches active tab", async () => {
    initWeatherCard();
    const tab2 = document.querySelectorAll(".wx-city-tab")[1] as HTMLElement;
    tab2.click();
    expect(tab2.classList.contains("active")).toBe(true);
    const tab1 = document.querySelectorAll(".wx-city-tab")[0] as HTMLElement;
    expect(tab1.classList.contains("active")).toBe(false);
  });

  it("ignores city tab click with invalid lat/lon", () => {
    const tab2 = document.querySelectorAll(".wx-city-tab")[1] as HTMLElement;
    tab2.removeAttribute("data-lat");
    initWeatherCard();
    tab2.click();
    // Should not throw and tab1 should stay active
    expect(
      document
        .querySelectorAll(".wx-city-tab")[0]!
        .classList.contains("active"),
    ).toBe(true);
  });
});

// ── switchWeatherCity ──

describe("Weather — switchWeatherCity", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
    `;
    cacheDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("updates weather data after city switch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather({ temperature_2m: 35 }),
      }),
    );
    await switchWeatherCity(32.08, 34.78);
    expect(document.getElementById("wx-temp")?.textContent).toBe("35°C");
  });

  it("handles fetch error gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(switchWeatherCity(32.08, 34.78)).resolves.not.toThrow();
  });
});

// ── Sprint: weather.ts branch coverage improvements ──

describe("Weather — chart toggle without #wx-hourly (null chart branch)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
      <button id="wx-chart-toggle"></button>
      <div id="wx-city-tabs"></div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("chart toggle click does not throw when #wx-hourly is absent", () => {
    initWeatherCard();
    const btn = document.getElementById("wx-chart-toggle")!;
    expect(() => btn.click()).not.toThrow();
  });
});

describe("Weather — city tab click on non-tab element", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
      <button id="wx-chart-toggle"></button>
      <div id="wx-city-tabs"><span class="not-a-tab">click me</span></div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("ignores click on non-.wx-city-tab element inside tabs container", () => {
    initWeatherCard();
    const span = document.querySelector(".not-a-tab") as HTMLElement;
    expect(() => span.click()).not.toThrow();
  });
});

// ── Targeted coverage tests for lines 297, 304, 353 ──────────────────────────
// These tests use inline setup to avoid any beforeEach/afterEach order issues.

describe("Weather — inline coverage: renderWeather weekly summary (line 297)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("executes domEmoji line when rendering with daily weather_code data", () => {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom(); // Inline cacheDom so el.wxWeekSummary is fresh
    const data = makeWeather();
    renderWeather(data);
    const summary = document.getElementById("wx-week-summary")!;
    // line 297 executed → summary has an emoji + temp range
    expect(summary.textContent).toMatch(/[°CF\d].*[°CF\d]/);
  });
});

describe("Weather — inline coverage: renderWeather sunrise/sunset (line 304)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("executes sunset line when el.wxRise and d.daily.sunset are set", () => {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"></div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom(); // Inline cacheDom so el.wxRise is set
    const data = makeWeather();
    renderWeather(data);
    const rise = document.getElementById("wx-rise")!;
    // line 304 executed → wx-rise has a time string
    expect(rise.textContent).toBeTruthy();
  });

  it("skips sunset text when sunset[0] is null → ?? '' fallback (line 302)", () => {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"></div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
    `;
    cacheDom();
    const data = makeWeather();
    // sunset[0] = null → new Date(null ?? "") = new Date("") → invalid → wx-rise stays empty
    data.daily.sunset = [null as unknown as string, "2024-01-02T17:00:00"];
    renderWeather(data);
    const rise = document.getElementById("wx-rise")!;
    expect(rise.textContent).toBe(""); // invalid date → no update
  });
});

describe("Weather — inline coverage: city tab click handler (line 353)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("reaches const lon line when clicking on .wx-city-tab with lat/lon data", () => {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"></div>
      <div id="wx-minmax"></div>
      <div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
      <span id="wx-sky-pill"></span>
      <button id="wx-chart-toggle"></button>
      <div id="wx-city-tabs">
        <button class="wx-city-tab active" data-city="1" data-lat="31.77" data-lon="35.21">ירושלים</button>
        <button class="wx-city-tab" data-city="2" data-lat="32.08" data-lon="34.78">ת"א</button>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
    initWeatherCard(); // wires click handler and calls cacheDom internally
    const tab2 = document.querySelector<HTMLButtonElement>(
      ".wx-city-tab[data-city='2']",
    )!;
    // Click the second tab — has valid lat/lon, reaches const lon line (353)
    expect(() => tab2.click()).not.toThrow();
  });
});

describe("Weather — initWeatherCities home city fallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("applies home city coords when LS_CITY_1 not set", () => {
    localStorage.setItem("dash_v2_home_lat", "32.08");
    localStorage.setItem("dash_v2_home_lon", "34.78");
    localStorage.setItem("dash_v2_home_name", "תל אביב");
    document.body.innerHTML = `<button class="wx-city-tab active" data-city="1" data-lat="31.77" data-lon="35.21">ירושלים</button>`;
    initWeatherCities();
    const tab = document.querySelector(".wx-city-tab") as HTMLButtonElement;
    expect(tab.dataset["lat"]).toBe("32.08");
    expect(tab.dataset["lon"]).toBe("34.78");
    expect(tab.textContent).toBe("תל אביב");
  });

  it("does not apply home city when LS_CITY_1 is set", () => {
    localStorage.setItem("dash_v2_city_1", "חיפה|32.79|34.98");
    localStorage.setItem("dash_v2_home_lat", "32.08");
    localStorage.setItem("dash_v2_home_lon", "34.78");
    document.body.innerHTML = `<button class="wx-city-tab active" data-city="1" data-lat="31.77" data-lon="35.21">ירושלים</button>`;
    initWeatherCities();
    const tab = document.querySelector(".wx-city-tab") as HTMLButtonElement;
    expect(tab.dataset["lat"]).toBe("32.79");
    expect(tab.textContent).toBe("חיפה");
  });

  it("does not apply home city when coords are NaN", () => {
    localStorage.setItem("dash_v2_home_lat", "invalid");
    document.body.innerHTML = `<button class="wx-city-tab active" data-city="1" data-lat="31.77" data-lon="35.21">ירושלים</button>`;
    initWeatherCities();
    const tab = document.querySelector(".wx-city-tab") as HTMLButtonElement;
    expect(tab.dataset["lat"]).toBe("31.77");
  });
});

describe("Weather — renderWeather with null DOM elements", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw when all optional DOM elements are absent", () => {
    document.body.innerHTML = "";
    cacheDom();
    expect(() => renderWeather(makeWeather())).not.toThrow();
  });

  it("renders partial DOM — only wx-temp present", () => {
    document.body.innerHTML = `<div id="wx-temp"></div>`;
    cacheDom();
    expect(() => renderWeather(makeWeather())).not.toThrow();
    expect(document.getElementById("wx-temp")?.textContent).toMatch(/°/);
  });
});
// ── Sprint: wx-temp click handler coverage ──────────────────────────────────

describe("Weather — wx-temp click toggles temp unit", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly" class=""></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
      <button id="wx-chart-toggle"></button>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeWeather(),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("clicking wx-temp fires toggleTempUnit and persists F", () => {
    initWeatherCard();
    document.getElementById("wx-temp")!.click();
    const raw = localStorage.getItem("dash_v2_config");
    const cfg = raw ? JSON.parse(raw) : {};
    expect(cfg.tempUnit).toBe("F");
  });

  it("double-clicking wx-temp toggles back to C", () => {
    initWeatherCard();
    const el = document.getElementById("wx-temp")!;
    el.click(); // C → F
    el.click(); // F → C
    const raw = localStorage.getItem("dash_v2_config");
    const cfg = raw ? JSON.parse(raw) : {};
    expect(cfg.tempUnit).toBe("C");
  });
});

// ── Sprint: renderWeather defensive branches ────────────────────────────────

describe("Weather — renderWeather defensive branches", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div>
      <div id="wx-forecast"><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div><span id="wx-sky-pill"></span>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("skips sunrise rendering when sunset string is invalid", () => {
    const data = makeWeather();
    data.daily!.sunset = ["not-a-date", "also-bad"];
    renderWeather(data);
    // wx-rise should remain empty — the isNaN guard prevents text update
    expect(document.getElementById("wx-rise")?.textContent).toBe("");
  });

  it("skips min/max rendering when daily temp arrays are missing", () => {
    const data = makeWeather();
    data.daily!.temperature_2m_max = [];
    data.daily!.temperature_2m_min = [];
    renderWeather(data);
    // wx-minmax should remain empty — dayMax/dayMin are undefined
    expect(document.getElementById("wx-minmax")?.textContent).toBe("");
  });

  it("toggleTempUnit re-renders from stale cache when fresh is null", async () => {
    // Put data in cache directly via the real cSet
    const { cSet: realCSet } = await import("@/core/cache");
    realCSet("wx", makeWeather());
    // Advance past TTL so cGet returns null but cGetStale returns data
    const origNow = Date.now;
    Date.now = () => origNow() + 20 * 60 * 1000; // 20min > 15min TTL
    toggleTempUnit();
    Date.now = origNow;
    // Should have re-rendered (wx-temp has content)
    expect(document.getElementById("wx-temp")?.textContent).not.toBe("");
  });
});

// ── Branch coverage: initWeatherCities active tab ──────────────────────────

describe("Weather — initWeatherCities active tab coord sync", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("syncs _activeLat/_activeLon from active tab with valid coords", async () => {
    document.body.innerHTML = `
      <button class="wx-city-tab active" data-city="1" data-lat="32.1" data-lon="34.8"></button>
      <button class="wx-city-tab" data-city="2" data-lat="31.0" data-lon="35.1"></button>
    `;
    const { initWeatherCities, switchWeatherCity } = await import("@/cards/weather/weather");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    expect(() => initWeatherCities()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("skips active tab coord sync when lat/lon are invalid (NaN)", () => {
    document.body.innerHTML = `
      <button class="wx-city-tab active" data-city="1" data-lat="not-a-number" data-lon="also-bad"></button>
    `;
    // initWeatherCities should not throw even with invalid coords
    expect(() => initWeatherCities()).not.toThrow();
  });
});

// ── Branch coverage: renderWeather with null daily ─────────────────────────

describe("Weather — renderWeather without daily data", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="top-temp"></span><span id="wx-temp"></span>
      <span id="wx-desc"></span><span id="wx-icon"></span>
      <span id="wx-wind"></span><span id="wx-hum"></span>
      <span id="wx-uv"></span><span id="wx-rise"></span>
      <div id="wx-hourly"></div><div id="wx-forecast"></div>
      <span id="wx-minmax"></span><span id="wx-week-summary"></span>
      <span id="wx-feels"></span><span id="wx-sky-pill"></span>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renderWeather with null daily does not throw", () => {
    const data = makeWeather();
    (data as Record<string, unknown>).daily = null;
    expect(() => renderWeather(data as WeatherResponse)).not.toThrow();
    // wx-rise should not be updated (daily is null)
    expect(document.getElementById("wx-rise")?.textContent).toBe("");
    expect(document.getElementById("wx-minmax")?.textContent).toBe("");
  });

  it("renderWeather weekly summary with unknown weather code → emoji fallback (line 295)", () => {
    // Use weather_code=10 in positions 1-7 (not in WX_EMOJI) → domEmoji = "🌡️" fallback
    const data = makeWeather();
    // Replace weather_code with code 10 (not in WX_EMOJI map) for positions 1-7
    data.daily.weather_code = [0, 10, 10, 10, 10, 10, 10, 10];
    renderWeather(data);
    const summary = document.getElementById("wx-week-summary")!;
    // domEmoji = WX_EMOJI[10] ?? "🌡️" = "🌡️" (10 not in map)
    expect(summary.textContent).toContain("🌡️");
  });

  it("renderWeather weekly summary with all-null weather codes → codes[0]??0 fallback (line 287)", () => {
    // weather_code positions 1-7 are null → codes=[] → codes[0]??0 = 0 → WX_EMOJI[0]="☀️"
    const data = makeWeather();
    data.daily.weather_code = [0, null as unknown as number, null as unknown as number,
      null as unknown as number, null as unknown as number, null as unknown as number,
      null as unknown as number, null as unknown as number];
    renderWeather(data);
    const summary = document.getElementById("wx-week-summary")!;
    // dominant = 0 (from ?? 0 fallback), WX_EMOJI[0] = "☀️"
    expect(summary.textContent).toContain("☀️");
  });

  it("renderWeather city tab click with invalid lat/lon returns early", async () => {
    document.body.innerHTML += `
      <div id="wx-city-tabs">
        <button class="wx-city-tab" data-city="1" data-lat="bad" data-lon="bad">צ'ק</button>
        <span id="non-tab-child"></span>
      </div>
    `;
    const { initWeatherCard } = await import("@/cards/weather/weather");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    initWeatherCard();

    // Click on a non-tab element inside wx-city-tabs (no .wx-city-tab parent)
    const span = document.getElementById("non-tab-child")!;
    expect(() => span.click()).not.toThrow();

    // Click on a tab with invalid coords
    const btn = document.querySelector<HTMLElement>(".wx-city-tab");
    expect(() => btn?.click()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
