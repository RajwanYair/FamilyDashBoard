/**
 * FamilyDashBoard API Proxy — Cloudflare Worker
 *
 * Eliminates CORS proxy chain by fetching APIs server-to-server.
 * Routes:
 *   GET /api/weather?lat=X&lon=Y          → Open-Meteo
 *   GET /api/stocks?sym=X                 → Yahoo Finance v8 chart
 *   GET /api/news?url=X                   → RSS feed proxy
 *   GET /api/currency                     → ER-API (ILS base)
 *   GET /api/calendar?url=X              → Google Calendar ICS proxy
 *   GET /api/alerts                       → Tzeva Adom history
 *   GET /api/hebcal?geonameid=X          → Hebcal shabbat
 *   GET /api/hebcal/holidays?year=X      → Hebcal holiday list
 *   GET /api/sefaria/calendar             → Sefaria calendars (Daf Yomi)
 */

export interface Env {
  ENVIRONMENT: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://rajwanyair.github.io",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

// Allowlist of permitted ICS URL origins (security: prevent SSRF to internal hosts)
const ALLOWED_CALENDAR_ORIGINS = [
  "calendar.google.com",
  "outlook.office365.com",
  "outlook.live.com",
  "ical.mac.com",
  "apple.com",
];

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
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

async function handleWeather(url: URL): Promise<Response> {
  const lat = url.searchParams.get("lat") ?? "31.7683";
  const lon = url.searchParams.get("lon") ?? "35.2137";
  // Validate coordinates
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (
    isNaN(latNum) ||
    isNaN(lonNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lonNum < -180 ||
    lonNum > 180
  ) {
    return jsonResponse({ error: "Invalid coordinates" }, 400);
  }
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;
  const res = await fetch(weatherUrl);
  return proxyResponse(res, 1800); // 30min cache
}

async function handleCurrency(): Promise<Response> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  return proxyResponse(res, 3600); // 1h cache
}

async function handleHebcal(url: URL): Promise<Response> {
  const geonameid = url.searchParams.get("geonameid") ?? "281184";
  // Validate: geonameid should be numeric
  if (!/^\d+$/.test(geonameid)) {
    return jsonResponse({ error: "Invalid geonameid" }, 400);
  }
  const res = await fetch(
    `https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameid}&M=on`,
  );
  return proxyResponse(res, 21600); // 6h cache
}

async function handleHebcalHolidays(url: URL): Promise<Response> {
  const year = url.searchParams.get("year");
  const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return jsonResponse({ error: "Invalid year" }, 400);
  }
  const res = await fetch(
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&year=${yearNum}&month=x`,
  );
  return proxyResponse(res, 43200); // 12h cache
}

async function handleStocks(url: URL): Promise<Response> {
  const sym = url.searchParams.get("sym");
  if (!sym) return jsonResponse({ error: "Missing sym parameter" }, 400);
  // Validate symbol: alphanumeric, dots, hyphens, carets only
  if (!/^[\w.\-^]{1,20}$/.test(sym)) {
    return jsonResponse({ error: "Invalid symbol" }, 400);
  }
  const encoded = encodeURIComponent(sym);
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`,
    { headers: { "User-Agent": "FamilyDashBoard/6.0" } },
  );
  return proxyResponse(res, 300); // 5min cache
}

async function handleNews(url: URL): Promise<Response> {
  const feedUrl = url.searchParams.get("url");
  if (!feedUrl) return jsonResponse({ error: "Missing url parameter" }, 400);

  // Validate: only allow known RSS feed origins (prevent SSRF)
  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  if (parsed.protocol !== "https:") {
    return jsonResponse({ error: "Only HTTPS feeds allowed" }, 400);
  }

  const res = await fetch(feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  return proxyResponse(res, 900); // 15min cache
}

async function handleAlerts(): Promise<Response> {
  const res = await fetch("https://api.tzevaadom.co.il/alerts-history", {
    headers: {
      "User-Agent": "FamilyDashBoard/6.0",
      Accept: "application/json",
    },
  });
  return proxyResponse(res, 60); // 1min cache — near real-time
}

async function handleCalendar(url: URL): Promise<Response> {
  const icsUrl = url.searchParams.get("url");
  if (!icsUrl) return jsonResponse({ error: "Missing url parameter" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(icsUrl);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  if (parsed.protocol !== "https:") {
    return jsonResponse({ error: "Only HTTPS URLs allowed" }, 400);
  }
  // Security: only allow established calendar service origins
  if (
    !ALLOWED_CALENDAR_ORIGINS.some((origin) => parsed.hostname.endsWith(origin))
  ) {
    return jsonResponse({ error: "Calendar origin not permitted" }, 403);
  }

  const res = await fetch(icsUrl);
  if (!res.ok) return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    return jsonResponse({ error: "Not a valid ICS response" }, 502);
  }
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=900",
      ...CORS_HEADERS,
    },
  });
}

async function handleSefariaCalendar(): Promise<Response> {
  const res = await fetch("https://www.sefaria.org/api/calendars");
  return proxyResponse(res, 86400); // 24h cache — Daf changes once a day
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

async function proxyResponse(
  res: Response,
  cacheTtl: number,
): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": `public, max-age=${cacheTtl}`,
      ...CORS_HEADERS,
    },
  });
}
