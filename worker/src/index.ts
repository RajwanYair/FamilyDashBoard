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

import { CORS_HEADERS, jsonResponse } from "./utils/response";
import { handleWeather, handleCurrency, handleHebcal, handleHebcalHolidays } from "./routes/data";
import { handleStocks, handleNews, handleAlerts, handleCalendar, handleSefariaCalendar } from "./routes/feeds";

export interface Env {
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/health")
        return jsonResponse({ ok: true, status: "healthy", ts: Date.now() });
      if (path === "/api/weather") return await handleWeather(url);
      if (path === "/api/currency") return await handleCurrency();
      if (path === "/api/hebcal") return await handleHebcal(url);
      if (path === "/api/hebcal/holidays")
        return await handleHebcalHolidays(url);
      if (path === "/api/stocks") return await handleStocks(url);
      if (path === "/api/news") return await handleNews(url);
      if (path === "/api/alerts") return await handleAlerts();
      if (path === "/api/calendar") return await handleCalendar(url);
      if (path === "/api/sefaria/calendar")
        return await handleSefariaCalendar();

      return jsonResponse({ error: "Not found" }, 404);
    } catch {
      return jsonResponse({ error: "Internal error" }, 500);
    }
  },
};

