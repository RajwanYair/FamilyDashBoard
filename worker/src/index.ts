/**
 * FamilyDashBoard API Proxy — Cloudflare Worker
 *
 * Routes:
 *   GET /health                           → Health check
 *   GET /api/weather?lat=X&lon=Y          → Open-Meteo
 *   GET /api/currency                     → ER-API (ILS base)
 *   GET /api/hebcal?geonameid=X           → Hebcal shabbat
 *   GET /api/hebcal/holidays?year=X       → Hebcal holiday list
 *   GET /api/stocks?sym=X                 → Yahoo Finance v8 chart
 *   GET /api/news?url=X                   → RSS feed proxy (allowlisted origins)
 *   GET /api/alerts                       → Tzeva Adom history
 *   GET /api/calendar?url=X              → Google Calendar ICS proxy
 *   GET /api/sefaria/calendar             → Sefaria calendars (Daf Yomi)
 *   GET /api/sefaria/text?ref=X           → Sefaria individual text lookup
 *   GET /api/crypto?ids=bitcoin          → CoinGecko Bitcoin price (validated)
 *   POST /api/errors                      → Client error ingestion (best-effort telemetry)
 */

import { jsonResponse } from "./utils/response";
import { handleWeather, handleCurrency, handleHebcal, handleHebcalHolidays } from "./routes/data";
import {
  handleStocks,
  handleNews,
  handleAlerts,
  handleCalendar,
  handleSefariaCalendar,
  handleSefariaText,
  handleCrypto,
} from "./routes/feeds";
import { handleErrors } from "./routes/errors";
import { isPreflight, handlePreflight } from "./middleware/cors";
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startMs = Date.now();

    // CORS preflight
    if (isPreflight(request)) return handlePreflight();

    // Rate limiting
    const ip = getClientIp(request);
    if (isRateLimited(ip)) return rateLimitResponse();

    const url = new URL(request.url);
    const path = url.pathname;

    let response: Response;
    try {
      if (path === "/health")
        response = jsonResponse({ ok: true, status: "healthy", ts: Date.now() });
      else if (path === "/api/weather") response = await handleWeather(url, env);
      else if (path === "/api/currency") response = await handleCurrency(env);
      else if (path === "/api/hebcal") response = await handleHebcal(url, env);
      else if (path === "/api/hebcal/holidays") response = await handleHebcalHolidays(url, env);
      else if (path === "/api/stocks") response = await handleStocks(url, env);
      else if (path === "/api/news") response = await handleNews(url);
      else if (path === "/api/alerts") response = await handleAlerts(env);
      else if (path === "/api/calendar") response = await handleCalendar(url);
      else if (path === "/api/sefaria/calendar") response = await handleSefariaCalendar();
      else if (path === "/api/sefaria/text") response = await handleSefariaText(url);
      else if (path === "/api/crypto") response = await handleCrypto(url, env);
      else if (path === "/api/errors") response = await handleErrors(request);
      else response = jsonResponse({ error: "Not found" }, 404);
    } catch {
      response = jsonResponse({ error: "Internal error" }, 500);
    }

    // Inject rate-limit info headers so clients can track their quota
    const remaining = getRemainingRequests(ip);
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
    headers.set("X-RateLimit-Remaining", String(remaining));

    const finalResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    logRequest(request, finalResponse, startMs, ip);
    return finalResponse;
  },
};
