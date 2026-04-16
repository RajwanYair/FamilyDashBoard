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
 */

import { jsonResponse } from "./utils/response";
import { handleWeather, handleCurrency, handleHebcal, handleHebcalHolidays } from "./routes/data";
import { handleStocks, handleNews, handleAlerts, handleCalendar, handleSefariaCalendar } from "./routes/feeds";
import { isPreflight, handlePreflight } from "./middleware/cors";
import { isRateLimited, getClientIp, rateLimitResponse } from "./middleware/rate-limit";
import { logRequest } from "./middleware/log";

export interface Env {
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
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
      else if (path === "/api/weather") response = await handleWeather(url);
      else if (path === "/api/currency") response = await handleCurrency();
      else if (path === "/api/hebcal") response = await handleHebcal(url);
      else if (path === "/api/hebcal/holidays") response = await handleHebcalHolidays(url);
      else if (path === "/api/stocks") response = await handleStocks(url);
      else if (path === "/api/news") response = await handleNews(url);
      else if (path === "/api/alerts") response = await handleAlerts();
      else if (path === "/api/calendar") response = await handleCalendar(url);
      else if (path === "/api/sefaria/calendar") response = await handleSefariaCalendar();
      else response = jsonResponse({ error: "Not found" }, 404);
    } catch {
      response = jsonResponse({ error: "Internal error" }, 500);
    }

    logRequest(request, response, startMs, ip);
    return response;
  },
};

