/**
 * FamilyDashBoard v13 — Service Worker Registration
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
let _autoReloadTimer: ReturnType<typeof setInterval> | null = null;
let _autoReloadSecs = 0;

/**
 * Register the service worker and set up update detection.
 *
 * @param onActivated - Optional callback invoked when a new SW version takes
 *   control (controllerchange on upgrade). Defaults to a per-card refresh via
 *   the caller-supplied function. Providing this avoids a full page reload.
 */
export async function registerSW(onActivated?: () => void): Promise<void> {
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

  // Dev escape hatch: ?nosw=1 in URL skips SW registration.
  // Useful when developing behind a corporate proxy/firewall where the SW
  // intercepts requests and serves stale offline-fallback HTML for blocked
  // origins. Combine with the global `__fdbUnregisterSW()` helper to fully
  // detach: open `…/?nosw=1`, then run `await __fdbUnregisterSW()` in DevTools.
  if (new URLSearchParams(window.location.search).has("nosw")) {
    diagLog("[sw] Skipping SW registration (?nosw=1 URL flag)");
    return;
  }

  // Capture controller state synchronously BEFORE any async operations.
  // On first install the controller is null; clients.claim() in the SW
  // activate handler fires controllerchange (null→SW) which must NOT
  // trigger a reload — that would cause an infinite loop on first visit.
  // Only reload when a controller already existed (i.e. this is an upgrade).
  const hadController = !!navigator.serviceWorker.controller;

  try {
    // Unregister any stale service workers (e.g. old v5 SW still installed)
    // before registering the current one. This silently evicts legacy SWs
    // even if they have an incompatible scope or cache-name, ensuring no old
    // version can intercept requests after an upgrade.
    // Also purge any cache entries whose name doesn't start with the shared
    // CACHE_NAME prefix ("familydashboard-v") so truly alien caches are removed
    // while any familydashboard-v* version cache (v7, v8, v9, v10…) is kept.
    const existing = await navigator.serviceWorker.getRegistrations();
    for (const reg of existing) {
      if (reg.scope !== `${window.location.origin}/FamilyDashBoard/`) {
        diagLog(`[sw] Unregistering stale SW (wrong scope): ${reg.scope}`);
        await reg.unregister();
      }
    }

    // NOTE: Stale-cache cleanup is intentionally NOT done here.
    // The SW activate handler already owns this responsibility — it keeps
    // exactly CACHE_NAME and CACHE_NAME_API and deletes everything else.
    // Doing it on the page side too was incorrect: the page-side check used
    // CACHE_NAME ("familydashboard-v") as the prefix, which does NOT match
    // "familydashboard-api-v*", causing the API cache to be wiped on every
    // page load and forcing all cards to re-fetch from network each visit.

    swRegistration = await navigator.serviceWorker.register("/FamilyDashBoard/sw.js", {
      scope: "/FamilyDashBoard/",
    });
    diagLog("[sw] Registered");

    // Periodically poll for SW updates so always-on displays pick up new
    // deployments without requiring a page navigation (browsers only check
    // automatically on navigation events; interval here is 60 minutes).
    const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
    setInterval(() => {
      swRegistration?.update().catch((e: unknown) => {
        diagLog(`[sw] Periodic update check failed: ${String(e)}`);
      });
    }, SW_UPDATE_INTERVAL_MS);

    swRegistration.addEventListener("updatefound", () => {
      const installing = swRegistration?.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installing") {
          showUpdateBannerState("installing");
        } else if (installing.state === "installed" && navigator.serviceWorker.controller) {
          diagLog("[sw] New version available");
          showUpdateBannerState("ready");
        }
      });
    });

    // Listen for controller change (another tab activated a new SW).
    // Guard: only act if a controller already existed before registration
    // started (hadController captured synchronously above). On first install
    // the SW calls clients.claim() which fires controllerchange (null→SW);
    // without this guard that would cause a reload loop on every first visit.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      diagLog("[sw] Controller changed — refreshing cards");
      // Refresh each card individually instead of reloading the whole page.
      onActivated?.();
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
 * Dev helper: unregister all service workers and purge FamilyDashBoard caches.
 *
 * Returns the number of registrations that were unregistered. Useful when a
 * stale SW is serving offline-fallback HTML behind a corporate proxy. After
 * calling this, reload the page (or open with `?nosw=1`) to verify the issue.
 *
 * Exposed on `globalThis.__fdbUnregisterSW` from `main.ts` for DevTools use.
 */
export async function unregisterSW(): Promise<number> {
  if (!("serviceWorker" in navigator)) return 0;
  let count = 0;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const ok = await r.unregister();
      if (ok) count++;
    }
    diagLog(`[sw] Unregistered ${count} registration(s)`);
  } catch (err) {
    diagLog(`[sw] Unregister failed: ${String(err)}`);
  }
  try {
    if ("caches" in self) {
      const keys = await caches.keys();
      const fdbKeys = keys.filter((k) => k.startsWith("familydashboard-"));
      await Promise.all(fdbKeys.map((k) => caches.delete(k)));
      diagLog(`[sw] Purged ${fdbKeys.length} cache(s)`);
    }
  } catch (err) {
    diagLog(`[sw] Cache purge failed: ${String(err)}`);
  }
  return count;
}

/**
 * Skip waiting on the installed SW and let the new version activate.
 */
export function swSkipWaiting(): void {
  const waiting = swRegistration?.waiting;
  if (!waiting) return;
  waiting.postMessage({ type: SW_MSG_SKIP_WAITING });
}

/** Cancel any running auto-reload countdown. */
function _clearAutoReloadCountdown(): void {
  if (_autoReloadTimer !== null) {
    clearInterval(_autoReloadTimer);
    _autoReloadTimer = null;
  }
}

/**
 * Start a 10-second countdown then auto-activate the waiting SW.
 * Designed for always-on TV displays where nobody clicks the button.
 * The manual reload button also clears the countdown and fires immediately.
 */
function _startAutoReloadCountdown(statusEl: HTMLElement | null): void {
  _clearAutoReloadCountdown();
  _autoReloadSecs = 10;
  const tick = () => {
    if (statusEl) {
      statusEl.textContent = `🆕 גרסה חדשה — מתרענן תוך ${_autoReloadSecs}s`;
    }
    if (_autoReloadSecs === 0) {
      _clearAutoReloadCountdown();
      swSkipWaiting();
      return;
    }
    _autoReloadSecs--;
  };
  tick(); // immediate first render
  _autoReloadTimer = setInterval(tick, 1000);
}

/**
 * Show the SW update banner with a specific progress state.
 *   downloading — SW fetch in progress (updatefound fired)
 *   installing  — SW installing assets
 *   ready       — SW installed, waiting to activate; start auto-reload countdown
 */
function showUpdateBannerState(state: "downloading" | "installing" | "ready"): void {
  const banner = document.getElementById("sw-update-banner");
  if (!banner) return;

  const statusEl = document.getElementById("sw-update-status");
  const reloadBtn = document.getElementById("sw-update-reload-btn") as HTMLButtonElement | null;

  const labels: Record<string, string> = {
    downloading: "🔄 מוריד עדכון...",
    installing: "⚙️ מתקין עדכון...",
  };

  if (state !== "ready" && statusEl) statusEl.textContent = labels[state] ?? "";
  if (reloadBtn) reloadBtn.hidden = state !== "ready";

  banner.classList.add("visible");
  if (state === "ready") {
    banner.setAttribute("data-sw-state", "ready");
    // Wire reload button only once — clicking cancels the countdown and reloads immediately
    if (reloadBtn && !reloadBtn.dataset["wired"]) {
      reloadBtn.dataset["wired"] = "1";
      reloadBtn.addEventListener(
        "click",
        () => {
          _clearAutoReloadCountdown();
          swSkipWaiting();
        },
        { once: true },
      );
    }
    // Always-on display: auto-activate after 10 s countdown
    _startAutoReloadCountdown(statusEl);
  } else {
    banner.setAttribute("data-sw-state", state);
  }
}
