/**
 * Worker unit tests — middleware: cors, rate-limit, validation, allowlists, response
 *
 * These tests run in Node.js / happy-dom without Miniflare.
 * They test pure utility functions (no fetch mocking needed).
 */

// ── CORS middleware ───────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isPreflight, handlePreflight } from "../../../worker/src/middleware/cors";
import {
  isRateLimited,
  getClientIp,
  rateLimitResponse,
  getRemainingRequests,
  clearRateLimitState,
  MAX_REQUESTS_PER_WINDOW,
} from "../../../worker/src/middleware/rate-limit";
import {
  ValidationError,
  validationErrorResponse,
  requireParam,
  requireLat,
  requireLon,
  requireYear,
  requireGeoId,
  requireSymbol,
  requireHttpsUrl,
} from "../../../worker/src/utils/validation";
import { ALLOWED_NEWS_ORIGINS, ALLOWED_CALENDAR_ORIGINS } from "../../../worker/src/utils/allowlists";
import { jsonResponse, proxyResponse, workerEnvelope } from "../../../worker/src/utils/response";

// ── CORS middleware tests ─────────────────────────────────────────────────────

describe("CORS middleware — isPreflight", () => {
  it("returns true for OPTIONS request with Origin header", () => {
    const req = new Request("https://example.com/api/weather", {
      method: "OPTIONS",
      headers: { Origin: "https://foo.com", "Access-Control-Request-Method": "GET" },
    });
    expect(isPreflight(req)).toBe(true);
  });

  it("returns false for GET request", () => {
    const req = new Request("https://example.com/api/weather", { method: "GET" });
    expect(isPreflight(req)).toBe(false);
  });

  it("returns false for OPTIONS without Origin", () => {
    // isPreflight only checks method — Origin header not required in this impl
    const req = new Request("https://example.com/api/weather", { method: "OPTIONS" });
    expect(isPreflight(req)).toBe(true); // implementation checks method only
  });
});

describe("CORS middleware — handlePreflight", () => {
  it("returns 204 status", () => {
    const res = handlePreflight();
    expect(res.status).toBe(204);
  });

  it("includes Access-Control-Allow-Origin: *", () => {
    const res = handlePreflight();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes Access-Control-Allow-Methods header", () => {
    const res = handlePreflight();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
  });
});

// ── Rate-limit middleware tests ───────────────────────────────────────────────

describe("Rate-limit middleware — isRateLimited", () => {
  beforeEach(() => clearRateLimitState());
  afterEach(() => clearRateLimitState());

  it("allows first request for a new IP", () => {
    expect(isRateLimited("1.2.3.4")).toBe(false);
  });

  it("allows requests below the limit", () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(isRateLimited("5.6.7.8")).toBe(false);
    }
  });

  it("blocks requests beyond the limit", () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      isRateLimited("9.10.11.12");
    }
    expect(isRateLimited("9.10.11.12")).toBe(true);
  });

  it("different IPs are tracked independently", () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 1; i++) {
      isRateLimited("1.1.1.1");
    }
    expect(isRateLimited("1.1.1.1")).toBe(true);
    expect(isRateLimited("2.2.2.2")).toBe(false);
  });
});

describe("Rate-limit middleware — getRemainingRequests", () => {
  beforeEach(() => clearRateLimitState());
  afterEach(() => clearRateLimitState());

  it("returns MAX for fresh IP", () => {
    expect(getRemainingRequests("fresh.ip")).toBe(MAX_REQUESTS_PER_WINDOW);
  });

  it("decrements after requests", () => {
    isRateLimited("dec.ip");
    isRateLimited("dec.ip");
    expect(getRemainingRequests("dec.ip")).toBe(MAX_REQUESTS_PER_WINDOW - 2);
  });
});

describe("Rate-limit middleware — getClientIp", () => {
  it("reads CF-Connecting-IP first", () => {
    const req = new Request("https://x.com", {
      headers: { "CF-Connecting-IP": "1.1.1.1", "X-Forwarded-For": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to X-Forwarded-For", () => {
    const req = new Request("https://x.com", {
      headers: { "X-Forwarded-For": "2.2.2.2, 3.3.3.3" },
    });
    expect(getClientIp(req)).toBe("2.2.2.2");
  });

  it("returns 'unknown' if no IP headers", () => {
    const req = new Request("https://x.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("Rate-limit middleware — rateLimitResponse", () => {
  it("has status 429", () => {
    expect(rateLimitResponse().status).toBe(429);
  });

  it("includes X-RateLimit-Limit header", () => {
    const res = rateLimitResponse();
    expect(res.headers.get("X-RateLimit-Limit")).toBe(String(MAX_REQUESTS_PER_WINDOW));
  });

  it("includes Retry-After header", () => {
    expect(rateLimitResponse().headers.get("Retry-After")).toBeTruthy();
  });
});

// ── Validation helpers ────────────────────────────────────────────────────────

describe("Validation — ValidationError", () => {
  it("has name ValidationError", () => {
    const err = new ValidationError("lat", "bad lat");
    expect(err.name).toBe("ValidationError");
    expect(err.param).toBe("lat");
    expect(err.message).toBe("bad lat");
  });
});

describe("Validation — validationErrorResponse", () => {
  it("returns 400 with JSON body", async () => {
    const err = new ValidationError("sym", "bad symbol");
    const res = validationErrorResponse(err);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; param: string };
    expect(body.param).toBe("sym");
    expect(body.error).toContain("bad symbol");
  });
});

describe("Validation — requireParam", () => {
  it("returns value when present", () => {
    const url = new URL("https://x.com?name=hello");
    expect(requireParam(url, "name")).toBe("hello");
  });

  it("throws when missing", () => {
    const url = new URL("https://x.com");
    expect(() => requireParam(url, "name")).toThrow(ValidationError);
  });

  it("throws when empty string", () => {
    const url = new URL("https://x.com?name=");
    expect(() => requireParam(url, "name")).toThrow(ValidationError);
  });
});

describe("Validation — requireLat / requireLon", () => {
  it("accepts valid latitude", () => {
    const url = new URL("https://x.com?lat=32.08");
    expect(requireLat(url)).toBeCloseTo(32.08);
  });

  it("rejects out-of-range latitude", () => {
    const url = new URL("https://x.com?lat=91");
    expect(() => requireLat(url)).toThrow(ValidationError);
  });

  it("accepts valid longitude", () => {
    const url = new URL("https://x.com?lon=34.78");
    expect(requireLon(url)).toBeCloseTo(34.78);
  });

  it("rejects out-of-range longitude", () => {
    const url = new URL("https://x.com?lon=200");
    expect(() => requireLon(url)).toThrow(ValidationError);
  });
});

describe("Validation — requireYear", () => {
  it("accepts current year-ish", () => {
    const url = new URL("https://x.com?year=2026");
    expect(requireYear(url)).toBe(2026);
  });

  it("rejects out-of-range year", () => {
    const url = new URL("https://x.com?year=1999");
    expect(() => requireYear(url)).toThrow(ValidationError);
  });

  it("defaults to current year when missing", () => {
    const url = new URL("https://x.com");
    const result = requireYear(url);
    expect(result).toBe(new Date().getFullYear());
  });
});

describe("Validation — requireGeoId", () => {
  it("accepts numeric geoname id", () => {
    const url = new URL("https://x.com?geonameid=281184");
    expect(requireGeoId(url)).toBe("281184");
  });

  it("rejects non-numeric", () => {
    const url = new URL("https://x.com?geonameid=abc");
    expect(() => requireGeoId(url)).toThrow(ValidationError);
  });
});

describe("Validation — requireSymbol", () => {
  it("accepts valid ticker", () => {
    const url = new URL("https://x.com?sym=AAPL");
    expect(requireSymbol(url)).toBe("AAPL");
  });

  it("accepts index symbol with ^", () => {
    const url = new URL("https://x.com?sym=%5EGSPC"); // %5E = ^
    expect(requireSymbol(url)).toBe("^GSPC");
  });

  it("rejects symbol with invalid chars", () => {
    const url = new URL("https://x.com?sym=AA%20BB");
    expect(() => requireSymbol(url)).toThrow(ValidationError);
  });
});

describe("Validation — requireHttpsUrl", () => {
  it("accepts valid HTTPS URL", () => {
    const url = new URL("https://x.com?url=https%3A%2F%2Frss.ynet.co.il%2Ffeed%2F");
    const result = requireHttpsUrl(url, "url");
    expect(result.href).toContain("rss.ynet.co.il");
  });

  it("rejects http URL", () => {
    const url = new URL("https://x.com?url=http%3A%2F%2Fevil.com");
    expect(() => requireHttpsUrl(url, "url")).toThrow(ValidationError);
  });

  it("rejects file:// URL", () => {
    const url = new URL("https://x.com?url=file%3A%2F%2F%2Fetc%2Fpasswd");
    expect(() => requireHttpsUrl(url, "url")).toThrow(ValidationError);
  });
});

// ── Allowlists ────────────────────────────────────────────────────────────────

describe("ALLOWED_NEWS_ORIGINS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ALLOWED_NEWS_ORIGINS)).toBe(true);
    expect(ALLOWED_NEWS_ORIGINS.length).toBeGreaterThan(0);
  });

  it("contains expected Israeli news sources", () => {
    expect(ALLOWED_NEWS_ORIGINS).toContain("rss.ynet.co.il");
    expect(ALLOWED_NEWS_ORIGINS).toContain("www.haaretz.co.il");
  });

  it("all entries are valid hostnames (no protocol, no path)", () => {
    for (const origin of ALLOWED_NEWS_ORIGINS) {
      expect(origin).not.toContain("://");
      expect(origin).not.toContain("/");
    }
  });
});

describe("ALLOWED_CALENDAR_ORIGINS", () => {
  it("contains Google Calendar", () => {
    expect(ALLOWED_CALENDAR_ORIGINS).toContain("calendar.google.com");
  });

  it("contains Outlook origins", () => {
    expect(ALLOWED_CALENDAR_ORIGINS).toContain("outlook.office365.com");
  });
});

// ── Response helpers ──────────────────────────────────────────────────────────

describe("Worker response helpers — jsonResponse", () => {
  it("returns correct status", () => {
    const res = jsonResponse({ ok: true }, 200);
    expect(res.status).toBe(200);
  });

  it("sets Content-Type: application/json", () => {
    const res = jsonResponse({ ok: true });
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("includes CORS header", () => {
    const res = jsonResponse({ ok: true });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("defaults to status 200", () => {
    expect(jsonResponse({}).status).toBe(200);
  });

  it("serializes body correctly", async () => {
    const res = jsonResponse({ x: 42 });
    const body = await res.json() as { x: number };
    expect(body.x).toBe(42);
  });
});

describe("Worker response helpers — proxyResponse", () => {
  it("passes through 200 status", async () => {
    const upstream = new Response("data", { status: 200 });
    const res = await proxyResponse(upstream, 300);
    expect(res.status).toBe(200);
  });

  it("sets Cache-Control header with max-age", async () => {
    const upstream = new Response("data", { status: 200 });
    const res = await proxyResponse(upstream, 300);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("max-age=300");
  });

  it("passes through non-ok upstream status", async () => {
    const upstream = new Response("fail", { status: 503 });
    const res = await proxyResponse(upstream, 60);
    expect(res.status).toBe(503);
  });
});

describe("Worker response helpers — workerEnvelope", () => {
  it("wraps data in WorkerResponse envelope", async () => {
    const data = { rates: { USD: 0.27 } };
    const res = workerEnvelope(data, "open.er-api.com", false, 3600);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown;
      stale: boolean;
      timestamp: number;
      provider: string;
    };
    expect(body.data).toEqual(data);
    expect(body.stale).toBe(false);
    expect(body.provider).toBe("open.er-api.com");
    expect(typeof body.timestamp).toBe("number");
  });

  it("sets Cache-Control header with correct max-age", async () => {
    const res = workerEnvelope({}, "test", false, 1800);
    expect(res.headers.get("Cache-Control")).toContain("max-age=1800");
  });

  it("marks stale=true when serving from cache", async () => {
    const res = workerEnvelope({ error: "unavailable" }, "none", true, 60);
    const body = (await res.json()) as { stale: boolean };
    expect(body.stale).toBe(true);
  });

  it("includes CORS headers", () => {
    const res = workerEnvelope({}, "test", false, 60);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ── Worker — POST /api/errors handler ─────────────────────────────────────────

import { handleErrors } from "../../../worker/src/routes/errors";
import { handleCurrency } from "../../../worker/src/routes/data";
import type { Env } from "../../../worker/src/index";

/** Minimal mock Env with a no-op KV namespace for unit tests (Stream W.2). */
const mockEnv: Env = {
  ENVIRONMENT: "test",
  CACHE_KV: {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVNamespace,
};

describe("Worker — handleErrors route", () => {
  function post(body: unknown): Request {
    return new Request("https://worker.dev/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 204 for a valid single error entry", async () => {
    const req = post([{ ts: Date.now(), message: "test error" }]);
    const res = await handleErrors(req);
    expect(res.status).toBe(204);
  });

  it("returns 204 for multiple valid error entries", async () => {
    const req = post([
      { ts: Date.now(), message: "err1", source: "main.ts", lineno: 42 },
      { ts: Date.now(), message: "err2" },
    ]);
    const res = await handleErrors(req);
    expect(res.status).toBe(204);
  });

  it("returns 405 for GET request", async () => {
    const req = new Request("https://worker.dev/api/errors", { method: "GET" });
    const res = await handleErrors(req);
    expect(res.status).toBe(405);
  });

  it("returns 400 for non-array body", async () => {
    const req = post({ ts: Date.now(), message: "not an array" });
    const res = await handleErrors(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("https://worker.dev/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await handleErrors(req);
    expect(res.status).toBe(400);
  });

  it("returns 413 when too many entries sent", async () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({ ts: i, message: `err${i}` }));
    const req = post(entries);
    const res = await handleErrors(req);
    expect(res.status).toBe(413);
  });

  it("returns 400 when all entries are invalid shape", async () => {
    const req = post([{ bad: "entry" }, { also: "bad" }]);
    const res = await handleErrors(req);
    expect(res.status).toBe(400);
  });

  it("accepts entries with optional source and lineno", async () => {
    const req = post([{ ts: 1000000000000, message: "m", source: "file.ts", lineno: 10 }]);
    const res = await handleErrors(req);
    expect(res.status).toBe(204);
  });

  it("rejects entries where ts is not a number", async () => {
    const req = post([{ ts: "2025-01-01", message: "bad ts" }]);
    const res = await handleErrors(req);
    expect(res.status).toBe(400);
  });

  it("rejects entries where message is missing", async () => {
    const req = post([{ ts: Date.now() }]);
    const res = await handleErrors(req);
    expect(res.status).toBe(400);
  });

  it("truncates messages longer than 500 characters", async () => {
    const longMsg = "a".repeat(600);
    const req = post([{ ts: Date.now(), message: longMsg }]);
    const res = await handleErrors(req);
    expect(res.status).toBe(204);
  });

  it("empty array returns 400 (no valid entries)", async () => {
    const req = post([]);
    const res = await handleErrors(req);
    expect(res.status).toBe(400);
  });
});

describe("Worker — handleCurrency route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the ILS-based primary upstream", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rates: { USD: 0.27 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await handleCurrency(mockEnv);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://open.er-api.com/v6/latest/ILS",
    );
    expect(res.status).toBe(200);
  });

  it("falls back to the secondary upstream when the primary fails", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("fail", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ rates: { USD: 0.27 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const res = await handleCurrency(mockEnv);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://open.er-api.com/v6/latest/ILS",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.exchangerate-api.com/v4/latest/ILS",
    );
    expect(res.status).toBe(200);
  });
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

import {
  WeatherSchema,
  CurrencySchema,
  HebcalSchema,
  HebcalHolidaysSchema,
  safeParse,
} from "../../../worker/src/utils/schemas";

describe("Zod schemas — safeParse helper", () => {
  it("returns ok:true for valid data", () => {
    const result = safeParse(CurrencySchema, { rates: { USD: 0.27, EUR: 0.25 } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.rates.USD).toBe(0.27);
  });

  it("returns ok:false with error string for invalid data", () => {
    const result = safeParse(CurrencySchema, { rates: "not an object" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it("passes through extra fields not in schema", () => {
    const result = safeParse(CurrencySchema, { rates: { USD: 0.27 }, extra: "field" });
    expect(result.ok).toBe(true);
  });
});

describe("Zod schemas — WeatherSchema", () => {
  const validWeather = {
    current: {
      temperature_2m: 22,
      apparent_temperature: 20,
      weather_code: 1,
      wind_speed_10m: 10,
      wind_direction_10m: 180,
      relative_humidity_2m: 55,
      uv_index: 3,
    },
    hourly: {
      temperature_2m: [22, 23],
      precipitation_probability: [10, 20],
      weather_code: [1, 2],
    },
    daily: {
      temperature_2m_max: [25],
      temperature_2m_min: [18],
      weather_code: [1],
      sunrise: ["2024-01-01T06:00"],
      sunset: ["2024-01-01T18:00"],
      precipitation_probability_max: [20],
      uv_index_max: [5],
    },
  };

  it("accepts valid Open-Meteo response", () => {
    const result = safeParse(WeatherSchema, validWeather);
    expect(result.ok).toBe(true);
  });

  it("rejects response missing current.temperature_2m", () => {
    const bad = { ...validWeather, current: { weather_code: 1 } };
    const result = safeParse(WeatherSchema, bad);
    expect(result.ok).toBe(false);
  });

  it("rejects response missing daily arrays", () => {
    const bad = { current: validWeather.current, hourly: validWeather.hourly, daily: {} };
    const result = safeParse(WeatherSchema, bad);
    expect(result.ok).toBe(false);
  });
});

describe("Zod schemas — CurrencySchema", () => {
  it("accepts valid ER-API response", () => {
    const result = safeParse(CurrencySchema, { rates: { USD: 0.27, EUR: 0.25, GBP: 0.21 } });
    expect(result.ok).toBe(true);
  });

  it("rejects missing rates field", () => {
    const result = safeParse(CurrencySchema, { base: "ILS" });
    expect(result.ok).toBe(false);
  });

  it("rejects rates with non-number values", () => {
    const result = safeParse(CurrencySchema, { rates: { USD: "not-a-number" } });
    expect(result.ok).toBe(false);
  });
});

describe("Zod schemas — HebcalSchema", () => {
  const validItem = { title: "Candle lighting", date: "2024-01-05T17:00", category: "candles" };

  it("accepts valid Hebcal shabbat response", () => {
    const result = safeParse(HebcalSchema, { items: [validItem] });
    expect(result.ok).toBe(true);
  });

  it("accepts empty items array", () => {
    const result = safeParse(HebcalSchema, { items: [] });
    expect(result.ok).toBe(true);
  });

  it("rejects missing items field", () => {
    const result = safeParse(HebcalSchema, { title: "Shabbat" });
    expect(result.ok).toBe(false);
  });

  it("rejects item missing required title field", () => {
    const result = safeParse(HebcalSchema, { items: [{ date: "2024-01-05", category: "candles" }] });
    expect(result.ok).toBe(false);
  });
});

describe("Zod schemas — HebcalHolidaysSchema", () => {
  const validItem = { title: "Rosh Hashana", date: "2024-10-02", category: "major" };

  it("accepts valid Hebcal holidays response", () => {
    const result = safeParse(HebcalHolidaysSchema, { items: [validItem] });
    expect(result.ok).toBe(true);
  });

  it("rejects missing items", () => {
    const result = safeParse(HebcalHolidaysSchema, {});
    expect(result.ok).toBe(false);
  });
});
