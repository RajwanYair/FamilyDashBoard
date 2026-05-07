/**
 * fast-check property tests — src/types/api.ts type guards
 *
 * Properties under test:
 *  AV1. All type guards return false for any primitive (string / number / boolean / null / undefined).
 *  AV2. isNewsItem returns true for any well-formed {title,link,pubDate,source} record.
 *  AV3. isNewsItem returns false when any required string field is missing or wrong type.
 *  AV4. isCurrencyResponse returns false when `rates` is an array (not a plain object).
 *  AV5. isWeatherResponse returns false when any required `current.*` numeric field is missing.
 *  AV6. isNewsItem is monotone: adding extra fields to a valid record keeps it valid.
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import {
  isNewsItem,
  isCurrencyResponse,
  isWeatherResponse,
  isAlertEvent,
  isHebcalResponse,
  isCoinGeckoResponse,
  isCalendarEvent,
} from "@/types/api";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const primitiveArb = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
);

const newsItemArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 80 }),
  link: fc.webUrl(),
  pubDate: fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") }).filter((d) => !isNaN(d.getTime())).map((d) => d.toISOString()),
  source: fc.string({ minLength: 1, maxLength: 40 }),
});

const currencyRatesArb = fc.dictionary(
  fc.stringMatching(/^[A-Z]{3}$/),
  fc.double({ min: 0, max: 10_000, noNaN: true }),
);

const currencyResponseArb = fc.record({
  rates: currencyRatesArb,
  base_code: fc.stringMatching(/^[A-Z]{3}$/),
  time_last_update_utc: fc.string({ minLength: 5 }),
});

const weatherCurrentArb = fc.record({
  temperature_2m: fc.double({ noNaN: true }),
  relative_humidity_2m: fc.double({ noNaN: true }),
  weather_code: fc.integer({ min: 0, max: 99 }),
  wind_speed_10m: fc.double({ noNaN: true }),
  wind_direction_10m: fc.double({ noNaN: true }),
  wind_gusts_10m: fc.double({ noNaN: true }),
  apparent_temperature: fc.double({ noNaN: true }),
  uv_index: fc.double({ noNaN: true }),
  dew_point_2m: fc.double({ noNaN: true }),
});

const weatherResponseArb = fc.record({
  current: weatherCurrentArb,
  hourly: fc.record({
    time: fc.array(fc.string(), { minLength: 1 }),
    temperature_2m: fc.array(fc.double({ noNaN: true }), { minLength: 1 }),
    precipitation_probability: fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1 }),
    weather_code: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1 }),
  }),
  daily: fc.record({
    time: fc.array(fc.string(), { minLength: 1 }),
    temperature_2m_max: fc.array(fc.double({ noNaN: true }), { minLength: 1 }),
    temperature_2m_min: fc.array(fc.double({ noNaN: true }), { minLength: 1 }),
    weather_code: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1 }),
    sunrise: fc.array(fc.string(), { minLength: 1 }),
    sunset: fc.array(fc.string(), { minLength: 1 }),
    precipitation_probability_max: fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1 }),
    uv_index_max: fc.array(fc.double({ noNaN: true }), { minLength: 1 }),
  }),
});

// ── AV1: type guards reject primitives ────────────────────────────────────────

describe("api-validators — AV1: all type guards return false for any primitive", () => {
  it("isNewsItem returns false for primitives", () => {
    fc.assert(
      fc.property(primitiveArb, (v) => !isNewsItem(v)),
      { numRuns: 100 },
    );
  });

  it("isCurrencyResponse returns false for primitives", () => {
    fc.assert(
      fc.property(primitiveArb, (v) => !isCurrencyResponse(v)),
      { numRuns: 80 },
    );
  });

  it("isWeatherResponse returns false for primitives", () => {
    fc.assert(
      fc.property(primitiveArb, (v) => !isWeatherResponse(v)),
      { numRuns: 80 },
    );
  });

  it("isAlertEvent returns false for primitives", () => {
    fc.assert(
      fc.property(primitiveArb, (v) => !isAlertEvent(v)),
      { numRuns: 80 },
    );
  });

  it("isHebcalResponse returns false for primitives", () => {
    fc.assert(
      fc.property(primitiveArb, (v) => !isHebcalResponse(v)),
      { numRuns: 80 },
    );
  });

  it("isCoinGeckoResponse returns false for primitives", () => {
    fc.assert(
      fc.property(primitiveArb, (v) => !isCoinGeckoResponse(v)),
      { numRuns: 80 },
    );
  });
});

// ── AV2: isNewsItem accepts well-formed records ───────────────────────────────

describe("api-validators — AV2: isNewsItem returns true for valid records", () => {
  it("any record with title/link/pubDate/source strings passes", () => {
    fc.assert(
      fc.property(newsItemArb, (item) => isNewsItem(item)),
      { numRuns: 100 },
    );
  });
});

// ── AV3: isNewsItem rejects records with missing/wrong required fields ─────────

describe("api-validators — AV3: isNewsItem returns false for malformed records", () => {
  it("missing title field → false", () => {
    fc.assert(
      fc.property(newsItemArb, ({ title: _title, ...rest }) => !isNewsItem(rest)),
      { numRuns: 80 },
    );
  });

  it("numeric title (not a string) → false", () => {
    fc.assert(
      fc.property(
        newsItemArb,
        fc.integer(),
        ({ link, pubDate, source }, numTitle) => !isNewsItem({ link, pubDate, source, title: numTitle }),
      ),
      { numRuns: 80 },
    );
  });

  it("missing source field → false", () => {
    fc.assert(
      fc.property(newsItemArb, ({ source: _source, ...rest }) => !isNewsItem(rest)),
      { numRuns: 80 },
    );
  });
});

// ── AV4: isCurrencyResponse rejects array as rates ────────────────────────────

describe("api-validators — AV4: isCurrencyResponse rejects non-object rates", () => {
  it("array as rates → false", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ noNaN: true }), { maxLength: 5 }),
        fc.string({ minLength: 3, maxLength: 3 }),
        fc.string({ minLength: 3 }),
        (ratesArr, base, time) => !isCurrencyResponse({ rates: ratesArr, base_code: base, time_last_update_utc: time }),
      ),
      { numRuns: 80 },
    );
  });

  it("string as rates → false", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.string({ minLength: 3, maxLength: 3 }),
        fc.string({ minLength: 3 }),
        (ratesStr, base, time) => !isCurrencyResponse({ rates: ratesStr, base_code: base, time_last_update_utc: time }),
      ),
      { numRuns: 80 },
    );
  });
});

// ── AV5: isWeatherResponse rejects missing required current.* field ───────────

describe("api-validators — AV5: isWeatherResponse rejects records missing required numeric fields", () => {
  it("removing temperature_2m from current → false", () => {
    fc.assert(
      fc.property(weatherResponseArb, (wr) => {
        const { temperature_2m: _t, ...curRest } = wr.current;
        return !isWeatherResponse({ ...wr, current: curRest });
      }),
      { numRuns: 60 },
    );
  });

  it("removing weather_code from current → false", () => {
    fc.assert(
      fc.property(weatherResponseArb, (wr) => {
        const { weather_code: _w, ...curRest } = wr.current;
        return !isWeatherResponse({ ...wr, current: curRest });
      }),
      { numRuns: 60 },
    );
  });

  it("replacing a numeric field with a string → false", () => {
    fc.assert(
      fc.property(weatherResponseArb, fc.string({ minLength: 1 }), (wr, badVal) => {
        const badCurrent = { ...wr.current, temperature_2m: badVal };
        return !isWeatherResponse({ ...wr, current: badCurrent });
      }),
      { numRuns: 60 },
    );
  });
});

// ── AV6: isNewsItem is monotone under field extension ─────────────────────────

describe("api-validators — AV6: valid NewsItem stays valid after adding extra fields", () => {
  it("adding arbitrary extra fields to a valid NewsItem keeps it valid", () => {
    fc.assert(
      fc.property(
        newsItemArb,
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !["title", "link", "pubDate", "source"].includes(s)),
          fc.string({ maxLength: 40 }),
        ),
        (item, extra) => isNewsItem({ ...item, ...extra }),
      ),
      { numRuns: 80 },
    );
  });
});
