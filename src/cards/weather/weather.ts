/**
 * FamilyDashBoard v6 — Weather Card
 *
 * Open-Meteo integration: current conditions, hourly chart, 7-day forecast.
 */

import { createCardLoader, scheduleCard } from "../base-card";
import { INTERVALS, WX_CODES, WX_EMOJI } from "../../core/constants";
import type { WeatherResponse } from "../../types/api";
import { diagLog } from "../../core/diag";
import { loadConfig } from "../../core/config";

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
};

function cacheDom(): void {
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
}

function getTempUnit(): "C" | "F" {
  return loadConfig().tempUnit;
}

function toDisplayTemp(c: number): string {
  if (getTempUnit() === "F") return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${c}°C`;
}

function deg2arrow(deg: number): string {
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round(deg / 45) % 8] ?? "↓";
}

async function fetchWeather(): Promise<WeatherResponse> {
  // TODO: support multi-city when city config is wired
  const lat = 31.7683;
  const lon = 35.2137;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather HTTP ${String(res.status)}`);
  return (await res.json()) as WeatherResponse;
}

function renderWeather(d: WeatherResponse): void {
  const cur = d.current;
  const tempC = Math.round(cur.temperature_2m);

  if (el.topTemp) el.topTemp.textContent = toDisplayTemp(tempC);
  if (el.wxTemp) el.wxTemp.textContent = toDisplayTemp(tempC);
  if (el.wxDesc) {
    const desc = WX_CODES[cur.weather_code] ?? "לא ידוע";
    const feels = Math.round(cur.apparent_temperature);
    el.wxDesc.textContent = `${desc} · מרגיש ${toDisplayTemp(feels)}`;
  }
  if (el.wxIcon) el.wxIcon.textContent = WX_EMOJI[cur.weather_code] ?? "🌡️";
  if (el.wxWind)
    el.wxWind.textContent = `${Math.round(cur.wind_speed_10m)} קמ"ש ${deg2arrow(cur.wind_direction_10m)}`;
  if (el.wxHum) el.wxHum.textContent = `${cur.relative_humidity_2m}%`;

  // UV index
  if (el.wxUv) {
    const uv = cur.uv_index;
    const label =
      uv <= 2
        ? "נמוך"
        : uv <= 5
          ? "בינוני"
          : uv <= 7
            ? "גבוה"
            : uv <= 10
              ? "גבוה מאוד"
              : "קיצוני";
    el.wxUv.textContent = `${uv.toFixed(1)} (${label})`;
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
      }
    }
  }

  // Sunrise/sunset
  if (d.daily && el.wxRise) {
    const ss = new Date(d.daily.sunset[0] ?? "");
    if (!isNaN(ss.getTime())) {
      el.wxRise.textContent = ss.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      });
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
}

const loadWeather = createCardLoader<WeatherResponse>(
  { id: "wx", ttl: 900_000, interval: INTERVALS.WEATHER },
  fetchWeather,
  renderWeather,
);

export function initWeatherCard(): void {
  cacheDom();
  void loadWeather();
  scheduleCard(loadWeather, INTERVALS.WEATHER);
  diagLog("[weather] Initialized");
}
