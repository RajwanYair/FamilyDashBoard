/**
 * Today Pane
 * X12: migrated collectInputs() to consume card signals via
 * getCardSignal() instead of direct cross-card imports (ADR-067).
 *
 * A collapsible summary bar between the header and main grid.
 * Aggregates urgent items from multiple cards: next calendar event ≤6h,
 * active alert badge, countdown ≤24h, most-overdue task, top stock mover ≥3%.
 * Auto-collapses when the items list is empty.
 */

import "./today-pane.css";
import { MS_PER_MIN } from "../core/constants";
import { getCardSignal } from "../core/card-signal-protocol";
import type { AlertEvent } from "../types/api";

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
  /** Overdue task count from tasks signal (X12). */
  overdueTaskCount: number;
  /** Clean text of the first overdue task, or null if none. */
  firstOverdueText: string | null;
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
  const activeAlerts = inputs.alerts.filter(
    (ev) => ev.alerts.some((z) => z.time * 1000 > inputs.nowMs - 60 * 60 * 1000), // within last hour
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

  // ── Tasks: most-overdue (X12: consumed from tasks signal) ──────────────
  if (inputs.overdueTaskCount > 0) {
    items.push({
      type: "tasks",
      icon: "⚠️",
      label:
        inputs.overdueTaskCount === 1 && inputs.firstOverdueText
          ? `משימה באיחור: ${inputs.firstOverdueText}`
          : `${inputs.overdueTaskCount} משימות באיחור`,
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

// ── Signal type helpers (X12 ADR-067) ────────────────────────────────────────

interface AlertsSignal {
  count: number;
  areas: string[];
  latestTs: number;
}
interface CountdownSignal {
  targetMs: number;
  title: string;
}
interface TopMoverSignal {
  sym: string;
  pct: number;
  dir: "up" | "down";
}
interface CalEventSignal {
  title: string;
  startMs: number;
  isAllDay: boolean;
}
interface TasksPendingSignal {
  count: number;
  overdue: number;
  total: number;
  firstOverdueText: string | null;
}

/**
 * X12: Collect today-pane inputs from card signals (ADR-067).
 * Uses getCardSignal() for all data — no direct cross-card imports.
 * Stock movers fall back to DOM pills when signal is absent for backward compat.
 */
function collectInputs(): TodayPaneInputs {
  const nowMs = Date.now();

  // Alerts — read from "alerts.active" signal
  const alertSig = getCardSignal<AlertsSignal>("alerts", "active");
  const alertVal = alertSig?.value ?? null;
  const alerts: AlertEvent[] = alertVal
    ? Array.from({ length: alertVal.count }, (_, i) => ({
        alerts: [
          {
            cities: [alertVal.areas[i % alertVal.areas.length] ?? "אזור"],
            threat: 0,
            time: alertVal.latestTs,
          },
        ],
      }))
    : [];

  // Countdown — read from "countdown.next" signal
  const cdSig = getCardSignal<CountdownSignal>("countdown", "next");
  const countdownTargetMs = cdSig?.value?.targetMs ?? null;
  const countdownTitle = cdSig?.value?.title ?? "";

  // Stocks — read from "stocks.top-mover" signal; fall back to DOM pills
  const stockSig = getCardSignal<TopMoverSignal>("stocks", "top-mover");
  const stockMovers: string[] = stockSig?.value
    ? [
        `${stockSig.value.sym} ${stockSig.value.dir === "up" ? "+" : ""}${stockSig.value.pct.toFixed(1)}%`,
      ]
    : Array.from(document.querySelectorAll<HTMLElement>(".stk-mover-pill"))
        .map((el) => el.textContent?.trim() ?? "")
        .filter(Boolean);

  // Calendar — read from "calendar.next-event" signal
  const calSig = getCardSignal<CalEventSignal>("calendar", "next-event");
  const nextCalEvent =
    calSig?.value && !calSig.value.isAllDay
      ? {
          label: calSig.value.title.substring(0, 40),
          minutesUntil: Math.round((calSig.value.startMs - nowMs) / MS_PER_MIN),
        }
      : null;

  // Tasks — read from "tasks.pending" signal (X12: replaces readChores + isOverdue)
  const tasksSig = getCardSignal<TasksPendingSignal>("tasks", "pending");
  const overdueTaskCount = tasksSig?.value?.overdue ?? 0;
  const firstOverdueText = tasksSig?.value?.firstOverdueText ?? null;

  return {
    nowMs,
    alerts,
    countdownTargetMs,
    countdownTitle,
    overdueTaskCount,
    firstOverdueText,
    stockMovers,
    nextCalEvent,
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
