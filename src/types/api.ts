/**
 * FamilyDashBoard v7 — API Response Types
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
    cloud_cover?: number;
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
  category: "candles" | "havdalah" | "holiday" | "parashat" | "omer" | "roshchodesh" | string;
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
  category?: string | undefined;
  description?: string | undefined;
}

// ── Calendar (ICS parsed event)
export interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | undefined;
  description?: string | undefined;
  icsIndex: number;
  category?: string | undefined;
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
    "temperature_2m",
    "relative_humidity_2m",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "apparent_temperature",
    "uv_index",
    "dew_point_2m",
  ];
  if (numFields.some((f) => typeof cur[f] !== "number")) return false;
  const hourly = v["hourly"];
  if (!isObj(hourly) || !isStrArr(hourly["time"]) || !isNumArr(hourly["temperature_2m"]))
    return false;
  const daily = v["daily"];
  if (!isObj(daily) || !isStrArr(daily["time"]) || !isNumArr(daily["temperature_2m_max"]))
    return false;
  return true;
}

/**
 * Validates that `v` has the shape of a NewsItem.
 * Requires title, link, pubDate, and source strings.
 */
export function isNewsItem(v: unknown): v is NewsItem {
  if (!isObj(v)) return false;
  return (
    typeof v["title"] === "string" &&
    typeof v["link"] === "string" &&
    typeof v["pubDate"] === "string" &&
    typeof v["source"] === "string"
  );
}

/**
 * Validates that `v` has the shape of a CurrencyResponse.
 * Requires rates object, base_code, and time_last_update_utc strings.
 */
export function isCurrencyResponse(v: unknown): v is CurrencyResponse {
  if (!isObj(v)) return false;
  return (
    isObj(v["rates"]) &&
    typeof v["base_code"] === "string" &&
    typeof v["time_last_update_utc"] === "string"
  );
}

/**
 * Validates that `v` has the shape of an AlertEvent array item.
 */
export function isAlertEvent(v: unknown): v is AlertEvent {
  if (!isObj(v)) return false;
  if (!Array.isArray(v["alerts"])) return false;
  return v["alerts"].every(
    (a) => isObj(a) && Array.isArray(a["cities"]) && typeof a["time"] === "number",
  );
}

/**
 * Validates that `v` has the shape of a YahooChartResponse.
 * Requires chart.result[0].meta with required price fields.
 */
export function isYahooChartResponse(v: unknown): v is YahooChartResponse {
  if (!isObj(v)) return false;
  const chart = v["chart"];
  if (!isObj(chart)) return false;
  const result = chart["result"];
  if (!Array.isArray(result) || result.length === 0) return false;
  const first = result[0];
  if (!isObj(first)) return false;
  const meta = first["meta"];
  if (!isObj(meta)) return false;
  return (
    typeof meta["regularMarketPrice"] === "number" &&
    typeof meta["previousClose"] === "number" &&
    typeof meta["currency"] === "string"
  );
}

/**
 * Validates that `v` has the shape of a HebcalResponse.
 * Requires title string and items array.
 */
export function isHebcalResponse(v: unknown): v is HebcalResponse {
  if (!isObj(v)) return false;
  if (typeof v["title"] !== "string") return false;
  if (!Array.isArray(v["items"])) return false;
  return v["items"].every(
    (item) =>
      isObj(item) &&
      typeof item["title"] === "string" &&
      typeof item["date"] === "string" &&
      typeof item["category"] === "string",
  );
}

/**
 * Validates that `v` has the shape of a CoinGeckoResponse.
 * Requires bitcoin.usd and bitcoin.usd_24h_change numbers.
 */
export function isCoinGeckoResponse(v: unknown): v is CoinGeckoResponse {
  if (!isObj(v)) return false;
  const btc = v["bitcoin"];
  if (!isObj(btc)) return false;
  return typeof btc["usd"] === "number" && typeof btc["usd_24h_change"] === "number";
}

/**
 * Validates that `v` has the shape of a CalendarEvent.
 * Requires summary string, start/end Date objects, allDay boolean.
 */
export function isCalendarEvent(v: unknown): v is CalendarEvent {
  if (!isObj(v)) return false;
  return (
    typeof v["summary"] === "string" &&
    v["start"] instanceof Date &&
    v["end"] instanceof Date &&
    typeof v["allDay"] === "boolean" &&
    typeof v["icsIndex"] === "number"
  );
}

// ── Domain types (Sprint 36–44, v7.13) ────────────────────────────────────
//
// Normalized internal representations that decouple cards from provider quirks.
// Cards render domain models; provider-specific parsing lives in mapper functions.

// ── WeatherDomain (Sprint 36) ──

/** Normalized weather state — card renders this, not WeatherResponse directly. */
export interface WeatherDomain {
  /** Celsius temperature */
  tempC: number;
  /** Celsius feels-like temperature */
  feelsLikeC: number;
  /** Relative humidity 0–100 */
  humidity: number;
  /** Wind speed km/h */
  windKph: number;
  /** Wind direction degrees 0–360 */
  windDeg: number;
  /** UV index */
  uv: number;
  /** Open-Meteo WMO weather code */
  weatherCode: number;
  /** Dew point Celsius */
  dewPointC: number;
  /** Hourly forecast (next 12 hours) */
  hourly: Array<{ time: string; tempC: number; precipPct: number; code: number }>;
  /** 4-day daily forecast */
  daily: Array<{
    date: string;
    maxC: number;
    minC: number;
    code: number;
    sunrise: string;
    sunset: string;
    precipPct: number;
    uv: number;
  }>;
  /** ISO timestamp of when this data was fetched */
  fetchedAt: string;
}

/**
 * Map a raw WeatherResponse to the normalized WeatherDomain.
 * Safe to call after `isWeatherResponse()` confirms the shape.
 */
export function mapToWeatherDomain(r: WeatherResponse): WeatherDomain {
  const c = r.current;
  const h = r.hourly;
  const d = r.daily;
  const now = new Date();
  const nowHour = now.getHours();
  const hourly = h.time
    .slice(0, 24)
    .map((t, i) => ({
      time: t,
      tempC: h.temperature_2m[i] ?? 0,
      precipPct: h.precipitation_probability[i] ?? 0,
      code: h.weather_code[i] ?? 0,
    }))
    .filter((_, i) => {
      const hh = parseInt(h.time[i]?.slice(11, 13) ?? "0", 10);
      return hh >= nowHour;
    })
    .slice(0, 12);

  const daily = d.time.map((date, i) => ({
    date,
    maxC: d.temperature_2m_max[i] ?? 0,
    minC: d.temperature_2m_min[i] ?? 0,
    code: d.weather_code[i] ?? 0,
    sunrise: d.sunrise[i] ?? "",
    sunset: d.sunset[i] ?? "",
    precipPct: d.precipitation_probability_max[i] ?? 0,
    uv: d.uv_index_max[i] ?? 0,
  }));

  return {
    tempC: c.temperature_2m,
    feelsLikeC: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windKph: c.wind_speed_10m,
    windDeg: c.wind_direction_10m,
    uv: c.uv_index,
    weatherCode: c.weather_code,
    dewPointC: c.dew_point_2m,
    hourly,
    daily,
    fetchedAt: now.toISOString(),
  };
}

// ── StocksDomain (Sprint 37) ──

/** Normalized single-stock state. */
export interface StockDomain {
  symbol: string;
  price: number;
  prevClose: number;
  /** Absolute price change */
  change: number;
  /** Percentage change */
  changePct: number;
  currency: string;
  /** Closing prices from chart (may be sparse/null-filled) */
  closes: (number | null)[];
  /** Post-market price if available */
  postMarketPrice: number | null;
  /** Post-market change % if available */
  postMarketChangePct: number | null;
  /** Pre-market price if available */
  preMarketPrice: number | null;
  /** Pre-market change % if available */
  preMarketChangePct: number | null;
  /** ISO timestamp of when this data was fetched */
  fetchedAt: string;
}

/**
 * Map a raw YahooChartResponse to a normalized StockDomain.
 * Returns null if the response is missing required result data.
 */
export function mapToStockDomain(symbol: string, r: YahooChartResponse): StockDomain | null {
  const result = r.chart.result?.[0];
  if (!result) return null;
  const meta = result.meta;
  const closes = result.indicators.quote[0]?.close ?? [];
  const price = meta.regularMarketPrice;
  const prev = meta.previousClose;
  return {
    symbol,
    price,
    prevClose: prev,
    change: price - prev,
    changePct: prev !== 0 ? ((price - prev) / prev) * 100 : 0,
    currency: meta.currency,
    closes,
    postMarketPrice: meta.postMarketPrice ?? null,
    postMarketChangePct: meta.postMarketChangePercent ?? null,
    preMarketPrice: meta.preMarketPrice ?? null,
    preMarketChangePct: meta.preMarketChangePercent ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

// ── CurrencyDomain (Sprint 42) ──

/** Normalized currency exchange state. */
export interface CurrencyDomain {
  /** ISO base currency code (e.g. "USD") */
  base: string;
  /** Map of currency code → rate vs base */
  rates: Record<string, number>;
  /** ISO timestamp of the last update from provider */
  updatedAt: string;
  /** ISO timestamp of when this data was fetched */
  fetchedAt: string;
}

/** Map a raw CurrencyResponse to CurrencyDomain. */
export function mapToCurrencyDomain(r: CurrencyResponse): CurrencyDomain {
  return {
    base: r.base_code,
    rates: { ...r.rates },
    updatedAt: r.time_last_update_utc,
    fetchedAt: new Date().toISOString(),
  };
}

// ── NewsDomain (Sprint 41) ──

/** Normalized single news article. */
export interface NewsDomainItem {
  title: string;
  link: string;
  /** Description / excerpt — may be empty */
  description: string;
  /** ISO date string */
  pubDate: string;
  /** Source label (feed name) */
  source: string;
  /** Feed index for color coding */
  feedIndex: number;
}

/** Map a raw NewsItem to NewsDomainItem. */
export function rssItemToDomain(item: NewsItem, feedIndex: number): NewsDomainItem {
  return {
    title: item.title,
    link: item.link,
    description: item.description ?? "",
    pubDate: item.pubDate,
    source: item.source,
    feedIndex,
  };
}

// ── AlertsDomain (Sprint 43) ──

/** Normalized single alert zone event. */
export interface AlertZoneDomain {
  cities: string[];
  /** Raw threat code from provider */
  threat: number;
  /** Unix timestamp (seconds) */
  time: number;
  /** Age in minutes at domain mapping time */
  ageMin: number;
}

/** Normalized alert container. */
export interface AlertsDomain {
  zones: AlertZoneDomain[];
  /** Total count in last 24h */
  count24h: number;
  fetchedAt: string;
}

/** Map a raw AlertEvent to AlertsDomain. */
export function mapToAlertsDomain(ev: AlertEvent): AlertsDomain {
  const now = Date.now() / 1000;
  const zones: AlertZoneDomain[] = ev.alerts.map((a) => ({
    cities: a.cities,
    threat: a.threat,
    time: a.time,
    ageMin: Math.max(0, Math.round((now - a.time) / 60)),
  }));
  return {
    zones,
    count24h: ev.alerts.length,
    fetchedAt: new Date().toISOString(),
  };
}

// ── HebcalDomain (Sprint 44) ──

/** Normalized single Hebcal item. */
export interface HebcalDomainItem {
  titleHe: string;
  titleEn: string;
  date: string;
  category: string;
  subcat?: string | undefined;
  memo?: string | undefined;
}

/** Normalized Hebrew calendar state. */
export interface HebcalDomain {
  items: HebcalDomainItem[];
  /** Candle lighting time if present */
  candleLighting?: string | undefined;
  /** Havdalah time if present */
  havdalah?: string | undefined;
  fetchedAt: string;
}

/** Map a raw HebcalResponse to HebcalDomain. */
export function mapToHebcalDomain(r: HebcalResponse): HebcalDomain {
  const candle = r.items.find((i) => i.category === "candles");
  const havd = r.items.find((i) => i.category === "havdalah");
  return {
    items: r.items.map((i) => ({
      titleHe: i.hebrew,
      titleEn: i.title,
      date: i.date,
      category: i.category,
      subcat: i.subcat,
      memo: i.memo,
    })),
    candleLighting: candle?.title,
    havdalah: havd?.title,
    fetchedAt: new Date().toISOString(),
  };
}

// ── CalendarDomain (Sprint 76) ──

/** Normalized calendar event for rendering. */
export interface CalendarDomainEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string | undefined;
  location?: string | undefined;
  icsIndex: number;
}

/** Map a CalendarEvent to CalendarDomainEvent (currently 1:1, reserved for future normalization). */
export function mapToCalendarDomainEvent(e: CalendarEvent): CalendarDomainEvent {
  return {
    summary: e.summary,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    description: e.description,
    location: e.location,
    icsIndex: e.icsIndex,
  };
}

// ── Worker Normalized Response Types (Stream W, v7.21) ────────────────────────
//
// These types describe what the FamilyDashBoard Cloudflare Worker returns after
// normalizing upstream API responses (ADR-006). All worker endpoints wrap their
// payload in WorkerResponse<T>, adding cache-staleness and provider metadata.
//
// Consumers: cards that use fetchJSONWithWorker<T>() check isWorkerEnabled()
// and fall back to direct proxy fetch if the Worker is unavailable.

/**
 * Generic envelope returned by every Worker endpoint.
 * `stale` = true when the Worker is serving from its own cache (upstream down).
 */
export interface WorkerResponse<T> {
  /** Normalized payload. */
  data: T;
  /** True if the Worker is serving stale cached data (upstream unreachable). */
  stale: boolean;
  /** Unix timestamp (ms) of when the Worker fetched / cached this data. */
  timestamp: number;
  /** Identifier of the upstream provider that served this response. */
  provider: string;
}

// ── Normalized Weather (Worker output) ───────────────────────────────────────

/** Condensed current conditions as returned by the Worker /weather endpoint. */
export interface NormalizedCurrentWeather {
  /** Temperature in Celsius. */
  tempC: number;
  /** Feels-like temperature in Celsius. */
  feelsLikeC: number;
  /** Relative humidity 0–100. */
  humidity: number;
  /** Wind speed in km/h. */
  windKph: number;
  /** Wind direction in degrees (0–360). */
  windDeg: number;
  /** UV index. */
  uvIndex: number;
  /** WMO weather code. */
  weatherCode: number;
}

/** Single daily forecast slot as returned by the Worker /weather endpoint. */
export interface NormalizedDailyForecast {
  /** ISO date string "YYYY-MM-DD". */
  date: string;
  /** Max temperature Celsius. */
  maxC: number;
  /** Min temperature Celsius. */
  minC: number;
  /** WMO weather code for the day. */
  weatherCode: number;
  /** Precipitation probability 0–100. */
  precipProbability: number;
  /** Sunrise ISO time string. */
  sunrise: string;
  /** Sunset ISO time string. */
  sunset: string;
}

/** Full weather payload from Worker /weather endpoint. */
export interface NormalizedWeatherData {
  current: NormalizedCurrentWeather;
  daily: NormalizedDailyForecast[];
  hourly: Array<{ time: string; tempC: number; precipPct: number; code: number }>;
}

// ── Normalized Stock (Worker output) ─────────────────────────────────────────

/** Single stock as returned by the Worker /stocks endpoint. */
export interface NormalizedStock {
  symbol: string;
  price: number;
  /** Absolute price change vs previous close. */
  change: number;
  /** Percentage change vs previous close. */
  changePercent: number;
  currency: string;
  previousClose: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  /** Post-market price (if available). */
  postMarketPrice?: number;
  /** Pre-market price (if available). */
  preMarketPrice?: number;
}

// ── Normalized Currency (Worker output) ──────────────────────────────────────

/** Currency rates payload from Worker /currency endpoint. */
export interface NormalizedCurrencyRates {
  /** ISO base currency code, e.g. "USD". */
  base: string;
  /** Map of ISO currency code → exchange rate vs base. */
  rates: Record<string, number>;
  /** ISO string of when the upstream provider last updated the rates. */
  updatedAt: string;
}

// ── Normalized News (Worker output) ──────────────────────────────────────────

/** Single news article from Worker /news endpoint. */
export interface NormalizedNewsItem {
  title: string;
  /** Canonical article URL. */
  url: string;
  /** ISO date string. */
  pubDate: string;
  /** Feed / publication name. */
  source: string;
  /** Optional section or topic tag. */
  category?: string;
  /** Short excerpt / description. */
  description?: string;
}

// ── Normalized Alert (Worker output) ─────────────────────────────────────────

/** Single alert event from Worker /alerts endpoint. */
export interface NormalizedAlertEvent {
  /** Stable ID for deduplication (provider-assigned or synthetic). */
  id: string;
  /** Short Hebrew or English description of the threat. */
  title: string;
  /** Affected cities / areas. */
  areas: string[];
  /** ISO timestamp of when the alert was issued. */
  timestamp: string;
  /** False once the event is older than the active window. */
  active: boolean;
}

// ── Runtime guard for WorkerResponse envelope ─────────────────────────────────

/**
 * Returns true if `v` has the shape of a WorkerResponse envelope.
 * Does NOT validate the inner `data` payload — callers should do that
 * separately with a domain-specific guard.
 */
export function isWorkerResponse(v: unknown): v is WorkerResponse<unknown> {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    "data" in r &&
    typeof r["stale"] === "boolean" &&
    typeof r["timestamp"] === "number" &&
    typeof r["provider"] === "string"
  );
}

// ── Domain type guards (Stream W, v7.22) ──────────────────────────────────────

/**
 * Returns true if `v` is a valid NormalizedWeatherData payload.
 * Checks that `current` has numeric temperature fields and `daily` is an array.
 */
export function isNormalizedWeatherData(v: unknown): v is NormalizedWeatherData {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r["current"] !== "object" || r["current"] === null) return false;
  const c = r["current"] as Record<string, unknown>;
  return (
    typeof c["tempC"] === "number" &&
    typeof c["feelsLikeC"] === "number" &&
    typeof c["humidity"] === "number" &&
    typeof c["windKph"] === "number" &&
    Array.isArray(r["daily"]) &&
    Array.isArray(r["hourly"])
  );
}

/**
 * Returns true if `v` is a valid NormalizedStock.
 * Checks that symbol is a non-empty string and price/change fields are numbers.
 */
export function isNormalizedStock(v: unknown): v is NormalizedStock {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["symbol"] === "string" &&
    r["symbol"].length > 0 &&
    typeof r["price"] === "number" &&
    typeof r["change"] === "number" &&
    typeof r["changePercent"] === "number" &&
    typeof r["currency"] === "string" &&
    typeof r["previousClose"] === "number"
  );
}

/**
 * Returns true if `v` is a valid NormalizedCurrencyRates payload.
 * Checks that base is a non-empty string, rates is a non-empty object, and updatedAt is a string.
 */
export function isNormalizedCurrencyRates(v: unknown): v is NormalizedCurrencyRates {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["base"] === "string" &&
    r["base"].length > 0 &&
    typeof r["rates"] === "object" &&
    r["rates"] !== null &&
    !Array.isArray(r["rates"]) &&
    typeof r["updatedAt"] === "string"
  );
}

/**
 * Returns true if `v` is a valid NormalizedNewsItem.
 * Checks required string fields title, url, pubDate, source.
 */
export function isNormalizedNewsItem(v: unknown): v is NormalizedNewsItem {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["title"] === "string" &&
    typeof r["url"] === "string" &&
    typeof r["pubDate"] === "string" &&
    typeof r["source"] === "string"
  );
}

/**
 * Returns true if `v` is a valid NormalizedAlertEvent.
 * Checks required fields id, title, areas (array), timestamp, active (boolean).
 */
export function isNormalizedAlertEvent(v: unknown): v is NormalizedAlertEvent {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["title"] === "string" &&
    Array.isArray(r["areas"]) &&
    typeof r["timestamp"] === "string" &&
    typeof r["active"] === "boolean"
  );
}
