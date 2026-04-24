/**
 * FamilyDashBoard Worker — NWS (api.weather.gov) normalizer (V13-DATA)
 *
 * Converts NWS forecast periods to the same WeatherSchema shape that
 * Open-Meteo returns, so the client needs no additional adapter.
 */

import type * as v from "valibot";
import type { NwsForecastPeriodSchema } from "./schemas";

type NwsPeriod = v.InferOutput<typeof NwsForecastPeriodSchema>;

// ── Unit conversions ──────────────────────────────────────────────────────────

/** Fahrenheit → Celsius, rounded to one decimal. */
export function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 * 10) / 10;
}

/** mph → km/h, rounded to one decimal. */
export function mphToKph(mph: number): number {
  return Math.round(mph * 1.60934 * 10) / 10;
}

/**
 * Parse NWS wind speed string to km/h.
 * Accepts "5 mph", "5 to 10 mph", "Calm", etc.
 * Returns the lower bound of a range.
 */
export function parseWindKph(windSpeed: string): number {
  if (/calm/i.test(windSpeed)) return 0;
  const match = /(\d+)/.exec(windSpeed);
  return match ? mphToKph(parseInt(match[1]!, 10)) : 0;
}

/** Cardinal/intercardinal wind direction → degrees 0–360. */
const DIR_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

export function windDirToDeg(dir: string): number {
  return DIR_DEG[dir.trim().toUpperCase()] ?? 0;
}

/** NWS shortForecast string → WMO weather code (best-effort approximation). */
export function shortForecastToWmo(forecast: string): number {
  const s = forecast.toLowerCase();
  if (/thunderstorm/.test(s)) return 95;
  if (/blizzard|heavy snow/.test(s)) return 73;
  if (/snow|flurries/.test(s)) return 71;
  if (/sleet|freezing rain/.test(s)) return 66;
  if (/rain shower|shower/.test(s)) return 80;
  if (/rain|drizzle/.test(s)) return 61;
  if (/fog|haze/.test(s)) return 45;
  if (/overcast/.test(s)) return 3;
  if (/cloudy/.test(s)) return 2;
  if (/partly sunny|partly clear|mostly clear|mostly sunny/.test(s)) return 1;
  return 0; // Clear / Sunny
}

// ── Daily period pairing ──────────────────────────────────────────────────────

interface DailyEntry {
  date: string;
  maxC: number;
  minC: number;
  code: number;
  precipPct: number;
}

/**
 * NWS non-hourly forecast alternates Day/Night pairs.
 * Group by calendar date, taking the higher temp as max and lower as min.
 */
export function buildDailyEntries(periods: NwsPeriod[]): DailyEntry[] {
  const map = new Map<string, DailyEntry>();

  for (const p of periods.slice(0, 16)) {
    const date = p.startTime.slice(0, 10);
    const tempC = p.temperatureUnit === "F" ? fToC(p.temperature) : p.temperature;
    const precipPct = p.probabilityOfPrecipitation?.value ?? 0;
    const code = shortForecastToWmo(p.shortForecast);

    const existing = map.get(date);
    if (!existing) {
      map.set(date, {
        date,
        maxC: p.isDaytime ? tempC : Number.NEGATIVE_INFINITY,
        minC: p.isDaytime ? Number.POSITIVE_INFINITY : tempC,
        code,
        precipPct,
      });
    } else {
      if (p.isDaytime) {
        existing.maxC = Math.max(existing.maxC, tempC);
        existing.code = code; // day-period code takes precedence
      } else {
        existing.minC = Math.min(
          existing.minC === Number.POSITIVE_INFINITY ? tempC : existing.minC,
          tempC,
        );
        if (existing.maxC === Number.NEGATIVE_INFINITY) existing.maxC = tempC;
      }
      existing.precipPct = Math.max(existing.precipPct, precipPct);
    }
  }

  return Array.from(map.values())
    .slice(0, 8)
    .map((d) => ({
      ...d,
      maxC: d.maxC === Number.NEGATIVE_INFINITY ? d.minC : d.maxC,
      minC: d.minC === Number.POSITIVE_INFINITY ? d.maxC : d.minC,
    }));
}

// ── Main normalizer ───────────────────────────────────────────────────────────

export interface NwsNormalized {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    uv_index: number;
    dew_point_2m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
  };
}

/**
 * Normalize NWS hourly + daily forecast data to the Open-Meteo WeatherSchema shape.
 * @param hourlyPeriods — periods from /forecast/hourly (1-hour intervals)
 * @param dailyPeriods  — periods from /forecast (12-hour day/night intervals)
 */
export function normalizeNwsToWeatherSchema(
  hourlyPeriods: NwsPeriod[],
  dailyPeriods: NwsPeriod[],
): NwsNormalized {
  const cur = hourlyPeriods[0]!;
  const curTempC = cur.temperatureUnit === "F" ? fToC(cur.temperature) : cur.temperature;

  const h24 = hourlyPeriods.slice(0, 24);
  const daily = buildDailyEntries(dailyPeriods);

  return {
    current: {
      temperature_2m: curTempC,
      apparent_temperature: curTempC, // NWS hourly doesn't expose feels-like
      relative_humidity_2m: cur.relativeHumidity?.value ?? 50,
      weather_code: shortForecastToWmo(cur.shortForecast),
      wind_speed_10m: parseWindKph(cur.windSpeed),
      wind_direction_10m: windDirToDeg(cur.windDirection),
      wind_gusts_10m: parseWindKph(cur.windSpeed),
      uv_index: 0, // NWS hourly doesn't include UV index
      dew_point_2m: cur.dewpoint?.value ?? 0,
    },
    hourly: {
      time: h24.map((p) => p.startTime.slice(0, 16)),
      temperature_2m: h24.map((p) =>
        p.temperatureUnit === "F" ? fToC(p.temperature) : p.temperature,
      ),
      precipitation_probability: h24.map((p) => p.probabilityOfPrecipitation?.value ?? 0),
      weather_code: h24.map((p) => shortForecastToWmo(p.shortForecast)),
    },
    daily: {
      time: daily.map((d) => d.date),
      temperature_2m_max: daily.map((d) => d.maxC),
      temperature_2m_min: daily.map((d) => d.minC),
      weather_code: daily.map((d) => d.code),
      sunrise: daily.map(() => ""),   // NWS forecast endpoints omit sunrise
      sunset: daily.map(() => ""),
      precipitation_probability_max: daily.map((d) => d.precipPct),
      uv_index_max: daily.map(() => 0),
    },
  };
}

/** Returns true when lat/lon are within the continental US + AK + HI bounds. */
export function isUsCoordinate(lat: number, lon: number): boolean {
  // Continental US: lat 24–50, lon -66 to -125
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) return true;
  // Alaska: lat 51–72, lon -130 to -168
  if (lat >= 51 && lat <= 72 && lon >= -168 && lon <= -130) return true;
  // Hawaii: lat 18–23, lon -154 to -161
  if (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) return true;
  return false;
}
