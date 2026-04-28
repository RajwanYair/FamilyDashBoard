import { jsonResponse, proxyResponse, workerEnvelope } from "../utils/response";
import {
  ValidationError,
  validationErrorResponse,
  requireLat,
  requireLon,
  requireGeoId,
  requireYear,
} from "../utils/validation";
import {
  WeatherSchema,
  MetNoWeatherSchema,
  NwsPointsSchema,
  NwsForecastSchema,
  CurrencySchema,
  HebcalSchema,
  HebcalHolidaysSchema,
  safeParse,
} from "../utils/schemas";
import { normalizeNwsToWeatherSchema, isUsCoordinate } from "../utils/nws-normalize";
import { kvGetStale, kvPut } from "../utils/kv";
import type { Env } from "../types";

export async function handleWeather(url: URL, env: Env): Promise<Response> {
  let latNum: number, lonNum: number;
  try {
    latNum = requireLat(url);
    lonNum = requireLon(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const kvKey = `weather:${latNum.toFixed(4)}:${lonNum.toFixed(4)}`;
  const requestedProvider = url.searchParams.get("provider");

  // ── Opt-in: NWS (api.weather.gov) — US-travel mode ────────────────────────
  if (requestedProvider === "nws") {
    if (!isUsCoordinate(latNum, lonNum)) {
      return jsonResponse(
        { error: "NWS provider only supports US coordinates", param: "provider" },
        400,
      );
    }
    try {
      const pointsRes = await fetch(
        `https://api.weather.gov/points/${latNum.toFixed(4)},${lonNum.toFixed(4)}`,
        {
          headers: {
            "User-Agent": "FamilyDashBoard/12.8 https://github.com/RajwanYair/FamilyDashBoard",
            Accept: "application/json",
          },
        },
      );
      if (pointsRes.ok) {
        const pointsData: unknown = await pointsRes.json();
        const points = safeParse(NwsPointsSchema, pointsData);
        if (points.ok) {
          const [hourlyRes, dailyRes] = await Promise.all([
            fetch(points.data.properties.forecastHourly, {
              headers: {
                "User-Agent": "FamilyDashBoard/12.8 https://github.com/RajwanYair/FamilyDashBoard",
                Accept: "application/json",
              },
            }),
            fetch(points.data.properties.forecast, {
              headers: {
                "User-Agent": "FamilyDashBoard/12.8 https://github.com/RajwanYair/FamilyDashBoard",
                Accept: "application/json",
              },
            }),
          ]);
          if (hourlyRes.ok && dailyRes.ok) {
            const [hourlyData, dailyData] = await Promise.all([
              hourlyRes.json() as Promise<unknown>,
              dailyRes.json() as Promise<unknown>,
            ]);
            const parsedHourly = safeParse(NwsForecastSchema, hourlyData);
            const parsedDaily = safeParse(NwsForecastSchema, dailyData);
            if (parsedHourly.ok && parsedDaily.ok) {
              const normalized = normalizeNwsToWeatherSchema(
                parsedHourly.data.properties.periods,
                parsedDaily.data.properties.periods,
              );
              const nwsKey = `weather-nws:${latNum.toFixed(4)}:${lonNum.toFixed(4)}`;
              void kvPut(env.CACHE_KV, nwsKey, normalized, 3600);
              return workerEnvelope(normalized, "nws", false, 1800);
            }
          }
        }
      }
    } catch {
      // NWS unreachable — fall through to Open-Meteo
    }
    // NWS failed: try KV stale for this location
    const nwsStale = await kvGetStale(
      env.CACHE_KV,
      `weather-nws:${latNum.toFixed(4)}:${lonNum.toFixed(4)}`,
    );
    if (nwsStale) return workerEnvelope(nwsStale, "nws-kv-stale", true, 60);
  }

  // ── Primary: Open-Meteo ────────────────────────────────────────────────────
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;
  const primaryRes = await fetch(weatherUrl);
  if (primaryRes.ok) {
    const data: unknown = await primaryRes.json();
    const parsed = safeParse(WeatherSchema, data);
    if (parsed.ok) {
      void kvPut(env.CACHE_KV, kvKey, parsed.data, 86400);
      return workerEnvelope(parsed.data, "open-meteo", false, 1800);
    }
  }

  // ── Backup: KV stale (fast, no network) ───────────────────────────────────
  const staleKv = await kvGetStale(env.CACHE_KV, kvKey);
  if (staleKv) return workerEnvelope(staleKv, "open-meteo-kv-stale", true, 60);

  // ── Backup: met.no / Yr ────────────────────────────────────────────────────
  const metnoUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latNum.toFixed(4)}&lon=${lonNum.toFixed(4)}`;
  try {
    const metnoRes = await fetch(metnoUrl, {
      headers: {
        "User-Agent": "FamilyDashBoard/11.0 https://github.com/RajwanYair/FamilyDashBoard",
        Accept: "application/json",
      },
    });
    if (metnoRes.ok) {
      const metnoData: unknown = await metnoRes.json();
      const metnoValidated = safeParse(MetNoWeatherSchema, metnoData);
      if (metnoValidated.ok) {
        // Store raw met.no data under a separate key so it doesn't pollute the
        // Open-Meteo cache. The client receives it as-is inside the envelope;
        // the "provider" field signals which normaliser to apply on the client.
        const metnoKey = `weather-metno:${latNum.toFixed(4)}:${lonNum.toFixed(4)}`;
        void kvPut(env.CACHE_KV, metnoKey, metnoValidated.data, 3600);
        return workerEnvelope(metnoValidated.data, "met.no", false, 1800);
      }
    }
  } catch {
    // met.no unreachable — fall through to final error
  }

  return jsonResponse({ error: "All weather providers failed" }, 502);
}

export async function handleCurrency(env: Env): Promise<Response> {
  const kvKey = "currency:ILS";
  const upstreams: Array<{ url: string; provider: string }> = [
    { url: "https://open.er-api.com/v6/latest/ILS", provider: "open.er-api.com" },
    { url: "https://api.exchangerate-api.com/v4/latest/ILS", provider: "exchangerate-api.com" },
    // Roadmap #19: ECB-sourced rates via Frankfurter (zero-key, ECB daily reference, ILS base supported)
    { url: "https://api.frankfurter.dev/v1/latest?base=ILS", provider: "frankfurter-ecb" },
  ];

  for (const { url, provider } of upstreams) {
    const res = await fetch(url);
    if (res.ok) {
      const data: unknown = await res.json();
      const parsed = safeParse(CurrencySchema, data);
      if (parsed.ok) {
        // Write to KV for future stale fallback (48 h TTL)
        void kvPut(env.CACHE_KV, kvKey, parsed.data, 172800);
        return workerEnvelope(parsed.data, provider, false, 3600); // 1 h
      }
    }
  }

  // All upstreams failed — try KV stale fallback
  const stale = await kvGetStale(env.CACHE_KV, kvKey);
  if (stale) return workerEnvelope(stale, "currency-kv-stale", true, 60);

  return workerEnvelope({ error: "Currency upstream unavailable" }, "none", true, 60);
}

export async function handleHebcal(url: URL, env: Env): Promise<Response> {
  let geonameid: string;
  try {
    geonameid = requireGeoId(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const kvKey = `hebcal:${geonameid}`;
  const res = await fetch(`https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameid}&M=on`);
  if (!res.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "hebcal-kv-stale", true, 60);
    return proxyResponse(res, 60);
  }
  const data: unknown = await res.json();
  const parsed = safeParse(HebcalSchema, data);
  if (!parsed.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "hebcal-kv-stale", true, 60);
    return jsonResponse({ error: "Upstream shape mismatch", detail: parsed.error }, 502);
  }
  // Write to KV for future stale fallback (6 h TTL)
  void kvPut(env.CACHE_KV, kvKey, parsed.data, 21600);
  return workerEnvelope(parsed.data, "hebcal", false, 21600); // 6 h
}

export async function handleHebcalHolidays(url: URL, env: Env): Promise<Response> {
  let yearNum: number;
  try {
    yearNum = requireYear(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const kvKey = `hebcal-holidays:${yearNum}`;
  const res = await fetch(
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&year=${yearNum}&month=x`,
  );
  if (!res.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "hebcal-holidays-kv-stale", true, 60);
    return proxyResponse(res, 60);
  }
  const data: unknown = await res.json();
  const parsed = safeParse(HebcalHolidaysSchema, data);
  if (!parsed.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "hebcal-holidays-kv-stale", true, 60);
    return jsonResponse({ error: "Upstream shape mismatch", detail: parsed.error }, 502);
  }
  // Write to KV for future stale fallback (12 h TTL)
  void kvPut(env.CACHE_KV, kvKey, parsed.data, 43200);
  return workerEnvelope(parsed.data, "hebcal", false, 43200); // 12 h
}
