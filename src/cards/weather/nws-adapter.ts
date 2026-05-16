/**
 * FamilyDashBoard — NWS (api.weather.gov) adapter
 *
 * Used when `weatherUsTravelMode` is enabled in config.
 * Converts api.weather.gov point → forecast JSON into the shared WeatherResponse shape.
 *
 * Reference: https://www.weather.gov/documentation/services-web-api
 *
 * initial stub — fetches NWS point metadata then
 * hourly forecast; populates only the fields WeatherResponse requires.
 * Full implementation (7-day daily, UV index) tracked in ROADMAP v14.
 */

import type { WeatherResponse } from "../../types/api";
import { diagLog } from "../../core/diag";
import { fetchWithTimeout } from "../../core/fetch";
import { cGet, cSet } from "../../core/cache";

const NWS_API = "https://api.weather.gov";
const CACHE_KEY_PREFIX = "nws:";
const CACHE_TTL_S = 600; // 10 min

/** Minimal shape returned by api.weather.gov /points/{lat},{lon} */
interface NWSPointMeta {
  properties: {
    forecastHourly: string;
    relativeLocation: { properties: { city: string; state: string } };
  };
}

/** Minimal shape for one NWS hourly period */
interface NWSPeriod {
  temperature: number;
  temperatureUnit: "F" | "C";
  windSpeed: string; // e.g. "10 mph"
  windDirection: string;
  shortForecast: string;
  probabilityOfPrecipitation: { value: number | null };
  startTime: string;
}

interface NWSHourlyForecast {
  properties: { periods: NWSPeriod[] };
}

/** Convert Fahrenheit → Celsius (NWS always returns °F) */
export function fToC(f: number): number {
  return Math.round((f - 32) * (5 / 9));
}

/** Map a short NWS forecast phrase to an Open-Meteo WMO weather code (best-effort). */
export function nwsPhraseToWmoCode(phrase: string): number {
  const p = phrase.toLowerCase();
  if (p.includes("thunder")) return 95;
  if (p.includes("snow")) return 71;
  if (p.includes("rain") || p.includes("shower")) return 61;
  if (p.includes("drizzle")) return 51;
  if (p.includes("fog")) return 45;
  if (p.includes("mostly cloudy") || p.includes("overcast")) return 3;
  if (p.includes("partly cloudy") || p.includes("partly sunny")) return 2;
  if (p.includes("sunny") || p.includes("clear")) return 0;
  return 1; // mostly clear
}

/**
 * Fetch weather data from api.weather.gov for a US location.
 * Returns a partial WeatherResponse populated from the NWS hourly endpoint.
 * Throws on network error so the caller can fall back to Open-Meteo.
 */
export async function fetchNWS(lat: number, lon: number): Promise<WeatherResponse> {
  const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = cGet<WeatherResponse>(cacheKey, CACHE_TTL_S);
  if (cached !== null) {
    diagLog(`[NWS] cache hit ${cacheKey}`);
    return cached;
  }

  diagLog(`[NWS] fetching point metadata lat=${lat} lon=${lon}`);
  const pointResp = await fetchWithTimeout(
    `${NWS_API}/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
    8_000,
    {
      headers: { "User-Agent": "FamilyDashBoard/14.14 (github.com/RajwanYair/FamilyDashBoard)" },
    },
  );
  if (!pointResp.ok) throw new Error(`NWS /points error ${pointResp.status}`);
  const pointMeta: NWSPointMeta = (await pointResp.json()) as NWSPointMeta;

  const hourlyUrl = pointMeta.properties.forecastHourly;
  diagLog(`[NWS] fetching hourly forecast ${hourlyUrl}`);
  const hourlyResp = await fetchWithTimeout(hourlyUrl, 8_000, {
    headers: { "User-Agent": "FamilyDashBoard/14.14 (github.com/RajwanYair/FamilyDashBoard)" },
  });
  if (!hourlyResp.ok) throw new Error(`NWS hourly error ${hourlyResp.status}`);
  const hourlyData: NWSHourlyForecast = (await hourlyResp.json()) as NWSHourlyForecast;

  const periods = hourlyData.properties.periods;
  const now = periods[0];
  if (!now) throw new Error("NWS: no periods returned");

  const tempC = fToC(now.temperature);
  const wmoCode = nwsPhraseToWmoCode(now.shortForecast);

  // Build a minimal WeatherResponse from NWS data
  const result: WeatherResponse = {
    current: {
      temperature_2m: tempC,
      relative_humidity_2m: 0, // NWS hourly doesn't include RH; leave as 0
      weather_code: wmoCode,
      wind_speed_10m: parseFloat(now.windSpeed) || 0,
      wind_direction_10m: 0, // direction is compass text — omit
      wind_gusts_10m: 0,
      apparent_temperature: tempC, // NWS doesn't provide feels-like in hourly
      uv_index: 0,
      dew_point_2m: 0,
      cloud_cover: 0,
    },
    hourly: {
      time: periods.slice(0, 24).map((p) => p.startTime),
      temperature_2m: periods.slice(0, 24).map((p) => fToC(p.temperature)),
      precipitation_probability: periods
        .slice(0, 24)
        .map((p) => p.probabilityOfPrecipitation.value ?? 0),
      weather_code: periods.slice(0, 24).map((p) => nwsPhraseToWmoCode(p.shortForecast)),
    },
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

  cSet(cacheKey, result);
  diagLog(`[NWS] fetch complete tempC=${tempC}`);
  return result;
}
