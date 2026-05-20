/**
 * FamilyDashBoard — Focus Mode (S53)
 *
 * Toggles a "focus-mode" class on the document body which hides all cards
 * except the primary information cards (weather, news, alerts).
 * Designed for distraction-free ambient viewing on TV displays.
 *
 * @module ui/focus-mode
 */

import { diagLog } from "../core/diag";

const FOCUS_CLASS = "focus-mode";

/** Primary cards that remain visible in focus mode. */
const FOCUS_CARDS: ReadonlySet<string> = new Set(["weather", "news", "alerts"]);

/** Whether focus mode is currently active. */
export function isFocusMode(): boolean {
  return document.body.classList.contains(FOCUS_CLASS);
}

/** Toggle focus mode on/off. Returns the new state. */
export function toggleFocusMode(): boolean {
  const next = !isFocusMode();
  document.body.classList.toggle(FOCUS_CLASS, next);
  diagLog(`[focus-mode] ${next ? "enabled" : "disabled"}`);
  return next;
}

/** Get the set of card IDs visible in focus mode. */
export function getFocusCards(): ReadonlySet<string> {
  return FOCUS_CARDS;
}
