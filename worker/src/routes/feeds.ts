import { jsonResponse, proxyResponse, CORS_HEADERS } from "../utils/response";
import { ALLOWED_NEWS_ORIGINS, ALLOWED_CALENDAR_ORIGINS } from "../utils/allowlists";
import {
  ValidationError,
  validationErrorResponse,
  requireSymbol,
  requireHttpsUrl,
} from "../utils/validation";

export async function handleStocks(url: URL): Promise<Response> {
  let sym: string;
  try {
    sym = requireSymbol(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const encoded = encodeURIComponent(sym);
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`,
    { headers: { "User-Agent": "FamilyDashBoard/6.0" } },
  );
  return proxyResponse(res, 300); // 5 min
}

export async function handleNews(url: URL): Promise<Response> {
  let parsed: URL;
  try {
    parsed = requireHttpsUrl(url, "url");
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  if (!ALLOWED_NEWS_ORIGINS.some((origin) => parsed.hostname === origin)) {
    return jsonResponse({ error: "News feed origin not permitted", param: "url" }, 403);
  }

  const res = await fetch(parsed.toString(), {
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
  let parsed: URL;
  try {
    parsed = requireHttpsUrl(url, "url");
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  if (
    !ALLOWED_CALENDAR_ORIGINS.some((origin) => parsed.hostname.endsWith(origin))
  ) {
    return jsonResponse({ error: "Calendar origin not permitted", param: "url" }, 403);
  }

  const res = await fetch(parsed.toString());
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

/**
 * Proxy an individual Sefaria text by reference.
 * GET /api/sefaria/text?ref=Berakhot.2a.1
 */
export async function handleSefariaText(url: URL): Promise<Response> {
  const ref = url.searchParams.get("ref");
  if (!ref || ref.trim() === "") {
    return jsonResponse({ error: "Missing required parameter: ref", param: "ref" }, 400);
  }
  // Allow only safe characters in a Sefaria ref (letters, digits, space, period, colon, underscore, hyphen)
  if (!/^[\w\s.:_\-,()]{1,120}$/.test(ref)) {
    return jsonResponse({ error: "Invalid ref format", param: "ref" }, 400);
  }
  const encoded = encodeURIComponent(ref.trim());
  const res = await fetch(`https://www.sefaria.org/api/v3/texts/${encoded}?context=0&pad=0`);
  return proxyResponse(res, 86400); // 24 h — text content is stable
}
