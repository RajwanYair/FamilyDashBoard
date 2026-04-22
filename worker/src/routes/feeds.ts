import { jsonResponse, workerEnvelope, CORS_HEADERS } from "../utils/response";
import {
  ALLOWED_NEWS_ORIGINS,
  ALLOWED_CALENDAR_ORIGINS,
  NEWS_FEED_URLS,
} from "../utils/allowlists";
import {
  ValidationError,
  validationErrorResponse,
  requireSymbol,
  requireHttpsUrl,
} from "../utils/validation";
import { safeParse, StocksChartSchema, CoinGeckoSchema, NewsRssSchema, AlertsSchema, SefariaCalendarSchema, SefariaTextSchema } from "../utils/schemas";
import { kvGetStale, kvPut } from "../utils/kv";
import { parseRss } from "../utils/rss-parser";
import type { Env } from "../types";

export async function handleStocks(url: URL, env: Env): Promise<Response> {
  let sym: string;
  try {
    sym = requireSymbol(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const kvKey = `stocks:${sym.toUpperCase()}`;
  const encoded = encodeURIComponent(sym);
  const upstream = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`,
    { headers: { "User-Agent": "FamilyDashBoard/6.0" } },
  );
  if (!upstream.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "yahoo-kv-stale", true, 60);
    return jsonResponse({ error: `Upstream ${upstream.status}` }, 502);
  }
  const data: unknown = await upstream.json();
  const validated = safeParse(StocksChartSchema, data);
  if (!validated.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "yahoo-kv-stale", true, 60);
    return jsonResponse({ error: "Upstream stocks schema invalid", detail: validated.error }, 502);
  }
  // Write to KV for future stale fallback (24 h TTL)
  void kvPut(env.CACHE_KV, kvKey, validated.data, 86400);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      ...CORS_HEADERS,
    },
  });
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
  if (!res.ok) return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  const text = await res.text();
  const validated = safeParse(NewsRssSchema, text);
  if (!validated.ok) {
    return jsonResponse(
      {
        error: "Upstream news response is not valid RSS/Atom",
        detail: validated.error,
      },
      502,
    );
  }
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/rss+xml",
      "Cache-Control": "public, max-age=900",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Aggregate all curated RSS feeds into a single normalised JSON array.
 * GET /api/news/aggregate
 *
 * Fetches all NEWS_FEED_URLS in parallel (Promise.allSettled),
 * deduplicates by first 40 chars of title, sorts by date (newest first),
 * caps at 100 items, and caches in KV for 15 min.
 */
export async function handleNewsAggregate(env: Env): Promise<Response> {
  const KV_KEY = "news:aggregate";
  const TTL = 900; // 15 min

  type NewsAggItem = {
    title: string;
    link: string;
    pubDate: string;
    source: string;
    description?: string;
  };

  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    NEWS_FEED_URLS.map(async ({ url, src }) => {
      const res = await fetch(url, {
        headers: { "User-Agent": "FamilyDashBoard/11.0", Accept: "application/rss+xml, text/xml, application/xml" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [] as NewsAggItem[];
      const text = await res.text();
      return parseRss(text, src, 25) as NewsAggItem[];
    }),
  );

  const allItems: NewsAggItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }

  // Deduplicate by first 40 chars of title
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    const key = item.title.trim().substring(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort newest-first (items without a valid date go to end)
  unique.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const payload = unique.slice(0, 100);

  if (payload.length === 0) {
    const stale = await kvGetStale(env.CACHE_KV, KV_KEY);
    if (stale) return workerEnvelope(stale, "news-agg-kv-stale", true, 60);
    return jsonResponse({ error: "All news feeds failed" }, 502);
  }

  void kvPut(env.CACHE_KV, KV_KEY, payload, TTL);
  return workerEnvelope(payload, "news-agg", false, TTL);
}

export async function handleAlerts(env: Env): Promise<Response> {
  const kvKey = "alerts:tzevaadom";
  const res = await fetch("https://api.tzevaadom.co.il/alerts-history", {
    headers: {
      "User-Agent": "FamilyDashBoard/6.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "tzevaadom-kv-stale", true, 60);
    return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  }
  const data: unknown = await res.json();
  const validated = safeParse(AlertsSchema, data);
  if (!validated.ok) {
    // Log but don't block — fall back to raw upstream data so the client
    // still gets something rather than a hard 502.
    console.warn(`[alerts] Zod validation warning: ${validated.error}`);
  }
  const payload = validated.ok ? validated.data : data;
  // Write to KV for future stale fallback (1 h TTL — alerts are time-sensitive)
  void kvPut(env.CACHE_KV, kvKey, payload, 3600);
  return workerEnvelope(payload, "tzevaadom", false, 60); // 1 min
}

export async function handleCalendar(url: URL, env: Env): Promise<Response> {
  let parsed: URL;
  try {
    parsed = requireHttpsUrl(url, "url");
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  if (!ALLOWED_CALENDAR_ORIGINS.some((origin) => parsed.hostname.endsWith(origin))) {
    return jsonResponse({ error: "Calendar origin not permitted", param: "url" }, 403);
  }

  // KV key: cap to 80 chars to stay within KV key limits
  const kvKey = `calendar:${parsed.hostname}${parsed.pathname}`.slice(0, 80);
  const res = await fetch(parsed.toString());
  if (!res.ok) {
    const stale = await kvGetStale<{ ics: string }>(env.CACHE_KV, kvKey);
    if (stale?.ics) {
      return new Response(stale.ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "public, max-age=900",
          "X-Cache": "kv-stale",
          ...CORS_HEADERS,
        },
      });
    }
    return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  }
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    return jsonResponse({ error: "Not a valid ICS response" }, 502);
  }
  void kvPut(env.CACHE_KV, kvKey, { ics: text }, 900);
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=900",
      ...CORS_HEADERS,
    },
  });
}

export async function handleSefariaCalendar(env: Env): Promise<Response> {
  const kvKey = "sefaria:calendar";
  const res = await fetch("https://www.sefaria.org/api/calendars");
  if (!res.ok) {
    const stale = await kvGetStale<Record<string, unknown>>(env.CACHE_KV, kvKey);
    if (stale) return jsonResponse(stale, 200);
    return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  }
  const data: unknown = await res.json();
  const validated = safeParse(SefariaCalendarSchema, data);
  if (!validated.ok) {
    console.warn(`[sefaria:calendar] Zod validation warning: ${validated.error}`);
  }
  const payload = validated.ok ? validated.data : data;
  void kvPut(env.CACHE_KV, kvKey, payload, 86400);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Proxy an individual Sefaria text by reference.
 * GET /api/sefaria/text?ref=Berakhot.2a.1
 */
export async function handleSefariaText(url: URL, env: Env): Promise<Response> {
  const ref = url.searchParams.get("ref");
  if (!ref || ref.trim() === "") {
    return jsonResponse({ error: "Missing required parameter: ref", param: "ref" }, 400);
  }
  // Allow only safe characters in a Sefaria ref (letters, digits, space, period, colon, underscore, hyphen)
  if (!/^[\w\s.:_\-,()]{1,120}$/.test(ref)) {
    return jsonResponse({ error: "Invalid ref format", param: "ref" }, 400);
  }
  const kvKey = `sefaria:text:${encodeURIComponent(ref.trim()).slice(0, 50)}`;
  const encoded = encodeURIComponent(ref.trim());
  const res = await fetch(`https://www.sefaria.org/api/v3/texts/${encoded}?context=0&pad=0`);
  if (!res.ok) {
    const stale = await kvGetStale<Record<string, unknown>>(env.CACHE_KV, kvKey);
    if (stale) return jsonResponse(stale, 200);
    return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  }
  const data: unknown = await res.json();
  const validated = safeParse(SefariaTextSchema, data);
  if (!validated.ok) {
    console.warn(`[sefaria:text] Zod validation warning: ${validated.error}`);
  }
  const payload = validated.ok ? validated.data : data;
  void kvPut(env.CACHE_KV, kvKey, payload, 86400);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Proxy CoinGecko Bitcoin price data.
 * GET /api/crypto?ids=bitcoin&vs_currencies=usd
 * Returns CoinGecko simple/price JSON, validated with CoinGeckoSchema.
 */
export async function handleCrypto(url: URL, env: Env): Promise<Response> {
  const ids = url.searchParams.get("ids") ?? "bitcoin";
  const vsCurrencies = url.searchParams.get("vs_currencies") ?? "usd";

  // Only permit bitcoin to prevent abuse
  if (ids !== "bitcoin") {
    return jsonResponse({ error: "Only bitcoin is supported", param: "ids" }, 400);
  }

  const kvKey = `crypto:bitcoin:${vsCurrencies}`;
  const upstream = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vsCurrencies)}&include_24hr_change=true`,
    { headers: { "User-Agent": "FamilyDashBoard/8.0", Accept: "application/json" } },
  );
  if (!upstream.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "coingecko-kv-stale", true, 60);
    return jsonResponse({ error: `Upstream ${upstream.status}` }, 502);
  }

  const data: unknown = await upstream.json();
  const validated = safeParse(CoinGeckoSchema, data);
  if (!validated.ok) {
    const stale = await kvGetStale(env.CACHE_KV, kvKey);
    if (stale) return workerEnvelope(stale, "coingecko-kv-stale", true, 60);
    return jsonResponse({ error: "Upstream crypto schema invalid", detail: validated.error }, 502);
  }
  // Write to KV for future stale fallback (24 h TTL)
  void kvPut(env.CACHE_KV, kvKey, validated.data, 86400);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      ...CORS_HEADERS,
    },
  });
}
