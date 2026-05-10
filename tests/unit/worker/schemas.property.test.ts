/**
 * fast-check property tests — worker/src/utils/schemas.ts
 *
 * Properties under test:
 *  SC1. WeatherSchema: valid structure passes
 *  SC2. WeatherSchema: missing field fails
 *  SC3. CurrencySchema: valid rates passes
 *  SC4. CurrencySchema: non-object fails
 *  SC5. HebcalSchema: valid items array passes
 *  SC6. NewsRssSchema: valid RSS string passes
 *  SC7. NewsRssSchema: empty string fails
 *  SC8. FinnhubQuoteSchema: valid numbers pass
 *  SC9. AlertsSchema: valid alert array passes
 *  SC10. AlertsSchema: non-array fails
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import * as v from "valibot";
import {
  WeatherSchema,
  CurrencySchema,
  HebcalSchema,
  NewsRssSchema,
  FinnhubQuoteSchema,
  AlertsSchema,
} from "../../../worker/src/utils/schemas";

// ── SC1: WeatherSchema valid ─────────────────────────────────────────────────

describe("schemas — SC1: WeatherSchema valid", () => {
  it("accepts well-formed weather data", () => {
    fc.assert(
      fc.property(
        fc.record({
          current: fc.record({
            temperature_2m: fc.double({ min: -50, max: 60, noNaN: true }),
            apparent_temperature: fc.double({ min: -50, max: 60, noNaN: true }),
            weather_code: fc.integer({ min: 0, max: 99 }),
            wind_speed_10m: fc.double({ min: 0, max: 200, noNaN: true }),
            wind_direction_10m: fc.double({ min: 0, max: 360, noNaN: true }),
            relative_humidity_2m: fc.double({ min: 0, max: 100, noNaN: true }),
            uv_index: fc.double({ min: 0, max: 15, noNaN: true }),
          }),
          hourly: fc.record({
            temperature_2m: fc.array(fc.double({ min: -50, max: 60, noNaN: true }), {
              minLength: 1,
              maxLength: 3,
            }),
            precipitation_probability: fc.array(fc.double({ min: 0, max: 100, noNaN: true }), {
              minLength: 1,
              maxLength: 3,
            }),
            weather_code: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 3 }),
          }),
          daily: fc.record({
            temperature_2m_max: fc.array(fc.double({ min: -50, max: 60, noNaN: true }), {
              minLength: 1,
              maxLength: 3,
            }),
            temperature_2m_min: fc.array(fc.double({ min: -50, max: 60, noNaN: true }), {
              minLength: 1,
              maxLength: 3,
            }),
            weather_code: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 3 }),
            sunrise: fc.array(fc.constant("2025-01-01T06:00:00"), { minLength: 1, maxLength: 3 }),
            sunset: fc.array(fc.constant("2025-01-01T17:00:00"), { minLength: 1, maxLength: 3 }),
            precipitation_probability_max: fc.array(fc.double({ min: 0, max: 100, noNaN: true }), {
              minLength: 1,
              maxLength: 3,
            }),
            uv_index_max: fc.array(fc.double({ min: 0, max: 15, noNaN: true }), {
              minLength: 1,
              maxLength: 3,
            }),
          }),
        }),
        (data) => {
          const result = v.safeParse(WeatherSchema, data);
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── SC2: WeatherSchema missing field ─────────────────────────────────────────

describe("schemas — SC2: WeatherSchema rejects", () => {
  it("fails for missing current", () => {
    const result = v.safeParse(WeatherSchema, { hourly: {}, daily: {} });
    expect(result.success).toBe(false);
  });
});

// ── SC3: CurrencySchema valid ────────────────────────────────────────────────

describe("schemas — SC3: CurrencySchema valid", () => {
  it("accepts valid rates record", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.stringMatching(/^[A-Z]{3}$/),
          fc.double({ min: 0.001, max: 10000, noNaN: true }),
          { minKeys: 1, maxKeys: 5 },
        ),
        (rates) => {
          const result = v.safeParse(CurrencySchema, { rates });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── SC4: CurrencySchema non-object ──────────────────────────────────────────

describe("schemas — SC4: CurrencySchema rejects", () => {
  it("fails for string", () => {
    expect(v.safeParse(CurrencySchema, "hello").success).toBe(false);
  });
  it("fails for null", () => {
    expect(v.safeParse(CurrencySchema, null).success).toBe(false);
  });
});

// ── SC5: HebcalSchema valid ──────────────────────────────────────────────────

describe("schemas — SC5: HebcalSchema valid", () => {
  it("accepts valid items", () => {
    const data = {
      items: [
        { title: "Shabbat", date: "2025-01-10", category: "parashat" },
        { title: "Rosh Chodesh", date: "2025-01-15", category: "roshchodesh" },
      ],
    };
    expect(v.safeParse(HebcalSchema, data).success).toBe(true);
  });
});

// ── SC6: NewsRssSchema valid ─────────────────────────────────────────────────

describe("schemas — SC6: NewsRssSchema valid RSS", () => {
  it("accepts RSS 2.0 content", () => {
    const rss = "<rss><channel><item><title>Test</title></item></channel></rss>";
    expect(v.safeParse(NewsRssSchema, rss).success).toBe(true);
  });

  it("accepts Atom 1.0 content", () => {
    const atom =
      '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Test</title></entry></feed>';
    expect(v.safeParse(NewsRssSchema, atom).success).toBe(true);
  });
});

// ── SC7: NewsRssSchema empty ─────────────────────────────────────────────────

describe("schemas — SC7: NewsRssSchema rejects", () => {
  it("fails for empty string", () => {
    expect(v.safeParse(NewsRssSchema, "").success).toBe(false);
  });
  it("fails for non-RSS XML", () => {
    expect(v.safeParse(NewsRssSchema, "<html><body>Hello</body></html>").success).toBe(false);
  });
});

// ── SC8: FinnhubQuoteSchema valid ────────────────────────────────────────────

describe("schemas — SC8: FinnhubQuoteSchema valid", () => {
  it("accepts valid quote", () => {
    fc.assert(
      fc.property(
        fc.record({
          c: fc.double({ min: 0, max: 10000, noNaN: true }),
          d: fc.double({ min: -100, max: 100, noNaN: true }),
          dp: fc.double({ min: -50, max: 50, noNaN: true }),
          t: fc.nat(),
        }),
        (quote) => {
          expect(v.safeParse(FinnhubQuoteSchema, quote).success).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── SC9: AlertsSchema valid ──────────────────────────────────────────────────

describe("schemas — SC9: AlertsSchema valid", () => {
  it("accepts array of alert items", () => {
    const alerts = [
      { time: "2025-01-01T12:00:00Z", threat: "rockets", cities: ["תל אביב", "חיפה"] },
    ];
    expect(v.safeParse(AlertsSchema, alerts).success).toBe(true);
  });
});

// ── SC10: AlertsSchema non-array ─────────────────────────────────────────────

describe("schemas — SC10: AlertsSchema rejects", () => {
  it("fails for non-array", () => {
    expect(v.safeParse(AlertsSchema, { time: "x" }).success).toBe(false);
  });
  it("fails for null", () => {
    expect(v.safeParse(AlertsSchema, null).success).toBe(false);
  });
});
