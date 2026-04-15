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
}

let els: CdEls = {
  title: null,
  days: null,
  hours: null,
  mins: null,
  secs: null,
  msg: null,
};

function cacheDom(): void {
  els = {
    title: document.getElementById("cd-wedding-title"),
    days: document.getElementById("cd-days"),
    hours: document.getElementById("cd-hours"),
    mins: document.getElementById("cd-mins"),
    secs: document.getElementById("cd-secs"),
    msg: document.getElementById("cd-msg"),
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
    daysEl.textContent = "0";
    if (hoursEl) hoursEl.textContent = "00";
    if (minsEl) minsEl.textContent = "00";
    if (secsEl) secsEl.textContent = "00";
    if (msgEl)
      msgEl.textContent = getCountdownDoneMsg();
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
}

// ── Init / Destroy ───────────────────────────────────────────────────────────

export function initCountdownCard(): void {
  cacheDom();
  tick();
  if (_cdInterval !== null) clearInterval(_cdInterval);
  _cdInterval = setInterval(tick, 1000);
  diagLog("[countdown] Initialized");
}

export function destroyCountdownCard(): void {
  if (_cdInterval !== null) {
    clearInterval(_cdInterval);
    _cdInterval = null;
  }
}
