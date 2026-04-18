/**
 * FamilyDashBoard v7 — Weather Card
 *
 * Open-Meteo integration: current conditions, hourly chart, 7-day forecast.
 */

import { createCardLoader, scheduleCard } from "../base-card";
import "./weather.css";
import {
  INTERVALS,
  WX_CODES,
  WX_EMOJI,
  LS_CITY_1,
  LS_CITY_2,
  LS_CITY_3,
  LS_HOME_LAT,
  LS_HOME_LON,
  LS_HOME_NAME,
  LS_WX_CHART_MODE,
} from "../../core/constants";
import type { WeatherResponse } from "../../types/api";
import { isWeatherResponse } from "../../types/api";
import { diagLog } from "../../core/diag";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { setSync } from "../../core/sync";
import { loadConfig, saveConfig } from "../../core/config";
import { fetchJSONWithWorker } from "../../core/fetch";
import { state } from "../../core/state";
import { computeMoonPhase as _sharedMoonPhase } from "../../core/utils";
import type { CardConfigField } from "../../types/card";

// ── City state ──
let _activeLat = 31.7683;
let _activeLon = 35.2137;

// LS_CITY_1/2/3 imported from constants

interface CityEntry {
  name: string;
  lat: number;
  lon: number;
}

export function parseCityEntry(raw: string): CityEntry | null {
  const parts = raw.split("|");
  if (parts.length < 3) return null;
  const lat = parseFloat(parts[1] ?? "");
  const lon = parseFloat(parts[2] ?? "");
  if (isNaN(lat) || isNaN(lon)) return null;
  return { name: parts[0]?.trim() ?? "", lat, lon };
}

/**
 * Apply configured city names/coords from localStorage to the tab buttons,
 * and sync _activeLat/_activeLon from the currently active tab.
 */
export function initWeatherCities(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>(
    ".wx-city-tab[data-city]",
  );
  const lsKeys = [LS_CITY_1, LS_CITY_2, LS_CITY_3];

  tabs.forEach((tab, i) => {
    const key = lsKeys[i];
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const entry = parseCityEntry(raw);
    if (!entry) return;
    tab.dataset["lat"] = String(entry.lat);
    tab.dataset["lon"] = String(entry.lon);
    if (entry.name) tab.textContent = entry.name;
  });

  // If city 1 has no explicit LS override, fall back to home city coords
  const tab1 = document.querySelector<HTMLButtonElement>(
    ".wx-city-tab[data-city='1']",
  );
  if (tab1 && !localStorage.getItem(LS_CITY_1)) {
    const homeLat = parseFloat(localStorage.getItem(LS_HOME_LAT) ?? "");
    const homeLon = parseFloat(localStorage.getItem(LS_HOME_LON) ?? "");
    const homeName = localStorage.getItem(LS_HOME_NAME) ?? "";
    if (!isNaN(homeLat) && !isNaN(homeLon)) {
      tab1.dataset["lat"] = String(homeLat);
      tab1.dataset["lon"] = String(homeLon);
      if (homeName) tab1.textContent = homeName;
    }
  }

  // Sync active coords from the active tab
  const active = document.querySelector<HTMLButtonElement>(
    ".wx-city-tab.active",
  );
  if (active) {
    const lat = parseFloat(active.dataset["lat"] ?? "");
    const lon = parseFloat(active.dataset["lon"] ?? "");
    if (!isNaN(lat) && !isNaN(lon)) {
      _activeLat = lat;
      _activeLon = lon;
    }
  }
}

/**
 * Toggle temperature unit between °C and °F,
 * save config, and re-render with cached data.
 */
export function toggleTempUnit(): void {
  const c = loadConfig();
  c.tempUnit = c.tempUnit === "C" ? "F" : "C";
  saveConfig(c);
  const fresh = cGet<WeatherResponse>("wx", INTERVALS.WEATHER);
  const data = fresh ?? cGetStale<WeatherResponse>("wx");
  if (data) renderWeather(data);
  diagLog(`FDB-055: [weather] tempUnit toggled to ${c.tempUnit}`);
}

/**
 * Switch to a different weather city: update state, fetch fresh data, render.
 */
export async function switchWeatherCity(
  lat: number,
  lon: number,
): Promise<void> {
  _activeLat = lat;
  _activeLon = lon;
  setSync("wx", "loading");
  try {
    const data = await fetchWeather();
    cSet("wx", data);
    renderWeather(data);
    setSync("wx", "ok");
  } catch (err) {
    diagLog(`FDB-056: [weather] City switch failed: ${String(err)}`);
    setSync("wx", "error");
  }
}

// ── DOM cache ──
const el = {
  topTemp: null as HTMLElement | null,
  wxTemp: null as HTMLElement | null,
  wxDesc: null as HTMLElement | null,
  wxIcon: null as HTMLElement | null,
  wxWind: null as HTMLElement | null,
  wxHum: null as HTMLElement | null,
  wxUv: null as HTMLElement | null,
  wxRise: null as HTMLElement | null,
  wxHourly: null as HTMLElement | null,
  wxForecast: null as HTMLElement | null,
  wxMinMax: null as HTMLElement | null,
  wxWeekSummary: null as HTMLElement | null,
  wxFeels: null as HTMLElement | null,
  wxSkyPill: null as HTMLElement | null,
  wxWindHeb: null as HTMLElement | null,
  wxDew: null as HTMLElement | null,
  wxGust: null as HTMLElement | null,
  wxPrecip: null as HTMLElement | null,
  wxHourlyStrip: null as HTMLElement | null,
  wxCloud: null as HTMLElement | null,
  wxWindTile: null as HTMLElement | null,
  wxRiseTile: null as HTMLElement | null,
};

export function cacheDom(): void {
  el.topTemp = document.getElementById("top-temp");
  el.wxTemp = document.getElementById("wx-temp");
  el.wxDesc = document.getElementById("wx-desc");
  el.wxIcon = document.getElementById("wx-icon");
  el.wxWind = document.getElementById("wx-wind");
  el.wxHum = document.getElementById("wx-hum");
  el.wxUv = document.getElementById("wx-uv");
  el.wxRise = document.getElementById("wx-rise");
  el.wxHourly = document.getElementById("wx-hourly");
  el.wxForecast = document.getElementById("wx-forecast");
  el.wxMinMax = document.getElementById("wx-minmax");
  el.wxWeekSummary = document.getElementById("wx-week-summary");
  el.wxFeels = document.getElementById("wx-feels");
  el.wxSkyPill = document.getElementById("wx-sky-pill");
  el.wxWindHeb = document.getElementById("wx-wind-heb");
  el.wxDew = document.getElementById("wx-dew");
  el.wxGust = document.getElementById("wx-gust");
  el.wxPrecip = document.getElementById("wx-precip");
  el.wxHourlyStrip = document.getElementById("wx-hourly-strip");
  el.wxCloud = document.getElementById("wx-cloud");
  el.wxWindTile = (el.wxWind?.closest(".wx-detail") as HTMLElement) ?? null;
  el.wxRiseTile = (el.wxRise?.closest(".wx-detail") as HTMLElement) ?? null;
}

function getTempUnit(): "C" | "F" {
  return loadConfig().tempUnit;
}

/**
 * Map WMO weather code to a sky condition label and CSS class.
 * Used by the sky condition pill in the weather card header.
 */
export function getSkyCategory(code: number): { label: string; cls: string } {
  if (code === 0) return { label: "☀️ בהיר", cls: "sky-clear" };
  if (code <= 2) return { label: "⛅ חלקי", cls: "sky-partly" };
  if (code <= 48) return { label: "☁️ מעונן", cls: "sky-cloudy" };
  if (code <= 67) return { label: "🌧️ גשם", cls: "sky-rain" };
  if (code <= 77) return { label: "❄️ שלג", cls: "sky-snow" };
  if (code <= 82) return { label: "🌦️ ממטרות", cls: "sky-shower" };
  return { label: "⛈️ סערה", cls: "sky-storm" };
}

export function toDisplayTemp(c: number): string {
  if (getTempUnit() === "F") return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${c}°C`;
}

export function deg2arrow(deg: number): string {
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round(deg / 45) % 8] ?? "↓";
}

/** Return Hebrew compass direction label for a wind bearing. */
export function deg2hebrewDir(deg: number): string {
  const dirs = ["ד׳", "ד׳-מ׳", "מ׳", "צ׳-מ׳", "צ׳", "צ׳-מ׳ב׳", "מ׳ב׳", "ד׳-מ׳ב׳"];
  return dirs[Math.round(deg / 45) % 8] ?? "ד׳";
}

/**
 * Return a Hebrew comfort-label for a relative-humidity percentage.
 * Used in the humidity detail tile to augment the raw percentage.
 */
export function humidityLabel(rh: number): string {
  if (rh < 30) return "יבש";
  if (rh < 50) return "נוח";
  if (rh < 70) return "לח";
  return "מאוד לח";
}

/**
 * Compute the approximate moon phase for a given date (defaults to today).
 * Returns a tuple of [emoji, Hebrew name].
 * Delegates to the shared computeMoonPhase in utils.ts.
 */
export function moonPhase(date: Date = new Date()): [string, string] {
  const { emoji, label } = _sharedMoonPhase(date);
  return [emoji, label];
}

/**
 * Return a Hebrew summary label for today's precipitation probability.
 * Shown in the rain/precip detail tile.
 */
export function precipSummaryLabel(pp: number): string {
  if (pp >= 70) return "כנראה גשם";
  if (pp >= 40) return "ייתכן גשם";
  if (pp >= 10) return "סיכוי נמוך";
  return "אין גשם";
}

/**
 * Sprint 32: Return a Hebrew label for a cloud cover percentage.
 * 0-12% → “בהיר”, 13-50% → “חלקי”, 51-84% → “מעונן”, 85-100% → “מעונן אחיד”.
 */
export function formatCloudCover(cc: number): string {
  if (cc <= 12) return `${cc}% בהיר`;
  if (cc <= 50) return `${cc}% חלקי`;
  if (cc <= 84) return `${cc}% מעונן`;
  return `${cc}% מעונן אחיד`;
}

/** localStorage key for persisting hourly chart view mode. */
// LS_WX_CHART_MODE imported from constants

/**
 * Sprint 46: Render the next-6-hours strip from hourly data.
 * Finds the current hour index in d.hourly.time and renders 6 tiles.
 * Respects cfg.weatherShowHourly.
 */
export function renderHourlyStrip(d: WeatherResponse): void {
  const container = el.wxHourlyStrip ?? document.getElementById("wx-hourly-strip");
  if (!container) return;

  const cfg = loadConfig();
  if (!cfg.weatherShowHourly) {
    container.style.display = "none";
    return;
  }
  container.style.display = "";

  const { time, temperature_2m, precipitation_probability, weather_code } = d.hourly;
  if (!time.length) return;

  // Find current or next hour index
  const nowHour = new Date().toISOString().slice(0, 13); // "2024-01-01T14"
  let startIdx = time.findIndex((t) => t.slice(0, 13) >= nowHour);
  if (startIdx === -1) startIdx = 0;

  const frag = document.createDocumentFragment();
  for (let i = startIdx; i < Math.min(startIdx + 6, time.length); i++) {
    const tile = document.createElement("div");
    tile.className = "wx-h-tile";

    const t = time[i] ?? "";
    const hourLabel = t.length >= 16 ? t.slice(11, 16) : "";
    const temp = toDisplayTemp(Math.round(temperature_2m[i] ?? 0));
    const pp = precipitation_probability[i] ?? 0;
    const wc = weather_code[i] ?? 0;
    const emoji = WX_EMOJI[wc] ?? "🌡️";

    const timeEl = document.createElement("div");
    timeEl.className = "wx-h-time";
    timeEl.textContent = hourLabel;

    const iconEl = document.createElement("div");
    iconEl.className = "wx-h-icon";
    iconEl.textContent = emoji;

    const tempEl = document.createElement("div");
    tempEl.className = "wx-h-temp";
    tempEl.textContent = temp;

    const precipEl = document.createElement("div");
    precipEl.className = "wx-h-precip";
    precipEl.textContent = pp > 0 ? `${pp}%` : "";
    if (pp >= 50) precipEl.classList.add("wx-h-precip-high");

    tile.appendChild(timeEl);
    tile.appendChild(iconEl);
    tile.appendChild(tempEl);
    tile.appendChild(precipEl);
    frag.appendChild(tile);
  }

  container.textContent = "";
  container.appendChild(frag);
}

async function fetchWeather(): Promise<WeatherResponse> {
  const lat = _activeLat;
  const lon = _activeLon;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,apparent_temperature,uv_index,dew_point_2m,cloud_cover&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;
  return fetchJSONWithWorker<WeatherResponse>(url);
}

export function renderWeather(d: WeatherResponse): void {
  const cur = d.current;
  const tempC = Math.round(cur.temperature_2m);
  const wCfg = loadConfig();
  if (el.wxWindTile)
    el.wxWindTile.style.display = wCfg.weatherShowWind ? "" : "none";
  if (el.wxRiseTile)
    el.wxRiseTile.style.display = wCfg.weatherShowSunrise ? "" : "none";

  if (el.topTemp) el.topTemp.textContent = toDisplayTemp(tempC);
  if (el.wxTemp) el.wxTemp.textContent = toDisplayTemp(tempC);
  if (el.wxDesc) {
    const desc = WX_CODES[cur.weather_code] ?? "לא ידוע";
    const feels = Math.round(cur.apparent_temperature);
    el.wxDesc.textContent = `${desc} · מרגיש ${toDisplayTemp(feels)}`;
  }
  // Feels-like cell (F26)
  if (el.wxFeels) el.wxFeels.textContent = toDisplayTemp(Math.round(cur.apparent_temperature));
  if (el.wxIcon) el.wxIcon.textContent = WX_EMOJI[cur.weather_code] ?? "🌡️";

  // Sky condition pill
  if (el.wxSkyPill) {
    const { label, cls } = getSkyCategory(cur.weather_code);
    el.wxSkyPill.textContent = label;
    el.wxSkyPill.className = `wx-sky-pill ${cls}`;
  }

  if (el.wxWind)
    el.wxWind.textContent = `${Math.round(cur.wind_speed_10m)} קמ"ש ${deg2arrow(cur.wind_direction_10m)}`;
  if (el.wxWindHeb)
    el.wxWindHeb.textContent = deg2hebrewDir(cur.wind_direction_10m);
  if (el.wxHum) el.wxHum.textContent = `${cur.relative_humidity_2m}% · ${humidityLabel(cur.relative_humidity_2m)}`;

  // Dew point (נ.ר.)
  if (el.wxDew)
    el.wxDew.textContent = toDisplayTemp(Math.round(cur.dew_point_2m));

  // Wind gust — shown only when significantly higher than sustained wind speed
  if (el.wxGust) {
    const gust = Math.round(cur.wind_gusts_10m);
    const sustained = Math.round(cur.wind_speed_10m);
    if (gust > sustained + 5) {
      el.wxGust.textContent = `↑ ${gust} קמ"ש`;
      el.wxGust.style.display = "";
    } else {
      el.wxGust.textContent = "";
      el.wxGust.style.display = "none";
    }
  }

  // UV index pill (F122)
  if (el.wxUv) {
    const uv = cur.uv_index;
    const [uvCls, uvLabel] =
      uv <= 2
        ? ["uv-low", "נמוך"]
        : uv <= 5
          ? ["uv-mod", "בינוני"]
          : uv <= 7
            ? ["uv-high", "גבוה"]
            : uv <= 10
              ? ["uv-vhigh", "גבוה מאוד"]
              : ["uv-extreme", "קיצוני"];
    // All values are computed constants — innerHTML is safe here
    el.wxUv.innerHTML = `<span class="uv-pill ${uvCls}">${uv.toFixed(0)}</span> ${uvLabel}`;
  }

  // F1 (v7.2): Today's precipitation probability (from daily forecast index 0)
  if (el.wxPrecip) {
    const pp = d.daily.precipitation_probability_max[0] ?? 0;
    el.wxPrecip.textContent = `${pp}% · ${precipSummaryLabel(pp)}`;
  }

  // Sprint 32: Cloud cover
  if (el.wxCloud) {
    const cc = cur.cloud_cover ?? 0;
    el.wxCloud.textContent = formatCloudCover(cc);
  }

  // Daily forecast
  if (d.daily && el.wxForecast) {
    const fDays = el.wxForecast.querySelectorAll<HTMLElement>(".wx-fday");
    for (let i = 1; i <= 7; i++) {
      const fDay = fDays[i - 1];
      const dateStr = d.daily.time[i];
      if (fDay && dateStr) {
        const dn = new Date(dateStr).toLocaleDateString("he-IL", {
          weekday: "short",
        });
        const mx = Math.round(d.daily.temperature_2m_max[i] ?? 0);
        const mn = Math.round(d.daily.temperature_2m_min[i] ?? 0);
        const wc = d.daily.weather_code[i] ?? 0;
        const emoji = WX_EMOJI[wc] ?? "🌡️";
        fDay.textContent = `${emoji} ${dn} ${toDisplayTemp(mx)}/${toDisplayTemp(mn)}`;

        // Precipitation chance bar (F56)
        const precip = d.daily.precipitation_probability_max[i];
        if (precip != null && precip > 0) {
          const bar = document.createElement("div");
          bar.className = "wx-precip-bar";
          const fill = document.createElement("div");
          fill.className = "wx-precip-fill";
          fill.style.width = `${Math.min(100, precip)}%`;
          bar.appendChild(fill);
          fDay.appendChild(bar);
        }
      }
    }
  }

  // Weekly weather summary (F148)
  if (d.daily && el.wxWeekSummary) {
    const maxTemps = d.daily.temperature_2m_max.slice(1, 8).filter(
      (v): v is number => v != null,
    );
    const minTemps = d.daily.temperature_2m_min.slice(1, 8).filter(
      (v): v is number => v != null,
    );
    const codes = d.daily.weather_code.slice(1, 8).filter(
      (v): v is number => v != null,
    );
    if (maxTemps.length && minTemps.length) {
      const weekMax = Math.round(Math.max(...maxTemps));
      const weekMin = Math.round(Math.min(...minTemps));
      // Find dominant weather code (most frequent in range)
      const freq = new Map<number, number>();
      codes.forEach((c) => freq.set(c, (freq.get(c) ?? 0) + 1));
      let dominant = codes[0] ?? 0;
      let domCount = 0;
      freq.forEach((cnt, code) => {
        if (cnt > domCount) {
          dominant = code;
          domCount = cnt;
        }
      });
      const domEmoji = WX_EMOJI[dominant] ?? "🌡️";
      el.wxWeekSummary.textContent = `${domEmoji} ${toDisplayTemp(weekMin)}–${toDisplayTemp(weekMax)}`;
    }
  }

  // Sunrise/sunset + moon phase
  if (d.daily && el.wxRise) {
    const ss = new Date(d.daily.sunset[0] ?? "");
    if (!isNaN(ss.getTime())) {
      const sunsetStr = ss.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const [moonEmoji] = moonPhase();
      el.wxRise.textContent = `${sunsetStr} ${moonEmoji}`;
    }
  }

  // Min/max today
  if (el.wxMinMax && d.daily) {
    const dayMax = d.daily.temperature_2m_max[0];
    const dayMin = d.daily.temperature_2m_min[0];
    if (dayMax != null && dayMin != null) {
      el.wxMinMax.textContent = `${toDisplayTemp(Math.round(dayMin))} / ${toDisplayTemp(Math.round(dayMax))}`;
    }
  }

  // Sprint 46: Hourly strip (next 6 hours)
  renderHourlyStrip(d);
}

const loadWeather = createCardLoader<WeatherResponse>(
  { id: "wx", ttl: 900_000, interval: INTERVALS.WEATHER },
  fetchWeather,
  renderWeather,
  isWeatherResponse,
);

export function initWeatherCard(): void {
  cacheDom();
  initWeatherCities(); // Apply configured cities from localStorage
  void loadWeather();
  scheduleCard(loadWeather, INTERVALS.WEATHER);

  // Wire chart toggle button — persist view mode to localStorage
  document.getElementById("wx-chart-toggle")?.addEventListener("click", () => {
    const chart = document.getElementById("wx-hourly");
    if (chart) {
      chart.classList.toggle("wx-chart-rain");
      try {
        localStorage.setItem(
          LS_WX_CHART_MODE,
          chart.classList.contains("wx-chart-rain") ? "rain" : "temp",
        );
      } catch { /* quota */ }
    }
  });
  // Restore persisted chart mode
  if (localStorage.getItem(LS_WX_CHART_MODE) === "rain") {
    document.getElementById("wx-hourly")?.classList.add("wx-chart-rain");
  }

  // Wire temperature unit toggle (°C ↔ °F)
  document
    .getElementById("wx-temp")
    ?.addEventListener("click", () => toggleTempUnit());

  // Wire city tab clicks
  document.getElementById("wx-city-tabs")?.addEventListener("click", (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".wx-city-tab",
    );
    if (!tab) return;
    const lat = parseFloat(tab.dataset["lat"] ?? "");
    const lon = parseFloat(tab.dataset["lon"] ?? "");
    if (isNaN(lat) || isNaN(lon)) return;
    // Update active state
    document
      .querySelectorAll(".wx-city-tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    void switchWeatherCity(lat, lon);
  });

  // Subscribe to reactive state: re-render when tempUnit changes externally (v8.0)
  state.on<string>("config.tempUnit", () => {
    const fresh = cGet<WeatherResponse>("wx", INTERVALS.WEATHER);
    const data = fresh ?? cGetStale<WeatherResponse>("wx");
    if (data) renderWeather(data);
  });

  diagLog("FDB-057: [weather] Initialized");
}

// ── Sprint 87: configSchema ────────────────────────────────────────────────

export const weatherConfigSchema: CardConfigField[] = [
  {
    key: "tempUnit",
    labelHe: "יחידת טמפרטורה",
    labelEn: "Temperature Unit",
    type: "select",
    defaultValue: "C",
    options: [
      { value: "C", label: "°C" },
      { value: "F", label: "°F" },
    ],
    tab: "display",
    group: "weather",
  },
  { key: "homeCity", labelHe: "עיר ברירת מחדל", labelEn: "Default City", type: "text", defaultValue: "jerusalem", tab: "display", group: "weather" },
  { key: "weatherShowDetails", labelHe: "הצג פרטים (לחות/UV/ירח)", labelEn: "Show Details (humidity/UV/moon)", type: "boolean", defaultValue: true, tab: "display", group: "weather" },
  { key: "weatherShowHourly", labelHe: "הצג תחזית שעתית", labelEn: "Show Hourly Forecast", type: "boolean", defaultValue: true, tab: "display", group: "weather" },
  { key: "weatherShowWind", labelHe: "הצג רוח", labelEn: "Show Wind", type: "boolean", defaultValue: true, tab: "display", group: "weather" },
  { key: "weatherShowSunrise", labelHe: "הצג זריחה/שקיעה", labelEn: "Show Sunrise/Sunset", type: "boolean", defaultValue: true, tab: "display", group: "weather" },
];
