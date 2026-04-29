/**
 * src/ui/offline-banner.ts — Sprint 174 (X6 · V14-CROSS)
 *
 * Reactive offline indicator driven by the event-bus `globalOffline` signal.
 * Replaces the inline window.addEventListener("offline"/"online") wiring
 * that previously lived inside `initDashboard()` in main.ts.
 *
 * Responsibilities:
 *   - Show/hide the #offline-banner pill reactively when navigator.onLine changes.
 *   - Fire a toast notification on state transitions.
 *   - Trigger card refresh (via caller-supplied callback) after reconnect.
 *
 * Usage:
 *   import { initOfflineBanner } from "./ui/offline-banner";
 *   initOfflineBanner(() => refreshAllCardsStaggered());
 */

import { effect } from "../core/signals";
import { globalOffline, initOfflineTracking } from "../core/event-bus";
import { diagLog } from "../core/diag";
import { showToast } from "./toast";
import { t } from "../core/i18n";

let _bannerEl: HTMLElement | null = null;
let _refreshCallback: (() => void) | null = null;
let _disposeEffect: (() => void) | null = null;
let _wentOffline = false;

/**
 * Initialize the offline banner.
 * Must be called once after the DOM is ready (e.g. from `initDashboard()`).
 *
 * @param onReconnect  Callback invoked (after 500 ms) when network is restored.
 */
export function initOfflineBanner(onReconnect: () => void): void {
  _bannerEl = document.getElementById("offline-banner");
  _refreshCallback = onReconnect;
  _wentOffline = false;

  // Wire navigator.onLine events → globalOffline signal (idempotent).
  initOfflineTracking();

  // Dispose any prior effect (hot-reload safety).
  _disposeEffect?.();

  // React to offline state changes.
  _disposeEffect = effect(() => {
    const offline = globalOffline.value;
    if (offline) {
      _wentOffline = true;
      _bannerEl?.classList.add("visible");
      showToast(t("offlineToast"), 5000);
      diagLog("[offline-banner] FDB-008: network offline");
    } else {
      _bannerEl?.classList.remove("visible");
      if (_wentOffline) {
        _wentOffline = false;
        showToast(t("onlineRefreshing"), 2500);
        setTimeout(() => _refreshCallback?.(), 500);
        diagLog("[offline-banner] FDB-009: network reconnected");
      }
    }
  });
}

/**
 * Dispose the offline banner effect and release DOM references.
 * Intended for testing and hot-reload teardown.
 * @internal
 */
export function _disposeOfflineBanner(): void {
  _disposeEffect?.();
  _disposeEffect = null;
  _bannerEl = null;
  _refreshCallback = null;
  _wentOffline = false;
}
