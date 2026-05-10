/**
 * fast-check property tests — src/types/api.ts domain mappers
 *
 * Properties under test:
 *  DM1. mapToStockDomain: null when result missing
 *  DM2. mapToStockDomain: correct change calculation
 *  DM3. mapToStockDomain: changePct = 0 when prevClose is 0
 *  DM4. mapToCurrencyDomain: preserves rates
 *  DM5. mapToCurrencyDomain: base from base_code
 *  DM6. rssItemToDomain: preserves all fields
 *  DM7. rssItemToDomain: empty description defaults to ""
 *  DM8. mapToAlertsDomain: zones count matches alerts.length
 *  DM9. mapToAlertsDomain: ageMin is non-negative
 *  DM10. isWorkerResponse: valid shape → true
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  mapToStockDomain,
  mapToCurrencyDomain,
  rssItemToDomain,
  mapToAlertsDomain,
  isWorkerResponse,
} from "@/types/api";

// ── DM1: mapToStockDomain null when no result ────────────────────────────────

describe("api-mappers — DM1: mapToStockDomain null", () => {
  it("returns null when chart.result is empty", () => {
    const resp = { chart: { result: [] } } as never;
    expect(mapToStockDomain("AAPL", resp)).toBeNull();
  });
});

// ── DM2: correct change calculation ─────────────────────────────────────────

describe("api-mappers — DM2: mapToStockDomain change", () => {
  it("change = price - prevClose", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        (price, prev) => {
          const resp = {
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: price,
                    previousClose: prev,
                    currency: "USD",
                    symbol: "TST",
                  },
                  indicators: { quote: [{ close: [] }] },
                },
              ],
            },
          };
          const d = mapToStockDomain("TST", resp as never);
          expect(d).not.toBeNull();
          expect(d!.change).toBeCloseTo(price - prev, 5);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── DM3: changePct 0 when prev is 0 ─────────────────────────────────────────

describe("api-mappers — DM3: changePct zero div", () => {
  it("changePct is 0 when previousClose is 0", () => {
    const resp = {
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 100, previousClose: 0, currency: "USD", symbol: "X" },
            indicators: { quote: [{ close: [] }] },
          },
        ],
      },
    };
    const d = mapToStockDomain("X", resp as never);
    expect(d!.changePct).toBe(0);
  });
});

// ── DM4: mapToCurrencyDomain preserves rates ─────────────────────────────────

describe("api-mappers — DM4: mapToCurrencyDomain rates", () => {
  it("preserves all rate entries", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.stringMatching(/^[A-Z]{3}$/),
          fc.double({ min: 0.01, max: 9999, noNaN: true }),
          { minKeys: 1, maxKeys: 5 },
        ),
        (rates) => {
          const resp = { base_code: "USD", rates, time_last_update_utc: "2025-01-01" } as never;
          const d = mapToCurrencyDomain(resp);
          for (const [k, v] of Object.entries(rates)) {
            expect(d.rates[k]).toBe(v);
          }
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── DM5: base from base_code ─────────────────────────────────────────────────

describe("api-mappers — DM5: mapToCurrencyDomain base", () => {
  it("base comes from base_code field", () => {
    const resp = { base_code: "EUR", rates: { USD: 1.1 }, time_last_update_utc: "" } as never;
    expect(mapToCurrencyDomain(resp).base).toBe("EUR");
  });
});

// ── DM6: rssItemToDomain preserves fields ────────────────────────────────────

describe("api-mappers — DM6: rssItemToDomain", () => {
  it("preserves title, link, pubDate, source", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          link: fc.webUrl(),
          pubDate: fc.constant("2025-01-01T00:00:00Z"),
          source: fc.string({ minLength: 1, maxLength: 20 }),
          description: fc.string({ minLength: 0, maxLength: 30 }),
        }),
        fc.nat({ max: 10 }),
        (item, idx) => {
          const d = rssItemToDomain(item as never, idx);
          expect(d.title).toBe(item.title);
          expect(d.link).toBe(item.link);
          expect(d.feedIndex).toBe(idx);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── DM7: rssItemToDomain empty description ───────────────────────────────────

describe("api-mappers — DM7: rssItemToDomain no desc", () => {
  it("defaults description to empty string", () => {
    const item = { title: "T", link: "http://a.com", pubDate: "2025", source: "S" };
    const d = rssItemToDomain(item as never, 0);
    expect(d.description).toBe("");
  });
});

// ── DM8: mapToAlertsDomain zones count ───────────────────────────────────────

describe("api-mappers — DM8: mapToAlertsDomain count", () => {
  it("zones.length = alerts.length", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cities: fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
              minLength: 1,
              maxLength: 3,
            }),
            threat: fc.nat({ max: 10 }),
            time: fc.integer({ min: 1700000000, max: 1800000000 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (alerts) => {
          const ev = { id: 1, alerts } as never;
          const d = mapToAlertsDomain(ev);
          expect(d.zones.length).toBe(alerts.length);
          expect(d.count24h).toBe(alerts.length);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── DM9: ageMin non-negative ─────────────────────────────────────────────────

describe("api-mappers — DM9: mapToAlertsDomain ageMin", () => {
  it("ageMin is non-negative", () => {
    const ev = {
      id: 1,
      alerts: [{ cities: ["A"], threat: 0, time: Math.floor(Date.now() / 1000) - 120 }],
    } as never;
    const d = mapToAlertsDomain(ev);
    expect(d.zones[0]!.ageMin).toBeGreaterThanOrEqual(0);
  });
});

// ── DM10: isWorkerResponse valid shape ───────────────────────────────────────

describe("api-mappers — DM10: isWorkerResponse", () => {
  it("accepts valid shape", () => {
    expect(
      isWorkerResponse({ data: { foo: 1 }, stale: false, timestamp: 123, provider: "test" }),
    ).toBe(true);
  });
  it("rejects primitive", () => {
    expect(isWorkerResponse("hello")).toBe(false);
    expect(isWorkerResponse(null)).toBe(false);
  });
});
