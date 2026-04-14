/**
 * FamilyDashBoard v6 — Service Worker Registration
 *
 * Register SW, handle SKIP_WAITING message, listen for controllerchange.
 */

import { diagLog } from "./diag";

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
    swRegistration = await navigator.serviceWorker.register(
      "/FamilyDashBoard/sw.js",
      {
        scope: "/FamilyDashBoard/",
      },
    );
    diagLog("[sw] Registered");

    swRegistration.addEventListener("updatefound", () => {
      const installing = swRegistration?.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
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
    navigator.serviceWorker.addEventListener(
      "message",
      (event: MessageEvent) => {
        if (event.data?.type === "VERSION_ACTIVATED") {
          diagLog(`[sw] Activated version: ${String(event.data.version)}`);
        }
      },
    );
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
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Show the SW update banner (wired to DOM in main.ts).
 */
function showUpdateBanner(): void {
  const banner = document.getElementById("sw-update-banner");
  if (banner) banner.classList.add("visible");
  // Wire reload button (replaces inline onclick="swUpdateReload()")
  const reloadBtn = document.getElementById("sw-update-reload-btn");
  if (reloadBtn)
    reloadBtn.addEventListener("click", swSkipWaiting, { once: true });
}
