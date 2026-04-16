/**
 * FamilyDashBoard v6 — Header (Clock, Greeting, Progress Bars, Chips)
 */

import "./header.css";
import { loadConfig } from "../core/config";
import { diagLog } from "../core/diag";

// ── DOM cache ──
let elClock: HTMLElement | null = null;
let elEngDate: HTMLElement | null = null;
let elHebrewDate: HTMLElement | null = null;
let elGreeting: HTMLElement | null = null;
let elDayBar: HTMLElement | null = null;
let elYearBar: HTMLElement | null = null;
let elBirthdayChip: HTMLElement | null = null;
let elCountdownChip: HTMLElement | null = null;
let elElecBadge: HTMLElement | null = null;
let clockShowSeconds = false;

/**
 * Get time-of-day greeting in Hebrew.
 */
function getGreeting(): string {
  const cfg = loadConfig();
  const familyName = cfg.familyName || "רגואן";
  const members = cfg.members ?? [];
  const h = new Date().getHours();
  const idx = (new Date().getDate() - 1) % Math.max(members.length, 1);
  const greetPerson = members.length > 0 ? members[idx] : null;
  const suffix = greetPerson ? `${greetPerson}!` : `למשפחת ${familyName}!`;

  if (h >= 5 && h < 12) return `🌅 בוקר טוב ${suffix}`;
  if (h >= 12 && h < 17) return "☀️ צהריים טובים!";
  if (h >= 17 && h < 21) return `🌆 ערב טוב ${suffix}`;
  return "🌙 לילה טוב!";
}

/**
 * Update day/year progress bars.
 */
function updateProgress(now: Date): void {
  // Day progress (minutes elapsed / 1440)
  const dayPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  if (elDayBar) elDayBar.style.width = `${dayPct.toFixed(1)}%`;

  // Year progress
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
  const yearPct =
    ((now.getTime() - startOfYear.getTime()) /
      (endOfYear.getTime() - startOfYear.getTime())) *
    100;
  if (elYearBar) elYearBar.style.width = `${yearPct.toFixed(1)}%`;
}

/**
 * Show a birthday chip in the header if any birthday is within 14 days.
 * Config: `birthdays: Array<{ name, month, day }>` (1-based month).
 */
export function updateBirthdayChip(): void {
  if (!elBirthdayChip) return;
  const { birthdays } = loadConfig();
  if (!birthdays.length) {
    elBirthdayChip.textContent = "";
    elBirthdayChip.hidden = true;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let nearest: { name: string; daysAway: number } | null = null;

  for (const { name, month, day } of birthdays) {
    const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
    const bday = bdayThisYear >= today ? bdayThisYear : new Date(today.getFullYear() + 1, month - 1, day);
    const daysAway = Math.round((bday.getTime() - today.getTime()) / 86_400_000);
    if (daysAway <= 14 && (!nearest || daysAway < nearest.daysAway)) {
      nearest = { name, daysAway };
    }
  }

  if (nearest) {
    const label =
      nearest.daysAway === 0
        ? `🎂 יום הולדת — ${nearest.name}!`
        : `🎂 ${nearest.name} בעוד ${nearest.daysAway} ימים`;
    elBirthdayChip.textContent = label;
    elBirthdayChip.hidden = false;
  } else {
    elBirthdayChip.textContent = "";
    elBirthdayChip.hidden = true;
  }
}

/**
 * Show a countdown chip in the header for a user-configured event.
 * Config: `countdownDate` (ISO date string) + `countdownLabel` (text).
 */
export function updateCountdownChip(): void {
  if (!elCountdownChip) return;
  const { countdownDate, countdownLabel } = loadConfig();
  if (!countdownDate || !countdownLabel) {
    elCountdownChip.textContent = "--";
    elCountdownChip.hidden = true;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(countdownDate + "T00:00:00");
  const msAway = target.getTime() - today.getTime();

  if (msAway < 0) {
    elCountdownChip.textContent = "";
    elCountdownChip.hidden = true;
    return;
  }

  const days = Math.round(msAway / 86_400_000);
  elCountdownChip.textContent =
    days === 0 ? `🎉 ${countdownLabel} — היום!` : `⏳ ${countdownLabel}: ${days} ימים`;
  elCountdownChip.hidden = false;
}

/**
 * Show/hide the electricity peak-hour badge.
 * Israeli residential tariff: weekdays (Sun–Thu) 17:00–22:00 = peak.
 */
export function updateElecBadge(now: Date): void {
  if (!elElecBadge) return;
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const isWeekday = day <= 4; // Sun–Thu
  const isPeak = isWeekday && hour >= 17 && hour < 22;
  elElecBadge.classList.toggle("peak-on", isPeak);
}

/**
 * Tick the clock, update greeting and progress bars.
 */
export function tickClock(): void {
  const now = new Date();

  const fmtOpts: Intl.DateTimeFormatOptions = clockShowSeconds
    ? {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Jerusalem",
      }
    : {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jerusalem",
      };

  const t = now.toLocaleTimeString("he-IL", fmtOpts);
  if (elClock && elClock.textContent !== t) elClock.textContent = t;

  const d = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  if (elEngDate && elEngDate.textContent !== d) elEngDate.textContent = d;

  const hd = now.toLocaleDateString("he-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  if (elHebrewDate && elHebrewDate.textContent !== hd) elHebrewDate.textContent = hd;

  const g = getGreeting();
  if (elGreeting && elGreeting.textContent !== g) elGreeting.textContent = g;

  updateProgress(now);
  updateBirthdayChip();
  updateCountdownChip();
  updateElecBadge(now);
}

/**
 * Toggle seconds display mode.
 */
export function toggleClockSeconds(): void {
  clockShowSeconds = !clockShowSeconds;
  tickClock();
}

/**
 * Directly set the seconds display mode (used by config panel on save).
 */
export function setClockSeconds(value: boolean): void {
  clockShowSeconds = value;
  tickClock();
}

/**
 * Initialize the header — cache DOM refs, do first tick, start interval.
 */
export function initHeader(): void {
  elClock = document.getElementById("clock");
  elEngDate = document.getElementById("eng-date");
  elHebrewDate = document.getElementById("hebrew-date");
  elGreeting = document.getElementById("greeting");
  elDayBar = document.getElementById("day-bar");
  elYearBar = document.getElementById("year-bar");
  elBirthdayChip = document.getElementById("header-birthday-chip");
  elCountdownChip = document.getElementById("header-countdown");
  elElecBadge = document.getElementById("elec-badge");

  const cfg = loadConfig();
  clockShowSeconds = cfg.clockSeconds ?? false;

  tickClock();
  setInterval(tickClock, 60_000);
  diagLog("[header] Initialized");
}
