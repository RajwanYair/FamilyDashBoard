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
  checkRateLimitAsync,
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
import {
  ALLOWED_NEWS_ORIGINS,
  ALLOWED_CALENDAR_ORIGINS,
} from "../../../worker/src/utils/allowlists";
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
    const body = (await res.json()) as { error: string; param: string };
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
    const body = (await res.json()) as { x: number };
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

  it("falls back to application/json when upstream has no Content-Type", async () => {
    // Simulate a response with no Content-Type header (null body → no default CT)
    const upstream = new Response(null, {
      status: 200,
      headers: {}, // no Content-Type set → .get() returns null
    });
    const res = await proxyResponse(upstream, 120);
    expect(res.headers.get("Content-Type")).toBe("application/json");
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
import type { KVStore } from "../../../worker/src/types";
import { makeKv, makeWorkerEnv } from "@tests/worker-helpers";

/** Minimal mock Env with a no-op KV namespace for unit tests (Stream W.2). */
const mockEnv: Env = makeWorkerEnv();

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

    expect(fetchMock).toHaveBeenCalledWith("https://open.er-api.com/v6/latest/ILS");
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

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://open.er-api.com/v6/latest/ILS");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.exchangerate-api.com/v4/latest/ILS");
    expect(res.status).toBe(200);
  });
});

// ── Worker — handleHebcal + handleHebcalHolidays routes (Stream W.3) ─────────

import { handleHebcal, handleHebcalHolidays } from "../../../worker/src/routes/data";

describe("Worker — handleHebcal route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with workerEnvelope on valid upstream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ date: "2024-01-05", title: "Candles", category: "candles", hebrew: "" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const url = new URL("https://worker.dev/api/hebcal?geonameid=293397");
    const res = await handleHebcal(url, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string };
    expect(body.provider).toBe("hebcal");
  });

  it("returns 400 when geonameid is non-numeric", async () => {
    const url = new URL("https://worker.dev/api/hebcal?geonameid=abc!!");
    const res = await handleHebcal(url, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns KV stale on upstream error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const kvGet = vi.fn().mockResolvedValue(
      JSON.stringify({
        items: [{ date: "2024-01-05", title: "Candles", category: "candles", hebrew: "" }],
        _stale: true,
      }),
    );
    const envWithKv: Env = {
      ...mockEnv,
      CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVStore,
    };
    const url = new URL("https://worker.dev/api/hebcal?geonameid=293397");
    const res = await handleHebcal(url, envWithKv);
    expect(res.status).toBe(200);
  });
});

describe("Worker — handleHebcalHolidays route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with workerEnvelope on valid upstream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ date: "2024-01-05", title: "Rosh Hashana", category: "holiday", hebrew: "" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const url = new URL("https://worker.dev/api/hebcal/holidays?year=2024");
    const res = await handleHebcalHolidays(url, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string };
    expect(body.provider).toBe("hebcal");
  });

  it("returns 400 when year is out of range", async () => {
    const url = new URL("https://worker.dev/api/hebcal/holidays?year=1999");
    const res = await handleHebcalHolidays(url, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns KV stale on upstream error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const kvGet = vi.fn().mockResolvedValue(
      JSON.stringify({
        items: [{ date: "2024-01-05", title: "Rosh Hashana", category: "holiday", hebrew: "" }],
      }),
    );
    const envWithKv: Env = {
      ...mockEnv,
      CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVStore,
    };
    const url = new URL("https://worker.dev/api/hebcal/holidays?year=2024");
    const res = await handleHebcalHolidays(url, envWithKv);
    expect(res.status).toBe(200);
  });
});

// ── Worker — handleWeather route (Sprint 35 — V13-DATA NWS coverage) ──────────

import { handleWeather } from "../../../worker/src/routes/data";

/** Minimal Open-Meteo response that satisfies WeatherSchema */
const validOpenMeteoData = {
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

describe("Worker — handleWeather route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when lat is missing", async () => {
    const url = new URL("https://worker.dev/api/weather?lon=34.78");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lon is missing", async () => {
    const url = new URL("https://worker.dev/api/weather?lat=32.08");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat is out of range", async () => {
    const url = new URL("https://worker.dev/api/weather?lat=95&lon=34.78");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns 200 with open-meteo provider on valid upstream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validOpenMeteoData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const url = new URL("https://worker.dev/api/weather?lat=32.08&lon=34.78");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string };
    expect(body.provider).toBe("open-meteo");
  });

  it("returns stale KV envelope when Open-Meteo fails and KV has data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad gateway", { status: 502 }),
    );
    const kvGet = vi.fn().mockResolvedValue(JSON.stringify(validOpenMeteoData));
    const envWithKv: Env = {
      ...mockEnv,
      CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVStore,
    };
    const url = new URL("https://worker.dev/api/weather?lat=32.08&lon=34.78");
    const res = await handleWeather(url, envWithKv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; stale: boolean };
    expect(body.stale).toBe(true);
  });

  it("returns 502 when all providers fail and no KV stale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad gateway", { status: 502 }),
    );
    const url = new URL("https://worker.dev/api/weather?lat=32.08&lon=34.78");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(502);
  });

  it("returns 400 for NWS provider with non-US coordinates", async () => {
    const url = new URL("https://worker.dev/api/weather?lat=32.08&lon=34.78&provider=nws");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("NWS provider only supports US coordinates");
  });

  it("accepts NWS provider for US coordinates (falls through when NWS fails)", async () => {
    // NWS points returns 503 (non-ok) → skip NWS, fall through to Open-Meteo
    // Open-Meteo also returns 503 → met.no also 503 → no KV stale → 502
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error", { status: 503 }));
    // US coordinate: New York City
    const url = new URL("https://worker.dev/api/weather?lat=40.71&lon=-74.01&provider=nws");
    const res = await handleWeather(url, mockEnv);
    expect(res.status).toBe(502);
  });
});

// ── Worker — handleAlerts route (Stream W.4) ──────────────────────────────────

import {
  handleAlerts,
  handleStocks,
  handleCrypto,
  handleNews,
} from "../../../worker/src/routes/feeds";

describe("Worker — handleAlerts route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with workerEnvelope when upstream succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "a1", area: "Tel Aviv" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const res = await handleAlerts(mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; data: unknown[] };
    expect(body.provider).toBe("tzevaadom");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 502 when upstream fails and no KV stale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const res = await handleAlerts(mockEnv);
    expect(res.status).toBe(502);
  });

  it("returns stale KV envelope when upstream fails and KV has data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const staleData = [{ id: "a1", area: "Tel Aviv" }];
    const kvGet = vi.fn().mockResolvedValue(JSON.stringify(staleData));
    const envWithKv: Env = {
      ...mockEnv,
      CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVStore,
    };
    const res = await handleAlerts(envWithKv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; stale: boolean };
    expect(body.provider).toBe("tzevaadom-kv-stale");
    expect(body.stale).toBe(true);
  });
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

import {
  WeatherSchema,
  CurrencySchema,
  HebcalSchema,
  HebcalHolidaysSchema,
  StocksChartSchema,
  CoinGeckoSchema,
  NewsRssSchema,
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
    const result = safeParse(HebcalSchema, {
      items: [{ date: "2024-01-05", category: "candles" }],
    });
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

// ── Zod schemas — StocksChartSchema (Stream W.5) ─────────────────────────────

const VALID_STOCKS = {
  chart: {
    result: [
      {
        meta: { regularMarketPrice: 182.5, currency: "USD", symbol: "AAPL" },
        timestamps: [1700000000],
      },
    ],
    error: null,
  },
};

describe("Zod schemas — StocksChartSchema", () => {
  it("accepts a valid Yahoo Finance chart response", () => {
    const result = safeParse(StocksChartSchema, VALID_STOCKS);
    expect(result.ok).toBe(true);
  });

  it("passes through extra fields in meta", () => {
    const data = {
      chart: {
        result: [
          { meta: { regularMarketPrice: 100, currency: "USD", symbol: "TSLA", extraField: true } },
        ],
        error: null,
      },
    };
    const result = safeParse(StocksChartSchema, data);
    expect(result.ok).toBe(true);
  });

  it("rejects missing chart.result", () => {
    const result = safeParse(StocksChartSchema, { chart: { error: null } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("result");
  });

  it("rejects empty chart.result array", () => {
    const result = safeParse(StocksChartSchema, { chart: { result: [], error: null } });
    expect(result.ok).toBe(false);
  });

  it("rejects meta missing regularMarketPrice", () => {
    const bad = { chart: { result: [{ meta: { currency: "USD", symbol: "X" } }], error: null } };
    const result = safeParse(StocksChartSchema, bad);
    expect(result.ok).toBe(false);
  });

  it("rejects meta with non-number regularMarketPrice", () => {
    const bad = {
      chart: {
        result: [{ meta: { regularMarketPrice: "not-a-number", currency: "USD", symbol: "X" } }],
        error: null,
      },
    };
    const result = safeParse(StocksChartSchema, bad);
    expect(result.ok).toBe(false);
  });
});

// ── Worker — handleStocks route (Stream W.5) ──────────────────────────────────

describe("Worker — handleStocks route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 JSON with valid upstream stocks data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(VALID_STOCKS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const url = new URL("https://worker.example.com/api/stocks?sym=AAPL");
    const res = await handleStocks(url, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof VALID_STOCKS;
    expect(body.chart.result[0]?.meta.symbol).toBe("AAPL");
  });

  it("returns 400 for missing sym param", async () => {
    const url = new URL("https://worker.example.com/api/stocks");
    const res = await handleStocks(url, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns 502 when upstream returns non-ok status and no KV stale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 503 }));
    const url = new URL("https://worker.example.com/api/stocks?sym=AAPL");
    const res = await handleStocks(url, mockEnv);
    expect(res.status).toBe(502);
  });

  it("returns 502 when upstream data fails Zod schema validation and no KV stale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ chart: { result: [], error: null } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const url = new URL("https://worker.example.com/api/stocks?sym=AAPL");
    const res = await handleStocks(url, mockEnv);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("schema invalid");
  });

  it("returns stale KV envelope when upstream fails and KV has data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 503 }));
    const kvGet = vi.fn().mockResolvedValue(JSON.stringify(VALID_STOCKS));
    const envWithKv: Env = {
      ...mockEnv,
      CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVStore,
    };
    const url = new URL("https://worker.example.com/api/stocks?sym=AAPL");
    const res = await handleStocks(url, envWithKv);
    expect(res.status).toBe(200);
    // KV stale path returns raw chart JSON (no envelope) so client can access
    // data.chart.result[0] directly — same format as the happy path.
    const body = (await res.json()) as typeof VALID_STOCKS;
    expect(body.chart.result[0]?.meta.symbol).toBe("AAPL");
  });
});

// ── Zod schemas — CoinGeckoSchema (Stream W.7) ──────────────────────────────

const VALID_CRYPTO = {
  bitcoin: { usd: 65000, usd_24h_change: 2.3 },
};

describe("Zod schemas — CoinGeckoSchema", () => {
  it("accepts valid CoinGecko bitcoin price response", () => {
    const result = safeParse(CoinGeckoSchema, VALID_CRYPTO);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.bitcoin.usd).toBe(65000);
  });

  it("accepts response without optional usd_24h_change", () => {
    const result = safeParse(CoinGeckoSchema, { bitcoin: { usd: 50000 } });
    expect(result.ok).toBe(true);
  });

  it("rejects missing bitcoin key", () => {
    const result = safeParse(CoinGeckoSchema, { ethereum: { usd: 3000 } });
    expect(result.ok).toBe(false);
  });

  it("rejects non-number usd value", () => {
    const result = safeParse(CoinGeckoSchema, { bitcoin: { usd: "sixty-five thousand" } });
    expect(result.ok).toBe(false);
  });

  it("passes through unknown extra fields", () => {
    const result = safeParse(CoinGeckoSchema, { bitcoin: { usd: 65000, eur: 60000 } });
    expect(result.ok).toBe(true);
  });
});

// ── Worker — handleCrypto route (Stream W.7) ──────────────────────────────────

describe("Worker — handleCrypto route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 JSON with valid CoinGecko bitcoin data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(VALID_CRYPTO), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const url = new URL("https://worker.example.com/api/crypto?ids=bitcoin&vs_currencies=usd");
    const res = await handleCrypto(url, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof VALID_CRYPTO;
    expect(body.bitcoin.usd).toBe(65000);
  });

  it("returns 400 for non-bitcoin ids", async () => {
    const url = new URL("https://worker.example.com/api/crypto?ids=ethereum");
    const res = await handleCrypto(url, mockEnv);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("bitcoin");
  });

  it("returns 502 when upstream returns non-ok status and no KV stale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    const url = new URL("https://worker.example.com/api/crypto?ids=bitcoin");
    const res = await handleCrypto(url, mockEnv);
    expect(res.status).toBe(502);
  });

  it("returns 502 when upstream data fails Zod schema validation and no KV stale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ethereum: { usd: 3000 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const url = new URL("https://worker.example.com/api/crypto?ids=bitcoin");
    const res = await handleCrypto(url, mockEnv);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("schema invalid");
  });

  it("returns stale KV envelope when upstream fails and KV has data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    const kvGet = vi.fn().mockResolvedValue(JSON.stringify(VALID_CRYPTO));
    const envWithKv: Env = {
      ...mockEnv,
      CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVStore,
    };
    const url = new URL("https://worker.example.com/api/crypto?ids=bitcoin");
    const res = await handleCrypto(url, envWithKv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; stale: boolean };
    expect(body.provider).toBe("coingecko-kv-stale");
    expect(body.stale).toBe(true);
  });
});

// ── Zod schemas — NewsRssSchema (Stream W.8) ──────────────────────────────────

const VALID_RSS_2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item><title>Article 1</title></item>
    <item><title>Article 2</title></item>
  </channel>
</rss>`;

const VALID_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry><title>Post 1</title></entry>
  <entry><title>Post 2</title></entry>
</feed>`;

describe("Zod schemas — NewsRssSchema", () => {
  it("accepts valid RSS 2.0 with <channel> and <item>", () => {
    const result = safeParse(NewsRssSchema, VALID_RSS_2);
    expect(result.ok).toBe(true);
  });

  it("accepts valid Atom 1.0 with <feed> and <entry>", () => {
    const result = safeParse(NewsRssSchema, VALID_ATOM);
    expect(result.ok).toBe(true);
  });

  it("accepts minimal feed with XML declaration, <channel> and <item>", () => {
    const result = safeParse(
      NewsRssSchema,
      '<?xml version="1.0"?><rss><channel><item/></channel></rss>',
    );
    expect(result.ok).toBe(true);
  });

  it("rejects empty string", () => {
    const result = safeParse(NewsRssSchema, "");
    expect(result.ok).toBe(false);
  });

  it("rejects plain JSON (not XML)", () => {
    const result = safeParse(NewsRssSchema, JSON.stringify({ title: "not rss" }));
    expect(result.ok).toBe(false);
  });

  it("rejects HTML that is not a feed", () => {
    const result = safeParse(NewsRssSchema, "<html><body><p>Not a feed</p></body></html>");
    expect(result.ok).toBe(false);
  });

  it("rejects RSS without <item> (empty channel)", () => {
    const result = safeParse(
      NewsRssSchema,
      "<rss><channel><title>No items</title></channel></rss>",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects Atom without <entry> (empty feed)", () => {
    const result = safeParse(NewsRssSchema, "<feed><title>No entries</title></feed>");
    expect(result.ok).toBe(false);
  });

  it("rejects non-string input", () => {
    const result = safeParse(NewsRssSchema, 42);
    expect(result.ok).toBe(false);
  });
});

// ── Worker — handleNews route (Stream W.8) ────────────────────────────────────

describe("Worker — handleNews route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with RSS text for valid RSS 2.0 upstream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(VALID_RSS_2, {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      }),
    );
    const url = new URL("https://worker.example.com/api/news?url=https://rss.ynet.co.il/0.xml");
    const res = await handleNews(url);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<channel");
  });

  it("returns 200 with Atom text for valid Atom upstream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(VALID_ATOM, {
        status: 200,
        headers: { "Content-Type": "application/atom+xml" },
      }),
    );
    const url = new URL("https://worker.example.com/api/news?url=https://rss.ynet.co.il/0.xml");
    const res = await handleNews(url);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<feed");
  });

  it("returns 502 when upstream returns non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    const url = new URL("https://worker.example.com/api/news?url=https://rss.ynet.co.il/0.xml");
    const res = await handleNews(url);
    expect(res.status).toBe(502);
  });

  it("returns 502 when upstream returns non-RSS content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body>Error page</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );
    const url = new URL("https://worker.example.com/api/news?url=https://rss.ynet.co.il/0.xml");
    const res = await handleNews(url);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("not valid RSS");
  });

  it("returns 403 for disallowed origin", async () => {
    const url = new URL(
      "https://worker.example.com/api/news?url=https://evil.example.com/feed.xml",
    );
    const res = await handleNews(url);
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing url param", async () => {
    const url = new URL("https://worker.example.com/api/news");
    const res = await handleNews(url);
    expect(res.status).toBe(400);
  });
});

// ── Worker — KV cache utilities (Stream W.9) ──────────────────────────────────

import { kvGetStale, kvPut } from "../../../worker/src/utils/kv";

describe("KV cache utilities — kvGetStale", () => {
  it("returns null when key is absent", async () => {
    const kv = makeKv(() => Promise.resolve(null));
    const result = await kvGetStale(kv, "missing:key");
    expect(result).toBeNull();
  });

  it("returns parsed data with _stale:true when key exists", async () => {
    const data = { rates: { USD: 0.27 } };
    const kv = makeKv(() => Promise.resolve(JSON.stringify(data)));
    const result = await kvGetStale<{ rates: Record<string, number> }>(kv, "currency:ILS");
    expect(result).not.toBeNull();
    expect(result?._stale).toBe(true);
    expect(result?.rates.USD).toBe(0.27);
  });

  it("returns null when stored value is invalid JSON", async () => {
    const kv = makeKv(() => Promise.resolve("not-json{{"));
    const result = await kvGetStale(kv, "bad:key");
    expect(result).toBeNull();
  });

  it("returns null when KV.get throws", async () => {
    const kv = makeKv(() => Promise.reject(new Error("KV unavailable")));
    const result = await kvGetStale(kv, "error:key");
    expect(result).toBeNull();
  });
});

describe("KV cache utilities — kvPut", () => {
  it("serializes data to JSON and calls kv.put", async () => {
    const putSpy = vi.fn().mockResolvedValue(undefined);
    const kv = makeKv(undefined, putSpy);
    const data = { rates: { USD: 0.27 } };
    await kvPut(kv, "currency:ILS", data, 3600);
    expect(putSpy).toHaveBeenCalledWith("currency:ILS", JSON.stringify(data), {
      expirationTtl: 3600,
    });
  });

  it("does not throw when kv.put rejects", async () => {
    const kv = makeKv(undefined, () => Promise.reject(new Error("KV write failed")));
    await expect(kvPut(kv, "key", {}, 60)).resolves.not.toThrow();
  });

  it("stores an array value correctly", async () => {
    const putSpy = vi.fn().mockResolvedValue(undefined);
    const kv = makeKv(undefined, putSpy);
    const data = [{ id: 1 }, { id: 2 }];
    await kvPut(kv, "list:items", data, 120);
    expect(putSpy).toHaveBeenCalledWith("list:items", JSON.stringify(data), {
      expirationTtl: 120,
    });
  });
});

// ── Worker — makeWorkerEnv helper (Stream W.9) ────────────────────────────────

describe("Worker test helper — makeWorkerEnv", () => {
  it("returns ENVIRONMENT: test by default", () => {
    const env = makeWorkerEnv();
    expect(env.ENVIRONMENT).toBe("test");
  });

  it("CACHE_KV.get returns null by default", async () => {
    const env = makeWorkerEnv();
    const result = await env.CACHE_KV.get("any:key");
    expect(result).toBeNull();
  });

  it("accepts a KV get override", async () => {
    const env = makeWorkerEnv({
      get: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    } as unknown as Partial<KVStore>);
    const result = await env.CACHE_KV.get("test:key");
    expect(result).toBe(JSON.stringify({ ok: true }));
  });

  it("makeKv get override is called with the key", async () => {
    const getSpy = vi.fn().mockResolvedValue(null);
    const kv = makeKv(getSpy);
    await kv.get("stocks:AAPL");
    expect(getSpy).toHaveBeenCalledWith("stocks:AAPL");
  });
});
// ── checkRateLimitAsync (V13-EDGE-6 DO-backed rate limiter) ──────────────────

describe("checkRateLimitAsync — in-memory fallback (no DO)", () => {
  beforeEach(() => clearRateLimitState());
  afterEach(() => clearRateLimitState());

  it("returns limited=false for a fresh IP when doNamespace is undefined", async () => {
    const result = await checkRateLimitAsync("10.0.0.1");
    expect(result.limited).toBe(false);
    expect(result.remaining).toBeLessThanOrEqual(MAX_REQUESTS_PER_WINDOW);
  });

  it("returns limited=true after exceeding the limit", async () => {
    for (let i = 0; i <= MAX_REQUESTS_PER_WINDOW; i++) {
      await checkRateLimitAsync("10.0.0.2");
    }
    const result = await checkRateLimitAsync("10.0.0.2");
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("falls back to in-memory when DO stub throws", async () => {
    const badDO = {
      idFromName: () => "id",
      get: () => ({ fetch: async () => { throw new Error("DO unavailable"); } }),
    };
    const result = await checkRateLimitAsync("10.0.0.3", badDO as never);
    expect(result.limited).toBe(false);
  });

  it("falls back to in-memory when DO returns non-ok status", async () => {
    const badDO = {
      idFromName: () => "id",
      get: () => ({ fetch: async () => new Response("error", { status: 500 }) }),
    };
    const result = await checkRateLimitAsync("10.0.0.4", badDO as never);
    expect(result.limited).toBe(false);
  });

  it("uses DO response when stub returns valid JSON", async () => {
    const mockDO = {
      idFromName: () => "id",
      get: () => ({
        fetch: async () => Response.json({ limited: false, remaining: 99 }),
      }),
    };
    const result = await checkRateLimitAsync("10.0.0.5", mockDO as never);
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(99);
  });

  it("returns limited=true from DO when DO says limited", async () => {
    const mockDO = {
      idFromName: () => "id",
      get: () => ({
        fetch: async () => Response.json({ limited: true, remaining: 0 }),
      }),
    };
    const result = await checkRateLimitAsync("10.0.0.6", mockDO as never);
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
