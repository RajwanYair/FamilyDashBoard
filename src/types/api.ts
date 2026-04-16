/**
 * FamilyDashBoard v6 — API Response Types
 *
 * TypeScript interfaces for all external API responses.
 */

// ── Weather (Open-Meteo) ──
export interface WeatherResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    apparent_temperature: number;
    uv_index: number;
    dew_point_2m: number;
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

// ── Stocks (Yahoo Finance v8 Chart) ──
export interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        previousClose: number;
        currency: string;
        regularMarketVolume: number;
        averageDailyVolume10Day?: number;
        fiftyTwoWeekLow?: number;
        fiftyTwoWeekHigh?: number;
        postMarketPrice?: number;
        preMarketPrice?: number;
        postMarketChangePercent?: number;
        preMarketChangePercent?: number;
      };
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

// ── Currency (ER-API) ──
export interface CurrencyResponse {
  rates: Record<string, number>;
  base_code: string;
  time_last_update_utc: string;
}

// ── Hebrew Calendar (Hebcal) ──
export interface HebcalResponse {
  title: string;
  items: HebcalItem[];
}

export interface HebcalItem {
  title: string;
  hebrew: string;
  date: string;
  category:
    | "candles"
    | "havdalah"
    | "holiday"
    | "parashat"
    | "omer"
    | "roshchodesh"
    | string;
  subcat?: string;
  memo?: string;
  link?: string;
}

// ── Sefaria Calendar ──
export interface SefariaCalendarResponse {
  calendar_items: SefariaCalendarItem[];
  date: string;
}

export interface SefariaCalendarItem {
  title: { en: string; he: string };
  url: string;
  ref: string;
  category: string;
  order: number;
  description?: { en: string; he: string };
}

// ── Red Alerts (Tzeva Adom) ──
export interface AlertZone {
  cities: string[];
  threat: number;
  time: number; // Unix timestamp (seconds)
}

export interface AlertEvent {
  alerts: AlertZone[];
  id?: string | number;
}

export type AlertsResponse = AlertEvent[];

// ── CoinGecko (BTC fallback) ──
export interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
}

// ── RSS Feed Item (after parsing) ──
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
  description?: string;
}

// ── Calendar (ICS parsed event) ──
export interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
  icsIndex: number;
  category?: string;
}

// ── Runtime type guards ───────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isNumArr(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" || x === null);
}
function isStrArr(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * Validates that `v` has the shape of a WeatherResponse.
 * Returns false for any missing or wrong-type required field.
 */
export function isWeatherResponse(v: unknown): v is WeatherResponse {
  if (!isObj(v)) return false;
  const cur = v["current"];
  if (!isObj(cur)) return false;
  const numFields: (keyof WeatherResponse["current"])[] = [
    "temperature_2m", "relative_humidity_2m", "weather_code",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "apparent_temperature", "uv_index", "dew_point_2m",
  ];
  if (numFields.some((f) => typeof cur[f] !== "number")) return false;
  const hourly = v["hourly"];
  if (!isObj(hourly) || !isStrArr(hourly["time"]) || !isNumArr(hourly["temperature_2m"])) return false;
  const daily = v["daily"];
  if (!isObj(daily) || !isStrArr(daily["time"]) || !isNumArr(daily["temperature_2m_max"])) return false;
  return true;
}

/**
 * Validates that `v` has the shape of a NewsItem.
 */
export function isNewsItem(v: unknown): v is NewsItem {
  if (!isObj(v)) return false;
  return typeof v["title"] === "string" && typeof v["link"] === "string" && typeof v["source"] === "string";
}

/**
 * Validates that `v` has the shape of a CurrencyResponse.
 */
export function isCurrencyResponse(v: unknown): v is CurrencyResponse {
  if (!isObj(v)) return false;
  return isObj(v["rates"]) && typeof v["base_code"] === "string";
}

/**
 * Validates that `v` has the shape of an AlertEvent array item.
 */
export function isAlertEvent(v: unknown): v is AlertEvent {
  if (!isObj(v)) return false;
  if (!Array.isArray(v["alerts"])) return false;
  return v["alerts"].every(
    (a) =>
      isObj(a) &&
      Array.isArray(a["cities"]) &&
      typeof a["time"] === "number",
  );
}
