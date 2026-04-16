/**
 * FamilyDashBoard v7 — Countdown Card
 *
 * Displays a ticking countdown to a configurable target date/time.
 * Pure client-side, no API required.
 * Target, title and done-message are read from DashboardConfig each tick.
 */

import "./countdown.css";
import { loadConfig } from "../../core/config";
import { diagLog } from "../../core/diag";

// ── Config-driven helpers ─────────────────────────────────────────────────────

export function getCountdownTargetDate(): Date {
  const c = loadConfig();
  const d = c.countdownCardDate || "2026-05-07";
  const t = c.countdownCardTime || "18:00";
  return new Date(`${d}T${t}:00`);
}

export function getCountdownTitle(): string {
  return loadConfig().countdownCardTitle || "חתונת אליאור וטובה";
}

export function getCountdownDoneMsg(): string {
  return loadConfig().countdownCardDoneMsg || "🎉 מזל טוב לאליאור ולטובה!";
}

let _cdInterval: ReturnType<typeof setInterval> | null = null;

// ── DOM refs ────────────────────────────────────────────────────────────────

interface CdEls {
  title: HTMLElement | null;
  days: HTMLElement | null;
  hours: HTMLElement | null;
  mins: HTMLElement | null;
  secs: HTMLElement | null;
  msg: HTMLElement | null;
  progressWrap: HTMLElement | null;
  progressBar: HTMLElement | null;
}

let els: CdEls = {
  title: null,
  days: null,
  hours: null,
  mins: null,
  secs: null,
  msg: null,
  progressWrap: null,
  progressBar: null,
};

function cacheDom(): void {
  els = {
    title: document.getElementById("cd-wedding-title"),
    days: document.getElementById("cd-days"),
    hours: document.getElementById("cd-hours"),
    mins: document.getElementById("cd-mins"),
    secs: document.getElementById("cd-secs"),
    msg: document.getElementById("cd-msg"),
    progressWrap: document.getElementById("cd-progress-wrap"),
    progressBar: document.getElementById("cd-progress-bar"),
  };
}

// ── Time helpers ────────────────────────────────────────────────────────────

export interface TimeComponents {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getTimeComponents(targetMs: number): TimeComponents {
  const diff = Math.max(0, targetMs - Date.now());
  const totalSecs = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSecs / 86400),
    hours: Math.floor((totalSecs % 86400) / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
  };
}

/** Returns the number of whole days that have elapsed since `targetMs`. */
export function getDaysSince(targetMs: number): number {
  return Math.max(0, Math.floor((Date.now() - targetMs) / 86_400_000));
}

/**
 * Compute elapsed progress (0–1) between a start and end date.
 * Returns null when no valid start date is configured.
 */
export function computeProgress(startMs: number, targetMs: number): number | null {
  if (!startMs || startMs >= targetMs) return null;
  const total = targetMs - startMs;
  const elapsed = Date.now() - startMs;
  return Math.max(0, Math.min(1, elapsed / total));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export function tick(): void {
  const titleEl = els.title ?? document.getElementById("cd-wedding-title");
  const daysEl = els.days ?? document.getElementById("cd-days");
  const hoursEl = els.hours ?? document.getElementById("cd-hours");
  const minsEl = els.mins ?? document.getElementById("cd-mins");
  const secsEl = els.secs ?? document.getElementById("cd-secs");
  const msgEl = els.msg ?? document.getElementById("cd-msg");
  if (!daysEl) return;
  const targetMs = getCountdownTargetDate().getTime();
  const now = Date.now();

  if (now >= targetMs) {
    // Event has passed
    if (titleEl) titleEl.textContent = "🎉 מזל טוב!";
    const daysSince = getDaysSince(targetMs);
    daysEl.textContent = String(daysSince);
    if (hoursEl) hoursEl.textContent = "00";
    if (minsEl) minsEl.textContent = "00";
    if (secsEl) secsEl.textContent = "00";
    if (msgEl)
      msgEl.textContent =
        daysSince > 0
          ? `${getCountdownDoneMsg()} · יום ${daysSince}`
          : getCountdownDoneMsg();
    if (_cdInterval !== null) {
      clearInterval(_cdInterval);
      _cdInterval = null;
    }
    return;
  }

  const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
  if (titleEl) titleEl.textContent = getCountdownTitle();
  daysEl.textContent = String(days);
  if (hoursEl) hoursEl.textContent = pad(hours);
  if (minsEl) minsEl.textContent = pad(minutes);
  if (secsEl) secsEl.textContent = pad(seconds);
  if (msgEl) {
    msgEl.textContent =
      days === 0
        ? "⏳ היום הגיע!"
        : days === 1
          ? "⏳ עוד יום אחד!"
          : days <= 7
            ? `⏳ עוד ${days} ימים!`
            : "";
  }

  // Progress bar — show when a start date is configured
  const cfg = loadConfig();
  const startDate = cfg.countdownCardStartDate;
  const progressWrapEl = els.progressWrap ?? document.getElementById("cd-progress-wrap");
  const progressBarEl = els.progressBar ?? document.getElementById("cd-progress-bar");
  if (progressWrapEl && progressBarEl && startDate) {
    const startMs = new Date(startDate).getTime();
    const progress = computeProgress(startMs, targetMs);
    if (progress !== null) {
      progressWrapEl.style.display = "";
      progressBarEl.style.width = `${Math.round(progress * 100)}%`;
    } else {
      progressWrapEl.style.display = "none";
    }
  } else if (progressWrapEl) {
    progressWrapEl.style.display = "none";
  }
}

// ── Init / Destroy ───────────────────────────────────────────────────────────

/** F8 (v7.2): Tick for the optional 2nd countdown event. */
export function tick2(): void {
  const cfg = loadConfig();
  const section = document.getElementById("cd2-section");
  if (!section) return;

  const d2 = cfg.countdownCard2Date;
  const t2 = cfg.countdownCard2Time || "18:00";
  if (!d2) {
    section.style.display = "none";
    return;
  }

  const targetMs = new Date(`${d2}T${t2}:00`).getTime();
  const now = Date.now();
  const titleEl = document.getElementById("cd2-title");
  const daysEl = document.getElementById("cd2-days");
  const hoursEl = document.getElementById("cd2-hours");
  const minsEl = document.getElementById("cd2-mins");
  const secsEl = document.getElementById("cd2-secs");
  const msgEl = document.getElementById("cd2-msg");

  section.style.display = "";
  if (titleEl) titleEl.textContent = cfg.countdownCard2Title || "אירוע 2";

  if (now >= targetMs) {
    const daysSince = getDaysSince(targetMs);
    if (daysEl) daysEl.textContent = String(daysSince);
    if (hoursEl) hoursEl.textContent = "00";
    if (minsEl) minsEl.textContent = "00";
    if (secsEl) secsEl.textContent = "00";
    if (msgEl) msgEl.textContent = cfg.countdownCard2DoneMsg || "🎉 מזל טוב!";
    return;
  }

  const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
  if (daysEl) daysEl.textContent = String(days);
  if (hoursEl) hoursEl.textContent = pad(hours);
  if (minsEl) minsEl.textContent = pad(minutes);
  if (secsEl) secsEl.textContent = pad(seconds);
  if (msgEl) msgEl.textContent = days <= 7 ? `⏳ עוד ${days} ימים!` : "";
}

export function initCountdownCard(): void {
  cacheDom();
  tick();
  tick2();
  if (_cdInterval !== null) clearInterval(_cdInterval);
  _cdInterval = setInterval(() => { tick(); tick2(); }, 1000);
  diagLog("[countdown] Initialized");
}

export function destroyCountdownCard(): void {
  if (_cdInterval !== null) {
    clearInterval(_cdInterval);
    _cdInterval = null;
  }
}
