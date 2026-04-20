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

export async function handleWeather(url: URL): Promise<Response> {
  let latNum: number, lonNum: number;
  try {
    latNum = requireLat(url);
    lonNum = requireLon(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;
  const res = await fetch(weatherUrl);
  if (!res.ok) {
    // Upstream error — fall through to raw proxy so SW stale-cache kicks in
    return proxyResponse(res, 60);
  }
  const data: unknown = await res.json();
  const parsed = safeParse(WeatherSchema, data);
  if (!parsed.ok) {
    return jsonResponse({ error: "Upstream shape mismatch", detail: parsed.error }, 502);
  }
  return workerEnvelope(parsed.data, "open-meteo", false, 1800); // 30 min
}

export async function handleCurrency(): Promise<Response> {
  const upstreams: Array<{ url: string; provider: string }> = [
    { url: "https://open.er-api.com/v6/latest/ILS", provider: "open.er-api.com" },
    { url: "https://api.exchangerate-api.com/v4/latest/ILS", provider: "exchangerate-api.com" },
  ];

  for (const { url, provider } of upstreams) {
    const res = await fetch(url);
    if (res.ok) {
      const data: unknown = await res.json();
      const parsed = safeParse(CurrencySchema, data);
      if (parsed.ok) return workerEnvelope(parsed.data, provider, false, 3600); // 1 h
    }
  }

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
