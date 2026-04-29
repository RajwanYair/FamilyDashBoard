/**
 * Sprint 190 / X1: Today Pane
 *
 * A collapsible summary bar between the header and main grid.
 * Aggregates urgent items from multiple cards: next calendar event ≤6h,
 * active alert badge, countdown ≤24h, most-overdue task, top stock mover ≥3%.
 * Auto-collapses when the items list is empty.
 */

import "./today-pane.css";
import {
  LS_CHORES,
  MS_PER_MIN,
} from "../core/constants";
import { alertRingGet } from "../cards/alerts/alerts";
import { getCountdownTargetDate, getCountdownTitle } from "../cards/countdown/countdown";
import type { AlertEvent } from "../types/api";
import type { ChoreItem } from "../cards/tasks/tasks";
import { isOverdue, parseTaskDueDate } from "../cards/tasks/tasks";

// ── Types ────────────────────────────────────────────────────────────────────

export type TodayUrgency = "normal" | "warning" | "critical";

export interface TodayPaneItem {
  /** Unique type key — only one item per type rendered. */
  type: string;
  icon: string;
  label: string;
  urgency: TodayUrgency;
}

export interface TodayPaneInputs {
  nowMs: number;
  alerts: AlertEvent[];
  countdownTargetMs: number | null;
  countdownTitle: string;
  chores: ChoreItem[];
  /** Top stock mover pill texts already rendered in DOM (e.g. ["TSLA +5.2%", "AAPL -3.1%"]). */
  stockMovers: string[];
  /** Next calendar event within 6h: label + minutesUntil. null if none. */
  nextCalEvent: { label: string; minutesUntil: number } | null;
}

// ── Pure builder ─────────────────────────────────────────────────────────────

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Pure function: derive today-pane items from structured inputs.
 * Returns items sorted: critical → warning → normal.
 */
export function buildTodayItems(inputs: TodayPaneInputs): TodayPaneItem[] {
  const items: TodayPaneItem[] = [];

  // ── Alerts: active alert zones ──────────────────────────────────────────
  const activeAlerts = inputs.alerts.filter((ev) =>
    ev.alerts.some((z) => z.time * 1000 > inputs.nowMs - 60 * 60 * 1000), // within last hour
  );
  if (activeAlerts.length > 0) {
    const zoneName = activeAlerts[0]?.alerts[0]?.cities[0] ?? "אזור לא ידוע";
    items.push({
      type: "alert",
      icon: "🚨",
      label: `${activeAlerts.length > 1 ? `${activeAlerts.length} אזורים` : zoneName}`,
      urgency: "critical",
    });
  }

  // ── Calendar: next event ≤6h ────────────────────────────────────────────
  if (
    inputs.nextCalEvent !== null &&
    inputs.nextCalEvent.minutesUntil >= 0 &&
    inputs.nextCalEvent.minutesUntil * 60 * 1000 <= SIX_HOURS_MS
  ) {
    const mins = inputs.nextCalEvent.minutesUntil;
    const timeLabel = mins < 60 ? `בעוד ${mins} דק׳` : `בעוד ${Math.round(mins / 60)} שע׳`;
    items.push({
      type: "cal",
      icon: "📅",
      label: `${inputs.nextCalEvent.label} — ${timeLabel}`,
      urgency: mins <= 30 ? "warning" : "normal",
    });
  }

  // ── Countdown: ≤24h ─────────────────────────────────────────────────────
  if (inputs.countdownTargetMs !== null) {
    const diffMs = inputs.countdownTargetMs - inputs.nowMs;
    if (diffMs > 0 && diffMs <= TWENTY_FOUR_HOURS_MS) {
      const hrs = Math.floor(diffMs / (60 * 60 * 1000));
      const label =
        hrs === 0
          ? `${inputs.countdownTitle} — פחות משעה`
          : `${inputs.countdownTitle} — ${hrs} שעות`;
      items.push({
        type: "countdown",
        icon: "⏳",
        label,
        urgency: hrs < 3 ? "warning" : "normal",
      });
    }
  }

  // ── Tasks: most-overdue ─────────────────────────────────────────────────
  const overdueTasks = inputs.chores.filter((c) => {
    const { dueDate } = parseTaskDueDate(c.chore);
    return dueDate !== null && isOverdue(dueDate);
  });
  if (overdueTasks.length > 0) {
    const first = overdueTasks[0]!;
    const { cleanText } = parseTaskDueDate(first.chore);
    items.push({
      type: "tasks",
      icon: "⚠️",
      label: `${overdueTasks.length === 1 ? `משימה באיחור: ${cleanText}` : `${overdueTasks.length} משימות באיחור`}`,
      urgency: "warning",
    });
  }

  // ── Stocks: top mover ≥3% ───────────────────────────────────────────────
  const bigMovers = inputs.stockMovers.filter((s) => {
    const m = s.match(/([+-]?\d+\.?\d*)\s*%/);
    if (!m) return false;
    return Math.abs(parseFloat(m[1]!)) >= 3;
  });
  if (bigMovers.length > 0) {
    items.push({
      type: "stocks",
      icon: "📈",
      label: bigMovers[0]!,
      urgency: "normal",
    });
  }

  // Sort: critical first, then warning, then normal
  const order: Record<TodayUrgency, number> = { critical: 0, warning: 1, normal: 2 };
  return items.sort((a, b) => order[a.urgency] - order[b.urgency]);
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

let _paneEl: HTMLElement | null = null;
let _itemsEl: HTMLElement | null = null;
let _refreshTimer: ReturnType<typeof setInterval> | null = null;

export function cachePaneDom(): void {
  _paneEl = document.getElementById("today-pane");
  _itemsEl = document.getElementById("today-pane-items");
}

/**
 * Render items into the pane container.
 * Collapses the section (is-hidden) when the items array is empty.
 */
export function renderTodayPane(items: TodayPaneItem[], container: HTMLElement): void {
  container.textContent = "";
  const frag = document.createDocumentFragment();
  for (const item of items) {
    const pill = document.createElement("span");
    pill.className = `today-pill today-pill--${item.urgency}`;
    pill.dataset["type"] = item.type;
    const iconEl = document.createElement("span");
    iconEl.className = "today-pill-icon";
    iconEl.textContent = item.icon;
    iconEl.setAttribute("aria-hidden", "true");
    const labelEl = document.createElement("span");
    labelEl.className = "today-pill-label";
    labelEl.textContent = item.label;
    pill.append(iconEl, labelEl);
    frag.appendChild(pill);
  }
  container.appendChild(frag);
}

/** Read chores from localStorage without importing the private loadChores fn. */
function readChores(): ChoreItem[] {
  try {
    const raw = localStorage.getItem(LS_CHORES);
    if (!raw) return [];
    return JSON.parse(raw) as ChoreItem[];
  } catch {
    return [];
  }
}

/** Read stock mover pill labels from DOM elements added in Sprint 187. */
function readStockMovers(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".stk-mover-pill"))
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);
}

/** Read next calendar event from the countdown DOM element. */
function readNextCalEvent(): { label: string; minutesUntil: number } | null {
  const el = document.getElementById("cal-countdown");
  if (!el || !el.textContent) return null;
  const text = el.textContent.trim();
  if (!text) return null;
  // Try to extract minutes from data attribute if available
  const minsAttr = el.dataset["minutesUntil"];
  if (minsAttr !== undefined) {
    const mins = parseInt(minsAttr, 10);
    if (Number.isFinite(mins) && mins >= 0) {
      return { label: text.replace(/^.*?:\s*/, "").substring(0, 30), minutesUntil: mins };
    }
  }
  return null;
}

/** Collect all inputs for buildTodayItems from DOM + localStorage + card APIs. */
export function collectInputs(): TodayPaneInputs {
  const countdownDate = (() => {
    try {
      return getCountdownTargetDate();
    } catch {
      return null;
    }
  })();
  const countdownTitle = (() => {
    try {
      return getCountdownTitle();
    } catch {
      return "";
    }
  })();

  return {
    nowMs: Date.now(),
    alerts: alertRingGet(),
    countdownTargetMs: countdownDate ? countdownDate.getTime() : null,
    countdownTitle,
    chores: readChores(),
    stockMovers: readStockMovers(),
    nextCalEvent: readNextCalEvent(),
  };
}

/** Refresh the today pane once. */
export function refreshTodayPane(): void {
  if (!_itemsEl || !_paneEl) return;
  const inputs = collectInputs();
  const items = buildTodayItems(inputs);
  renderTodayPane(items, _itemsEl);
  if (items.length === 0) {
    _paneEl.classList.add("is-hidden");
  } else {
    _paneEl.classList.remove("is-hidden");
  }
}

/** Initialize the today pane: wire DOM, start refresh interval (every 60s). */
export function initTodayPane(): void {
  cachePaneDom();
  if (!_paneEl || !_itemsEl) return;
  refreshTodayPane();
  if (_refreshTimer !== null) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(refreshTodayPane, 60 * MS_PER_MIN);
}

/** Reset state for tests only. */
export function _resetTodayPaneForTest(): void {
  if (_refreshTimer !== null) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
  _paneEl = null;
  _itemsEl = null;
}
