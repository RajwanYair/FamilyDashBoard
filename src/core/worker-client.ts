/**
 * FamilyDashBoard v13 — Typed Worker HTTP Client 
 *
 * Single place that knows:
 *   - The worker base URL
 *   - Every route path and its expected response shape
 *   - How to build query strings
 *
 * Generated conceptually from `worker/openapi.yaml`; manually maintained until
 * `openapi-typescript` is added to the parent toolchain in v12.1.
 *
 * Usage:
 *   import { wc } from "@/core/worker-client";
 *   const data = await wc.weather({ lat: 31.78, lon: 35.22 });
 *
 * All functions throw on non-2xx HTTP or network error.
 * Callers must wrap in try/catch + stale-fallback (see fetch.ts pattern).
 */
// @openapi-paths-hash: 7ee296bf5cc9b94fc531aae39da0ecae236c60de10dccd8c92361694967b7ab3

import { WORKER_BASE_URL } from "./constants";
import { fetchWithTimeout } from "./fetch";
import { diagLog } from "./diag";
import type {
  WeatherResponse,
  CurrencyResponse,
  HebcalResponse,
  YahooChartResponse,
  AlertsResponse,
  CoinGeckoResponse,
  SefariaCalendarResponse,
} from "@/types/api";

// ── Worker envelope ───────────────────────────────────────────────────────────

/** Every worker response is wrapped in this envelope. */
export interface WorkerEnvelope<T = unknown> {
  data: T;
  source: string;
  stale: boolean;
  ts: number;
  ttl?: number;
}

// ── Route parameter types ─────────────────────────────────────────────────────

export interface WeatherParams {
  lat: number;
  lon: number;
}

export interface HebcalParams {
  geonameid: string | number;
}

export interface HebcalHolidaysParams {
  year: number;
}

export interface StocksParams {
  sym: string;
}

export interface NewsParams {
  /** Full URL of the RSS feed (must be on the worker allowlist). */
  url: string;
}

export interface SefariaTextParams {
  /** Sefaria text reference, e.g. "Berakhot.2a.1" */
  ref: string;
}

export interface CryptoParams {
  ids?: string;
  vs_currencies?: string;
}

export interface CalendarParams {
  /** Full URL of the Google Calendar ICS feed. */
  url: string;
}

// ── Typed response shapes ─────────────────────────────────────────────────────

export type NewsAggregateResponse = {
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    source: string;
    category?: string;
    description?: string;
  }>;
  count: number;
  sources: number;
  deduped: number;
};

export type SefariaTextResponse = {
  ref: string;
  heRef: string;
  text: string | string[];
  he: string | string[];
  book: string;
};

export type HealthResponse = {
  ok: boolean;
  status: string;
  ts: number;
};

// ── Low-level fetch helper ────────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;

async function workerGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<WorkerEnvelope<T>> {
  const url = new URL(path, WORKER_BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetchWithTimeout(url.toString(), TIMEOUT_MS);
  if (!res.ok) {
    diagLog(`[worker-client] ${path} → HTTP ${res.status}`);
    throw new Error(`Worker ${path} returned ${res.status}`);
  }
  return res.json() as Promise<WorkerEnvelope<T>>;
}

async function workerPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${WORKER_BASE_URL}${path}`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    diagLog(`[worker-client] POST ${path} → HTTP ${res.status}`);
    throw new Error(`Worker POST ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Typed route functions ─────────────────────────────────────────────────────

/**
 * `wc` — FamilyDashBoard Worker Client
 *
 * One function per route. All return `Promise<WorkerEnvelope<T>>` with the
 * appropriate data type, except `health` and `submitErrors`.
 */
export const wc = {
  /** GET /health */
  health(): Promise<WorkerEnvelope<HealthResponse>> {
    return workerGet<HealthResponse>("/health");
  },

  /** GET /api/weather?lat=&lon= */
  weather(p: WeatherParams): Promise<WorkerEnvelope<WeatherResponse>> {
    return workerGet<WeatherResponse>("/api/weather", {
      lat: String(p.lat),
      lon: String(p.lon),
    });
  },

  /** GET /api/currency (ILS base, all major pairs) */
  currency(): Promise<WorkerEnvelope<CurrencyResponse>> {
    return workerGet<CurrencyResponse>("/api/currency");
  },

  /** GET /api/hebcal?geonameid= (Shabbat times + parasha) */
  hebcal(p: HebcalParams): Promise<WorkerEnvelope<HebcalResponse>> {
    return workerGet<HebcalResponse>("/api/hebcal", {
      geonameid: String(p.geonameid),
    });
  },

  /** GET /api/hebcal/holidays?year= */
  hebcalHolidays(p: HebcalHolidaysParams): Promise<WorkerEnvelope<HebcalResponse>> {
    return workerGet<HebcalResponse>("/api/hebcal/holidays", {
      year: String(p.year),
    });
  },

  /** GET /api/stocks?sym= (Yahoo Finance v8 chart, Finnhub primary) */
  stocks(p: StocksParams): Promise<WorkerEnvelope<YahooChartResponse>> {
    return workerGet<YahooChartResponse>("/api/stocks", { sym: p.sym });
  },

  /** GET /api/news?url= (single RSS feed proxy) */
  news(p: NewsParams): Promise<WorkerEnvelope<NewsAggregateResponse>> {
    return workerGet<NewsAggregateResponse>("/api/news", { url: p.url });
  },

  /** GET /api/news/aggregate (all 16 curated feeds, SimHash deduped) */
  newsAggregate(): Promise<WorkerEnvelope<NewsAggregateResponse>> {
    return workerGet<NewsAggregateResponse>("/api/news/aggregate");
  },

  /** GET /api/alerts (Tzeva Adom active + recent history) */
  alerts(): Promise<WorkerEnvelope<AlertsResponse>> {
    return workerGet<AlertsResponse>("/api/alerts");
  },

  /** GET /api/calendar?url= (Google Calendar ICS proxy) */
  calendar(p: CalendarParams): Promise<WorkerEnvelope<unknown>> {
    return workerGet("/api/calendar", { url: p.url });
  },

  /** GET /api/sefaria/calendar (Daf Yomi + weekly learning) */
  sefariaCalendar(): Promise<WorkerEnvelope<SefariaCalendarResponse>> {
    return workerGet<SefariaCalendarResponse>("/api/sefaria/calendar");
  },

  /** GET /api/sefaria/text?ref= */
  sefariaText(p: SefariaTextParams): Promise<WorkerEnvelope<SefariaTextResponse>> {
    return workerGet<SefariaTextResponse>("/api/sefaria/text", { ref: p.ref });
  },

  /** GET /api/crypto?ids=&vs_currencies= (CoinGecko BTC price) */
  crypto(p?: CryptoParams): Promise<WorkerEnvelope<CoinGeckoResponse>> {
    const params: Record<string, string> = {};
    if (p?.ids) params["ids"] = p.ids;
    if (p?.vs_currencies) params["vs_currencies"] = p.vs_currencies;
    return workerGet<CoinGeckoResponse>("/api/crypto", params);
  },

  /** POST /api/errors (client error telemetry, best-effort) */
  submitErrors(errors: unknown[]): Promise<void> {
    return workerPost<void>("/api/errors", errors).catch(() => undefined);
  },
} as const;
