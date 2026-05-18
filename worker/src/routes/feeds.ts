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
import {
  safeParse,
  StocksChartSchema,
  CoinGeckoSchema,
  NewsRssSchema,
  AlertsSchema,
  SefariaCalendarSchema,
  SefariaTextSchema,
  FinnhubQuoteSchema,
} from "../utils/schemas";
import { kvGetStale, kvPut } from "../utils/kv";
import { parseRss } from "../utils/rss-parser";
import {
  simHash,
  isNearDuplicate,
  getEmbedding,
  isNearDuplicateByEmbedding,
} from "../utils/simhash";
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

  // ── Helper: return raw chart JSON (no envelope — client expects YahooChartResponse directly) ──
  const rawChartResponse = (data: unknown, maxAge: number): Response =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${maxAge}`,
        ...CORS_HEADERS,
      },
    });

  // ── Primary: Finnhub (requires FINNHUB_API_KEY Worker secret) ────────────
  if (env.FINNHUB_API_KEY) {
    try {
      const finnhubRes = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encoded}&token=${env.FINNHUB_API_KEY}`,
        { headers: { "User-Agent": "FamilyDashBoard/12.0", Accept: "application/json" } },
      );
      if (finnhubRes.ok) {
        const finnhubData: unknown = await finnhubRes.json();
        const finnhubParsed = safeParse(FinnhubQuoteSchema, finnhubData);
        if (finnhubParsed.ok) {
          // Normalise to Yahoo chart envelope so the client needs no changes.
          const normalised = {
            chart: {
              result: [
                {
                  meta: {
                    symbol: sym.toUpperCase(),
                    currency: "USD",
                    regularMarketPrice: finnhubParsed.data.c,
                    previousClose: finnhubParsed.data.c - finnhubParsed.data.d,
                    regularMarketChangePercent: finnhubParsed.data.dp,
                  },
                  indicators: {
                    quote: [
                      {
                        close: [finnhubParsed.data.c - finnhubParsed.data.d, finnhubParsed.data.c],
                      },
                    ],
                  },
                },
              ],
              error: null,
            },
          };
          void kvPut(env.CACHE_KV, kvKey, normalised, 3600);
          return rawChartResponse(normalised, 300);
        }
      }
    } catch {
      // Finnhub unreachable — fall through to Yahoo
    }
  }

  // ── Secondary: Yahoo Finance (query1 then query2) ─────────────────────────
  let lastSchemaError: string | undefined;
  const yahooHosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"] as const;
  for (const host of yahooHosts) {
    try {
      const upstream = await fetch(
        `https://${host}/v8/finance/chart/${encoded}?interval=1d&range=1d`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FamilyDashBoard/12.0)",
            Accept: "application/json",
            Origin: "https://finance.yahoo.com",
            Referer: "https://finance.yahoo.com/",
          },
        },
      );
      if (!upstream.ok) continue;
      const data: unknown = await upstream.json();
      const validated = safeParse(StocksChartSchema, data);
      if (validated.ok) {
        void kvPut(env.CACHE_KV, kvKey, validated.data, 86400);
        return rawChartResponse(validated.data, 300);
      }
      lastSchemaError = validated.error;
      break; // Same schema error on both hosts — skip to fallback
    } catch {
      continue;
    }
  }

  // ── Tertiary: KV stale ────────────────────────────────────────────────────
  const staleKv = await kvGetStale(env.CACHE_KV, kvKey);
  if (staleKv) return rawChartResponse(staleKv, 60);

  return jsonResponse(
    {
      error: lastSchemaError
        ? `Upstream stocks schema invalid — all providers failed`
        : "All stock providers failed",
      ...(lastSchemaError ? { detail: lastSchemaError } : {}),
    },
    502,
  );
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
    // owasp-allow:A05 — Cloudflare Worker runtime
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
      const res = await fetch(url, { // owasp-allow:A10 — url from hardcoded NEWS_FEED_URLS constant
        headers: {
          "User-Agent": "FamilyDashBoard/11.0",
          Accept: "application/rss+xml, text/xml, application/xml",
        },
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

  // Deduplicate: exact URL first, then SimHash near-duplicate on title
  const seenUrls = new Set<string>();
  const hashes: bigint[] = [];
  const unique = allItems.filter((item) => {
    // Exact-URL dedup
    if (seenUrls.has(item.link)) return false;
    seenUrls.add(item.link);

    // SimHash near-duplicate dedup on title
    const fingerprint = simHash(item.title);
    if (hashes.some((h) => isNearDuplicate(fingerprint, h))) return false;
    hashes.push(fingerprint);
    return true;
  });

  // V13-AI-2: Optional embedding-based near-duplicate fallback pass.
  // Only runs when Workers AI is bound (env.AI) — if not bound, skip silently.
  // Runs after SimHash to catch semantically-similar headlines that differ in wording.
  // Uses @cf/baai/bge-small-en-v1.5 (384-dim, ~33 ms per item on Workers Free).
  // Bounded to the first 40 items to avoid excessive AI inference cost.
  let embeddingDeduped: NewsAggItem[] = unique;
  if (env.AI) {
    const EMBED_LIMIT = 40;
    const toEmbed = unique.slice(0, EMBED_LIMIT);
    const rest = unique.slice(EMBED_LIMIT);
    const embeddings: (number[] | null)[] = await Promise.all(
      toEmbed.map((item) => getEmbedding(env.AI!, item.title)),
    );
    const embeddingPassed: NewsAggItem[] = [];
    const embeddingVecs: number[][] = [];
    for (let i = 0; i < toEmbed.length; i++) {
      const vec = embeddings[i];
      if (!vec) {
        // Embedding failed for this item — keep it (fail-open)
        embeddingPassed.push(toEmbed[i]!);
        continue;
      }
      const isDup = embeddingVecs.some((seen) => isNearDuplicateByEmbedding(vec, seen));
      if (!isDup) {
        embeddingPassed.push(toEmbed[i]!);
        embeddingVecs.push(vec);
      }
    }
    embeddingDeduped = [...embeddingPassed, ...rest];
  }

  // Sort newest-first (items without a valid date go to end)
  embeddingDeduped.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const payload = embeddingDeduped.slice(0, 100);

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
    console.warn(`[alerts] Valibot validation warning: ${validated.error}`);
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
  const res = await fetch(parsed.toString()); // owasp-allow:A05 — Cloudflare Worker runtime
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
  const res = await fetch("https://www.sefaria.org/api/calendars"); // owasp-allow:A05 — Cloudflare Worker runtime
  if (!res.ok) {
    const stale = await kvGetStale<Record<string, unknown>>(env.CACHE_KV, kvKey);
    if (stale) return jsonResponse(stale, 200);
    return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  }
  const data: unknown = await res.json();
  const validated = safeParse(SefariaCalendarSchema, data);
  if (!validated.ok) {
    // V13-DATA strict mode: invalid response → try KV stale, then 502
    console.error(`[sefaria:calendar] Valibot strict validation failed: ${validated.error}`);
    const stale = await kvGetStale<Record<string, unknown>>(env.CACHE_KV, kvKey);
    if (stale) return jsonResponse(stale, 200);
    return jsonResponse(
      { error: "Upstream response failed validation", detail: validated.error },
      502,
    );
  }
  void kvPut(env.CACHE_KV, kvKey, validated.data, 86400);
  return new Response(JSON.stringify(validated.data), {
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
  const res = await fetch(`https://www.sefaria.org/api/v3/texts/${encoded}?context=0&pad=0`); // owasp-allow:A05 — Cloudflare Worker runtime
  if (!res.ok) {
    const stale = await kvGetStale<Record<string, unknown>>(env.CACHE_KV, kvKey);
    if (stale) return jsonResponse(stale, 200);
    return jsonResponse({ error: `Upstream ${res.status}` }, 502);
  }
  const data: unknown = await res.json();
  const validated = safeParse(SefariaTextSchema, data);
  if (!validated.ok) {
    // V13-DATA strict mode: invalid response → try KV stale, then 502
    console.error(`[sefaria:text] Valibot strict validation failed: ${validated.error}`);
    const stale = await kvGetStale<Record<string, unknown>>(env.CACHE_KV, kvKey);
    if (stale) return jsonResponse(stale, 200);
    return jsonResponse(
      { error: "Upstream response failed validation", detail: validated.error },
      502,
    );
  }
  void kvPut(env.CACHE_KV, kvKey, validated.data, 86400);
  return new Response(JSON.stringify(validated.data), {
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

// ── Stocks Live WebSocket (ADR-086, S-DO) ─────────────────────────────────────

/**
 * Upgrade handler for GET /api/stocks/live — forwards the WebSocket connection
 * to the StocksLiveDO Durable Object using the Hibernation API.
 *
 * The DO class is named per-symbol-group via a deterministic shard key so that
 * up to `MAX_STOCKS_SHARDS` independent DOs each serve a subset of tickers,
 * keeping per-DO connection counts low.
 *
 * Returns 501 when the `STOCKS_DO` binding is not configured (local dev / unit tests).
 */
const MAX_STOCKS_SHARDS = 4;

export async function handleStocksLive(request: Request, env: Env): Promise<Response> {
  if (!env.STOCKS_DO) {
    return jsonResponse({ error: "stocks_ws_not_configured" }, 501);
  }

  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return new Response("This endpoint requires a WebSocket Upgrade", { status: 426 });
  }

  const url = new URL(request.url);
  const rawSyms = url.searchParams.get("sym") ?? "";

  // Derive shard key from first symbol to distribute load.
  const firstSym = rawSyms.split(",")[0]?.trim().toUpperCase() ?? "DEFAULT";
  const shard = firstSym.charCodeAt(0) % MAX_STOCKS_SHARDS;
  const doId = env.STOCKS_DO.idFromName(`stocks-shard-${shard}`);
  const stub = env.STOCKS_DO.get(doId);

  // Forward the WebSocket upgrade to the DO.
  const doRequest = new Request(`${url.origin}/connect?sym=${encodeURIComponent(rawSyms)}`, {
    headers: request.headers,
  });
  return stub.fetch(doRequest);
}

