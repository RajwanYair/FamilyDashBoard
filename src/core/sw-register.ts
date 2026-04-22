/**
 * FamilyDashBoard v7 — Service Worker Registration
 *
 * Register SW, handle SKIP_WAITING message, listen for controllerchange.
 */

import { diagLog } from "./diag";
import {
  SW_MSG_SKIP_WAITING,
  SW_MSG_VERSION_ACTIVATED,
  isVersionActivatedMsg,
} from "./sw-constants";

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register the service worker and set up update detection.
 */
export async function registerSW(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    diagLog("[sw] Service Worker not supported");
    return;
  }

  // Service Workers require HTTPS (or localhost). Skip silently on file://
  // so the controllerchange → reload trap never fires for local file access.
  if (window.location.protocol === "file:") {
    diagLog("[sw] Skipping SW registration on file:// (requires HTTPS)");
    return;
  }

  try {
    // Unregister any stale service workers (e.g. old v5 SW still installed)
    // before registering the current one. This silently evicts legacy SWs
    // even if they have an incompatible scope or cache-name, ensuring no old
    // version can intercept requests after an upgrade.
    // Also purge any cache entries whose name doesn't start with "familydashboard-v7"
    // so old caches (v5, v6) never serve stale content.
    const existing = await navigator.serviceWorker.getRegistrations();
    for (const reg of existing) {
      if (reg.scope !== `${window.location.origin}/FamilyDashBoard/`) {
        diagLog(`[sw] Unregistering stale SW (wrong scope): ${reg.scope}`);
        await reg.unregister();
      }
    }

    // Delete any caches from old versions (v5/v6) that don't match v7
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (!name.startsWith("familydashboard-v7")) {
          diagLog(`[sw] Deleting stale cache: ${name}`);
          await caches.delete(name);
        }
      }
    }

    swRegistration = await navigator.serviceWorker.register("/FamilyDashBoard/sw.js", {
      scope: "/FamilyDashBoard/",
    });
    diagLog("[sw] Registered");

    swRegistration.addEventListener("updatefound", () => {
      const installing = swRegistration?.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          diagLog("[sw] New version available");
          showUpdateBanner();
        }
      });
    });

    // Listen for controller change (another tab activated a new SW)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      diagLog("[sw] Controller changed — reloading");
      window.location.reload();
    });

    // Listen for VERSION_ACTIVATED broadcast from SW
    navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
      if (isVersionActivatedMsg(event.data)) {
        diagLog(`[sw] Activated version: ${event.data.version}`);
      } else if (event.data?.type === SW_MSG_VERSION_ACTIVATED) {
        // Fallback for non-typed payloads (legacy SW)
        diagLog(`[sw] Activated version: ${String(event.data.version)}`);
      }
    });
  } catch (err) {
    diagLog(`[sw] Registration failed: ${String(err)}`);
  }
}

/**
 * Skip waiting on the installed SW and let the new version activate.
 */
export function swSkipWaiting(): void {
  const waiting = swRegistration?.waiting;
  if (!waiting) return;
  waiting.postMessage({ type: SW_MSG_SKIP_WAITING });
}

/**
 * Show the SW update banner (wired to DOM in main.ts).
 */
function showUpdateBanner(): void {
  const banner = document.getElementById("sw-update-banner");
  if (banner) banner.classList.add("visible");
  // Wire reload button (replaces inline onclick="swUpdateReload()")
  const reloadBtn = document.getElementById("sw-update-reload-btn");
  if (reloadBtn) reloadBtn.addEventListener("click", swSkipWaiting, { once: true });
}
