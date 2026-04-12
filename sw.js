/* FamilyDashBoard ServiceWorker — v4.15.0
 * F111: sw.js added to APP_SHELL pre-cache (full offline shell)
 * F112: API network-first with offline cache fallback
 * F113: SW posts NETWORK_BACK message to clients on network recovery */

const CACHE_NAME     = "familydashboard-v4.15.0";
const CACHE_NAME_API = "familydashboard-api-v4.15.0";
// F111: include sw.js itself in app shell pre-cache
const APP_SHELL = ["./BestDashBoard.html", "./manifest.json", "./sw.js"];

// F112: API origins to cache for offline fallback
const API_CACHE_ORIGINS = [
  "api.open-meteo.com",
  "www.hebcal.com",
  "open.er-api.com",
  "exchangerate-api.com",
];

// F113: track network failure state to detect recovery
let _networkWasDown = false;

// ── Install: pre-cache the app shell ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL)),
    // Note: skipWaiting() is triggered by the page via postMessage({type:'SKIP_WAITING'})
    // so the user is notified before the SW activates (F101).
  );
});

// ── Message: skip waiting on request from page ────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
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
      .then(() => self.clients.claim()),
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
            caches.open(CACHE_NAME_API).then((c) => c.put(event.request, clone));
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
        return cached || fresh;
      }),
    ),
  );
});
