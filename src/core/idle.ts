/**
 * FamilyDashBoard v7 — Idle Scheduler & Page Visibility
 *
 * Sprint 113 (V14-FOUNDATIONS): the page-visibility flag is now backed by a
 * `signal()` from `core/signals.ts` so new consumers can subscribe via
 * `effect()` / `computed()`. The legacy `isPageVisible()` /
 * `onVisibilityChange()` callback API is preserved as a thin shim — no
 * existing call site changes. New consumers should import
 * `pageVisibleSignal` directly.
 */

import { WAKE_REFRESH_MS } from "./constants";
import { diagLog } from "./diag";
import { signal, type ReadonlySignal } from "./signals";

// ── scheduleIdle: requestIdleCallback wrapper ──
export const scheduleIdle: (fn: () => void) => void =
  typeof requestIdleCallback === "function"
    ? (fn) => requestIdleCallback(fn)
    : (fn) => setTimeout(fn, 1);

// ── Page Visibility ──
const _pageVisible = signal<boolean>(true);
/** Reactive read-only view of `document.visibilityState !== "hidden"`. */
export const pageVisibleSignal: ReadonlySignal<boolean> = _pageVisible;
let lastHiddenAt: number | null = null;
const visibilityCallbacks: Array<(visible: boolean) => void> = [];

export function isPageVisible(): boolean {
  // Use peek() so callers that happen to be inside an active effect do NOT
  // accidentally subscribe — call sites use this as a one-shot guard.
  return _pageVisible.peek();
}

export function onVisibilityChange(cb: (visible: boolean) => void): void {
  visibilityCallbacks.push(cb);
}

export function shouldWakeRefresh(): boolean {
  return lastHiddenAt !== null && Date.now() - lastHiddenAt > WAKE_REFRESH_MS;
}

function handleVisibilityChange(): void {
  const visible = !document.hidden;
  _pageVisible.value = visible;

  if (!visible) {
    lastHiddenAt = Date.now();
    diagLog("[visibility] Page hidden");
  } else {
    const wasAway =
      lastHiddenAt !== null ? `(away ${Math.round((Date.now() - lastHiddenAt) / 1000)}s)` : "";
    diagLog(`[visibility] Page visible ${wasAway}`);
    lastHiddenAt = null;
  }

  for (const cb of visibilityCallbacks) {
    cb(visible);
  }
}

export function initVisibility(): void {
  document.addEventListener("visibilitychange", handleVisibilityChange);
}
