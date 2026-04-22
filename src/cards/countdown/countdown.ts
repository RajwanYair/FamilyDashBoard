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
import { MS_PER_DAY } from "../../core/constants";
import { decomposeDuration, pad2 } from "../../core/utils";
import type { DurationParts } from "../../core/utils";
import type { CardConfigField } from "../../types/card";

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

export type TimeComponents = DurationParts;

export function getTimeComponents(targetMs: number): TimeComponents {
  return decomposeDuration(Math.max(0, targetMs - Date.now()));
}

/** Returns the number of whole days that have elapsed since `targetMs`. */
export function getDaysSince(targetMs: number): number {
  return Math.max(0, Math.floor((Date.now() - targetMs) / MS_PER_DAY));
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
        daysSince > 0 ? `${getCountdownDoneMsg()} · יום ${daysSince}` : getCountdownDoneMsg();
    if (_cdInterval !== null) {
      clearInterval(_cdInterval);
      _cdInterval = null;
    }
    return;
  }

  const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
  if (titleEl) titleEl.textContent = getCountdownTitle();
  daysEl.textContent = String(days);
  if (hoursEl) hoursEl.textContent = pad2(hours);
  if (minsEl) minsEl.textContent = pad2(minutes);
  if (secsEl) secsEl.textContent = pad2(seconds);
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

/** Shared logic for secondary countdown slots (events 2 & 3). */
function tickSecondary(
  prefix: string,
  sectionId: string,
  date: string | undefined,
  time: string,
  title: string,
  doneMsg: string,
  startDate: string | undefined,
): void {
  const section = document.getElementById(sectionId);
  if (!section) return;

  if (!date) {
    section.style.display = "none";
    return;
  }

  const targetMs = new Date(`${date}T${time}:00`).getTime();
  const now = Date.now();
  const titleEl = document.getElementById(`${prefix}-title`);
  const daysEl = document.getElementById(`${prefix}-days`);
  const hoursEl = document.getElementById(`${prefix}-hours`);
  const minsEl = document.getElementById(`${prefix}-mins`);
  const secsEl = document.getElementById(`${prefix}-secs`);
  const msgEl = document.getElementById(`${prefix}-msg`);

  section.style.display = "";
  if (titleEl) titleEl.textContent = title;

  if (now >= targetMs) {
    const daysSince = getDaysSince(targetMs);
    if (daysEl) daysEl.textContent = String(daysSince);
    if (hoursEl) hoursEl.textContent = "00";
    if (minsEl) minsEl.textContent = "00";
    if (secsEl) secsEl.textContent = "00";
    if (msgEl) msgEl.textContent = doneMsg;
    return;
  }

  const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
  if (daysEl) daysEl.textContent = String(days);
  if (hoursEl) hoursEl.textContent = pad2(hours);
  if (minsEl) minsEl.textContent = pad2(minutes);
  if (secsEl) secsEl.textContent = pad2(seconds);
  if (msgEl) msgEl.textContent = days <= 7 ? `⏳ עוד ${days} ימים!` : "";

  const progressWrap = document.getElementById(`${prefix}-progress-wrap`);
  const progressBar = document.getElementById(`${prefix}-progress-bar`);
  if (progressWrap && progressBar && startDate) {
    const startMs = new Date(startDate).getTime();
    const progress = computeProgress(startMs, targetMs);
    if (progress !== null) {
      progressWrap.style.display = "";
      progressBar.style.width = `${Math.round(progress * 100)}%`;
    } else {
      progressWrap.style.display = "none";
    }
  } else if (progressWrap) {
    progressWrap.style.display = "none";
  }
}

/** F8 (v7.2): Tick for the optional 2nd countdown event. */
export function tick2(): void {
  const cfg = loadConfig();
  tickSecondary(
    "cd2",
    "cd2-section",
    cfg.countdownCard2Date,
    cfg.countdownCard2Time || "18:00",
    cfg.countdownCard2Title || "אירוע 2",
    cfg.countdownCard2DoneMsg || "🎉 מזל טוב!",
    cfg.countdownCard2StartDate,
  );
}

export function tick3(): void {
  const cfg = loadConfig();
  tickSecondary(
    "cd3",
    "cd3-section",
    cfg.countdownCard3Date,
    cfg.countdownCard3Time || "18:00",
    cfg.countdownCard3Title || "אירוע 3",
    cfg.countdownCard3DoneMsg || "🎉 מזל טוב!",
    cfg.countdownCard3StartDate,
  );
}

export function initCountdownCard(): void {
  cacheDom();
  tick();
  tick2();
  tick3();
  if (_cdInterval !== null) clearInterval(_cdInterval);
  _cdInterval = setInterval(() => {
    tick();
    tick2();
    tick3();
  }, 1000);
  diagLog("FDB-030: [countdown] Initialized");
}

export function destroyCountdownCard(): void {
  if (_cdInterval !== null) {
    clearInterval(_cdInterval);
    _cdInterval = null;
  }
}

// ── Sprint 82: configSchema ────────────────────────────────────────────────

export const countdownConfigSchema: CardConfigField[] = [
  {
    key: "countdownCardTitle",
    labelHe: "כותרת אירוע",
    labelEn: "Event Title",
    type: "text",
    defaultValue: "חתונת אליאור וטובה",
    tab: "calendar",
    group: "countdown",
  },
  {
    key: "countdownCardDate",
    labelHe: "תאריך יעד",
    labelEn: "Target Date",
    type: "date",
    defaultValue: "2026-05-07",
    tab: "calendar",
    group: "countdown",
  },
  {
    key: "countdownCardTime",
    labelHe: "שעת יעד",
    labelEn: "Target Time",
    type: "text",
    defaultValue: "18:00",
    placeholder: "HH:MM",
    tab: "calendar",
    group: "countdown",
  },
  {
    key: "countdownCardDoneMsg",
    labelHe: "הודעת סיום",
    labelEn: "Done Message",
    type: "text",
    defaultValue: "🎉 מזל טוב לאליאור ולטובה!",
    tab: "calendar",
    group: "countdown",
  },
  {
    key: "countdownCardStartDate",
    labelHe: "תאריך התחלה (פס התקדמות)",
    labelEn: "Start Date (progress bar)",
    type: "date",
    defaultValue: "",
    tab: "calendar",
    group: "countdown",
  },
  {
    key: "countdownCard2Title",
    labelHe: "אירוע 2 — כותרת",
    labelEn: "Event 2 — Title",
    type: "text",
    defaultValue: "",
    tab: "calendar",
    group: "countdown-2",
  },
  {
    key: "countdownCard2Date",
    labelHe: "אירוע 2 — תאריך",
    labelEn: "Event 2 — Date",
    type: "date",
    defaultValue: "",
    tab: "calendar",
    group: "countdown-2",
  },
  {
    key: "countdownCard2Time",
    labelHe: "אירוע 2 — שעה",
    labelEn: "Event 2 — Time",
    type: "text",
    defaultValue: "",
    placeholder: "HH:MM",
    tab: "calendar",
    group: "countdown-2",
  },
  {
    key: "countdownCard2DoneMsg",
    labelHe: "אירוע 2 — הודעת סיום",
    labelEn: "Event 2 — Done Msg",
    type: "text",
    defaultValue: "",
    tab: "calendar",
    group: "countdown-2",
  },
  {
    key: "countdownCard3Title",
    labelHe: "אירוע 3 — כותרת",
    labelEn: "Event 3 — Title",
    type: "text",
    defaultValue: "",
    tab: "calendar",
    group: "countdown-3",
  },
  {
    key: "countdownCard3Date",
    labelHe: "אירוע 3 — תאריך",
    labelEn: "Event 3 — Date",
    type: "date",
    defaultValue: "",
    tab: "calendar",
    group: "countdown-3",
  },
  {
    key: "countdownCard3Time",
    labelHe: "אירוע 3 — שעה",
    labelEn: "Event 3 — Time",
    type: "text",
    defaultValue: "",
    placeholder: "HH:MM",
    tab: "calendar",
    group: "countdown-3",
  },
  {
    key: "countdownCard3DoneMsg",
    labelHe: "אירוע 3 — הודעת סיום",
    labelEn: "Event 3 — Done Msg",
    type: "text",
    defaultValue: "",
    tab: "calendar",
    group: "countdown-3",
  },
];
