/**
 * FamilyDashBoard v13 — Countdown Card
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
import { cGetStale } from "../../core/cache";
import type { HebcalItem } from "../../types/api";
import type { DurationParts } from "../../core/utils";
import type { CardConfigField } from "../../types/card";

// ── Config-driven helpers ─────────────────────────────────────────────────────

export function getCountdownTargetDate(): Date {
  const c = loadConfig();
  let d = c.countdownCardDate || "2026-05-07";
  const t = c.countdownCardTime || "18:00";
  // Sprint 180 / CD3: advance past recurring dates
  const recurrence = c.countdownCardRecurrence || undefined;
  if (recurrence === "annual") {
    d = advanceAnnualDate(d);
  } else if (recurrence === "monthly") {
    d = advanceMonthlyDate(d);
  }
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
  /** Sprint 191 / CD4: body element for confetti class toggle */
  body: HTMLElement | null;
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
  body: null,
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
    body: document.querySelector(".countdown-body"),
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

/**
 * Sprint 180 / CD3: When the target date is in the past and recurrence is monthly,
 * advance it to the same day-of-month in the next upcoming calendar month.
 * Returns the updated YYYY-MM-DD string.
 */
export function advanceMonthlyDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const day = parts[2] ?? "01";
  let d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  const now = Date.now();
  while (d.getTime() < now) {
    // Advance by one month
    const nextMonth = d.getMonth() + 1;
    const nextYear = nextMonth > 11 ? d.getFullYear() + 1 : d.getFullYear();
    const wrappedMonth = nextMonth > 11 ? 0 : nextMonth;
    d = new Date(nextYear, wrappedMonth, parseInt(day, 10));
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Sprint 180 / CD1: Find the next upcoming Yom Tov (holiday) from Hebcal items
 * within the next `maxDays` days (default 90). Returns title + YYYY-MM-DD date string,
 * or null when no holiday is found in range.
 */
export function getNextYomTov(
  items: HebcalItem[],
  now: Date = new Date(),
  maxDays = 90,
): { title: string; date: string } | null {
  const nowMs = now.setHours(0, 0, 0, 0);
  const cutoff = nowMs + maxDays * MS_PER_DAY;
  const upcoming = items
    .filter((i) => {
      if (i.category !== "holiday") return false;
      const d = new Date(i.date).setHours(0, 0, 0, 0);
      return d >= nowMs && d <= cutoff;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const first = upcoming[0];
  if (!first) return null;
  const dateStr = first.date.slice(0, 10);
  return { title: first.hebrew ?? first.title, date: dateStr };
}

/**
 * Sprint 180 / CD2: Parse ICS text and find the next calendar event that is
 * at least `minDaysAhead` days in the future (default 7). Returns title + date,
 * or null when none found.
 */
export function getNextCalEventForCountdown(
  icsText: string,
  minDaysAhead = 7,
): { title: string; date: string } | null {
  const minMs = Date.now() + minDaysAhead * MS_PER_DAY;
  const blocks = icsText.split("BEGIN:VEVENT");
  const events: Array<{ title: string; date: string; ms: number }> = [];
  for (const block of blocks.slice(1)) {
    const sumMatch = /^SUMMARY[^:]*:(.+)/m.exec(block);
    const dtMatch = /^DTSTART(?:;[^:]+)?:(\d{8}(?:T\d{6}Z?)?)/m.exec(block);
    if (!sumMatch || !dtMatch) continue;
    const title = (sumMatch[1] ?? "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
    const raw = dtMatch[1] ?? "";
    let d: Date;
    if (raw.length === 8) {
      d = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`);
    } else {
      d = new Date(
        raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/, "$1-$2-$3T$4:$5:$6$7"),
      );
    }
    if (!isNaN(d.getTime()) && d.getTime() >= minMs) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      events.push({ title, date: dateStr, ms: d.getTime() });
    }
  }
  events.sort((a, b) => a.ms - b.ms);
  const first = events[0];
  return first ? { title: first.title, date: first.date } : null;
}

// ── Sprint 191 / CD4: CSS Confetti ──────────────────────────────────────────

const CD_CONFETTI_CLASS = "cd-confetti";

/**
 * Adds or removes the `cd-confetti` CSS class on the countdown body element.
 * The animation is defined in countdown.css and only plays when the user has
 * not opted in to `prefers-reduced-motion: reduce`.
 */
export function setConfetti(active: boolean): void {
  const body = els.body ?? document.querySelector<HTMLElement>(".countdown-body");
  if (!body) return;
  body.classList.toggle(CD_CONFETTI_CLASS, active);
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
    // Sprint 191 / CD4: show CSS confetti on the exact day of the event (T-0)
    setConfetti(daysSince === 0);
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

  // Sprint 180 / CD1: Auto-populate slot 2 with next Yom Tov if unset
  const cfg2 = loadConfig();
  if (!cfg2.countdownCard2Date) {
    const now = new Date();
    const holKey = `holidays-${now.getFullYear()}-${now.getMonth()}`;
    const holData = cGetStale<{ items: HebcalItem[] }>(holKey);
    if (holData?.items) {
      const yomTov = getNextYomTov(holData.items, now);
      if (yomTov) {
        const section2 = document.getElementById("cd2-section");
        const title2 = document.getElementById("cd2-title");
        if (section2 && title2) {
          title2.textContent = yomTov.title;
          section2.style.display = "";
          const daysEl = document.getElementById("cd2-days");
          const hoursEl = document.getElementById("cd2-hours");
          const minsEl = document.getElementById("cd2-mins");
          const secsEl = document.getElementById("cd2-secs");
          const targetMs = new Date(`${yomTov.date}T18:00:00`).getTime();
          const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
          if (daysEl) daysEl.textContent = String(days);
          if (hoursEl) hoursEl.textContent = pad2(hours);
          if (minsEl) minsEl.textContent = pad2(minutes);
          if (secsEl) secsEl.textContent = pad2(seconds);
        }
      }
    }
  }

  // Sprint 180 / CD2: Auto-populate slot 3 with next calendar event (≥ 7 days) if unset
  const cfg3 = loadConfig();
  if (!cfg3.countdownCard3Date) {
    const icsText = cGetStale<string>("cal-ics");
    if (icsText) {
      const calEvent = getNextCalEventForCountdown(icsText);
      if (calEvent) {
        const section3 = document.getElementById("cd3-section");
        const title3 = document.getElementById("cd3-title");
        if (section3 && title3) {
          title3.textContent = calEvent.title;
          section3.style.display = "";
          const daysEl = document.getElementById("cd3-days");
          const hoursEl = document.getElementById("cd3-hours");
          const minsEl = document.getElementById("cd3-mins");
          const secsEl = document.getElementById("cd3-secs");
          const targetMs = new Date(`${calEvent.date}T18:00:00`).getTime();
          const { days, hours, minutes, seconds } = getTimeComponents(targetMs);
          if (daysEl) daysEl.textContent = String(days);
          if (hoursEl) hoursEl.textContent = pad2(hours);
          if (minsEl) minsEl.textContent = pad2(minutes);
          if (secsEl) secsEl.textContent = pad2(seconds);
        }
      }
    }
  }

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
    key: "countdownCardRecurrence",
    labelHe: "חזרתיות",
    labelEn: "Recurrence",
    type: "select",
    defaultValue: "",
    options: [
      { value: "", label: "ללא" },
      { value: "annual", label: "שנתי" },
      { value: "monthly", label: "חודשי" },
    ],
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
