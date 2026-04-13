/**
 * FamilyDashBoard v6 — Header (Clock, Greeting, Progress Bars)
 */

import { loadConfig } from "../core/config";
import { diagLog } from "../core/diag";

// ── DOM cache ──
let elClock: HTMLElement | null = null;
let elEngDate: HTMLElement | null = null;
let elGreeting: HTMLElement | null = null;
let elDayBar: HTMLElement | null = null;
let elYearBar: HTMLElement | null = null;
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

  const g = getGreeting();
  if (elGreeting && elGreeting.textContent !== g) elGreeting.textContent = g;

  updateProgress(now);
}

/**
 * Toggle seconds display mode.
 */
export function toggleClockSeconds(): void {
  clockShowSeconds = !clockShowSeconds;
  tickClock();
}

/**
 * Initialize the header — cache DOM refs, do first tick, start interval.
 */
export function initHeader(): void {
  elClock = document.getElementById("clock");
  elEngDate = document.getElementById("eng-date");
  elGreeting = document.getElementById("greeting");
  elDayBar = document.getElementById("day-bar");
  elYearBar = document.getElementById("year-bar");

  const cfg = loadConfig();
  clockShowSeconds = cfg.clockSeconds ?? false;

  tickClock();
  setInterval(tickClock, 60_000);
  diagLog("[header] Initialized");
}
