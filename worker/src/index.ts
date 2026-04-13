/**
 * FamilyDashBoard API Proxy — Cloudflare Worker
 *
 * Eliminates CORS proxy chain by fetching APIs server-to-server.
 * Routes:
 *   GET /api/weather?lat=X&lon=Y     → Open-Meteo
 *   GET /api/stocks?symbols=X,Y,Z    → Yahoo Finance
 *   GET /api/news?feeds=X,Y          → RSS proxy
 *   GET /api/currency                → ER-API
 *   GET /api/calendar?url=X          → ICS proxy
 *   GET /api/alerts                  → Pikud HaOref
 *   GET /api/hebcal?geonameid=X      → Hebcal API
 */

export interface Env {
  ENVIRONMENT: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://rajwanyair.github.io",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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
      // TODO: Add more routes as cards are migrated

      return jsonResponse({ error: "Not found" }, 404);
    } catch (err) {
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
