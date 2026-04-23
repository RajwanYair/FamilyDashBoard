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
 *   GET /api/news?url=X                   → RSS feed proxy (allowlisted origins)
 *   GET /api/news/aggregate               → Aggregate all 16 curated RSS feeds
 *   GET /api/alerts                       → Tzeva Adom history
 *   GET /api/calendar?url=X              → Google Calendar ICS proxy
 *   GET /api/sefaria/calendar             → Sefaria calendars (Daf Yomi)
 *   GET /api/sefaria/text?ref=X           → Sefaria individual text lookup
 *   GET /api/crypto?ids=bitcoin          → CoinGecko Bitcoin price (validated)
 *   POST /api/errors                      → Client error ingestion (best-effort telemetry)
 *   GET  /api/metrics                     → Prometheus text metrics (token-gated, D1-backed)
 *   POST /api/reports                     → Browser Reporting API ingest (CSP + deprecation + intervention)
 *   GET  /api/reports/digest              → Report summary digest (token-gated, D1-backed, ADR-028)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
// ── Durable Objects (V12-EDGE-3) — re-exported for wrangler binding ───────────
export { AlertsOrchestrator } from "./durable-objects/alerts-orchestrator";
import { handleWeather, handleCurrency, handleHebcal, handleHebcalHolidays } from "./routes/data";
import {
  handleStocks,
  handleNews,
  handleNewsAggregate,
  handleAlerts,
  handleCalendar,
  handleSefariaCalendar,
  handleSefariaText,
  handleCrypto,
} from "./routes/feeds";
import { handleErrors, handleErrorsExport } from "./routes/errors";
import { handleMetrics } from "./routes/metrics";
import { handleReportsIngest, handleReportsDigest } from "./routes/reports";
import { handleScheduled, handleNextYearPreWarm } from "./routes/cron";
import {
  isRateLimited,
  getClientIp,
  rateLimitResponse,
  getRemainingRequests,
  MAX_REQUESTS_PER_WINDOW,
} from "./middleware/rate-limit";
import { logRequest } from "./middleware/log";
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

// Rate limiting + request logging middleware
app.use("*", async (c, next) => {
  const ip = getClientIp(c.req.raw);
  if (isRateLimited(ip)) return rateLimitResponse();

  const startMs = Date.now();
  await next();

  // Inject rate-limit info headers
  c.res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
  c.res.headers.set("X-RateLimit-Remaining", String(getRemainingRequests(ip)));

  logRequest(c.req.raw, c.res, startMs, ip);
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ ok: true, status: "healthy", ts: Date.now() }),
);

app.get("/api/weather", (c) =>
  handleWeather(new URL(c.req.url), c.env),
);

app.get("/api/currency", (c) =>
  handleCurrency(c.env),
);

app.get("/api/hebcal/holidays", (c) =>
  handleHebcalHolidays(new URL(c.req.url), c.env),
);

app.get("/api/hebcal", (c) =>
  handleHebcal(new URL(c.req.url), c.env),
);

app.get("/api/stocks", (c) =>
  handleStocks(new URL(c.req.url), c.env),
);

app.get("/api/news/aggregate", (c) =>
  handleNewsAggregate(c.env),
);

app.get("/api/news", (c) =>
  handleNews(new URL(c.req.url)),
);

app.get("/api/alerts", (c) =>
  handleAlerts(c.env),
);

app.get("/api/calendar", (c) =>
  handleCalendar(new URL(c.req.url), c.env),
);

app.get("/api/sefaria/calendar", (c) =>
  handleSefariaCalendar(c.env),
);

app.get("/api/sefaria/text", (c) =>
  handleSefariaText(new URL(c.req.url), c.env),
);

app.get("/api/crypto", (c) =>
  handleCrypto(new URL(c.req.url), c.env),
);

app.get("/api/errors/export", (c) =>
  handleErrorsExport(c.req.raw, c.env),
);

app.post("/api/errors", (c) =>
  handleErrors(c.req.raw, c.env),
);

app.get("/api/metrics", (c) =>
  handleMetrics(c.req.raw, c.env),
);

app.post("/api/reports", (c) =>
  handleReportsIngest(c.req.raw, c.env),
);

app.get("/api/reports/digest", (c) =>
  handleReportsDigest(c.req.raw, c.env),
);

app.all("*", (c) => c.json({ error: "Not found" }, 404));

// ── Export ────────────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch.bind(app),

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // 23:00 UTC — pre-warm next Hebrew year's holiday list (V12-DATA)
    if (new Date(event.scheduledTime).getUTCHours() === 23) {
      await handleNextYearPreWarm(env);
    } else {
      await handleScheduled(env);
    }
  },
};
