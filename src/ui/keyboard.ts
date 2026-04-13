/**
 * FamilyDashBoard v6 — Keyboard Shortcuts
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

/**
 * Register a keyboard shortcut.
 */
export function registerKey(
  key: string,
  description: string,
  handler: () => void,
): void {
  actions.push({ key: key.toLowerCase(), description, handler });
}

/**
 * Get all registered shortcuts (for the help overlay).
 */
export function getKeyboardActions(): readonly KeyboardAction[] {
  return actions;
}

/**
 * Initialize keyboard listeners with built-in shortcuts.
 */
export function initKeyboard(): void {
  // Built-in: theme cycle
  registerKey("t", "מחזור ערכות נושא", cycleTheme);
  registerKey("p", "הדפסה", () => window.print());

  // The global keydown dispatcher
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    // Ignore when typing in inputs/textareas
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const key = e.key.toLowerCase();
    for (const action of actions) {
      if (action.key === key) {
        e.preventDefault();
        action.handler();
        diagLog(`[key] ${key} → ${action.description}`);
        return;
      }
    }
  });

  diagLog(`[keyboard] Initialized with ${String(actions.length)} shortcuts`);
}
