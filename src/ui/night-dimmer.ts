/**
 * FamilyDashBoard v6 — Night Dimmer Overlay
 */

import "./night-dimmer.css";
import { diagLog } from "../core/diag";

const LS_DIM_START = "dash_v2_dim_start";
const LS_DIM_END = "dash_v2_dim_end";

let dimEl: HTMLElement | null = null;
let dimLevel = 55; // default opacity percentage
let dimActive = false;
let _warmTint = false; // F3 (v7.2): amber/warm tint mode

/** Enable or disable warm amber tint on the night dimmer overlay. */
export function setWarmTint(on: boolean): void {
  _warmTint = on;
  applyDim();
}

/** Return whether warm tint mode is active. */
export function isWarmTint(): boolean {
  return _warmTint;
}

/**
 * Toggle the night dimmer on/off.
 */
export function toggleNightDim(): void {
  dimActive = !dimActive;
  applyDim();
  updateDimIndicator();
  diagLog(`[dimmer] ${dimActive ? "ON" : "OFF"} (${dimLevel}%)`);
}

/**
 * Set the dimmer opacity level (0-100).
 */
export function setDimLevel(level: number): void {
  dimLevel = Math.max(0, Math.min(100, level));
  if (dimActive) applyDim();
}

function applyDim(): void {
  if (!dimEl?.isConnected)
    dimEl = document.getElementById("night-dim");
  if (!dimEl) return;

  if (dimActive) {
    dimEl.style.opacity = String(dimLevel / 100);
    dimEl.style.display = "block";
    // Apply warm amber tint via CSS custom property
    if (_warmTint) {
      dimEl.style.setProperty("background-color", "var(--dimmer-warm-color)");
    } else {
      dimEl.style.removeProperty("background-color");
    }
    dimEl.style.filter = _warmTint ? "none" : "";
    dimEl.classList.toggle("warm-tint", _warmTint);
  } else {
    dimEl.style.display = "none";
    dimEl.classList.remove("warm-tint");
  }
}

export function updateDimIndicator(): void {
  const chip = document.getElementById("dim-indicator");
  if (!chip) return;
  if (dimActive) {
    chip.style.display = "";
    chip.title = `עמעום לילה פעיל (${dimLevel}%) — לחץ N לכיבוי`;
  } else {
    chip.style.display = "none";
  }
}

/**
 * Auto-dim check: activate between start and end hours.
 */
export function autoDimCheck(startHour: number, endHour: number): void {
  const h = new Date().getHours();
  const shouldDim =
    startHour > endHour
      ? h >= startHour || h < endHour // e.g. 23:00 → 06:00
      : h >= startHour && h < endHour; // e.g. 08:00 → 18:00

  if (shouldDim && !dimActive) {
    dimActive = true;
    applyDim();
    updateDimIndicator();
  } else if (!shouldDim && dimActive) {
    dimActive = false;
    applyDim();
    updateDimIndicator();
  }
}

export function isDimActive(): boolean {
  return dimActive;
}

/**
 * Initialize night dimmer: apply configured level, run immediate check,
 * then re-check every 60 seconds using the provided schedule config.
 *
 * @param nightDimLevel Dimmer opacity level (0–100).
 * @param scheduleEnabled Whether automatic schedule is enabled (default: false).
 * @param startHour Hour to start dimming (0–23, default: 23).
 * @param endHour   Hour to stop dimming (0–23, default: 6).
 */
export function initNightDimmer(
  nightDimLevel: number,
  scheduleEnabled = false,
  startHour = 23,
  endHour = 6,
): void {
  setDimLevel(nightDimLevel);

  // Prefer config params; fall back to localStorage for backward compat
  const readHours = (): { start: number; end: number; enabled: boolean } => ({
    start: startHour !== 23
      ? startHour
      : parseInt(localStorage.getItem(LS_DIM_START) ?? String(startHour), 10),
    end: endHour !== 6
      ? endHour
      : parseInt(localStorage.getItem(LS_DIM_END) ?? String(endHour), 10),
    enabled: scheduleEnabled,
  });

  const { start, end, enabled } = readHours();
  if (enabled) {
    autoDimCheck(start, end);
  }
  updateDimIndicator();

  setInterval(() => {
    const { start: s, end: e, enabled: en } = readHours();
    if (en) autoDimCheck(s, e);
  }, 60_000);

  diagLog(`[dimmer] schedule ${enabled ? `ON ${start}h–${end}h` : "OFF"} @ ${nightDimLevel}%`);
}
