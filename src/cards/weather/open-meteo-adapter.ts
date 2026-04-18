/**
 * FamilyDashBoard v7 — Open-Meteo Provider Adapter (Sprint 89)
 *
 * Implements ProviderAdapter<WeatherResponse> for the Open-Meteo weather API.
 */

import type { ProviderAdapter, ProviderResult } from "../../types/provider";
import type { WeatherResponse } from "../../types/api";
import { isWeatherResponse } from "../../types/api";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { INTERVALS } from "../../core/constants";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from "../../core/provider";
import { fetchJSONWithWorker } from "../../core/fetch";
import { diagLog } from "../../core/diag";
import type { ProviderStatus } from "../../core/provider";

const PROVIDER_ID = "open-meteo";
const CACHE_KEY = "wx";

export function createOpenMeteoAdapter(
  lat: number,
  lon: number,
): ProviderAdapter<WeatherResponse> {
  const cacheTtl = INTERVALS.WEATHER;

  return {
    id: PROVIDER_ID,
    displayName: "Open-Meteo Weather",
    cacheKey: CACHE_KEY,
    cacheTtl,

    async fetch(): Promise<ProviderResult<WeatherResponse>> {
      // Check cache first
      const cached = cGet<WeatherResponse>(CACHE_KEY, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max` +
        `&hourly=temperature_2m,weather_code` +
        `&timezone=auto&forecast_days=7`;

      try {
        const data = await fetchJSONWithWorker<WeatherResponse>(url);
        if (!isWeatherResponse(data)) {
          recordProviderFailure(PROVIDER_ID);
          const stale = cGetStale<WeatherResponse>(CACHE_KEY);
          return { ok: false, error: "Invalid response shape", stale: stale ?? undefined };
        }
        cSet(CACHE_KEY, data);
        recordProviderSuccess(PROVIDER_ID);
        diagLog(`FDB-089: [open-meteo] Fetched weather for ${lat},${lon}`);
        return { ok: true, data };
      } catch (err) {
        recordProviderFailure(PROVIDER_ID);
        const stale = cGetStale<WeatherResponse>(CACHE_KEY);
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          stale: stale ?? undefined,
        };
      }
    },

    status(): ProviderStatus {
      return getProviderHealth(PROVIDER_ID).status;
    },
  };
}
