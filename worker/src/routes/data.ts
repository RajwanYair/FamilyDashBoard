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
  CurrencySchema,
  HebcalSchema,
  HebcalHolidaysSchema,
  safeParse,
} from "../utils/schemas";
import type { Env } from "../index";

// ── KV stale-fallback helpers (Stream W.2) ────────────────────────────────

/**
 * Try to read a cached value from KV.
 * Returns the parsed object with `_stale: true` injected, or null if absent.
 */
async function kvGetStale<T>(
  kv: KVNamespace,
  key: string,
): Promise<(T & { _stale: true }) | null> {
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    return { ...parsed, _stale: true };
  } catch {
    return null;
  }
}

/** Write a successful upstream response to KV for future stale fallback. */
async function kvPut(
  kv: KVNamespace,
  key: string,
  data: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch {
    // Non-fatal — KV write failures should not break the response.
  }
}

export async function handleWeather(url: URL, env: Env): Promise<Response> {
  let latNum: number, lonNum: number;
  try {
    latNum = requireLat(url);
    lonNum = requireLon(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const kvKey = `weather:${latNum.toFixed(4)}:${lonNum.toFixed(4)}`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;
  const res = await fetch(weatherUrl);
  if (!res.ok) {
    // Upstream error — try KV stale fallback before proxy
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "open-meteo-kv-stale", true, 60);
    return proxyResponse(res, 60);
  }
  const data: unknown = await res.json();
  const parsed = safeParse(WeatherSchema, data);
  if (!parsed.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "open-meteo-kv-stale", true, 60);
    return jsonResponse({ error: "Upstream shape mismatch", detail: parsed.error }, 502);
  }
  // Write to KV for future stale fallback (24 h TTL)
  void kvPut(env.CACHE_KV, kvKey, parsed.data, 86400);
  return workerEnvelope(parsed.data, "open-meteo", false, 1800); // 30 min
}

export async function handleCurrency(env: Env): Promise<Response> {
  const kvKey = "currency:ILS";
  const upstreams: Array<{ url: string; provider: string }> = [
    { url: "https://open.er-api.com/v6/latest/ILS", provider: "open.er-api.com" },
    { url: "https://api.exchangerate-api.com/v4/latest/ILS", provider: "exchangerate-api.com" },
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

  return workerEnvelope(
    { error: "Currency upstream unavailable" },
    "none",
    true,
    60,
  );
}

export async function handleHebcal(url: URL): Promise<Response> {
  let geonameid: string;
  try {
    geonameid = requireGeoId(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const res = await fetch(
    `https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameid}&M=on`,
  );
  if (!res.ok) return proxyResponse(res, 60);
  const data: unknown = await res.json();
  const parsed = safeParse(HebcalSchema, data);
  if (!parsed.ok) {
    return jsonResponse({ error: "Upstream shape mismatch", detail: parsed.error }, 502);
  }
  return workerEnvelope(parsed.data, "hebcal", false, 21600); // 6 h
}

export async function handleHebcalHolidays(url: URL): Promise<Response> {
  let yearNum: number;
  try {
    yearNum = requireYear(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const res = await fetch(
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&year=${yearNum}&month=x`,
  );
  if (!res.ok) return proxyResponse(res, 60);
  const data: unknown = await res.json();
  const parsed = safeParse(HebcalHolidaysSchema, data);
  if (!parsed.ok) {
    return jsonResponse({ error: "Upstream shape mismatch", detail: parsed.error }, 502);
  }
  return workerEnvelope(parsed.data, "hebcal", false, 43200); // 12 h
}
