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
    error: result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; "),
  };
}
