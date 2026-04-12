/* FamilyDashBoard ServiceWorker — v4.13.0
 * Strategy: stale-while-revalidate for app shell (HTML).
 * API responses are NOT cached here — they use the in-page dual-layer cache
 * (in-memory Map + localStorage with dash_v2_ prefix). */

const CACHE_NAME = "familydashboard-v4.13.0";
const APP_SHELL = ["./BestDashBoard.html", "./manifest.json"];

// ── Install: pre-cache the app shell ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: remove old cache versions ───────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: stale-while-revalidate for same-origin navigation ──────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Only handle requests to our own origin (not external APIs)
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
