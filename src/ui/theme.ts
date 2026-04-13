/**
 * FamilyDashBoard v6 — Theme System
 *
 * 5 themes: black, blue, matrix, amber, purple.
 * Cycle with T key, persist in localStorage.
 */

import { diagLog } from "../core/diag";

export const THEMES = ["black", "blue", "matrix", "amber", "purple"] as const;
export type ThemeName = (typeof THEMES)[number];

const LS_THEME_KEY = "dash_theme";

/**
 * Apply a named theme to the body element.
 */
export function applyTheme(theme: string): void {
  const valid = THEMES.includes(theme as ThemeName) ? theme : "black";
  document.body.classList.remove(...THEMES.map((t) => `theme-${t}`));
  document.body.classList.add(`theme-${valid}`);

  try {
    localStorage.setItem(LS_THEME_KEY, valid);
  } catch {
    /* quota exceeded */
  }

  // Sync the config panel's theme dropdown
  const sel = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement | null;
  if (sel && sel.value !== valid) sel.value = valid;

  diagLog(`[theme] Applied: ${valid}`);
}

/**
 * Cycle to the next theme.
 */
export function cycleTheme(): void {
  const current = THEMES.findIndex((t) =>
    document.body.classList.contains(`theme-${t}`),
  );
  applyTheme(THEMES[(current + 1) % THEMES.length] ?? "black");
}

/**
 * Get the currently active theme name.
 */
export function currentTheme(): ThemeName {
  const found = THEMES.find((t) =>
    document.body.classList.contains(`theme-${t}`),
  );
  return found ?? "black";
}

/**
 * Initialize theme from localStorage and wire the config dropdown.
 */
export function initTheme(): void {
  const saved = localStorage.getItem(LS_THEME_KEY) ?? "black";
  applyTheme(saved);

  const sel = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement | null;
  if (sel) {
    sel.addEventListener("change", () => applyTheme(sel.value));
  }
}
