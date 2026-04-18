/**
 * FamilyDashBoard v7 — Night Dimmer Overlay
 */

import "./night-dimmer.css";
import { diagLog } from "../core/diag";
import { LS_DIM_START, LS_DIM_END } from "../core/constants";

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

/**
 * Check whether the current time falls within the dimming window,
 * optionally limited to specific weekdays (Sprint 57).
 *
 * @param startHour  - Hour to start dimming (0–23)
 * @param endHour    - Hour to end dimming (0–23)
 * @param weekdays   - Array of JS weekday numbers (0=Sun…6=Sat) to restrict dimming.
 *                     Empty or undefined means all days.
 */
export function autoDimCheckWeekday(
  startHour: number,
  endHour: number,
  weekdays?: number[],
): void {
  if (weekdays && weekdays.length > 0) {
    const today = new Date().getDay();
    if (!weekdays.includes(today)) {
      // Not a scheduled day — ensure dimmer is off
      if (dimActive) {
        dimActive = false;
        applyDim();
        updateDimIndicator();
      }
      return;
    }
  }
  autoDimCheck(startHour, endHour);
}

export function isDimActive(): boolean {
  return dimActive;
}

// ── Idle Auto-Dim (Sprint 26) ──────────────────────────────────────────────

let _idleMinutes = 0;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _idleAutoDimmed = false;
let _idleListenersAdded = false;

function _armIdleTimer(): void {
  if (_idleTimer !== null) clearTimeout(_idleTimer);
  _idleTimer = null;
  if (_idleMinutes > 0) {
    _idleTimer = setTimeout(() => {
      if (!dimActive) {
        _idleAutoDimmed = true;
        dimActive = true;
        applyDim();
        updateDimIndicator();
        diagLog(`[dimmer] idle auto-dim after ${_idleMinutes} min`);
      }
    }, _idleMinutes * 60_000);
  }
}

/**
 * Reset the idle countdown on any user activity.
 * If the dimmer was auto-activated by inactivity, it will be turned off.
 */
export function resetIdleTimer(): void {
  if (_idleMinutes <= 0) return;
  if (_idleAutoDimmed) {
    _idleAutoDimmed = false;
    dimActive = false;
    applyDim();
    updateDimIndicator();
  }
  _armIdleTimer();
}

/**
 * Configure idle auto-dim. 0 = disabled.
 * Sets up document event listeners on first call with minutes > 0.
 */
export function setIdleAutoDimMinutes(minutes: number): void {
  _idleMinutes = Math.max(0, minutes);
  _armIdleTimer();
  if (!_idleListenersAdded && _idleMinutes > 0) {
    _idleListenersAdded = true;
    const handler = (): void => { resetIdleTimer(); };
    document.addEventListener("mousemove", handler, { passive: true });
    document.addEventListener("keydown", handler, { passive: true });
    document.addEventListener("touchstart", handler, { passive: true });
  }
}

/** Return configured idle auto-dim minutes (0 = disabled). */
export function getIdleAutoDimMinutes(): number {
  return _idleMinutes;
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
