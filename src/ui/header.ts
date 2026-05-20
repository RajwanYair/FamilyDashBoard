/**
 * FamilyDashBoard v13 — Header (Clock, Greeting, Progress Bars, Chips)
 */

import "./header.css";
import { loadConfig } from "../core/config";
import { diagLog } from "../core/diag";
import { INTERVALS } from "../core/constants";
import { getInterfaceLanguage, t } from "../core/i18n";
import { today, fromParts, diffDays, dayProgressPct, yearProgressPct } from "../core/temporal";

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
 * Get time-of-day greeting in the active interface language.
 */
function getGreeting(): string {
  const cfg = loadConfig();
  const familyName = cfg.familyName || "רגואן";
  const members = cfg.members ?? [];
  const language = getInterfaceLanguage();
  const now = today();
  const h = now.getHours();
  const idx = (now.getDate() - 1) % Math.max(members.length, 1);
  const greetPerson = members.length > 0 ? members[idx] : null;
  const suffix = greetPerson
    ? `${greetPerson}!`
    : language === "en"
      ? `${familyName} family!`
      : `למשפחת ${familyName}!`;

  if (h >= 5 && h < 12) return t("goodMorning", { suffix });
  if (h >= 12 && h < 17) return t("goodNoon");
  if (h >= 17 && h < 21) return t("goodEvening", { suffix });
  return t("goodNight");
}

/**
 * Update day/year progress bars.
 */
function updateProgress(now: Date): void {
  if (elDayBar) elDayBar.style.width = `${dayProgressPct(now).toFixed(1)}%`;
  if (elYearBar) elYearBar.style.width = `${yearProgressPct(now).toFixed(1)}%`;
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

  const todayDate = today();
  todayDate.setHours(0, 0, 0, 0);
  let nearest: { name: string; daysAway: number } | null = null;

  for (const { name, month, day } of birthdays) {
    const bdayThisYear = fromParts(todayDate.getFullYear(), month, day);
    const bday =
      bdayThisYear >= todayDate ? bdayThisYear : fromParts(todayDate.getFullYear() + 1, month, day);
    const daysAway = diffDays(todayDate, bday);
    if (daysAway <= 14 && (!nearest || daysAway < nearest.daysAway)) {
      nearest = { name, daysAway };
    }
  }

  if (nearest) {
    const label =
      nearest.daysAway === 0
        ? t("birthdayToday", { name: nearest.name })
        : t("birthdayInDays", {
            name: nearest.name,
            days: nearest.daysAway,
          });
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

  const todayD = today();
  todayD.setHours(0, 0, 0, 0);
  const target = fromParts(...(countdownDate.split("-").map(Number) as [number, number, number]));
  const days = diffDays(todayD, target);

  if (days < 0) {
    elCountdownChip.textContent = "";
    elCountdownChip.hidden = true;
    return;
  }

  elCountdownChip.textContent =
    days === 0
      ? t("countdownToday", { label: countdownLabel })
      : t("countdownInDays", { label: countdownLabel, days });
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

// Hebrew gematria alphabet lookup tables
const _GEM_ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const _GEM_TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];

/**
 * Convert a positive integer (1–9999) to a Hebrew gematria string.
 * - Thousands are separated with a geresh (׳), e.g. 5786 → ה׳תשפ״ו
 * - Multi-letter numbers have gershayim (״) before the last letter, e.g. 25 → כ״ה
 * - Single-letter numbers get a geresh, e.g. 5 → ה׳
 * - Special cases: 15 → ט״ו, 16 → ט״ז (to avoid divine-name abbreviations)
 * - Falls back to String(n) for out-of-range inputs.
 */
export function numToGematria(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n > 9999) return String(n);

  let rem = n;
  const parts: string[] = [];

  // Thousands (1–9) → single letter with geresh added later
  if (rem >= 1000) {
    const th = Math.floor(rem / 1000);
    parts.push((_GEM_ONES[th] ?? "") + "׳");
    rem %= 1000;
  }

  // Hundreds — repeat ת for values ≥ 400
  while (rem >= 400) {
    parts.push("ת");
    rem -= 400;
  }
  if (rem >= 100) {
    const hIdx = Math.floor(rem / 100);
    parts.push(["", "ק", "ר", "ש"][hIdx] ?? "");
    rem %= 100;
  }

  // Special: 15 → ט+ו, 16 → ט+ז (avoid divine abbreviations)
  if (rem === 15) {
    parts.push("ט", "ו");
  } else if (rem === 16) {
    parts.push("ט", "ז");
  } else {
    if (rem >= 10) {
      parts.push(_GEM_TENS[Math.floor(rem / 10)] ?? "");
      rem %= 10;
    }
    if (rem > 0) {
      parts.push(_GEM_ONES[rem] ?? "");
    }
  }

  // Add punctuation: geresh after thousands prefix (already added), gershayim before last letter
  const thousands = parts.findIndex((p) => p.endsWith("׳"));
  const suffix = thousands >= 0 ? parts.slice(thousands + 1) : parts;
  const prefix = thousands >= 0 ? parts.slice(0, thousands + 1) : [];

  let suffixStr: string;
  if (suffix.length === 0) {
    // Pure thousands (e.g. n=1000 → "א׳")
    suffixStr = "";
  } else if (suffix.length === 1) {
    suffixStr = suffix[0] + "׳";
  } else {
    suffixStr = suffix.slice(0, -1).join("") + "״" + suffix[suffix.length - 1];
  }

  return prefix.join("") + suffixStr;
}

/**
 * Build the full Hebrew date string in Hebrew letters (gematria) for a given Date.
 * Uses Intl.DateTimeFormat with the Hebrew calendar to get weekday, month name, day
 * and year in their natural order, then replaces numeric day/year with gematria.
 * Returns a string like: "יום חמישי, כ״ה ניסן ה׳תשפ״ו"
 */
export function formatHebrewDateGematria(date: Date): string {
  const fmt = new Intl.DateTimeFormat("he-u-ca-hebrew", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  // Replace any run of ASCII digits with their gematria equivalent
  return fmt.format(date).replace(/\d+/gu, (m) => numToGematria(parseInt(m, 10)));
}

/**
 * Tick the clock, update greeting and progress bars.
 */
export function tickClock(): void {
  const now = today();

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

  const timeText = now.toLocaleTimeString("he-IL", fmtOpts);
  if (elClock && elClock.textContent !== timeText) elClock.textContent = timeText;

  const d = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  if (elEngDate && elEngDate.textContent !== d) elEngDate.textContent = d;

  // Build Hebrew date with all numbers as Hebrew gematria letters (browser-independent).
  const hd = formatHebrewDateGematria(now);
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
  setInterval(tickClock, INTERVALS.CLOCK);
  diagLog("[header] Initialized");
}
