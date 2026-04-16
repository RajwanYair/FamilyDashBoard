import { jsonResponse, proxyResponse, CORS_HEADERS } from "../utils/response";
import { ALLOWED_NEWS_ORIGINS, ALLOWED_CALENDAR_ORIGINS } from "../utils/allowlists";

export async function handleStocks(url: URL): Promise<Response> {
  const sym = url.searchParams.get("sym");
  if (!sym) return jsonResponse({ error: "Missing sym parameter" }, 400);
  if (!/^[\w.\-^]{1,20}$/.test(sym)) {
    return jsonResponse({ error: "Invalid symbol" }, 400);
  }
  const encoded = encodeURIComponent(sym);
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`,
    { headers: { "User-Agent": "FamilyDashBoard/6.0" } },
  );
  return proxyResponse(res, 300); // 5 min
}

export async function handleNews(url: URL): Promise<Response> {
  const feedUrl = url.searchParams.get("url");
  if (!feedUrl) return jsonResponse({ error: "Missing url parameter" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  if (parsed.protocol !== "https:") {
    return jsonResponse({ error: "Only HTTPS feeds allowed" }, 400);
  }
  if (!ALLOWED_NEWS_ORIGINS.some((origin) => parsed.hostname === origin)) {
    return jsonResponse({ error: "News feed origin not permitted" }, 403);
  }

  const res = await fetch(feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  return proxyResponse(res, 900); // 15 min
}

export async function handleAlerts(): Promise<Response> {
  const res = await fetch("https://api.tzevaadom.co.il/alerts-history", {
    headers: {
      "User-Agent": "FamilyDashBoard/6.0",
      Accept: "application/json",
    },
  });
  return proxyResponse(res, 60); // 1 min
}

export async function handleCalendar(url: URL): Promise<Response> {
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

export async function handleSefariaCalendar(): Promise<Response> {
  const res = await fetch("https://www.sefaria.org/api/calendars");
  return proxyResponse(res, 86400); // 24 h
}
