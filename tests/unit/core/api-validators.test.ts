/**
 * Tests for runtime API type guards in src/types/api.ts
 * Covers: isWeatherResponse, isNewsItem, isCurrencyResponse, isAlertEvent,
 *         isYahooChartResponse, isHebcalResponse, isCoinGeckoResponse, isCalendarEvent
 */

import { describe, it, expect } from "vitest";
import {
  isWeatherResponse,
  isNewsItem,
  isCurrencyResponse,
  isAlertEvent,
  isYahooChartResponse,
  isHebcalResponse,
  isCoinGeckoResponse,
  isCalendarEvent,
  mapToWeatherDomain,
  mapToStockDomain,
  mapToCurrencyDomain,
  rssItemToDomain,
  mapToAlertsDomain,
  mapToHebcalDomain,
  mapToCalendarDomainEvent,
} from "@/types/api";
import type {
  WeatherResponse,
  NewsItem,
  CurrencyResponse,
  AlertEvent,
  YahooChartResponse,
  HebcalResponse,
  CoinGeckoResponse,
  CalendarEvent,
} from "@/types/api";

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

  it("returns false when pubDate is missing", () => {
    const { pubDate: _p, ...rest } = makeNewsItem();
    expect(isNewsItem(rest)).toBe(false);
  });

  it("returns false when pubDate is not a string", () => {
    expect(isNewsItem({ ...makeNewsItem(), pubDate: 1234567890 })).toBe(false);
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

  it("returns false when time_last_update_utc is missing", () => {
    const c = makeCurrencyResponse() as unknown as Record<string, unknown>;
    delete c["time_last_update_utc"];
    expect(isCurrencyResponse(c)).toBe(false);
  });

  it("returns false when time_last_update_utc is not a string", () => {
    expect(isCurrencyResponse({ ...makeCurrencyResponse(), time_last_update_utc: 0 })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCurrencyResponse(null)).toBe(false);
  });
});

// ── isAlertEvent ──────────────────────────────────────────────────────────────

function makeAlertEvent(): AlertEvent {
  return {
    alerts: [{ cities: ["תל אביב", "רמת גן"], threat: 1, time: 1700000000 }],
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

// ── isYahooChartResponse ────────────────────────────────────────────────────

function makeYahooChartResponse(): YahooChartResponse {
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 182.5,
            previousClose: 180.0,
            currency: "USD",
            regularMarketVolume: 1_000_000,
          },
          indicators: { quote: [{ close: [180.0, 181.0, 182.5] }] },
        },
      ],
      error: null,
    },
  };
}

describe("isYahooChartResponse", () => {
  it("returns true for a valid YahooChartResponse", () => {
    expect(isYahooChartResponse(makeYahooChartResponse())).toBe(true);
  });

  it("returns false for null", () => {
    expect(isYahooChartResponse(null)).toBe(false);
  });

  it("returns false when chart is missing", () => {
    expect(isYahooChartResponse({})).toBe(false);
  });

  it("returns false when result is empty array", () => {
    expect(isYahooChartResponse({ chart: { result: [], error: null } })).toBe(false);
  });

  it("returns false when meta is missing", () => {
    const y = makeYahooChartResponse();
    (y.chart.result[0] as unknown as Record<string, unknown>)["meta"] = undefined;
    expect(isYahooChartResponse(y)).toBe(false);
  });

  it("returns false when regularMarketPrice is not a number", () => {
    const y = makeYahooChartResponse();
    (y.chart.result[0].meta as unknown as Record<string, unknown>)["regularMarketPrice"] = "high";
    expect(isYahooChartResponse(y)).toBe(false);
  });

  it("returns false when currency is not a string", () => {
    const y = makeYahooChartResponse();
    (y.chart.result[0].meta as unknown as Record<string, unknown>)["currency"] = 840;
    expect(isYahooChartResponse(y)).toBe(false);
  });
});

// ── isHebcalResponse ─────────────────────────────────────────────────────────

function makeHebcalResponse(): HebcalResponse {
  return {
    title: "Hebcal Israel 2024",
    items: [{ title: "שבת שלום", hebrew: "שבת שלום", date: "2024-01-06", category: "parashat" }],
  };
}

describe("isHebcalResponse", () => {
  it("returns true for a valid HebcalResponse", () => {
    expect(isHebcalResponse(makeHebcalResponse())).toBe(true);
  });

  it("returns true for a response with empty items array", () => {
    expect(isHebcalResponse({ title: "title", items: [] })).toBe(true);
  });

  it("returns false when title is missing", () => {
    expect(isHebcalResponse({ items: [] })).toBe(false);
  });

  it("returns false when items is not an array", () => {
    expect(isHebcalResponse({ title: "t", items: null })).toBe(false);
  });

  it("returns false when an item is missing title", () => {
    expect(
      isHebcalResponse({ title: "t", items: [{ date: "2024-01-01", category: "holiday" }] }),
    ).toBe(false);
  });

  it("returns false when an item is missing date", () => {
    expect(isHebcalResponse({ title: "t", items: [{ title: "x", category: "holiday" }] })).toBe(
      false,
    );
  });

  it("returns false for null", () => {
    expect(isHebcalResponse(null)).toBe(false);
  });
});

// ── isCoinGeckoResponse ───────────────────────────────────────────────────────

function makeCoinGeckoResponse(): CoinGeckoResponse {
  return { bitcoin: { usd: 42000, usd_24h_change: 2.5 } };
}

describe("isCoinGeckoResponse", () => {
  it("returns true for a valid CoinGeckoResponse", () => {
    expect(isCoinGeckoResponse(makeCoinGeckoResponse())).toBe(true);
  });

  it("returns false when bitcoin is missing", () => {
    expect(isCoinGeckoResponse({})).toBe(false);
  });

  it("returns false when usd is not a number", () => {
    expect(isCoinGeckoResponse({ bitcoin: { usd: "high", usd_24h_change: 1 } })).toBe(false);
  });

  it("returns false when usd_24h_change is missing", () => {
    expect(isCoinGeckoResponse({ bitcoin: { usd: 42000 } })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCoinGeckoResponse(null)).toBe(false);
  });

  it("returns false for array", () => {
    expect(isCoinGeckoResponse([])).toBe(false);
  });
});

// ── isCalendarEvent ───────────────────────────────────────────────────────────

function makeCalendarEvent(): CalendarEvent {
  return {
    summary: "Parent-Teacher Meeting",
    start: new Date("2024-03-15T09:00:00"),
    end: new Date("2024-03-15T10:00:00"),
    allDay: false,
    icsIndex: 0,
  };
}

describe("isCalendarEvent", () => {
  it("returns true for a valid CalendarEvent", () => {
    expect(isCalendarEvent(makeCalendarEvent())).toBe(true);
  });

  it("returns true with optional fields present", () => {
    expect(
      isCalendarEvent({ ...makeCalendarEvent(), location: "School", description: "Bring ID" }),
    ).toBe(true);
  });

  it("returns false when summary is missing", () => {
    const { summary: _s, ...rest } = makeCalendarEvent();
    expect(isCalendarEvent(rest)).toBe(false);
  });

  it("returns false when start is not a Date", () => {
    expect(isCalendarEvent({ ...makeCalendarEvent(), start: "2024-03-15" })).toBe(false);
  });

  it("returns false when end is not a Date", () => {
    expect(isCalendarEvent({ ...makeCalendarEvent(), end: null })).toBe(false);
  });

  it("returns false when allDay is not a boolean", () => {
    expect(isCalendarEvent({ ...makeCalendarEvent(), allDay: 0 })).toBe(false);
  });

  it("returns false when icsIndex is not a number", () => {
    expect(isCalendarEvent({ ...makeCalendarEvent(), icsIndex: "first" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCalendarEvent(null)).toBe(false);
  });
});

// ── Domain mappers (Sprints 36-44, v7.13) ────────────────────────────────────

describe("mapToWeatherDomain ", () => {
  it("maps tempC, feelsLikeC, humidity, windKph correctly", () => {
    const wx = makeWeatherResponse();
    const d = mapToWeatherDomain(wx);
    expect(d.tempC).toBe(22);
    expect(d.feelsLikeC).toBe(21);
    expect(d.humidity).toBe(55);
    expect(d.windKph).toBe(10);
  });

  it("maps weatherCode and uv", () => {
    const d = mapToWeatherDomain(makeWeatherResponse());
    expect(d.weatherCode).toBe(1);
    expect(d.uv).toBe(3);
  });

  it("includes fetchedAt as ISO string", () => {
    const d = mapToWeatherDomain(makeWeatherResponse());
    expect(typeof d.fetchedAt).toBe("string");
    expect(() => new Date(d.fetchedAt)).not.toThrow();
  });

  it("daily array maps date, maxC, minC, code", () => {
    const d = mapToWeatherDomain(makeWeatherResponse());
    const first = d.daily[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.date).toBe("2024-01-01");
      expect(first.maxC).toBe(25);
      expect(first.minC).toBe(15);
      expect(first.code).toBe(1);
    }
  });
});

function makeDomainStockResponse(): YahooChartResponse {
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 150,
            previousClose: 145,
            currency: "USD",
            regularMarketVolume: 1000000,
          },
          indicators: { quote: [{ close: [140, 142, 148, 150] }] },
        },
      ],
      error: null,
    },
  };
}

describe("mapToStockDomain ", () => {
  it("maps price, prevClose, change, changePct", () => {
    const d = mapToStockDomain("AAPL", makeDomainStockResponse());
    expect(d).not.toBeNull();
    if (d) {
      expect(d.symbol).toBe("AAPL");
      expect(d.price).toBe(150);
      expect(d.prevClose).toBe(145);
      expect(d.change).toBeCloseTo(5);
      expect(d.changePct).toBeCloseTo((5 / 145) * 100);
    }
  });

  it("returns closes array", () => {
    const d = mapToStockDomain("AAPL", makeDomainStockResponse());
    expect(d?.closes).toEqual([140, 142, 148, 150]);
  });

  it("returns null when result is empty", () => {
    const empty: YahooChartResponse = { chart: { result: [], error: null } };
    expect(mapToStockDomain("AAPL", empty)).toBeNull();
  });

  it("includes fetchedAt timestamp", () => {
    const d = mapToStockDomain("AAPL", makeDomainStockResponse());
    expect(typeof d?.fetchedAt).toBe("string");
  });
});

describe("mapToCurrencyDomain ", () => {
  function makeCurrencyResponse(): CurrencyResponse {
    return {
      rates: { ILS: 3.7, EUR: 0.92 },
      base_code: "USD",
      time_last_update_utc: "2024-01-01T00:00:00Z",
    };
  }

  it("maps base, rates, updatedAt", () => {
    const d = mapToCurrencyDomain(makeCurrencyResponse());
    expect(d.base).toBe("USD");
    expect(d.rates["ILS"]).toBe(3.7);
    expect(d.updatedAt).toBe("2024-01-01T00:00:00Z");
  });

  it("includes fetchedAt", () => {
    const d = mapToCurrencyDomain(makeCurrencyResponse());
    expect(typeof d.fetchedAt).toBe("string");
  });
});

describe("rssItemToDomain ", () => {
  function makeNewsItem(): NewsItem {
    return {
      title: "כותרת",
      link: "https://x.com/1",
      pubDate: "2024-01-01T10:00:00Z",
      source: "Ynet",
      description: "תיאור",
    };
  }

  it("maps title, link, source, feedIndex", () => {
    const d = rssItemToDomain(makeNewsItem(), 2);
    expect(d.title).toBe("כותרת");
    expect(d.source).toBe("Ynet");
    expect(d.feedIndex).toBe(2);
  });

  it("maps description (optional)", () => {
    const d = rssItemToDomain(makeNewsItem(), 0);
    expect(d.description).toBe("תיאור");
  });

  it("uses empty string for missing description", () => {
    const item = makeNewsItem();
    (item as Record<string, unknown>)["description"] = undefined;
    const d = rssItemToDomain(item, 0);
    expect(d.description).toBe("");
  });
});

describe("mapToAlertsDomain ", () => {
  function makeAlertEvent(): AlertEvent {
    return {
      alerts: [
        { cities: ["תל אביב", "גבעתיים"], threat: 1, time: Math.floor(Date.now() / 1000) - 60 },
        { cities: ["ירושלים"], threat: 2, time: Math.floor(Date.now() / 1000) - 300 },
      ],
    };
  }

  it("maps zones length", () => {
    const d = mapToAlertsDomain(makeAlertEvent());
    expect(d.zones).toHaveLength(2);
  });

  it("maps cities and threat", () => {
    const d = mapToAlertsDomain(makeAlertEvent());
    expect(d.zones[0]?.cities).toContain("תל אביב");
    expect(d.zones[0]?.threat).toBe(1);
  });

  it("computes ageMin > 0 for old alerts", () => {
    const d = mapToAlertsDomain(makeAlertEvent());
    expect(d.zones[0]?.ageMin).toBeGreaterThanOrEqual(1);
  });

  it("count24h equals number of zones", () => {
    const d = mapToAlertsDomain(makeAlertEvent());
    expect(d.count24h).toBe(2);
  });
});

describe("mapToHebcalDomain ", () => {
  it("maps items to titleHe/titleEn", () => {
    const r: HebcalResponse = {
      title: "Hebcal",
      items: [
        { title: "Candle lighting", hebrew: "הדלקת נרות", date: "2024-01-05", category: "candles" },
      ],
    };
    const d = mapToHebcalDomain(r);
    expect(d.items[0]?.titleHe).toBe("הדלקת נרות");
    expect(d.items[0]?.titleEn).toBe("Candle lighting");
  });

  it("extracts candleLighting time", () => {
    const r: HebcalResponse = {
      title: "Hebcal",
      items: [
        {
          title: "Candle lighting: 17:30",
          hebrew: "הדלקת נרות",
          date: "2024-01-05",
          category: "candles",
        },
      ],
    };
    const d = mapToHebcalDomain(r);
    expect(d.candleLighting).toContain("Candle lighting");
  });

  it("includese fetchedAt", () => {
    const d = mapToHebcalDomain({ title: "t", items: [] });
    expect(typeof d.fetchedAt).toBe("string");
  });
});

describe("mapToCalendarDomainEvent ", () => {
  it("maps all CalendarEvent fields to CalendarDomainEvent", () => {
    const ce: CalendarEvent = {
      summary: "Meeting",
      start: new Date("2024-01-01T09:00:00"),
      end: new Date("2024-01-01T10:00:00"),
      allDay: false,
      icsIndex: 1,
    };
    const d = mapToCalendarDomainEvent(ce);
    expect(d.summary).toBe("Meeting");
    expect(d.icsIndex).toBe(1);
    expect(d.allDay).toBe(false);
  });
});
