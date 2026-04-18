/**
 * FamilyDashBoard v7 — Idle Scheduler & Page Visibility
 */

import { WAKE_REFRESH_MS } from "./constants";
import { diagLog } from "./diag";

// ── scheduleIdle: requestIdleCallback wrapper ──
export const scheduleIdle: (fn: () => void) => void =
  typeof requestIdleCallback === "function"
    ? (fn) => requestIdleCallback(fn)
    : (fn) => setTimeout(fn, 1);

// ── Page Visibility ──
let pageVisible = true;
let lastHiddenAt: number | null = null;
const visibilityCallbacks: Array<(visible: boolean) => void> = [];

export function isPageVisible(): boolean {
  return pageVisible;
}

export function onVisibilityChange(cb: (visible: boolean) => void): void {
  visibilityCallbacks.push(cb);
}

export function shouldWakeRefresh(): boolean {
  return lastHiddenAt !== null && Date.now() - lastHiddenAt > WAKE_REFRESH_MS;
}

function handleVisibilityChange(): void {
  pageVisible = !document.hidden;

  if (!pageVisible) {
    lastHiddenAt = Date.now();
    diagLog("[visibility] Page hidden");
  } else {
    const wasAway =
      lastHiddenAt !== null
        ? `(away ${Math.round((Date.now() - lastHiddenAt) / 1000)}s)`
        : "";
    diagLog(`[visibility] Page visible ${wasAway}`);
    lastHiddenAt = null;
  }

  for (const cb of visibilityCallbacks) {
    cb(pageVisible);
  }
}

export function initVisibility(): void {
  document.addEventListener("visibilitychange", handleVisibilityChange);
}
