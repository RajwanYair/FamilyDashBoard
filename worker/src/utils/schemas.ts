/**
 * FamilyDashBoard Worker — Zod schemas for upstream API response validation.
 *
 * These schemas validate the structural shape of upstream JSON before the
 * worker wraps it in a WorkerResponse envelope. Unknown extra fields are
 * allowed via `.passthrough()` so upstream additions don't break the worker.
 */

import { z } from "zod";

// ── Weather (Open-Meteo) ──────────────────────────────────────────────────────

export const WeatherCurrentSchema = z
  .object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    relative_humidity_2m: z.number(),
    uv_index: z.number(),
  })
  .passthrough();

export const WeatherHourlySchema = z
  .object({
    temperature_2m: z.array(z.number()),
    precipitation_probability: z.array(z.number()),
    weather_code: z.array(z.number()),
  })
  .passthrough();

export const WeatherDailySchema = z
  .object({
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    weather_code: z.array(z.number()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
    precipitation_probability_max: z.array(z.number()),
    uv_index_max: z.array(z.number()),
  })
  .passthrough();

export const WeatherSchema = z
  .object({
    current: WeatherCurrentSchema,
    hourly: WeatherHourlySchema,
    daily: WeatherDailySchema,
  })
  .passthrough();

// ── Currency (ER-API) ─────────────────────────────────────────────────────────

export const CurrencySchema = z
  .object({
    rates: z.record(z.string(), z.number()),
  })
  .passthrough();

// ── Hebcal (Shabbat times) ────────────────────────────────────────────────────

export const HebcalItemSchema = z
  .object({
    title: z.string(),
    date: z.string(),
    category: z.string(),
  })
  .passthrough();

export const HebcalSchema = z
  .object({
    items: z.array(HebcalItemSchema),
  })
  .passthrough();

// ── Hebcal Holidays ───────────────────────────────────────────────────────────

export const HebcalHolidayItemSchema = z
  .object({
    title: z.string(),
    date: z.string(),
    category: z.string(),
  })
  .passthrough();

export const HebcalHolidaysSchema = z
  .object({
    items: z.array(HebcalHolidayItemSchema),
  })
  .passthrough();

// ── Stocks (Yahoo Finance chart) ─────────────────────────────────────────────

export const StocksChartMetaSchema = z
  .object({
    regularMarketPrice: z.number(),
    currency: z.string(),
    symbol: z.string(),
  })
  .passthrough();

export const StocksChartResultSchema = z
  .object({
    meta: StocksChartMetaSchema,
  })
  .passthrough();

export const StocksChartSchema = z
  .object({
    chart: z
      .object({
        result: z.array(StocksChartResultSchema).min(1),
        error: z.null().optional(),
      })
      .passthrough(),
  })
  .passthrough();

// ── News / RSS ────────────────────────────────────────────────────────────────

/**
 * Structural validation for RSS 2.0 and Atom 1.0 feed XML.
 * The worker proxies RSS feeds as raw XML — this schema validates that the
 * response body contains the expected root elements before forwarding it.
 * Uses z.string().refine() because Zod has no XML parser; we check markers.
 */
export const NewsRssSchema = z.string().refine(
  (text) =>
    // RSS 2.0 must have <channel> and at least one <item>
    (text.includes("<channel") && text.includes("<item")) ||
    // Atom 1.0 must have <feed and at least one <entry
    (text.includes("<feed") && text.includes("<entry")),
  {
    message:
      "Response is not a valid RSS 2.0 or Atom 1.0 feed (missing <channel>/<item> or <feed>/<entry>)",
  },
);

// ── Crypto / CoinGecko ───────────────────────────────────────────────────────

export const CoinGeckoPriceSchema = z
  .object({
    usd: z.number(),
    usd_24h_change: z.number().optional(),
  })
  .passthrough();

export const CoinGeckoSchema = z
  .object({
    bitcoin: CoinGeckoPriceSchema,
  })
  .passthrough();

// ── met.no (Yr) Weather — backup provider ────────────────────────────────────

export const MetNoInstantDetailsSchema = z
  .object({
    air_temperature: z.number(),
    wind_speed: z.number(),
    relative_humidity: z.number().optional(),
  })
  .passthrough();

export const MetNoTimeseriesSchema = z
  .object({
    time: z.string(),
    data: z
      .object({
        instant: z
          .object({ details: MetNoInstantDetailsSchema })
          .passthrough(),
        next_1_hours: z
          .object({ summary: z.object({ symbol_code: z.string() }).passthrough() })
          .passthrough()
          .optional(),
        next_6_hours: z
          .object({ summary: z.object({ symbol_code: z.string() }).passthrough() })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const MetNoWeatherSchema = z
  .object({
    properties: z
      .object({
        timeseries: z.array(MetNoTimeseriesSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough();

// ── Finnhub Stock Quote — backup provider ─────────────────────────────────────

/**
 * Finnhub GET /quote response:
 *   { c: currentPrice, d: change, dp: changePercent, h, l, o, pc, t }
 */
export const FinnhubQuoteSchema = z
  .object({
    c: z.number(),  // current price
    d: z.number(),  // change
    dp: z.number(), // percent change
    t: z.number(),  // unix timestamp
  })
  .passthrough();

// ── Tzeva Adom (Red Alerts) ──────────────────────────────────────────────────

export const AlertItemSchema = z
  .object({
    time: z.string(),
    threat: z.string(),
    cities: z.array(z.string()),
  })
  .passthrough();

/**
 * Tzeva Adom /alerts-history response — an array of alert objects.
 * Unknown extra fields on each item are allowed via .passthrough().
 */
export const AlertsSchema = z.array(AlertItemSchema);

// ── Sefaria Calendar ─────────────────────────────────────────────────────────

export const SefariaCalendarItemSchema = z
  .object({
    title: z.object({ en: z.string(), he: z.string().optional() }).passthrough(),
    displayValue: z.object({ en: z.string(), he: z.string().optional() }).passthrough(),
  })
  .passthrough();

export const SefariaCalendarSchema = z
  .object({
    calendar_items: z.array(SefariaCalendarItemSchema),
  })
  .passthrough();

// ── Sefaria Text ─────────────────────────────────────────────────────────────

export const SefariaTextSchema = z
  .object({
    ref: z.string(),
    versions: z.array(z.object({ text: z.string().optional() }).passthrough()).optional(),
    he: z.union([z.string(), z.array(z.unknown())]).optional(),
    text: z.union([z.string(), z.array(z.unknown())]).optional(),
  })
  .passthrough();

// ── Helper ────────────────────────────────────────────────────────────────────

/** Parse `data` against `schema`. Returns `{ ok: true, data }` or `{ ok: false, error }`. */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}
