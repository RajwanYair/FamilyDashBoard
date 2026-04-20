/**
 * Stream W (v7.22) — Type guard tests for normalized API types.
 *
 * Verifies isWorkerResponse, isNormalizedWeatherData, isNormalizedStock,
 * isNormalizedCurrencyRates, isNormalizedNewsItem, isNormalizedAlertEvent.
 */
import { describe, it, expect } from "vitest";
import {
  isWorkerResponse,
  isNormalizedWeatherData,
  isNormalizedStock,
  isNormalizedCurrencyRates,
  isNormalizedNewsItem,
  isNormalizedAlertEvent,
} from "../../../src/types/api";

// ── isWorkerResponse ───────────────────────────────────────────────────────────

describe("isWorkerResponse", () => {
  it("accepts a valid WorkerResponse envelope", () => {
    expect(
      isWorkerResponse({
        data: { temp: 20 },
        stale: false,
        timestamp: 1_700_000_000,
        provider: "open-meteo",
      }),
    ).toBe(true);
  });
  it("rejects null", () => {
    expect(isWorkerResponse(null)).toBe(false);
  });
  it("rejects missing stale field", () => {
    expect(isWorkerResponse({ data: {}, timestamp: 1, provider: "x" })).toBe(
      false,
    );
  });
  it("rejects stale as string instead of boolean", () => {
    expect(
      isWorkerResponse({
        data: {},
        stale: "true",
        timestamp: 1,
        provider: "x",
      }),
    ).toBe(false);
  });
  it("rejects missing provider", () => {
    expect(isWorkerResponse({ data: {}, stale: false, timestamp: 1 })).toBe(
      false,
    );
  });
  it("rejects primitive", () => {
    expect(isWorkerResponse("not-an-object")).toBe(false);
  });
});

// ── isNormalizedWeatherData ────────────────────────────────────────────────────

const validWeather = {
  current: {
    tempC: 22,
    feelsLikeC: 21,
    humidity: 60,
    windKph: 15,
    windDeg: 270,
    uvIndex: 5,
    weatherCode: 1,
  },
  daily: [],
  hourly: [],
};

describe("isNormalizedWeatherData", () => {
  it("accepts valid weather payload", () => {
    expect(isNormalizedWeatherData(validWeather)).toBe(true);
  });
  it("rejects when current is missing", () => {
    expect(isNormalizedWeatherData({ daily: [], hourly: [] })).toBe(false);
  });
  it("rejects when tempC is a string", () => {
    expect(
      isNormalizedWeatherData({
        ...validWeather,
        current: { ...validWeather.current, tempC: "22" },
      }),
    ).toBe(false);
  });
  it("rejects when daily is not an array", () => {
    expect(isNormalizedWeatherData({ ...validWeather, daily: null })).toBe(
      false,
    );
  });
  it("rejects when hourly is missing", () => {
    const { hourly: _h, ...noHourly } = validWeather;
    expect(isNormalizedWeatherData(noHourly)).toBe(false);
  });
  it("rejects null", () => {
    expect(isNormalizedWeatherData(null)).toBe(false);
  });
  it("rejects a primitive", () => {
    expect(isNormalizedWeatherData(42)).toBe(false);
  });
});

// ── isNormalizedStock ─────────────────────────────────────────────────────────

const validStock = {
  symbol: "AAPL",
  price: 178.5,
  change: 2.3,
  changePercent: 1.3,
  currency: "USD",
  previousClose: 176.2,
};

describe("isNormalizedStock", () => {
  it("accepts valid stock", () => {
    expect(isNormalizedStock(validStock)).toBe(true);
  });
  it("accepts stock with optional fields", () => {
    expect(
      isNormalizedStock({
        ...validStock,
        fiftyTwoWeekHigh: 200,
        postMarketPrice: 179,
      }),
    ).toBe(true);
  });
  it("rejects empty symbol", () => {
    expect(isNormalizedStock({ ...validStock, symbol: "" })).toBe(false);
  });
  it("rejects price as string", () => {
    expect(isNormalizedStock({ ...validStock, price: "178.5" })).toBe(false);
  });
  it("rejects missing changePercent", () => {
    const { changePercent: _cp, ...noPercent } = validStock;
    expect(isNormalizedStock(noPercent)).toBe(false);
  });
  it("rejects null", () => {
    expect(isNormalizedStock(null)).toBe(false);
  });
});

// ── isNormalizedCurrencyRates ─────────────────────────────────────────────────

const validRates = {
  base: "USD",
  rates: { ILS: 3.7, EUR: 0.92 },
  updatedAt: "2026-04-19T12:00:00Z",
};

describe("isNormalizedCurrencyRates", () => {
  it("accepts valid currency rates", () => {
    expect(isNormalizedCurrencyRates(validRates)).toBe(true);
  });
  it("rejects empty base", () => {
    expect(isNormalizedCurrencyRates({ ...validRates, base: "" })).toBe(false);
  });
  it("rejects rates as array", () => {
    expect(isNormalizedCurrencyRates({ ...validRates, rates: [] })).toBe(false);
  });
  it("rejects rates as null", () => {
    expect(isNormalizedCurrencyRates({ ...validRates, rates: null })).toBe(
      false,
    );
  });
  it("rejects missing updatedAt", () => {
    const { updatedAt: _u, ...noUpdate } = validRates;
    expect(isNormalizedCurrencyRates(noUpdate)).toBe(false);
  });
  it("rejects null", () => {
    expect(isNormalizedCurrencyRates(null)).toBe(false);
  });
});

// ── isNormalizedNewsItem ──────────────────────────────────────────────────────

const validNews = {
  title: "Breaking news",
  url: "https://example.com/article",
  pubDate: "2026-04-19T10:00:00Z",
  source: "Example News",
};

describe("isNormalizedNewsItem", () => {
  it("accepts valid news item", () => {
    expect(isNormalizedNewsItem(validNews)).toBe(true);
  });
  it("accepts news item with optional category and description", () => {
    expect(
      isNormalizedNewsItem({
        ...validNews,
        category: "tech",
        description: "Short blurb.",
      }),
    ).toBe(true);
  });
  it("rejects missing url", () => {
    const { url: _u, ...noUrl } = validNews;
    expect(isNormalizedNewsItem(noUrl)).toBe(false);
  });
  it("rejects missing source", () => {
    const { source: _s, ...noSrc } = validNews;
    expect(isNormalizedNewsItem(noSrc)).toBe(false);
  });
  it("rejects null", () => {
    expect(isNormalizedNewsItem(null)).toBe(false);
  });
  it("rejects array", () => {
    expect(isNormalizedNewsItem([validNews])).toBe(false);
  });
});

// ── isNormalizedAlertEvent ────────────────────────────────────────────────────

const validAlert = {
  id: "alert-001",
  title: "Rocket fire",
  areas: ["Tel Aviv", "Rishon LeZion"],
  timestamp: "2026-04-19T08:30:00Z",
  active: true,
};

describe("isNormalizedAlertEvent", () => {
  it("accepts valid alert event", () => {
    expect(isNormalizedAlertEvent(validAlert)).toBe(true);
  });
  it("accepts alert with active: false", () => {
    expect(isNormalizedAlertEvent({ ...validAlert, active: false })).toBe(true);
  });
  it("accepts alert with empty areas array", () => {
    expect(isNormalizedAlertEvent({ ...validAlert, areas: [] })).toBe(true);
  });
  it("rejects areas as string", () => {
    expect(isNormalizedAlertEvent({ ...validAlert, areas: "Tel Aviv" })).toBe(
      false,
    );
  });
  it("rejects active as string", () => {
    expect(isNormalizedAlertEvent({ ...validAlert, active: "true" })).toBe(
      false,
    );
  });
  it("rejects missing id", () => {
    const { id: _i, ...noId } = validAlert;
    expect(isNormalizedAlertEvent(noId)).toBe(false);
  });
  it("rejects null", () => {
    expect(isNormalizedAlertEvent(null)).toBe(false);
  });
});
