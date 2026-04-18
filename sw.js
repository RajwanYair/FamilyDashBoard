/* FamilyDashBoard ServiceWorker — v7.18.0
 * APP_SHELL pre-cache · API network-first with offline fallback
 * NETWORK_BACK broadcast on reconnection · VERSION_ACTIVATED on activate
 * See CHANGELOG.md for full version history. */

const CACHE_NAME = "familydashboard-v__APP_VERSION__";
const CACHE_NAME_API = "familydashboard-api-v__APP_VERSION__";
// v7.10: APP_SHELL updated — BestDashBoard.html removed, index.html added
const APP_SHELL = ["./index.html", "./manifest.webmanifest", "./sw.js", "./icon.svg"];

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
