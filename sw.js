/* FamilyDashBoard ServiceWorker — v7.8.0
 * F111: sw.js added to APP_SHELL pre-cache (full offline shell)
 * F112: API network-first with offline cache fallback
 * F113: SW posts NETWORK_BACK message to clients on network recovery
 * F162: CACHE_NAME bumped to v5.0.0; CORS proxy + stock origins added to API cache
 * F163: icon.svg added to APP_SHELL
 * F166: OFFLINE_RESPONSE fallback for navigation requests with no cache
 * F167: VERSION_ACTIVATED broadcast to all clients on activate
 * v6.0.0: TypeScript modular rewrite release — CACHE_NAME bumped to v6.0.0
 * v6.1.0: Birthday chip, countdown chip, news bookmarks, BG rotation, stock alerts, multi-birthday, multi-BG URLs
 * v6.2.0: CSS co-location, renderStocksShell(), ESLint TS, vitest pool:forks, worker CI deploy
 * v6.5.0: Coverage sprint — cache.ts 100%, base-card.ts 100%, motivation.ts 100%, alerts.ts 91%, calendar.ts 95%, maximize.ts 96%
 * v7.0.0: Card type system, tasks card, system-info, CSS @layer, dialog migration, worker-first fetch, card visibility
 * v7.0.0 (alpha2): Shabbat countdown, Sefaria deep-links, halacha yomit, school vacation indicator, A-key alerts
 * v7.1.0: Drag-and-drop card layout, layout persistence, 1554 tests/38 suites, 0-error lint suite
 * v7.1.1: Countdown card (11th card), fix hebrew-date/favicon/news-overlap, tile layout, CI unified, 1570 tests/39 suites
 * v7.1.2: Markdown lint fix, 1574 tests/39 suites
 * v7.2.0: F5 CLEAR_API_CACHE handler, precipitation chip, alert volume, warm tint, reset-all, cache-age chip, tasks quick-add, countdown 2nd event, news filter chips, L-key warm tint
 * v7.7.0: 50-sprint session — type guards, weather UX, countdown, tasks, news, stocks, Hebrew cal, runtime API guards
 * v7.8.0: Sprint 31–38 — ARIA a11y, CSS co-location, config v2, fetch dedup+quality tier, night dim schedule, cache diag */

const CACHE_NAME = "familydashboard-v__APP_VERSION__";
const CACHE_NAME_API = "familydashboard-api-v__APP_VERSION__";
// F111: include sw.js itself in app shell pre-cache
const APP_SHELL = [
  "./BestDashBoard.html",
  "./manifest.json",
  "./sw.js",
  "./icon.svg",
];

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
  "query1.finance.yahoo.com",
  "api.coingecko.com",
  "tzevaadom.co.il",
  "sefaria.org",
];

// F113: track network failure state to detect recovery
let _networkWasDown = false;

// F166: Minimal offline fallback page for navigation requests with no cache
const OFFLINE_HTML = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>לוח משפחתי - מצב לא מקוון</title><style>body{background:#060b14;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui}</style></head><body><div style="text-align:center"><div style="font-size:4em">📺</div><h1>לוח משפחתי</h1><p>אין חיבור לאינטרנט. הנתונים יוצגו ברגע שהחיבור יחזור.</p></div></body></html>`;

// ── Install: pre-cache the app shell ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
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
          .then((clients) =>
            clients.forEach((c) =>
              c.postMessage({ type: "API_CACHE_CLEARED" }),
            ),
          );
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
          keys
            .filter((k) => k !== CACHE_NAME && k !== CACHE_NAME_API)
            .map((k) => caches.delete(k)),
        ),
      )
      // F167: tell all clients this version has activated
      .then(() => {
        self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
          clients.forEach((c) =>
            c.postMessage({ type: "VERSION_ACTIVATED", version: CACHE_NAME }),
          );
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

  // F112: API origins — network-first with offline cache fallback
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
            const clone = response.clone();
            caches
              .open(CACHE_NAME_API)
              .then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          _networkWasDown = true;
          return caches
            .open(CACHE_NAME_API)
            .then((c) => c.match(event.request))
            .then((cached) => cached || Response.error());
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
