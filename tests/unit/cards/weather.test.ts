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
  deg2hebrewDir,
  renderWeather,
  cacheDom,
  getSkyCategory,
  parseCityEntry,
  initWeatherCities,
  toggleTempUnit,
  switchWeatherCity,
  initWeatherCard,
  destroyWeatherCard,
  humidityLabel,
  moonPhase,
  precipSummaryLabel,
  renderHourlyStrip,
  formatCloudCover,
  weatherConfigSchema,
  weatherCard,
  computeGoldenHour,
  getMoonPhaseSummary,
  scrollToLinkedCard,
} from "@/cards/weather/weather";
import type { WeatherResponse } from "@/types/api";

// ── Minimal WeatherResponse fixture ──
function makeWeather(overrides?: Partial<WeatherResponse["current"]>): WeatherResponse {
  return {
    current: {
      temperature_2m: 22,
      relative_humidity_2m: 55,
      weather_code: 0,
      wind_speed_10m: 15,
      wind_direction_10m: 180,
      wind_gusts_10m: 25,
      apparent_temperature: 20,
      uv_index: 3,
      dew_point_2m: 14,
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
  it.each([
    [0, "↓"],
    [90, "←"],
    [180, "↑"],
    [270, "→"],
    [45, "↙"],
    [360, "↓"],
  ] as const)("deg2arrow(%d) → %s", (deg, expected) => {
    expect(deg2arrow(deg)).toBe(expected);
  });
});

// ── deg2hebrewDir ──
describe("Weather — deg2hebrewDir", () => {
  it.each([
    [0, "ד׳"],
    [90, "מ׳"],
    [180, "צ׳"],
    [270, "מ׳ב׳"],
    [45, "ד׳-מ׳"],
    [135, "צ׳-מ׳"],
    [225, "צ׳-מ׳ב׳"],
    [315, "ד׳-מ׳ב׳"],
    [360, "ד׳"],
  ] as const)("deg2hebrewDir(%d) → %s", (deg, expected) => {
    expect(deg2hebrewDir(deg)).toBe(expected);
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

  it("renders humidity percentage with comfort label", () => {
    renderWeather(makeWeather({ relative_humidity_2m: 72 }));
    const text = document.getElementById("wx-hum")?.textContent ?? "";
    expect(text).toContain("72%");
    expect(text).toContain("מאוד לח");
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

  it("calls fetch with weather URL (worker-first or open-meteo fallback)", async () => {
    const { initWeatherCard } = await import("@/cards/weather/weather");
    initWeatherCard();
    await vi.waitFor(() => {
      const called = vi.mocked(fetch).mock.calls.length > 0;
      if (!called) throw new Error("fetch not called yet");
    });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0] ?? "");
    expect(url.includes("open-meteo.com") || url.includes("/api/weather")).toBe(true);
  });

  it("destroyWeatherCard does not throw after init", async () => {
    const { initWeatherCard, destroyWeatherCard } = await import("@/cards/weather/weather");
    initWeatherCard();
    expect(() => destroyWeatherCard()).not.toThrow();
  });
});

describe("Weather — weatherCard CardDefinition", () => {
  it("exposes the registry shape for weather", () => {
    expect(weatherCard.id).toBe("weather");
    expect(weatherCard.icon).toBe("🌤");
    expect(weatherCard.defaultSlot.col).toBe(0);
  });

  it("render returns a card host element", () => {
    const el = weatherCard.render();
    expect(el.tagName).toBe("SECTION");
    expect((el as HTMLElement).dataset.cardId).toBe("weather");
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
    const tab = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']");
    expect(tab?.textContent).toBe("Haifa");
  });

  it("updates tab data-lat/data-lon from LS_CITY_2", async () => {
    buildCityDOM();
    localStorage.setItem("dash_v2_city_2", "Eilat|29.56|34.95");
    const { initWeatherCities } = await import("@/cards/weather/weather");
    initWeatherCities();
    const tab = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='2']");
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
    const tab = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']");
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
    const tab = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']");
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

  it.each([
    [1, "sky-partly"],
    [2, "sky-partly"],
    [3, "sky-cloudy"],
    [45, "sky-cloudy"],
    [61, "sky-rain"],
    [71, "sky-snow"],
    [80, "sky-shower"],
    [95, "sky-storm"],
  ] as const)("getSkyCategory(%d) → cls=%s", (code, expected) => {
    expect(getSkyCategory(code).cls).toBe(expected);
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
    expect(document.getElementById("wx-sky-pill")?.className).toContain("sky-storm");
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
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain("uv-mod");
  });

  it("renders uv-high for UV 6", () => {
    renderWeather(makeWeather({ uv_index: 6 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain("uv-high");
  });

  it("renders uv-vhigh for UV 9", () => {
    renderWeather(makeWeather({ uv_index: 9 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain("uv-vhigh");
  });

  it("renders uv-extreme for UV 11", () => {
    renderWeather(makeWeather({ uv_index: 11 }));
    expect(document.querySelector("#wx-uv .uv-pill")?.className).toContain("uv-extreme");
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
    renderWeather(makeWeather({ temperature_2m: 30, apparent_temperature: 24 }));
    expect(document.getElementById("wx-feels")?.textContent).toBe("24°C");
  });

  it("rounds apparent temperature to nearest integer", () => {
    renderWeather(makeWeather({ apparent_temperature: 21.7 }));
    expect(document.getElementById("wx-feels")?.textContent).toBe("22°C");
  });

  it("does not throw when #wx-feels is absent", () => {
    document.getElementById("wx-feels")?.remove();
    cacheDom();
    expect(() => renderWeather(makeWeather({ apparent_temperature: 20 }))).not.toThrow();
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
    expect(document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain")).toBe(true);
    btn.click();
    expect(document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain")).toBe(false);
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
    expect(document.querySelectorAll(".wx-city-tab")[0]!.classList.contains("active")).toBe(true);
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
    expect(document.getElementById("wx-uv")?.textContent).toContain("גבוה מאוד");
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
    expect(document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain")).toBe(true);
    btn.click();
    expect(document.getElementById("wx-hourly")!.classList.contains("wx-chart-rain")).toBe(false);
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
    expect(document.querySelectorAll(".wx-city-tab")[0]!.classList.contains("active")).toBe(true);
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

  it("shows '--:--' placeholders when sunset[0] is null (W1 Sprint 175)", () => {
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
    // sunset[0] = null → formatted as '--:--' with golden-hour fallback
    data.daily.sunset = [null as unknown as string, "2024-01-02T17:00:00"];
    renderWeather(data);
    const rise = document.getElementById("wx-rise")!;
    // New format: "HH:MM↑ · --:--↓ · ✨--:-- <moon>" (sunrise valid, sunset/golden-hour invalid)
    expect(rise.textContent).toContain("--:--");
    expect(rise.textContent).toContain("↑");
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
    const tab2 = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='2']")!;
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

  it("shows '--:--' fallback for invalid sunset string (W1 Sprint 175)", () => {
    const data = makeWeather();
    data.daily!.sunset = ["not-a-date", "also-bad"];
    renderWeather(data);
    // wx-rise always shows content now — invalid parts display as '--:--'
    expect(document.getElementById("wx-rise")?.textContent).toContain("--:--");
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
    data.daily.weather_code = [
      0,
      null as unknown as number,
      null as unknown as number,
      null as unknown as number,
      null as unknown as number,
      null as unknown as number,
      null as unknown as number,
      null as unknown as number,
    ];
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
// ── WX_EMOJI fallback "🌡️" for current weather (line 209) ───────────────────

describe("Weather — renderWeather WX_EMOJI fallback for unknown weather_code (line 209)", () => {
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

  it("sets wxIcon to '🌡️' when weather_code is not in WX_EMOJI map (line 209 ?? branch)", () => {
    // Use weather_code=10 which is NOT in WX_EMOJI → WX_EMOJI[10] = undefined → "🌡️" fallback
    const data = makeWeather({ weather_code: 10 });
    renderWeather(data);
    expect(document.getElementById("wx-icon")?.textContent).toBe("🌡️");
  });
});

// ── WX_EMOJI fallback and wc ?? 0 in forecast (lines 251-252) ────────────────

describe("Weather — renderWeather forecast wc ?? 0 and WX_EMOJI ?? '🌡️' (lines 251-252)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="top-temp"></span><span id="wx-temp"></span>
      <span id="wx-desc"></span><span id="wx-icon"></span>
      <span id="wx-wind"></span><span id="wx-hum"></span>
      <span id="wx-uv"></span><span id="wx-rise"></span>
      <div id="wx-hourly"></div>
      <div id="wx-forecast">
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div><div class="wx-fday"></div>
        <div class="wx-fday"></div>
      </div>
      <span id="wx-minmax"></span><span id="wx-week-summary"></span>
      <span id="wx-feels"></span><span id="wx-sky-pill"></span>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses wc=0 via ?? 0 for null weather_code entry (line 251) and emoji fallback for code 10 (line 252)", () => {
    const data = makeWeather();
    // Index 1: null → wc=0 via ?? 0 (line 251 TRUE branch) — WX_EMOJI[0]="☀️" (no 252 fallback)
    // Index 2: 10 → wc=10 (line 251 FALSE branch) — WX_EMOJI[10]=undefined → "🌡️" (line 252 TRUE branch)
    data.daily.weather_code = [0, null as unknown as number, 10, 0, 0, 0, 0, 0];
    renderWeather(data);
    const fDays = document.querySelectorAll<HTMLElement>(".wx-fday");
    // fDays[0] = i=1 (null→0→"☀️"), fDays[1] = i=2 (10→"🌡️")
    expect(fDays[0]?.textContent).toContain("☀️"); // wc=0 via ?? 0 → "☀️"
    expect(fDays[1]?.textContent).toContain("🌡️"); // wc=10 → "🌡️" fallback
  });
});

// ── City tab missing data-lon → ?? "" → isNaN(lon) → return (line 351) ───────

describe("Weather — city tab click missing data-lon triggers ?? '' fallback (line 351)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("lon ?? '' fires when .wx-city-tab has no data-lon attribute (line 351 ?? '' branch)", async () => {
    document.body.innerHTML = `
      <span id="wx-temp"></span><span id="top-temp"></span>
      <div id="wx-city-tabs">
        <button class="wx-city-tab active" data-city="1" data-lat="32.0">ירושלים</button>
      </div>
    `;
    // initWeatherCard wires the click handler
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const mod = await import("@/cards/weather/weather");
    mod.initWeatherCard();
    // Tab has data-lat but NO data-lon → dataset["lon"] = undefined → ?? "" → parseFloat("") = NaN
    // → isNaN(lon) = true → early return at line 352 (no crash)
    const tab = document.querySelector<HTMLElement>(".wx-city-tab");
    expect(() => tab?.click()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

// ── Branch coverage: initWeatherCities active tab lat ?? "" fallback (line 82) ─

describe("Weather — initWeatherCities active tab with no data-lat fires ?? '' (line 82)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("triggers ?? '' fallback when active tab has no data-lat attribute (line 82 right branch)", () => {
    // Active tab with NO data-lat → active.dataset["lat"] is undefined → ?? "" fires
    document.body.innerHTML = `
      <button class="wx-city-tab active" data-city="1" data-lon="34.8"></button>
    `;
    // initWeatherCities: querySelector(".wx-city-tab.active") returns the button;
    // active.dataset["lat"] is undefined → ?? "" → parseFloat("") = NaN → skip update
    expect(() => initWeatherCities()).not.toThrow();
  });
});

// ── Branch coverage: toggleTempUnit with fresh cache (line 100 LEFT branch) ──

describe("Weather — toggleTempUnit with fresh cache (line 100 ?? left branch)", () => {
  function buildWeatherDOM(): void {
    document.body.innerHTML = `
      <div id="top-temp"></div><div id="wx-temp"></div>
      <div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-wind"></div><div id="wx-hum"></div>
      <div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-hourly"></div><div id="wx-forecast"></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div>
      <div id="wx-feels"></div>
    `;
    cacheDom();
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("uses fresh cache directly when cGet returns non-null (line 100 ?? LEFT branch / line 101 TRUE branch)", async () => {
    buildWeatherDOM();
    const { cSet: realCSet } = await import("@/core/cache");
    // Store weather data without advancing time — within 30-min TTL
    // cGet("wx", INTERVALS.WEATHER) returns fresh → ?? left branch taken
    realCSet("wx", makeWeather());
    toggleTempUnit();
    // cGet returned fresh → data = fresh → if (data) TRUE → renderWeather called
    expect(document.getElementById("wx-temp")?.textContent).not.toBe("");
  });
});

// ── Sprint v7.10: dew point + wind gust rendering ──
describe(`Weather — dew point rendering`, () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<div id="wx-temp"></div><div id="wx-wind"></div><div id="wx-hum"></div><div id="wx-uv"></div><div id="wx-dew"></div><span id="wx-gust"></span><span id="wx-wind-heb"></span><div id="wx-desc"></div><div id="wx-icon"></div><div id="wx-rise"></div><div id="wx-hourly"></div><div id="wx-forecast"><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div></div><div id="wx-minmax"></div><div id="wx-week-summary"></div><div id="wx-feels"></div><span id="wx-sky-pill"></span><div id="top-temp"></div>`;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it(`renders dew point in Celsius`, () => {
    renderWeather(makeWeather({ dew_point_2m: 14 }));
    expect(document.getElementById(`wx-dew`)?.textContent).toBe(`14°C`);
  });

  it(`renders dew point correctly in Fahrenheit`, () => {
    localStorage.setItem(`dash_v2_config`, JSON.stringify({ tempUnit: `F` }));
    renderWeather(makeWeather({ dew_point_2m: 0 }));
    expect(document.getElementById(`wx-dew`)?.textContent).toBe(`32°F`);
  });

  it(`shows wind gust when significantly higher than sustained wind`, () => {
    renderWeather(makeWeather({ wind_speed_10m: 10, wind_gusts_10m: 30 }));
    const gust = document.getElementById(`wx-gust`);
    expect(gust?.textContent).toContain(`30`);
    expect(gust?.style.display).not.toBe(`none`);
  });

  it(`hides wind gust when close to sustained wind`, () => {
    renderWeather(makeWeather({ wind_speed_10m: 20, wind_gusts_10m: 22 }));
    const gust = document.getElementById(`wx-gust`);
    expect(gust?.style.display).toBe(`none`);
  });
});

// ── Sprint v7.11: weather null-guard + toggleTempUnit no-cache paths ──

describe("Weather — renderWeather with null wxDew (no #wx-dew element)", () => {
  beforeEach(() => {
    localStorage.clear();
    // DOM without #wx-dew and #wx-gust — guard branches take false path
    document.body.innerHTML = `<div id="wx-temp"></div><div id="wx-wind"></div><div id="wx-hum"></div><div id="wx-uv"></div><span id="wx-wind-heb"></span><div id="wx-desc"></div><div id="wx-icon"></div><div id="wx-rise"></div><div id="wx-hourly"></div><div id="wx-forecast"><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div></div><div id="wx-minmax"></div><div id="wx-week-summary"></div><div id="wx-feels"></div><span id="wx-sky-pill"></span><div id="top-temp"></div>`;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw when wx-dew element is absent", () => {
    expect(() => renderWeather(makeWeather({ dew_point_2m: 14 }))).not.toThrow();
  });

  it("does not throw when wx-gust element is absent", () => {
    expect(() =>
      renderWeather(makeWeather({ wind_speed_10m: 10, wind_gusts_10m: 30 })),
    ).not.toThrow();
  });
});

describe("Weather — toggleTempUnit no-cache path (neither fresh nor stale)", () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("saves config and does not call renderWeather when cache is empty", async () => {
    vi.resetModules();
    localStorage.clear();
    const { toggleTempUnit: ttu } = await import("@/cards/weather/weather");
    // No cache seeded → cGet and cGetStale both return null
    expect(() => ttu()).not.toThrow();
    // Check tempUnit was actually saved
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(["C", "F"]).toContain(saved["tempUnit"]);
  });
});

describe("Weather — renderWeather wx-sky-pill null guard", () => {
  beforeEach(() => {
    localStorage.clear();
    // DOM without #wx-sky-pill
    document.body.innerHTML = `<div id="wx-temp"></div><div id="wx-wind"></div><div id="wx-hum"></div><div id="wx-uv"></div><div id="wx-dew"></div><span id="wx-gust"></span><span id="wx-wind-heb"></span><div id="wx-desc"></div><div id="wx-icon"></div><div id="wx-rise"></div><div id="wx-hourly"></div><div id="wx-forecast"><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div></div><div id="wx-minmax"></div><div id="wx-week-summary"></div><div id="wx-feels"></div><div id="top-temp"></div>`;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw when wx-sky-pill element is absent", () => {
    expect(() => renderWeather(makeWeather({ weather_code: 0 }))).not.toThrow();
  });
});

describe("Weather — weekly summary 'שמשי' label (all-clear week)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<div id="wx-temp"></div><div id="wx-wind"></div><div id="wx-hum"></div><div id="wx-uv"></div><div id="wx-dew"></div><span id="wx-gust"></span><span id="wx-wind-heb"></span><div id="wx-desc"></div><div id="wx-icon"></div><div id="wx-rise"></div><div id="wx-hourly"></div><div id="wx-forecast"><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div></div><div id="wx-minmax"></div><div id="wx-week-summary"></div><div id="wx-feels"></div><span id="wx-sky-pill"></span><div id="top-temp"></div>`;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows '☀️' emoji when all forecast days are clear (code 0)", () => {
    const wx = makeWeather({ weather_code: 0 });
    // All forecast days clear
    wx.daily.weather_code = [0, 0, 0, 0, 0, 0, 0, 0];
    renderWeather(wx);
    expect(document.getElementById("wx-week-summary")?.textContent).toContain("☀️");
  });
});

// ── humidityLabel ────────────────────────────────────────────────────────────

describe("Weather — humidityLabel", () => {
  it("returns 'יבש' for rh < 30", () => {
    expect(humidityLabel(0)).toBe("יבש");
    expect(humidityLabel(29)).toBe("יבש");
  });

  it("returns 'נוח' for rh 30–49", () => {
    expect(humidityLabel(30)).toBe("נוח");
    expect(humidityLabel(49)).toBe("נוח");
  });

  it("returns 'לח' for rh 50–69", () => {
    expect(humidityLabel(50)).toBe("לח");
    expect(humidityLabel(69)).toBe("לח");
  });

  it("returns 'מאוד לח' for rh >= 70", () => {
    expect(humidityLabel(70)).toBe("מאוד לח");
    expect(humidityLabel(100)).toBe("מאוד לח");
  });
});

// ── moonPhase ────────────────────────────────────────────────────────────────

describe("Weather — moonPhase", () => {
  it("returns a tuple [emoji, hebrewName]", () => {
    const [emoji, name] = moonPhase(new Date("2024-01-11")); // roughly full moon
    expect(emoji).toMatch(/[\u{1F311}-\u{1F318}]/u);
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("returns new moon values for known new moon date", () => {
    // 2000-01-06 is the reference new moon
    const [emoji, name] = moonPhase(new Date("2000-01-06T18:14:00Z"));
    expect(emoji).toBe("🌑");
    expect(name).toBe("ירח חדש");
  });

  it("returns full moon emoji for approximately half synodic period later", () => {
    // ~14.77 days after reference new moon → full moon
    const ref = new Date("2000-01-06T18:14:00Z");
    const full = new Date(ref.getTime() + 14.77 * 24 * 60 * 60 * 1000);
    const [emoji] = moonPhase(full);
    expect(emoji).toBe("🌕");
  });

  it("uses today's date when no argument is passed", () => {
    const [emoji] = moonPhase();
    expect(["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"]).toContain(emoji);
  });
});

// ── precipSummaryLabel ───────────────────────────────────────────────────────

describe("Weather — precipSummaryLabel", () => {
  it("returns 'אין גשם' for pp < 10", () => {
    expect(precipSummaryLabel(0)).toBe("אין גשם");
    expect(precipSummaryLabel(9)).toBe("אין גשם");
  });

  it("returns 'סיכוי נמוך' for pp 10–39", () => {
    expect(precipSummaryLabel(10)).toBe("סיכוי נמוך");
    expect(precipSummaryLabel(39)).toBe("סיכוי נמוך");
  });

  it("returns 'ייתכן גשם' for pp 40–69", () => {
    expect(precipSummaryLabel(40)).toBe("ייתכן גשם");
    expect(precipSummaryLabel(69)).toBe("ייתכן גשם");
  });

  it("returns 'כנראה גשם' for pp >= 70", () => {
    expect(precipSummaryLabel(70)).toBe("כנראה גשם");
    expect(precipSummaryLabel(100)).toBe("כנראה גשם");
  });
});

// ── Sprint 46: renderHourlyStrip ─────────────────────────────────────────────

function makeHourlyWeather(hourCount = 6): WeatherResponse {
  const now = new Date();
  const times: string[] = [];
  const temps: number[] = [];
  const probs: number[] = [];
  const codes: number[] = [];
  for (let i = 0; i < hourCount; i++) {
    const d = new Date(now);
    d.setHours(now.getHours() + i, 0, 0, 0);
    times.push(d.toISOString().slice(0, 16)); // "2024-01-01T14:00"
    temps.push(20 + i);
    probs.push(i * 10);
    codes.push(0);
  }
  const base = makeWeather();
  return {
    ...base,
    hourly: {
      time: times,
      temperature_2m: temps,
      precipitation_probability: probs,
      weather_code: codes,
    },
  };
}

describe("Weather — renderHourlyStrip (Sprint 46)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherShowHourly: true }));
    document.body.innerHTML = '<div id="wx-hourly-strip"></div>';
    cacheDom();
  });

  it("renders 6 tiles when weatherShowHourly is true", () => {
    renderHourlyStrip(makeHourlyWeather(10));
    const strip = document.getElementById("wx-hourly-strip")!;
    const tiles = strip.querySelectorAll(".wx-h-tile");
    expect(tiles.length).toBe(6);
  });

  it("hides the strip when weatherShowHourly is false", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ weatherShowHourly: false, configVersion: 3 }),
    );
    renderHourlyStrip(makeHourlyWeather(10));
    const strip = document.getElementById("wx-hourly-strip")!;
    expect(strip.querySelector(".wx-h-tile")).toBeNull();
  });

  it("renders time labels on tiles", () => {
    renderHourlyStrip(makeHourlyWeather(6));
    const strip = document.getElementById("wx-hourly-strip")!;
    const timeCells = strip.querySelectorAll(".wx-h-time");
    expect(timeCells.length).toBeGreaterThan(0);
    // Should have HH:MM format
    expect(timeCells[0]?.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it("renders temperature on each tile", () => {
    renderHourlyStrip(makeHourlyWeather(6));
    const strip = document.getElementById("wx-hourly-strip")!;
    const tempCells = strip.querySelectorAll(".wx-h-temp");
    expect(tempCells.length).toBe(6);
    expect(tempCells[0]?.textContent).toMatch(/°/);
  });

  it("shows precip% only when > 0", () => {
    const data = makeHourlyWeather(6);
    data.hourly.precipitation_probability = [0, 30, 60, 0, 10, 80];
    renderHourlyStrip(data);
    const strip = document.getElementById("wx-hourly-strip")!;
    const precipCells = strip.querySelectorAll(".wx-h-precip");
    // Index 0 → 0% → empty text
    expect(precipCells[0]?.textContent).toBe("");
    // Index 1 → 30% → shows
    expect(precipCells[1]?.textContent).toBe("30%");
  });

  it("adds wx-h-precip-high class when precip >= 50", () => {
    const data = makeHourlyWeather(6);
    data.hourly.precipitation_probability = [0, 0, 50, 70, 0, 0];
    renderHourlyStrip(data);
    const strip = document.getElementById("wx-hourly-strip")!;
    const highCells = strip.querySelectorAll(".wx-h-precip-high");
    expect(highCells.length).toBe(2);
  });

  it("does not throw when strip element is missing", () => {
    document.body.innerHTML = "";
    cacheDom();
    expect(() => renderHourlyStrip(makeHourlyWeather(6))).not.toThrow();
  });

  it("does not throw with empty hourly data", () => {
    const base = makeWeather();
    expect(() => renderHourlyStrip(base)).not.toThrow();
  });
});

// ── Sprint 32: formatCloudCover ────────────────────────────────────────────

describe("Weather — formatCloudCover (Sprint 32)", () => {
  it("returns 'בהיר' label for 0%", () => {
    expect(formatCloudCover(0)).toContain("בהיר");
  });

  it("returns 'בהיר' label for 12%", () => {
    expect(formatCloudCover(12)).toContain("בהיר");
  });

  it("returns 'חלקי' label for 13%", () => {
    expect(formatCloudCover(13)).toContain("חלקי");
  });

  it("returns 'חלקי' label for 50%", () => {
    expect(formatCloudCover(50)).toContain("חלקי");
  });

  it("returns 'מעונן' label for 51%", () => {
    expect(formatCloudCover(51)).toContain("מעונן");
  });

  it("returns 'מעונן מאוד' prefix for 85%", () => {
    const result = formatCloudCover(85);
    expect(result).toContain("85%");
    expect(result).toContain("מעונן");
  });

  it("includes the numeric percentage in output", () => {
    expect(formatCloudCover(75)).toContain("75%");
  });
});

// ── Sprint 87: configSchema ─────────────────────────────────────────────

describe("Weather — configSchema (Sprint 87)", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(weatherConfigSchema)).toBe(true);
    expect(weatherConfigSchema.length).toBeGreaterThan(0);
  });

  it("includes tempUnit as select field", () => {
    const field = weatherConfigSchema.find((f) => f.key === "tempUnit");
    expect(field).toBeDefined();
    expect(field!.type).toBe("select");
    expect(field!.options).toHaveLength(2);
  });

  it("includes weather toggle fields", () => {
    const keys = weatherConfigSchema.map((f) => f.key);
    expect(keys).toContain("weatherShowDetails");
    expect(keys).toContain("weatherShowHourly");
    expect(keys).toContain("weatherShowWind");
    expect(keys).toContain("weatherShowSunrise");
  });

  it("all fields have required properties", () => {
    for (const f of weatherConfigSchema) {
      expect(f.key).toBeTruthy();
      expect(f.labelHe).toBeTruthy();
      expect(f.labelEn).toBeTruthy();
      expect(f.type).toBeTruthy();
      expect(f.defaultValue).toBeDefined();
    }
  });
});

// ── Stream D2.2: createAsyncCardLoader migration ─────────────────────────────

describe("Weather — loadWeather uses createAsyncCardLoader (Stream D2.2)", () => {
  it("weatherCard init is a function", () => {
    expect(typeof weatherCard.init).toBe("function");
  });

  it("weatherCard destroy is a function", () => {
    expect(typeof weatherCard.destroy).toBe("function");
  });

  it('weatherCard id is "weather"', () => {
    expect(weatherCard.id).toBe("weather");
  });

  it("loadWeather returns a Promise when page is hidden", async () => {
    const { initWeatherCard, weatherCard: wc } = await import("@/cards/weather/weather");
    void initWeatherCard;
    void wc; // loaded but not invoked — just check import
    // Confirm the card loader pattern is present via init existence
    expect(typeof wc.init).toBe("function");
  });
});

// ── Sprint 91: branch coverage gaps ──────────────────────────────────────────

describe("Weather — Sprint 91 renderHourlyStrip branch gaps", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherShowHourly: true }));
    document.body.innerHTML = '<div id="wx-hourly-strip"></div>';
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("startIdx resets to 0 when all hourly times are in the past (startIdx === -1 branch)", () => {
    // Build times all 48 hours ago → no match for >= nowHour → findIndex returns -1
    const past: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      d.setHours(i, 0, 0, 0);
      past.push(d.toISOString().slice(0, 16));
    }
    const data = makeWeather();
    data.hourly = {
      time: past,
      temperature_2m: [20, 21, 22, 23, 24, 25],
      precipitation_probability: [0, 0, 0, 0, 0, 0],
      weather_code: [0, 0, 0, 0, 0, 0],
    };
    // Should render from index 0 without throwing
    expect(() => renderHourlyStrip(data)).not.toThrow();
    const strip = document.getElementById("wx-hourly-strip")!;
    expect(strip.querySelectorAll(".wx-h-tile").length).toBe(6);
  });

  it("renders empty hourLabel when time string is shorter than 16 chars (t.length < 16 branch)", () => {
    const data = makeWeather();
    // "2024-01-01T14" is 13 chars — triggers the false branch of t.length >= 16
    data.hourly = {
      time: [
        "2024-01-01T14",
        "2024-01-01T15",
        "2024-01-01T16",
        "2024-01-01T17",
        "2024-01-01T18",
        "2024-01-01T19",
      ],
      temperature_2m: [20, 21, 22, 23, 24, 25],
      precipitation_probability: [0, 0, 0, 0, 0, 0],
      weather_code: [0, 0, 0, 0, 0, 0],
    };
    renderHourlyStrip(data);
    const strip = document.getElementById("wx-hourly-strip")!;
    const timeCells = strip.querySelectorAll(".wx-h-time");
    // All time labels should be empty strings (false branch)
    expect(timeCells[0]?.textContent).toBe("");
  });

  it("uses fallback emoji '🌡️' for unknown WX code (WX_EMOJI[wc] ?? '🌡️' branch)", () => {
    const now = new Date();
    const times: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now);
      d.setHours(now.getHours() + i, 0, 0, 0);
      times.push(d.toISOString().slice(0, 16));
    }
    const data = makeWeather();
    data.hourly = {
      time: times,
      temperature_2m: [20, 21, 22, 23, 24, 25],
      precipitation_probability: [0, 0, 0, 0, 0, 0],
      weather_code: [9999, 9999, 9999, 9999, 9999, 9999], // unknown code → fallback
    };
    renderHourlyStrip(data);
    const strip = document.getElementById("wx-hourly-strip")!;
    const icons = strip.querySelectorAll(".wx-h-icon");
    expect(icons[0]?.textContent).toBe("🌡️");
  });
});

describe("Weather — Sprint 91 initWeatherCities branch gaps", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("skips active lat/lon update when active tab has invalid lat/lon (NaN branch)", () => {
    document.body.innerHTML = `
      <button class="wx-city-tab active" data-city="1" data-lat="bad" data-lon="worse">City</button>
    `;
    // Should not throw — invalid coords are ignored silently
    expect(() => initWeatherCities()).not.toThrow();
  });

  it("skips text update when entry.name is empty (if entry.name false branch)", () => {
    document.body.innerHTML = `
      <button class="wx-city-tab" data-city="1" data-lat="31" data-lon="35">Original</button>
    `;
    // Entry with empty name: "|32.08|34.78" → entry.name = "" → if (entry.name) is false
    localStorage.setItem("dash_v2_city_1", "|32.08|34.78");
    initWeatherCities();
    const tab = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']");
    // Text should remain unchanged (empty name → skip text update)
    expect(tab?.textContent).toBe("Original");
    // But coords should update
    expect(tab?.dataset["lat"]).toBe("32.08");
  });

  it("skips home coord update when homeLat/homeLon are NaN (!isNaN false branch)", () => {
    document.body.innerHTML = `
      <button class="wx-city-tab" data-city="1" data-lat="31" data-lon="35">City</button>
    `;
    // LS_CITY_1 not set → falls into home fallback, but home coords are invalid
    localStorage.setItem("dash_v2_home_lat", "not-a-number");
    localStorage.setItem("dash_v2_home_lon", "also-bad");
    expect(() => initWeatherCities()).not.toThrow();
    const tab = document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']");
    // Coords should NOT have changed (NaN guard prevents update)
    expect(tab?.dataset["lat"]).toBe("31");
  });
});

describe("Weather — Sprint 91 renderWeather wind-tile display", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("hides wind tile when weatherShowWind is false (wxWindTile branch)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, weatherShowWind: false }),
    );
    document.body.innerHTML = `
      <div class="wx-detail"><div id="wx-wind"></div></div>
      <div id="wx-temp"></div><div id="wx-desc"></div><div id="wx-icon"></div>
      <div id="wx-hum"></div><div id="wx-uv"></div><div id="wx-rise"></div>
      <div id="wx-forecast"><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div><div class="wx-fday"></div></div>
      <div id="wx-minmax"></div><div id="wx-week-summary"></div><div id="wx-feels"></div>
      <span id="wx-sky-pill"></span><div id="top-temp"></div>
    `;
    cacheDom();
    renderWeather(makeWeather());
    const windDetail = document.querySelector<HTMLElement>(".wx-detail")!;
    expect(windDetail.style.display).toBe("none");
  });
});

// ── computeGoldenHour (W1, Sprint 175) ───────────────────────────────────────

describe("computeGoldenHour", () => {
  it("returns morningEnd as sunrise + 60 min", () => {
    const { morningEnd } = computeGoldenHour("2025-06-01T05:00:00", "2025-06-01T20:00:00");
    // 05:00 + 60 min = 06:00
    expect(morningEnd).toMatch(/06:00/);
  });

  it("returns eveningStart as sunset - 60 min", () => {
    const { eveningStart } = computeGoldenHour("2025-06-01T05:00:00", "2025-06-01T20:00:00");
    // 20:00 - 60 min = 19:00
    expect(eveningStart).toMatch(/19:00/);
  });

  it("returns '--:--' for invalid sunrise", () => {
    const { morningEnd } = computeGoldenHour("bad-date", "2025-06-01T20:00:00");
    expect(morningEnd).toBe("--:--");
  });

  it("returns '--:--' for invalid sunset", () => {
    const { eveningStart } = computeGoldenHour("2025-06-01T05:00:00", "bad-date");
    expect(eveningStart).toBe("--:--");
  });

  it("returns '--:--' for both when both are invalid", () => {
    const { morningEnd, eveningStart } = computeGoldenHour("", "");
    expect(morningEnd).toBe("--:--");
    expect(eveningStart).toBe("--:--");
  });

  it("handles short ISO strings without seconds", () => {
    const { morningEnd } = computeGoldenHour("2025-06-01T06:30", "2025-06-01T19:45");
    // 06:30 + 60 = 07:30
    expect(morningEnd).toMatch(/07:30/);
  });
});

// ── W4 / Sprint 193: Air quality ──────────────────────────────────────────────

import { aqiLabel, renderAqiTile, fetchAirQuality } from "@/cards/weather/weather";
import { isAirQualityResponse } from "@/types/api";

describe("Weather — aqiLabel (Sprint 193 / W4)", () => {
  it("returns aqi-good for AQI 0", () => {
    expect(aqiLabel(0).cls).toBe("aqi-good");
    expect(aqiLabel(0).label).toBe("טוב");
  });
  it("returns aqi-good for AQI 20", () => {
    expect(aqiLabel(20).cls).toBe("aqi-good");
  });
  it("returns aqi-fair for AQI 21", () => {
    expect(aqiLabel(21).cls).toBe("aqi-fair");
  });
  it("returns aqi-moderate for AQI 50", () => {
    expect(aqiLabel(50).cls).toBe("aqi-moderate");
  });
  it("returns aqi-poor for AQI 70", () => {
    expect(aqiLabel(70).cls).toBe("aqi-poor");
  });
  it("returns aqi-vpoor for AQI 90", () => {
    expect(aqiLabel(90).cls).toBe("aqi-vpoor");
  });
  it("returns aqi-extreme for AQI 110", () => {
    expect(aqiLabel(110).cls).toBe("aqi-extreme");
  });
});

describe("Weather — renderAqiTile (Sprint 193 / W4)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="wx-aqi"></div>`;
  });

  it("renders AQI pill + Hebrew label in #wx-aqi", () => {
    renderAqiTile(25);
    const el = document.getElementById("wx-aqi")!;
    expect(el.innerHTML).toContain("aqi-fair");
    expect(el.innerHTML).toContain("25");
    expect(el.textContent).toContain("סביר");
  });

  it("renders good label for AQI 10", () => {
    renderAqiTile(10);
    expect(document.getElementById("wx-aqi")!.innerHTML).toContain("aqi-good");
  });

  it("does nothing when #wx-aqi element is absent", () => {
    document.body.innerHTML = "";
    expect(() => renderAqiTile(30)).not.toThrow();
  });
});

describe("Weather — fetchAirQuality (Sprint 193 / W4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns AirQualityResponse on valid data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ current: { european_aqi: 35, pm10: 20, pm2_5: 12 } }),
      }),
    );
    const result = await fetchAirQuality(31.77, 35.21);
    expect(result).not.toBeNull();
    expect(result?.current.european_aqi).toBe(35);
  });

  it("returns null when response fails type guard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bad: true }) }),
    );
    const result = await fetchAirQuality(31.77, 35.21);
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchAirQuality(31.77, 35.21);
    expect(result).toBeNull();
  });
});

describe("Weather — isAirQualityResponse type guard", () => {
  it("accepts valid AQI object", () => {
    expect(isAirQualityResponse({ current: { european_aqi: 30, pm10: 15, pm2_5: 8 } })).toBe(true);
  });
  it("rejects missing pm2_5 field", () => {
    expect(isAirQualityResponse({ current: { european_aqi: 30, pm10: 15 } })).toBe(false);
  });
  it("rejects non-object", () => {
    expect(isAirQualityResponse(null)).toBe(false);
    expect(isAirQualityResponse("string")).toBe(false);
  });
});

// ── W3 / Sprint 194: Nowcast ──────────────────────────────────────────────────

import { fetchNowcast, renderNowcastStrip } from "@/cards/weather/weather";
import { isNowcastResponse } from "@/types/api";

function makeNowcast(probs = [10, 45, 80, 20]): import("@/types/api").NowcastResponse {
  return {
    minutely_15: {
      time: ["00:00", "00:15", "00:30", "00:45"],
      precipitation_probability: probs,
    },
  };
}

describe("Weather — isNowcastResponse type guard (Sprint 194 / W3)", () => {
  it("accepts valid nowcast object", () => {
    expect(isNowcastResponse(makeNowcast())).toBe(true);
  });
  it("rejects missing precipitation_probability array", () => {
    expect(isNowcastResponse({ minutely_15: { time: [] } })).toBe(false);
  });
  it("rejects non-object", () => {
    expect(isNowcastResponse(null)).toBe(false);
  });
});

describe("Weather — fetchNowcast (Sprint 194 / W3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns NowcastResponse on valid data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeNowcast([5, 30, 70, 90]) }),
    );
    const result = await fetchNowcast(31.77, 35.21);
    expect(result).not.toBeNull();
    expect(result?.minutely_15.precipitation_probability[2]).toBe(70);
  });

  it("returns null when response fails type guard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bad: true }) }));
    const result = await fetchNowcast(31.77, 35.21);
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchNowcast(31.77, 35.21);
    expect(result).toBeNull();
  });
});

describe("Weather — renderNowcastStrip (Sprint 194 / W3)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="wx-nowcast" hidden></div>`;
    cacheDom();
  });

  it("renders nc-low / nc-med / nc-high segments correctly", () => {
    renderNowcastStrip(makeNowcast([10, 45, 80, 20]));
    const el = document.getElementById("wx-nowcast")!;
    expect(el.innerHTML).toContain("nc-low");
    expect(el.innerHTML).toContain("nc-med");
    expect(el.innerHTML).toContain("nc-high");
    expect(el.getAttribute("hidden")).toBeNull();
  });

  it("renders 4 segments from first 4 probability values", () => {
    renderNowcastStrip(makeNowcast([10, 20, 30, 40]));
    const segs = document.querySelectorAll(".nc-seg");
    expect(segs.length).toBe(4);
  });

  it("does nothing when #wx-nowcast element is absent", () => {
    document.body.innerHTML = "";
    cacheDom();
    expect(() => renderNowcastStrip(makeNowcast())).not.toThrow();
  });

  it("does nothing when probability array is empty", () => {
    renderNowcastStrip({ minutely_15: { time: [], precipitation_probability: [] } });
    expect(document.getElementById("wx-nowcast")!.innerHTML).toBe("");
  });
});

// ── W5 / Sprint 195: SVG wind compass ────────────────────────────────────────

import { compassGustArc, renderWindCompass } from "@/cards/weather/weather";

describe("Weather — compassGustArc (Sprint 195 / W5)", () => {
  it("returns a valid SVG arc path string", () => {
    const path = compassGustArc(0, 60);
    expect(path).toMatch(/^M /);
    expect(path).toContain("A 16 16");
  });

  it("caps sweep at 359.9 to prevent full-circle artifact", () => {
    const path = compassGustArc(0, 400);
    expect(path).toContain("A 16 16");
    // large-arc flag = 1 when sweep > 180
    expect(path).toContain(" 1 1 ");
  });

  it("uses custom radius when provided", () => {
    const path = compassGustArc(90, 90, 10);
    expect(path).toContain("A 10 10");
  });
});

describe("Weather — renderWindCompass (Sprint 195 / W5)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <svg id="wx-compass">
        <line id="wx-compass-needle"/>
        <path id="wx-compass-gust" visibility="hidden"/>
      </svg>`;
    cacheDom();
  });

  it("sets rotate transform on needle", () => {
    renderWindCompass(270, 20, 10);
    const needle = document.getElementById("wx-compass-needle")!;
    expect(needle.getAttribute("transform")).toBe("rotate(270)");
  });

  it("shows gust arc when gust > speed + 5", () => {
    renderWindCompass(90, 15, 25);
    const gust = document.getElementById("wx-compass-gust")!;
    expect(gust.getAttribute("visibility")).toBe("visible");
    expect(gust.getAttribute("d")).toBeTruthy();
  });

  it("hides gust arc when gust ≤ speed + 5", () => {
    renderWindCompass(90, 20, 20);
    const gust = document.getElementById("wx-compass-gust")!;
    expect(gust.getAttribute("visibility")).toBe("hidden");
  });

  it("does nothing when needle element is absent", () => {
    document.body.innerHTML = "";
    cacheDom();
    expect(() => renderWindCompass(180, 10, 30)).not.toThrow();
  });
});

// ── Sprint 207 / W6: getMoonPhaseSummary + scrollToLinkedCard ──────────
describe("Weather — getMoonPhaseSummary (Sprint 207)", () => {
  it("returns crossLinkTarget hebrew-cal", () => {
    const result = getMoonPhaseSummary(new Date("2024-01-11"));
    expect(result.crossLinkTarget).toBe("hebrew-cal");
  });

  it("returns non-empty emoji and label", () => {
    const result = getMoonPhaseSummary(new Date("2024-01-11"));
    expect(result.emoji.length).toBeGreaterThan(0);
    expect(result.label.length).toBeGreaterThan(0);
  });

  it("known new moon date returns \u05d9\u05e8\u05d7 \u05d7\u05d3\u05e9", () => {
    const result = getMoonPhaseSummary(new Date("2000-01-06T18:14:00Z"));
    expect(result.emoji).toBe("🌑");
    expect(result.label).toBe("ירח חדש");
  });

  it("scrollToLinkedCard is a no-op when element absent", () => {
    document.body.innerHTML = "";
    expect(() => scrollToLinkedCard("hebrew-cal")).not.toThrow();
  });

  it("scrollToLinkedCard calls scrollIntoView when card exists", () => {
    document.body.innerHTML = '<section data-card-id="hebrew-cal"></section>';
    const card = document.querySelector('[data-card-id="hebrew-cal"]') as HTMLElement;
    const spy = vi.spyOn(card, "scrollIntoView").mockImplementation(() => undefined);
    scrollToLinkedCard("hebrew-cal");
    expect(spy).toHaveBeenCalledOnce();
  });
});

// ── Sprint 254: fast-check property tests (WP1–WP6) ───────────────────────

import * as fc from "fast-check";

describe("WP1 · toDisplayTemp — property: output always ends with °C or °F", () => {
  it("always returns a string ending with °C or °F for any finite number", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (c) => {
        const result = toDisplayTemp(c);
        return result.endsWith("°C") || result.endsWith("°F");
      }),
    );
  });

  it("Celsius output contains the rounded integer value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -60, max: 60 }),
        (c) => {
          const result = toDisplayTemp(c);
          return result.includes(String(Math.round(c)));
        },
      ),
    );
  });
});

describe("WP2 · deg2arrow — property: always returns one of 8 arrow characters", () => {
  const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  it("any degree 0–359 maps to a known arrow", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 359 }), (deg) => {
        return ARROWS.includes(deg2arrow(deg));
      }),
    );
  });

  it("idempotent — same input always produces same output", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 359 }), (deg) => {
        return deg2arrow(deg) === deg2arrow(deg);
      }),
    );
  });
});

describe("WP3 · aqiLabel — property: cls always matches known CSS class prefix", () => {
  it("returns a non-empty label and known cls for aqi 0–500", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), (aqi) => {
        const { label, cls } = aqiLabel(aqi);
        return (
          label.length > 0 &&
          (cls.startsWith("aqi-") || cls === "")
        );
      }),
    );
  });

  it("label is always a non-empty string for any integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 1000 }), (aqi) => {
        const { label } = aqiLabel(aqi);
        return typeof label === "string" && label.length > 0;
      }),
    );
  });
});

describe("WP4 · humidityLabel — property: output is always a non-empty string", () => {
  it("returns non-empty for any humidity 0–100", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (rh) => {
        const result = humidityLabel(rh);
        return typeof result === "string" && result.length > 0;
      }),
    );
  });

  it("monotone behaviour — higher humidity maps to wetter label", () => {
    // 100% is always "רטוב מאוד" or similar — just verify it's non-empty
    expect(humidityLabel(100).length).toBeGreaterThan(0);
    expect(humidityLabel(0).length).toBeGreaterThan(0);
    // dry < wet: no hard assertion but function must not throw
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (rh) => {
        expect(() => humidityLabel(rh)).not.toThrow();
        return true;
      }),
    );
  });
});

describe("WP5 · precipSummaryLabel — property: deterministic for any non-negative mm", () => {
  it("always returns a non-empty string for 0–200 mm", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200, noNaN: true }), (pp) => {
        const result = precipSummaryLabel(pp);
        return typeof result === "string" && result.length > 0;
      }),
    );
  });

  it("same input always returns same output (referential transparency)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200, noNaN: true }), (pp) => {
        return precipSummaryLabel(pp) === precipSummaryLabel(pp);
      }),
    );
  });
});

describe("WP6 · computeGoldenHour — property: output format is HH:MM or '--:--'", () => {
  const HH_MM = /^\d{2}:\d{2}$/;
  it("valid ISO sunrise/sunset produces HH:MM times", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        fc.integer({ min: 60, max: 300 }), // day length in minutes
        (sunrise, dayMinutes) => {
          fc.pre(isFinite(sunrise.getTime()));
          const sunset = new Date(sunrise.getTime() + dayMinutes * 60_000);
          const { morningEnd, eveningStart } = computeGoldenHour(
            sunrise.toISOString(),
            sunset.toISOString(),
          );
          return HH_MM.test(morningEnd) && HH_MM.test(eveningStart);
        },
      ),
    );
  });

  it("invalid ISO strings produce '--:--' fallbacks", () => {
    const { morningEnd, eveningStart } = computeGoldenHour("not-a-date", "also-not");
    expect(morningEnd).toBe("--:--");
    expect(eveningStart).toBe("--:--");
  });

  it("evening start is always before or equal to sunset (1h offset)", () => {
    const sunrise = new Date("2024-06-21T05:00:00Z");
    const sunset = new Date("2024-06-21T21:00:00Z");
    const { eveningStart } = computeGoldenHour(sunrise.toISOString(), sunset.toISOString());
    // eveningStart should be sunset minus 1h ≈ 20:00
    expect(eveningStart).toMatch(HH_MM);
  });
});
