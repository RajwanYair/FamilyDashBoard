/**
 * FamilyDashBoard v6 — Screen Mode + Font Scale
 *
 * Applies screen mode class (screen-tv / screen-tablet / screen-phone)
 * and font scale CSS custom property (--font-scale on <html>).
 */

import { loadConfig, updateConfig } from "../core/config";
import type { DashboardConfig } from "../types/config";
import { diagLog } from "../core/diag";

const SCREEN_CLASSES = ["screen-tv", "screen-tablet", "screen-phone"] as const;

/**
 * Apply a screen mode class to <body>.
 */
export function applyScreenMode(mode: DashboardConfig["screenMode"]): void {
  document.body.classList.remove(...SCREEN_CLASSES);
  document.body.classList.add(`screen-${mode}`);
  diagLog(`[screen-mode] Applied: ${mode}`);
}

/**
 * Apply font scale as a CSS custom property on <html>.
 */
export function applyFontScale(scale: number): void {
  const clamped = Math.max(0.7, Math.min(1.5, Math.round(scale * 100) / 100));
  document.documentElement.style.setProperty("--font-scale", String(clamped));
  diagLog(`[screen-mode] Font scale: ${clamped}`);
}

/**
 * Step the font scale up (+1) or down (-1) by 0.05 and save to config.
 */
export function stepFontScale(dir: 1 | -1): void {
  const c = loadConfig();
  const next = Math.round((c.fontScale + dir * 0.05) * 100) / 100;
  const clamped = Math.max(0.7, Math.min(1.5, next));
  applyFontScale(clamped);
  updateConfig("fontScale", clamped);
  diagLog(`[screen-mode] Font scale → ${clamped}`);
}

/**
 * Initialize screen mode and font scale from saved config, and wire
 * the screen-mode dropdown in the settings panel (if present).
 */
export function initScreenMode(): void {
  const c = loadConfig();
  applyScreenMode(c.screenMode);
  applyFontScale(c.fontScale);

  // Wire the screen-mode dropdown
  const sel = document.getElementById(
    "screen-mode-select",
  ) as HTMLSelectElement | null;
  if (sel) {
    sel.addEventListener("change", () => {
      const mode = sel.value as DashboardConfig["screenMode"];
      applyScreenMode(mode);
      updateConfig("screenMode", mode);
    });
  }

  diagLog(
    `[screen-mode] Initialized: mode=${c.screenMode} scale=${c.fontScale}`,
  );
}
