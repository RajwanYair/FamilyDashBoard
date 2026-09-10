/**
 * FamilyDashBoard v13 — Keyboard Shortcuts
 *
 * Central keyboard handler. All shortcuts dispatched from here.
 */

import { cycleTheme } from "./theme";
import { diagLog } from "../core/diag";

export interface KeyboardAction {
  key: string;
  description: string;
  handler: () => void;
}

const actions: KeyboardAction[] = [];
const overlayClosers = new Map<string, () => void>();
let keyboardInitialized = false;

/**
 * Register a keyboard shortcut.
 */
export function registerKey(key: string, description: string, handler: () => void): void {
  actions.push({ key: key.toLowerCase(), description, handler });
}

/**
 * Get all registered shortcuts (for the help overlay).
 */
export function getKeyboardActions(): readonly KeyboardAction[] {
  return actions;
}

/**
 * Register module-specific cleanup for an overlay.
 *
 * This lets Escape use the same cleanup path as an explicit close button
 * (for example, stopping a diagnostics refresh timer and restoring focus).
 */
export function registerOverlayCloser(id: string, closer: () => void): void {
  overlayClosers.set(id, closer);
}

/**
 * Initialize keyboard listeners with built-in shortcuts.
 */
export function initKeyboard(): void {
  if (keyboardInitialized) return;

  // Built-in: theme cycle
  registerKey("t", "מחזור ערכות נושא", cycleTheme);
  registerKey("p", "הדפסה", () => {
    document.body.dataset["printUrl"] = location.href;
    window.print();
  });

  // The global keydown dispatcher
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    // Escape is a global overlay command even when focus is inside a form
    // control. Other shortcuts remain ignored while typing.
    if (key !== "escape") {
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
    }
    for (const action of actions) {
      if (action.key === key) {
        e.preventDefault();
        action.handler();
        diagLog(`[key] ${key} → ${action.description}`);
        return;
      }
    }
  });

  keyboardInitialized = true;
  diagLog(`[keyboard] Initialized with ${String(actions.length)} shortcuts`);
}

/**
 * Convenience: close all known overlays.
 * For <dialog> elements, calls .close(); for div overlays, removes .visible.
 * Used by the Escape key handler.
 */
export function closeAllOverlays(): void {
  // <dialog> elements — use native close()
  const dialogIds = ["config-overlay", "help-overlay", "diag-overlay", "halacha-overlay"];
  for (const id of dialogIds) {
    const el = document.getElementById(id);
    const isOpen =
      el instanceof HTMLDialogElement ? el.open : el?.classList.contains("visible") === true;
    if (!isOpen) continue;

    const closer = overlayClosers.get(id);
    if (closer) {
      closer();
      continue;
    }
    if (el instanceof HTMLDialogElement && el.open) {
      el.close();
    } else {
      el?.classList.remove("visible");
    }
  }
  diagLog("[keyboard] closeAllOverlays");
}
