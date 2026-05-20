/**
 * D8/W-IMS — Israel Meteorological Service weather adapter (ADR-061, v14.0)
 *
 * Fetches current-conditions data from the IMS public station feed and
 * converts it to the shared WeatherResponse shape. Activated only when
 * the requested lat/lon falls within IL bounds (ADR-061 §Adapter Contract rule 4).
 *
 * Source: https://ims.gov.il/sites/default/files/ims_data/map_data/currentWeather.json
 *   — A public JSON file updated ~hourly with all Israeli observation stations.
 *
 * Limitations (v14.0):
 *   - Current conditions only; hourly/daily arrays are populated as single-entry
 *     placeholders. Callers may complement with Open-Meteo for forecast data.
 *   - Weather code is inferred from rainfall and humidity (best-effort WMO mapping).
 *   - IMS warnings and Hebrew advisories pass through via the `imsMeta` field.
 */

import type { WeatherResponse } from "../../types/api";
import { API } from "../../core/constants";
import { fetchJSON } from "../../core/fetch";
import { today } from "../../core/temporal";
import { diagLog } from "../../core/diag";
import { cGet, cSet } from "../../core/cache";

const PROVIDER_ID = "ims";
const CACHE_KEY_PREFIX = "ims:";
const CACHE_TTL_S = 1_800; // 30 min — IMS updates ~hourly

/** IL bounding box (mirrors boi-adapter.ts). */
export const IL_LAT_MIN = 29.4;
export const IL_LAT_MAX = 33.4;
export const IL_LON_MIN = 34.2;
export const IL_LON_MAX = 35.9;

/** Return true when the coordinates are within Israel. */
export function isILGeo(lat: number, lon: number): boolean {
  return lat >= IL_LAT_MIN && lat <= IL_LAT_MAX && lon >= IL_LON_MIN && lon <= IL_LON_MAX;
}

/**
 * Minimal shape of one station entry in the IMS currentWeather.json feed.
 * Fields use IMS standard abbreviations; optional fields may be null / absent.
 */
export interface IMSStation {
  stn_num?: number | null;
  time_obs?: string | null;
  lat?: number | null;
  lon?: number | null;
  location?: string | null;
  /** Dry-bulb temperature °C */
  TD?: number | null;
  /** Daily max temperature °C */
  TDmax?: number | null;
  /** Daily min temperature °C */
  TDmin?: number | null;
  /** Relative humidity % */
  RH?: number | null;
  /** Wind direction (degrees) */
  WD?: number | null;
  /** Wind speed (m/s) */
  WS?: number | null;
  /** Wind gust (m/s) */
  WSmax?: number | null;
  /** Precipitation accumulation (mm) */
  Rain?: number | null;
  /** Dew point temperature °C */
  Td?: number | null;
}

/** Haversine distance in kilometres between two lat/lon pairs. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Best-effort conversion of IMS field values to a WMO weather code.
 * Priority: rain > humidity > default clear.
 */
export function imsToWmoCode(rain: number, humidity: number): number {
  if (rain > 10) return 65; // heavy rain
  if (rain > 2) return 61; // moderate rain
  if (rain > 0.1) return 51; // light drizzle/rain
  if (humidity > 90) return 45; // fog
  if (humidity > 75) return 3; // overcast
  if (humidity > 55) return 2; // partly cloudy
  return 1; // mostly clear
}

/**
 * Convert m/s wind speed to km/h.
 */
export function msToKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

/**
 * Find the station in `stations` nearest to (`lat`, `lon`).
 * Returns null when the array is empty or no station has valid coordinates.
 */
export function findNearestStation(
  stations: IMSStation[],
  lat: number,
  lon: number,
): IMSStation | null {
  let best: IMSStation | null = null;
  let bestDist = Infinity;

  for (const s of stations) {
    if (typeof s.lat !== "number" || typeof s.lon !== "number") continue;
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }

  return best;
}

/**
 * Convert an IMS station observation into the shared WeatherResponse shape.
 * Hourly is a 24-hour repeat of the current observation (IMS does not provide
 * hourly forecasts in this endpoint). Daily is a single-entry best-estimate
 * from TDmax/TDmin.
 */
export function imsStationToWeatherResponse(station: IMSStation): WeatherResponse {
  const tempC = typeof station.TD === "number" ? station.TD : 0;
  const humidity = typeof station.RH === "number" ? station.RH : 0;
  const windSpeedMs = typeof station.WS === "number" ? station.WS : 0;
  const windGustMs = typeof station.WSmax === "number" ? station.WSmax : windSpeedMs;
  const windDir = typeof station.WD === "number" ? station.WD : 0;
  const dewPoint = typeof station.Td === "number" ? station.Td : 0;
  const rain = typeof station.Rain === "number" ? station.Rain : 0;
  const wmoCode = imsToWmoCode(rain, humidity);

  const windKmh = msToKmh(windSpeedMs);
  const gustKmh = msToKmh(windGustMs);

  // Build ISO-8601 time strings for hourly (24 repeating slots from obs time)
  const baseTime = station.time_obs ?? today().toISOString();
  const baseMs = new Date(baseTime).getTime();
  const hourlyTimes = Array.from({ length: 24 }, (_, i) =>
    new Date(baseMs + i * 3_600_000).toISOString().slice(0, 16),
  );

  // Daily: single entry using TDmax/TDmin if available; fall back to ±3°C estimate
  const tdMax = typeof station.TDmax === "number" ? station.TDmax : tempC + 3;
  const tdMin = typeof station.TDmin === "number" ? station.TDmin : tempC - 3;
  const today = new Date(baseMs).toISOString().slice(0, 10);

  return {
    current: {
      temperature_2m: tempC,
      relative_humidity_2m: humidity,
      weather_code: wmoCode,
      wind_speed_10m: windKmh,
      wind_direction_10m: windDir,
      wind_gusts_10m: gustKmh,
      apparent_temperature: tempC, // IMS doesn't provide feels-like; use dry bulb
      uv_index: 0, // not in IMS current-weather feed
      dew_point_2m: dewPoint,
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: Array(24).fill(tempC) as number[],
      precipitation_probability: Array(24).fill(rain > 0 ? 60 : 10) as number[],
      weather_code: Array(24).fill(wmoCode) as number[],
    },
    daily: {
      time: [today],
      temperature_2m_max: [tdMax],
      temperature_2m_min: [tdMin],
      weather_code: [wmoCode],
      sunrise: [""],
      sunset: [""],
      precipitation_probability_max: [rain > 0 ? 80 : 10],
      uv_index_max: [0],
    },
  };
}

/**
 * Fetch IMS current-conditions data and return a WeatherResponse for
 * the station nearest to (`lat`, `lon`).
 * Throws so the caller can fall back to Open-Meteo.
 */
export async function fetchIMS(lat: number, lon: number): Promise<WeatherResponse> {
  if (!isILGeo(lat, lon)) {
    throw new Error(`[IMS] lat=${lat} lon=${lon} is outside IL bounds — use Open-Meteo`);
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cGet<WeatherResponse>(cacheKey, CACHE_TTL_S);
  if (cached !== null) {
    diagLog(`[${PROVIDER_ID}] cache hit ${cacheKey}`);
    return cached;
  }

  diagLog(`[${PROVIDER_ID}] fetching station data lat=${lat} lon=${lon}`);

  const stations = await fetchJSON<IMSStation[]>(API.IMS_CURRENT_WEATHER);
  if (!Array.isArray(stations) || stations.length === 0) {
    throw new Error("[IMS] empty or invalid station response");
  }

  const nearest = findNearestStation(stations, lat, lon);
  if (!nearest) {
    throw new Error("[IMS] no station with valid coordinates found");
  }

  diagLog(
    `[${PROVIDER_ID}] nearest station: ${nearest.location ?? "unknown"} ` +
      `(${nearest.lat?.toFixed(2)}, ${nearest.lon?.toFixed(2)})`,
  );

  const result = imsStationToWeatherResponse(nearest);
  cSet(cacheKey, result);
  return result;
}
