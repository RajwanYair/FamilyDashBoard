/**
 * FamilyDashBoard v6 — Night Dimmer Overlay
 */

import { diagLog } from "../core/diag";

let dimEl: HTMLElement | null = null;
let dimLevel = 55; // default opacity percentage
let dimActive = false;

/**
 * Toggle the night dimmer on/off.
 */
export function toggleNightDim(): void {
  dimActive = !dimActive;
  applyDim();
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
  if (!dimEl) dimEl = document.getElementById("night-dim");
  if (!dimEl) return;

  if (dimActive) {
    dimEl.style.opacity = String(dimLevel / 100);
    dimEl.style.display = "block";
  } else {
    dimEl.style.display = "none";
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
  } else if (!shouldDim && dimActive) {
    dimActive = false;
    applyDim();
  }
}

export function isDimActive(): boolean {
  return dimActive;
}
