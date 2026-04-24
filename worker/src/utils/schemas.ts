/**
 * FamilyDashBoard Worker — Valibot schemas for upstream API response validation.
 * (ADR-023: Zod replaced by Valibot 1.x for ~87% bundle savings on validation)
 *
 * These schemas validate the structural shape of upstream JSON before the
 * worker wraps it in a WorkerResponse envelope. Unknown extra fields are
 * preserved via v.looseObject() (Zod's .passthrough() equivalent).
 */

import * as v from "valibot";

// ── Weather (Open-Meteo) ──────────────────────────────────────────────────────

export const WeatherCurrentSchema = v.looseObject({
  temperature_2m: v.number(),
  apparent_temperature: v.number(),
  weather_code: v.number(),
  wind_speed_10m: v.number(),
  wind_direction_10m: v.number(),
  relative_humidity_2m: v.number(),
  uv_index: v.number(),
});

export const WeatherHourlySchema = v.looseObject({
  temperature_2m: v.array(v.number()),
  precipitation_probability: v.array(v.number()),
  weather_code: v.array(v.number()),
});

export const WeatherDailySchema = v.looseObject({
  temperature_2m_max: v.array(v.number()),
  temperature_2m_min: v.array(v.number()),
  weather_code: v.array(v.number()),
  sunrise: v.array(v.string()),
  sunset: v.array(v.string()),
  precipitation_probability_max: v.array(v.number()),
  uv_index_max: v.array(v.number()),
});

export const WeatherSchema = v.looseObject({
  current: WeatherCurrentSchema,
  hourly: WeatherHourlySchema,
  daily: WeatherDailySchema,
});

// ── Currency (ER-API) ─────────────────────────────────────────────────────────

export const CurrencySchema = v.looseObject({
  rates: v.record(v.string(), v.number()),
});

// ── Hebcal (Shabbat times) ────────────────────────────────────────────────────

export const HebcalItemSchema = v.looseObject({
  title: v.string(),
  date: v.string(),
  category: v.string(),
});

export const HebcalSchema = v.looseObject({
  items: v.array(HebcalItemSchema),
});

// ── Hebcal Holidays ───────────────────────────────────────────────────────────

export const HebcalHolidayItemSchema = v.looseObject({
  title: v.string(),
  date: v.string(),
  category: v.string(),
});

export const HebcalHolidaysSchema = v.looseObject({
  items: v.array(HebcalHolidayItemSchema),
});

// ── Stocks (Yahoo Finance chart) ─────────────────────────────────────────────

export const StocksChartMetaSchema = v.looseObject({
  regularMarketPrice: v.number(),
  currency: v.string(),
  symbol: v.string(),
});

export const StocksChartResultSchema = v.looseObject({
  meta: StocksChartMetaSchema,
});

export const StocksChartSchema = v.looseObject({
  chart: v.looseObject({
    result: v.pipe(v.array(StocksChartResultSchema), v.minLength(1)),
    error: v.optional(v.null_()),
  }),
});

// ── News / RSS ────────────────────────────────────────────────────────────────

/**
 * Structural validation for RSS 2.0 and Atom 1.0 feed XML.
 * The worker proxies RSS feeds as raw XML — this schema validates that the
 * response body contains the expected root elements before forwarding it.
 */
export const NewsRssSchema = v.pipe(
  v.string(),
  v.check(
    (text) =>
      // RSS 2.0 must have <channel> and at least one <item>
      (text.includes("<channel") && text.includes("<item")) ||
      // Atom 1.0 must have <feed and at least one <entry
      (text.includes("<feed") && text.includes("<entry")),
    "Response is not a valid RSS 2.0 or Atom 1.0 feed (missing <channel>/<item> or <feed>/<entry>)",
  ),
);

// ── Crypto / CoinGecko ───────────────────────────────────────────────────────

export const CoinGeckoPriceSchema = v.looseObject({
  usd: v.number(),
  usd_24h_change: v.optional(v.number()),
});

export const CoinGeckoSchema = v.looseObject({
  bitcoin: CoinGeckoPriceSchema,
});

// ── met.no (Yr) Weather — backup provider ────────────────────────────────────

export const MetNoInstantDetailsSchema = v.looseObject({
  air_temperature: v.number(),
  wind_speed: v.number(),
  relative_humidity: v.optional(v.number()),
});

export const MetNoTimeseriesSchema = v.looseObject({
  time: v.string(),
  data: v.looseObject({
    instant: v.looseObject({ details: MetNoInstantDetailsSchema }),
    next_1_hours: v.optional(
      v.looseObject({
        summary: v.looseObject({ symbol_code: v.string() }),
      }),
    ),
    next_6_hours: v.optional(
      v.looseObject({
        summary: v.looseObject({ symbol_code: v.string() }),
      }),
    ),
  }),
});

export const MetNoWeatherSchema = v.looseObject({
  properties: v.looseObject({
    timeseries: v.pipe(v.array(MetNoTimeseriesSchema), v.minLength(1)),
  }),
});

// ── Finnhub Stock Quote — backup provider ─────────────────────────────────────

/**
 * Finnhub GET /quote response:
 *   { c: currentPrice, d: change, dp: changePercent, h, l, o, pc, t }
 */
export const FinnhubQuoteSchema = v.looseObject({
  c: v.number(),  // current price
  d: v.number(),  // change
  dp: v.number(), // percent change
  t: v.number(),  // unix timestamp
});

// ── Tzeva Adom (Red Alerts) ──────────────────────────────────────────────────

export const AlertItemSchema = v.looseObject({
  time: v.string(),
  threat: v.string(),
  cities: v.array(v.string()),
});

/**
 * Tzeva Adom /alerts-history response — an array of alert objects.
 * Unknown extra fields on each item are allowed via v.looseObject().
 */
export const AlertsSchema = v.array(AlertItemSchema);

// ── NWS (api.weather.gov) — US-travel mode (V13-DATA) ────────────────────────

/**
 * NWS /points/{lat},{lon} response — returns forecast endpoint URLs.
 */
export const NwsPointsSchema = v.looseObject({
  properties: v.looseObject({
    forecast: v.string(),
    forecastHourly: v.string(),
    timeZone: v.string(),
  }),
});

/**
 * Quantitative value used for humidity, precipitation probability, dewpoint.
 */
export const NwsQuantValueSchema = v.looseObject({
  value: v.nullable(v.number()),
  unitCode: v.optional(v.string()),
});

/**
 * Single forecast period returned by NWS /gridpoints/.../forecast
 * and /gridpoints/.../forecast/hourly.
 */
export const NwsForecastPeriodSchema = v.looseObject({
  number: v.number(),
  startTime: v.string(),
  endTime: v.string(),
  isDaytime: v.boolean(),
  temperature: v.number(),
  temperatureUnit: v.string(), // "F" or "C"
  windSpeed: v.string(),       // e.g. "5 mph" or "5 to 10 mph"
  windDirection: v.string(),   // e.g. "S", "NW"
  shortForecast: v.string(),
  probabilityOfPrecipitation: v.optional(NwsQuantValueSchema),
  dewpoint: v.optional(NwsQuantValueSchema),
  relativeHumidity: v.optional(NwsQuantValueSchema),
});

export const NwsForecastSchema = v.looseObject({
  properties: v.looseObject({
    periods: v.pipe(v.array(NwsForecastPeriodSchema), v.minLength(1)),
  }),
});

// ── Sefaria Calendar (strict mode — V13-DATA) ────────────────────────────────
// v.looseObject() passes through unknown fields so new Sefaria API additions
// do not break validation, while still enforcing the required shape.

export const SefariaCalendarItemSchema = v.looseObject({
  title: v.looseObject({ en: v.string(), he: v.optional(v.string()) }),
  displayValue: v.looseObject({ en: v.string(), he: v.optional(v.string()) }),
});

export const SefariaCalendarSchema = v.looseObject({
  calendar_items: v.pipe(v.array(SefariaCalendarItemSchema), v.minLength(1)),
});

// ── Sefaria Text (strict mode — V13-DATA) ─────────────────────────────────────
// ref is required; text content fields are optional due to sparse Sefaria API.

export const SefariaTextSchema = v.looseObject({
  ref: v.string(),
  versions: v.optional(
    v.array(v.looseObject({ text: v.optional(v.string()) })),
  ),
  he: v.optional(v.union([v.string(), v.array(v.unknown())])),
  text: v.optional(v.union([v.string(), v.array(v.unknown())])),
});

// ── Helper ────────────────────────────────────────────────────────────────────

/** Parse `data` against `schema`. Returns `{ ok: true, data }` or `{ ok: false, error }`. */
export function safeParse<T>(
  schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = v.safeParse(schema, data);
  if (result.success) return { ok: true, data: result.output };
  return {
    ok: false,
    error: result.issues.map((i) => i.message).join("; "),
  };
}
