/**
 * FamilyDashBoard v7 — Theme System
 *
 * 6 themes: black, blue, matrix, amber, purple, rose.
 * Cycle with T key, persist in localStorage.
 * v7: respects prefers-color-scheme when no saved theme.
 */

import { diagLog } from "../core/diag";
import { LS_THEME } from "../core/constants";

export const THEMES = [
  "black",
  "blue",
  "matrix",
  "amber",
  "purple",
  "rose",
] as const;
export type ThemeName = (typeof THEMES)[number];

// LS_THEME imported from constants

/**
 * Apply a named theme to the body element.
 * Uses View Transitions API when available for a smooth crossfade.
 */
export function applyTheme(theme: string): void {
  const valid = THEMES.includes(theme as ThemeName) ? theme : "black";

  const doApply = (): void => {
    document.body.classList.remove(...THEMES.map((t) => `theme-${t}`));
    document.body.classList.add(`theme-${valid}`);
    try {
      localStorage.setItem(LS_THEME, valid);
    } catch {
      /* quota exceeded */
    }
    // Sync the config panel's theme dropdown
    const sel = document.getElementById(
      "theme-select",
    ) as HTMLSelectElement | null;
    if (sel && sel.value !== valid) sel.value = valid;
    diagLog(`[theme] Applied: ${valid}`);
  };

  if ("startViewTransition" in document) {
    void document.startViewTransition(doApply);
  } else {
    doApply();
  }
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
  const saved = localStorage.getItem(LS_THEME) ?? "black";
  applyTheme(saved);

  const sel = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement | null;
  if (sel) {
    sel.addEventListener("change", () => applyTheme(sel.value));
  }

  // v7: Follow OS dark/light preference changes (only when user hasn't picked a theme)
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", (e) => {
      const hasSaved = !!localStorage.getItem(LS_THEME);
      if (!hasSaved) {
        // Light OS → amber; Dark OS → black
        applyTheme(e.matches ? "amber" : "black");
      }
    });
}

/**
 * Auto-theme by time of day: apply 'black' between 20:00–07:00 when enabled,
 * otherwise restore the configured day theme.
 */
export function checkAutoTheme(enabled: boolean, dayTheme: ThemeName): void {
  if (!enabled) return;
  const h = new Date().getHours();
  const isNight = h >= 20 || h < 7;
  const target: ThemeName = isNight ? "black" : dayTheme;
  if (!document.body.classList.contains(`theme-${target}`)) {
    applyTheme(target);
  }
}
