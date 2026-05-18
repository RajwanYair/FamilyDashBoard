/**
 * FamilyDashBoard API Proxy — Cloudflare Worker (Hono router — ADR-026)
 *
 * Routes:
 *   GET /health                           → Health check
 *   GET /api/weather?lat=X&lon=Y          → Open-Meteo
 *   GET /api/currency                     → ER-API (ILS base)
 *   GET /api/hebcal?geonameid=X           → Hebcal shabbat
 *   GET /api/hebcal/holidays?year=X       → Hebcal holiday list
 *   GET /api/stocks?sym=X                 → Yahoo Finance v8 chart
 *   GET /api/stocks/live?sym=A,B          → WS upgrade → StocksLiveDO (ADR-086)
 *   GET /api/news?url=X                   → RSS feed proxy (allowlisted origins)
 *   GET /api/news/aggregate               → Aggregate all 16 curated RSS feeds
 *   GET /api/news/summarise               → Workers AI news summarisation (AI_ENABLED=true, else 503)
 *   GET /api/motivation/hebrew            → Workers AI Hebrew motivational quote (AI_ENABLED=true, else 503)
 *   GET /api/ai/synthesis                 → Daily Hebrew synthesis tile (cached 4 h; faith-safe; AI_ENABLED=true, else 503)
 *   GET /api/alerts                       → Tzeva Adom history
 *   GET /api/alerts/subscribe             → SSE stream (AlertsOrchestrator, ADR-025 legacy)
 *   GET /api/alerts/live                  → WS upgrade → AlertsLiveDO (ADR-089, zero idle CPU)
 *   GET /api/calendar?url=X              → Google Calendar ICS proxy
 *   GET /api/sefaria/calendar             → Sefaria calendars (Daf Yomi)
 *   GET /api/sefaria/text?ref=X           → Sefaria individual text lookup
 *   GET /api/crypto?ids=bitcoin          → CoinGecko Bitcoin price (validated)
 *   POST /api/errors                      → Client error ingestion (best-effort telemetry)
 *   GET  /api/metrics                     → Prometheus text metrics (token-gated, D1-backed)
 *   POST /api/reports                     → Browser Reporting API ingest (CSP + deprecation + intervention)
 *   GET  /api/reports/digest              → Report summary digest (token-gated, D1-backed, ADR-028)
 *   GET  /api/r2-asset?url=X             → R2 background image cache proxy (ADR-050, allowlisted CDNs only)
 *
 * Middleware:
 *   CORS · Rate-limiting · Request logging · Canary header (X-Canary: true, CANARY_PCT%) · Analytics Engine
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
// ── Durable Objects (V12-EDGE-3, V13-EDGE-6, ADR-086) — re-exported for wrangler binding ──
export { AlertsOrchestrator } from "./durable-objects/alerts-orchestrator";
export { AlertsLiveDO } from "./durable-objects/alerts-live-do";
export { RateLimiterDO } from "./durable-objects/rate-limiter-do";
export { StocksLiveDO } from "./durable-objects/stocks-live-do";
import { handleWeather, handleCurrency, handleHebcal, handleHebcalHolidays } from "./routes/data";
import {
  handleStocks,
  handleStocksLive,
  handleNews,
  handleNewsAggregate,
  handleAlerts,
  handleCalendar,
  handleSefariaCalendar,
  handleSefariaText,
  handleCrypto,
} from "./routes/feeds";
import { handleErrors, handleErrorsExport, handleErrorsQueue } from "./routes/errors";
import { handleMetrics } from "./routes/metrics";
import { handleReportsIngest, handleReportsDigest } from "./routes/reports";
import { handleR2Asset } from "./routes/r2-asset";
import { handleScheduled, handleNextYearPreWarm, handleWeeklyDigest } from "./routes/cron";
import { handleNewsSummarise, handleMotivationHebrew, handleAiSynthesis } from "./routes/ai";
import {
  checkRateLimitAsync,
  getClientIp,
  rateLimitResponse,
  MAX_REQUESTS_PER_WINDOW,
} from "./middleware/rate-limit";
import { logRequest } from "./middleware/log";
import { applyCanaryHeader, shouldTagCanary } from "./middleware/canary";
import { earlyHintsMiddleware } from "./middleware/early-hints";
import { writeAnalyticsHit, normaliseRoute } from "./utils/analytics";
import type { Env } from "./types";

export type { Env };

// ── Hono app ─────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// CORS — allow all origins (same policy as before)
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

// Rate limiting + request logging middleware (V13-EDGE-6: DO-backed when RATE_LIMITER_DO bound)
app.use("*", async (c, next) => {
  const ip = getClientIp(c.req.raw);
  const { limited, remaining } = await checkRateLimitAsync(ip, c.env.RATE_LIMITER_DO);
  if (limited) return rateLimitResponse();

  const startMs = Date.now();
  await next();

  // Inject rate-limit info headers
  c.res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
  c.res.headers.set("X-RateLimit-Remaining", String(remaining));

  logRequest(c.req.raw, c.res, startMs, ip);

  // Canary traffic tagging (V12-EDGE-4b ) — fire-and-forget header injection
  applyCanaryHeader(c.res, c.env.CANARY_PCT);

  // Analytics Engine hit (V12-EDGE-2b, ADR-029) — fire-and-forget
  writeAnalyticsHit(
    c.env.ANALYTICS,
    c.req.method,
    normaliseRoute(c.req.url),
    c.res.status,
    c.env.ENVIRONMENT ?? "production",
  );
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", earlyHintsMiddleware, (c) =>
  c.json({ ok: true, status: "healthy", ts: Date.now() }),
);

// V13-EDGE-5: Canary health endpoint — reveals canary percentage and current tag status
app.get("/api/canary", (c) => {
  const pct = parseInt(c.env.CANARY_PCT ?? "0", 10);
  const tagged = shouldTagCanary(c.env.CANARY_PCT);
  return c.json({ canary: tagged, pct: isNaN(pct) ? 0 : pct, ts: Date.now() });
});

app.get("/api/weather", earlyHintsMiddleware, (c) => handleWeather(new URL(c.req.url), c.env));

app.get("/api/currency", earlyHintsMiddleware, (c) => handleCurrency(c.env));

app.get("/api/hebcal/holidays", (c) => handleHebcalHolidays(new URL(c.req.url), c.env));

app.get("/api/hebcal", earlyHintsMiddleware, (c) => handleHebcal(new URL(c.req.url), c.env));

app.get("/api/stocks", (c) => handleStocks(new URL(c.req.url), c.env));

// ADR-086: Hibernatable WebSocket live stream for stock prices
app.get("/api/stocks/live", (c) => handleStocksLive(c.req.raw, c.env));

app.get("/api/news/aggregate", earlyHintsMiddleware, (c) => handleNewsAggregate(c.env));

app.get("/api/news/summarise", (c) => handleNewsSummarise(c.env));

app.get("/api/news", (c) => handleNews(new URL(c.req.url)));

app.get("/api/alerts", earlyHintsMiddleware, (c) => handleAlerts(c.env));

// V13-EDGE-1: SSE fan-out via ALERTS_DO Durable Object (ADR-025) — legacy path
app.get("/api/alerts/subscribe", (c) => {
  if (!c.env.ALERTS_DO) return c.json({ error: "SSE not available" }, 503);
  const id = c.env.ALERTS_DO.idFromName("global");
  const stub = c.env.ALERTS_DO.get(id);
  const subscribeUrl = new URL(c.req.raw.url);
  subscribeUrl.pathname = "/subscribe";
  return stub.fetch(new Request(subscribeUrl.href, { signal: c.req.raw.signal }));
});

// ADR-089: Hibernatable WebSocket live alert stream (replaces SSE at zero idle CPU cost)
app.get("/api/alerts/live", (c) => {
  if (!c.env.ALERTS_LIVE_DO) return c.json({ error: "alerts WS not available" }, 503);
  const id = c.env.ALERTS_LIVE_DO.idFromName("global");
  const stub = c.env.ALERTS_LIVE_DO.get(id);
  const connectUrl = new URL(c.req.raw.url);
  connectUrl.pathname = "/connect";
  return stub.fetch(new Request(connectUrl.href, c.req.raw));
});

app.get("/api/calendar", (c) => handleCalendar(new URL(c.req.url), c.env));

app.get("/api/sefaria/calendar", (c) => handleSefariaCalendar(c.env));

app.get("/api/sefaria/text", (c) => handleSefariaText(new URL(c.req.url), c.env));

app.get("/api/crypto", earlyHintsMiddleware, (c) => handleCrypto(new URL(c.req.url), c.env));

app.get("/api/motivation/hebrew", (c) => handleMotivationHebrew(c.env));

// Daily AI synthesis tile
app.get("/api/ai/synthesis", (c) => handleAiSynthesis(c.env));

app.get("/api/errors/export", (c) => handleErrorsExport(c.req.raw, c.env));

app.post("/api/errors", (c) => handleErrors(c.req.raw, c.env));

app.get("/api/metrics", (c) => handleMetrics(c.req.raw, c.env));

app.post("/api/reports", (c) => handleReportsIngest(c.req.raw, c.env));

app.get("/api/reports/digest", (c) => handleReportsDigest(c.req.raw, c.env));

// ADR-050: R2 asset caching proxy for background images and media assets
app.get("/api/r2-asset", (c) => handleR2Asset(c.req.raw, c.env));

app.all("*", (c) => c.json({ error: "Not found" }, 404));

// ── Export ────────────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch.bind(app),

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();
    const dow = new Date(event.scheduledTime).getUTCDay(); // 0=Sun … 6=Sat
    // 23:00 UTC Saturday — weekly digest (ADR-033)
    if (hour === 23 && dow === 6) {
      await handleWeeklyDigest(env);
      // Also pre-warm next year on 29 Elul (best-effort — same cron window)
      await handleNextYearPreWarm(env);
    } else if (hour === 23) {
      // 23:00 UTC other days — pre-warm next Hebrew year's holiday list (V12-DATA)
      await handleNextYearPreWarm(env);
    } else {
      await handleScheduled(env);
    }
  },

  async queue(
    batch: { messages: Array<{ body: unknown; ack(): void }> },
    _env: Env,
  ): Promise<void> {
    await handleErrorsQueue(batch);
  },
};
