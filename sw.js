/* FamilyDashBoard ServiceWorker — v13.34.0
 * APP_SHELL pre-cache · API network-first with offline fallback
 * NETWORK_BACK broadcast on reconnection · VERSION_ACTIVATED on activate
 * v13.6.0: coverage ratchet (moon-phase+GPU) · LHCI perf ≥0.97 · NWS US-travel mode · @vitest/browser scaffold · motivation non-repeat window · icalendar fuzz 157→171 · Stryker→error-reporter+diag · V14-HARMONISE README (+41 tests, Sprints 66-73)
 * See CHANGELOG.md for full version history. */

const CACHE_NAME = "familydashboard-v__APP_VERSION__";
const CACHE_NAME_API = "familydashboard-api-v__APP_VERSION__";
// v7.10: APP_SHELL updated — BestDashBoard.html removed, index.html added
// v8.5.0: Stream SW.1 — auto-precache manifest extends APP_SHELL at install
// v8.6.0: Stream SW.2 — background sync error queue (_queueErrorReport, _flushErrorQueue)
// v8.7.0: Stream D2.5/D2.6 — calendar/hebrew-cal/alerts async IDB cache; W.5 Stocks Zod schema; F.3 theme token audit
// v9.1.0: Stream SW.4 — migrated to sw.ts; TypeScript source with strict type checks
// v9.2.0: Worker KV stale fallback (W.9); CSS tile-grid + --card-min-height (F.3); shared tooling presets (I)
const APP_SHELL = ["./index.html", "./manifest.webmanifest", "./sw.js", "./icon.svg"];

/**
 * Stream SW.1: Load the auto-generated precache manifest produced by
 * `scripts/generate-precache.mjs` after each Vite build.
 * Falls back silently to the static APP_SHELL if unavailable (dev mode / first install).
 * @returns {Promise<string[]>}
 */
async function _loadPrecacheManifest() {
  try {
    const resp = await fetch("./sw-precache-manifest.json", {
      cache: "no-store",
    });
    if (!resp.ok) return APP_SHELL;
    /** @type {unknown} */
    const data = await resp.json();
    return Array.isArray(data) && data.length > 0 ? data : APP_SHELL;
  } catch {
    return APP_SHELL;
  }
}

// F162: API origins to cache for offline fallback (direct APIs + CORS proxies)
const API_CACHE_ORIGINS = [
  "api.open-meteo.com",
  "www.hebcal.com",
  "open.er-api.com",
  "exchangerate-api.com",
  // F162 additions — CORS proxies & data providers
  "api.allorigins.win",
  "api.codetabs.com",
  "corsproxy.io",
  // query1.finance.yahoo.com intentionally omitted: all Yahoo requests are
  // routed through the Cloudflare Worker in production. Direct browser fetches
  // to Yahoo are CORS-blocked; keeping the origin here caused the SW to set
  // _networkWasDown=true on every stocks refresh, triggering spurious
  // "Connection restored" toasts.
  "api.coingecko.com",
  "tzevaadom.co.il",
  "sefaria.org",
];

// Stream SW: per-origin TTL (seconds). Default: 3600 s (1 h).
// Mirrors CACHE_TTL_BY_ORIGIN in src/core/sw-constants.ts.
const CACHE_TTL_BY_ORIGIN = {
  "api.coingecko.com": 300,
  "api.open-meteo.com": 1800,
  "open.er-api.com": 1800,
  "exchangerate-api.com": 1800,
  "www.hebcal.com": 21600,
  "sefaria.org": 21600,
  "tzevaadom.co.il": 21600,
  "api.allorigins.win": 600,
  "api.codetabs.com": 600,
  "corsproxy.io": 600,
};
const CACHE_TTL_DEFAULT_S = 3600;

/** Return the TTL in seconds for the given hostname. */
function _ttlForOrigin(hostname) {
  for (const [origin, ttl] of Object.entries(CACHE_TTL_BY_ORIGIN)) {
    if (hostname.endsWith(origin)) return ttl;
  }
  return CACHE_TTL_DEFAULT_S;
}

/** Return true if the cached Response is still within its per-origin TTL. */
function _isFresh(response, hostname) {
  const dateHeader = response.headers.get("x-sw-cached-at");
  if (!dateHeader) return true; // no timestamp — treat as fresh to avoid over-invalidation
  const age = (Date.now() - parseInt(dateHeader, 10)) / 1000;
  return age < _ttlForOrigin(hostname);
}

// F113: track network failure state to detect recovery
let _networkWasDown = false;

// F166: Minimal offline fallback page for navigation requests with no cache
const OFFLINE_HTML = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>לוח משפחתי - מצב לא מקוון</title><style>body{background:#060b14;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui}</style></head><body><div style="text-align:center"><div style="font-size:4em">📺</div><h1>לוח משפחתי</h1><p>אין חיבור לאינטרנט. הנתונים יוצגו ברגע שהחיבור יחזור.</p></div></body></html>`;

// ── Install: pre-cache the app shell ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    _loadPrecacheManifest().then((urls) =>
      caches.open(CACHE_NAME).then((cache) => cache.addAll(urls)),
    ),
    // Note: skipWaiting() is triggered by the page via postMessage({type:'SKIP_WAITING'})
    // so the user is notified before the SW activates (F101).
  );
});

// ── Message: skip waiting on request from page ────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // F5 (v7.2): Clear API cache on demand
  if (event.data?.type === "CLEAR_API_CACHE") {
    event.waitUntil(
      caches.delete(CACHE_NAME_API).then(() => {
        return self.clients
          .matchAll({ includeUncontrolled: true })
          .then((clients) => clients.forEach((c) => c.postMessage({ type: "API_CACHE_CLEARED" })));
      }),
    );
  }
});

// ── Activate: remove old cache versions ───────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME && k !== CACHE_NAME_API).map((k) => caches.delete(k)),
        ),
      )
      // F167: tell all clients this version has activated
      .then(() => {
        self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
          clients.forEach((c) => c.postMessage({ type: "VERSION_ACTIVATED", version: CACHE_NAME }));
        });
        return self.clients.claim();
      }),
  );
});

// ── F113: notify all clients that network is back ─────────────────────────
function _notifyNetworkBack() {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage({ type: "NETWORK_BACK" }));
  });
}

// ── Fetch: app shell stale-while-revalidate + F112 API network-first ──────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // F112: API origins — network-first with offline cache fallback + per-origin TTL
  if (API_CACHE_ORIGINS.some((o) => url.hostname.endsWith(o))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            // F113: signal recovery if network was previously down
            if (_networkWasDown) {
              _networkWasDown = false;
              _notifyNetworkBack();
            }
            // Stream SW: stamp cache timestamp for TTL enforcement
            const stamped = new Response(response.clone().body, {
              status: response.status,
              statusText: response.statusText,
              headers: (() => {
                const h = new Headers(response.headers);
                h.set("x-sw-cached-at", String(Date.now()));
                return h;
              })(),
            });
            caches.open(CACHE_NAME_API).then((c) => c.put(event.request, stamped));
          }
          return response;
        })
        .catch(() => {
          _networkWasDown = true;
          return caches
            .open(CACHE_NAME_API)
            .then((c) => c.match(event.request))
            .then((cached) => {
              // Stream SW: honour per-origin TTL — evict stale cached responses
              if (cached && !_isFresh(cached, url.hostname)) {
                caches.open(CACHE_NAME_API).then((c) => c.delete(event.request));
                return Response.error();
              }
              return cached || Response.error();
            });
        }),
    );
    return;
  }

  // Only handle same-origin requests beyond this point
  if (url.origin !== self.location.origin) return;

  // Navigation requests and app-shell assets → stale-while-revalidate
  const isShell =
    event.request.mode === "navigate" ||
    APP_SHELL.some((p) => url.pathname.endsWith(p.replace("./", "/")));

  if (!isShell) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fresh = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => null);
        // Return cached immediately if available; update cache in background
        return (
          cached ||
          fresh ||
          new Response(OFFLINE_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      }),
    ),
  );
});

// ── Stream SW.2: Background sync — error report queue ────────────────────────
// Error payloads that failed to POST are stored in the Cache API keyed by
// a synthetic request URL. On the next sync event the SW retries all queued
// payloads and removes successfully delivered ones.

const ERROR_QUEUE_CACHE = "fdb-error-queue-v1";
const ERROR_POST_URL = "https://fdb.rajwanyair.workers.dev/api/errors";

/**
 * Queue an error-report payload for background-sync retry.
 * Called via postMessage({ type: "QUEUE_ERROR_REPORT", payload: [...] }).
 */
async function _queueErrorReport(payload) {
  try {
    const cache = await caches.open(ERROR_QUEUE_CACHE);
    const key = new Request(
      `/fdb-error-queue/${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await cache.put(
      key,
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    // Non-fatal: if queue fails we lose the report but never crash the SW
  }
}

/**
 * Flush all queued error reports to the worker endpoint.
 * Successful deliveries are removed from the queue.
 */
async function _flushErrorQueue() {
  let cache;
  try {
    cache = await caches.open(ERROR_QUEUE_CACHE);
  } catch {
    return;
  }
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (req) => {
      const res = await cache.match(req);
      if (!res) return;
      const body = await res.text();
      try {
        const response = await fetch(ERROR_POST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (response.ok || response.status === 204) {
          await cache.delete(req);
        }
      } catch {
        // Keep in queue for the next sync attempt
      }
    }),
  );
}

// Handle QUEUE_ERROR_REPORT message from the page
self.addEventListener("message", (event) => {
  if (event.data?.type === "QUEUE_ERROR_REPORT" && event.data.payload) {
    event.waitUntil(_queueErrorReport(event.data.payload));
  }
});

// Background Sync: retry queued error reports when connectivity recovers
self.addEventListener("sync", (event) => {
  if (event.tag === "error-report") {
    event.waitUntil(_flushErrorQueue());
  }
});
