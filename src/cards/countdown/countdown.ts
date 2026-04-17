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

/**
 * Return a CSS urgency class based on days remaining.
 *  - "cd-urgent-pulse" → ≤ 1 day (pulsing animation)
 *  - "cd-urgent-amber" → ≤ 7 days (amber highlight)
 *  - ""               → otherwise
 */
export function urgencyClass(days: number): string {
  if (days <= 1) return "cd-urgent-pulse";
  if (days <= 7) return "cd-urgent-amber";
  return "";
}

/**
 * Return the Hebrew day-of-week name for a given Date.
 * e.g. "יום ראשון", "יום שישי"
 */
export function hebrewDayOfWeek(date: Date): string {
  return date.toLocaleDateString("he-IL", { weekday: "long" });
}

/**
 * Return a Hebrew display string for days remaining.
 * Shows "היום! 🎉" when days = 0, "מחר" when 1, "N ימים" otherwise.
 */
export function daysLabel(days: number): string {
  if (days === 0) return "היום! 🎉";
  if (days === 1) return "מחר";
  return `${days} ימים`;
}

/**
 * When `annual` is true and the target date is in the past,
 * advance it to the same month/day in the next upcoming year.
 * Returns the updated YYYY-MM-DD string.
 */
export function advanceAnnualDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  let year = parseInt(parts[0] ?? "2024", 10);
  const month = parts[1] ?? "01";
  const day = parts[2] ?? "01";
  while (new Date(`${year}-${month}-${day}T00:00:00`).getTime() < Date.now()) {
    year += 1;
  }
  return `${year}-${month}-${day}`;
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

  // Urgency CSS class on the days element
  const urg = urgencyClass(days);
  daysEl.className = urg ? `cd-num ${urg}` : "cd-num";

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

  // Progress bar for event 2 — Sprint 31
  const progressWrap2 = document.getElementById("cd2-progress-wrap");
  const progressBar2 = document.getElementById("cd2-progress-bar");
  if (progressWrap2 && progressBar2 && cfg.countdownCard2StartDate) {
    const startMs = new Date(cfg.countdownCard2StartDate).getTime();
    const progress = computeProgress(startMs, targetMs);
    if (progress !== null) {
      progressWrap2.style.display = "";
      progressBar2.style.width = `${Math.round(progress * 100)}%`;
    } else {
      progressWrap2.style.display = "none";
    }
  } else if (progressWrap2) {
    progressWrap2.style.display = "none";
  }
}
export function tick3(): void {
  const cfg = loadConfig();
  const section = document.getElementById("cd3-section");
  if (!section) return;

  const d3 = cfg.countdownCard3Date;
  const t3 = cfg.countdownCard3Time || "18:00";
  if (!d3) {
    section.style.display = "none";
    return;
  }

  const targetMs = new Date(`${d3}T${t3}:00`).getTime();
  const now = Date.now();
  const titleEl = document.getElementById("cd3-title");
  const daysEl = document.getElementById("cd3-days");
  const hoursEl = document.getElementById("cd3-hours");
  const minsEl = document.getElementById("cd3-mins");
  const secsEl = document.getElementById("cd3-secs");
  const msgEl = document.getElementById("cd3-msg");

  section.style.display = "";
  if (titleEl) titleEl.textContent = cfg.countdownCard3Title || "אירוע 3";

  if (now >= targetMs) {
    const daysSince = getDaysSince(targetMs);
    if (daysEl) daysEl.textContent = String(daysSince);
    if (hoursEl) hoursEl.textContent = "00";
    if (minsEl) minsEl.textContent = "00";
    if (secsEl) secsEl.textContent = "00";
    if (msgEl) msgEl.textContent = cfg.countdownCard3DoneMsg || "🎉 מזל טוב!";
    return;
  }

  const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
  if (daysEl) daysEl.textContent = String(days);
  if (hoursEl) hoursEl.textContent = pad(hours);
  if (minsEl) minsEl.textContent = pad(minutes);
  if (secsEl) secsEl.textContent = pad(seconds);
  if (msgEl) msgEl.textContent = days <= 7 ? `⏳ עוד ${days} ימים!` : "";

  // Progress bar for event 3 — Sprint 31
  const progressWrap3 = document.getElementById("cd3-progress-wrap");
  const progressBar3 = document.getElementById("cd3-progress-bar");
  if (progressWrap3 && progressBar3 && cfg.countdownCard3StartDate) {
    const startMs = new Date(cfg.countdownCard3StartDate).getTime();
    const progress = computeProgress(startMs, targetMs);
    if (progress !== null) {
      progressWrap3.style.display = "";
      progressBar3.style.width = `${Math.round(progress * 100)}%`;
    } else {
      progressWrap3.style.display = "none";
    }
  } else if (progressWrap3) {
    progressWrap3.style.display = "none";
  }
}

export function initCountdownCard(): void {
  cacheDom();
  tick();
  tick2();
  tick3();
  if (_cdInterval !== null) clearInterval(_cdInterval);
  _cdInterval = setInterval(() => { tick(); tick2(); tick3(); }, 1000);
  diagLog("FDB-030: [countdown] Initialized");
}

export function destroyCountdownCard(): void {
  if (_cdInterval !== null) {
    clearInterval(_cdInterval);
    _cdInterval = null;
  }
}
