/**
 * Tests for runtime API type guards in src/types/api.ts
 * Covers: isWeatherResponse, isNewsItem, isCurrencyResponse, isAlertEvent
 */

import { describe, it, expect } from "vitest";
import {
  isWeatherResponse,
  isNewsItem,
  isCurrencyResponse,
  isAlertEvent,
} from "@/types/api";
import type { WeatherResponse, NewsItem, CurrencyResponse, AlertEvent } from "@/types/api";

// ── isWeatherResponse ─────────────────────────────────────────────────────────

function makeWeatherResponse(): WeatherResponse {
  return {
    current: {
      temperature_2m: 22,
      relative_humidity_2m: 55,
      weather_code: 1,
      wind_speed_10m: 10,
      wind_direction_10m: 180,
      wind_gusts_10m: 15,
      apparent_temperature: 21,
      uv_index: 3,
      dew_point_2m: 12,
    },
    hourly: {
      time: ["2024-01-01T00:00", "2024-01-01T01:00"],
      temperature_2m: [20, 19],
      precipitation_probability: [10, 5],
      weather_code: [0, 0],
    },
    daily: {
      time: ["2024-01-01"],
      temperature_2m_max: [25],
      temperature_2m_min: [15],
      weather_code: [1],
      sunrise: ["2024-01-01T06:00"],
      sunset: ["2024-01-01T18:00"],
      precipitation_probability_max: [10],
      uv_index_max: [5],
    },
  };
}

describe("isWeatherResponse", () => {
  it("returns true for a valid WeatherResponse", () => {
    expect(isWeatherResponse(makeWeatherResponse())).toBe(true);
  });

  it("returns false for null", () => {
    expect(isWeatherResponse(null)).toBe(false);
  });

  it("returns false for a plain string", () => {
    expect(isWeatherResponse("weather")).toBe(false);
  });

  it("returns false when current is missing", () => {
    const w = makeWeatherResponse() as unknown as Record<string, unknown>;
    delete w["current"];
    expect(isWeatherResponse(w)).toBe(false);
  });

  it("returns false when a numeric field is wrong type", () => {
    const w = makeWeatherResponse();
    (w.current as unknown as Record<string, unknown>)["temperature_2m"] = "hot";
    expect(isWeatherResponse(w)).toBe(false);
  });

  it("returns false when hourly.time is not an array of strings", () => {
    const w = makeWeatherResponse();
    (w.hourly as unknown as Record<string, unknown>)["time"] = [1, 2, 3];
    expect(isWeatherResponse(w)).toBe(false);
  });

  it("returns false when daily is missing", () => {
    const w = makeWeatherResponse() as unknown as Record<string, unknown>;
    delete w["daily"];
    expect(isWeatherResponse(w)).toBe(false);
  });

  it("returns false for an empty object", () => {
    expect(isWeatherResponse({})).toBe(false);
  });
});

// ── isNewsItem ────────────────────────────────────────────────────────────────

function makeNewsItem(): NewsItem {
  return {
    title: "Breaking news",
    link: "https://example.com/news",
    pubDate: "2024-01-01",
    source: "TestFeed",
  };
}

describe("isNewsItem", () => {
  it("returns true for a valid NewsItem", () => {
    expect(isNewsItem(makeNewsItem())).toBe(true);
  });

  it("returns true with optional fields present", () => {
    expect(isNewsItem({ ...makeNewsItem(), category: "Tech", description: "Desc" })).toBe(true);
  });

  it("returns false when title is missing", () => {
    const { title: _t, ...rest } = makeNewsItem();
    expect(isNewsItem(rest)).toBe(false);
  });

  it("returns false when link is a number", () => {
    expect(isNewsItem({ ...makeNewsItem(), link: 42 })).toBe(false);
  });

  it("returns false when source is missing", () => {
    const { source: _s, ...rest } = makeNewsItem();
    expect(isNewsItem(rest)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isNewsItem(null)).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isNewsItem([])).toBe(false);
  });
});

// ── isCurrencyResponse ────────────────────────────────────────────────────────

function makeCurrencyResponse(): CurrencyResponse {
  return {
    rates: { USD: 3.7, EUR: 4.0 },
    base_code: "ILS",
    time_last_update_utc: "2024-01-01T00:00:00Z",
  };
}

describe("isCurrencyResponse", () => {
  it("returns true for a valid CurrencyResponse", () => {
    expect(isCurrencyResponse(makeCurrencyResponse())).toBe(true);
  });

  it("returns false when rates is missing", () => {
    const { rates: _r, ...rest } = makeCurrencyResponse();
    expect(isCurrencyResponse(rest)).toBe(false);
  });

  it("returns false when rates is an array", () => {
    expect(isCurrencyResponse({ ...makeCurrencyResponse(), rates: [1, 2, 3] })).toBe(false);
  });

  it("returns false when base_code is missing", () => {
    const c = makeCurrencyResponse() as unknown as Record<string, unknown>;
    delete c["base_code"];
    expect(isCurrencyResponse(c)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCurrencyResponse(null)).toBe(false);
  });
});

// ── isAlertEvent ──────────────────────────────────────────────────────────────

function makeAlertEvent(): AlertEvent {
  return {
    alerts: [
      { cities: ["תל אביב", "רמת גן"], threat: 1, time: 1700000000 },
    ],
    id: "abc123",
  };
}

describe("isAlertEvent", () => {
  it("returns true for a valid AlertEvent", () => {
    expect(isAlertEvent(makeAlertEvent())).toBe(true);
  });

  it("returns true when id is absent", () => {
    expect(isAlertEvent({ alerts: [{ cities: ["עיר"], threat: 2, time: 123456 }] })).toBe(true);
  });

  it("returns false when alerts is not an array", () => {
    expect(isAlertEvent({ alerts: "not-an-array", id: "x" })).toBe(false);
  });

  it("returns false when an alert zone has no cities array", () => {
    expect(isAlertEvent({ alerts: [{ threat: 1, time: 123 }] })).toBe(false);
  });

  it("returns false when an alert zone has no time number", () => {
    expect(isAlertEvent({ alerts: [{ cities: [], threat: 1 }] })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAlertEvent(null)).toBe(false);
  });

  it("returns false for a plain string", () => {
    expect(isAlertEvent("alert")).toBe(false);
  });
});
