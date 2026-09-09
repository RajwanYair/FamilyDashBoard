/**
 * FamilyDashBoard — Freshness Badge System (P1 Info Hierarchy)
 *
 * Shows "X minutes ago" / "Y hours ago" badges on data cards so the user
 * instantly sees how recent the displayed data is.
 *
 * Usage:
 *   markFresh("weather");          // call after successful fetch
 *   renderFreshnessBadge("weather", containerEl);  // mount badge into a card
 *
 * A single 30-second interval updates all registered badges.
 */

import { nowMs, fromEpochMs } from "./temporal";
import { INTERVALS, MS_PER_MIN } from "./constants";

// ── State ──────────────────────────────────────────────────────────────────────

export interface FreshnessMetadata {
  /** Upstream observation/publication time, when supplied by the provider. */
  observedAtMs?: number;
  /** Original retrieval time when data is rendered from a cache hit. */
  retrievedAtMs?: number;
  /** Local render time, useful when rendering is deferred after retrieval. */
  renderedAtMs?: number;
  /** Provider/card-specific freshness boundary. */
  ttlMs?: number;
}

export interface FreshnessSnapshot {
  cardId: string;
  retrievedAtMs: number;
  observedAtMs: number | null;
  renderedAtMs: number;
  ageMs: number;
  ttlMs: number;
  state: "fresh" | "aging" | "stale";
}

interface FreshnessRecord {
  retrievedAtMs: number;
  observedAtMs: number | null;
  renderedAtMs: number;
  ttlMs: number;
}

const CARD_ID_ALIASES: Readonly<Record<string, string>> = {
  cal: "calendar",
  cur: "currency",
  hebcal: "hebrew-cal",
  moti: "motivation",
  wx: "weather",
};

const DEFAULT_TTLS: Readonly<Record<string, number>> = {
  alerts: INTERVALS.ALERTS_ACTIVE,
  calendar: INTERVALS.CALENDAR,
  currency: INTERVALS.CURRENCY,
  "hebrew-cal": INTERVALS.HEBREW_CAL,
  motivation: INTERVALS.MOTIVATION,
  news: INTERVALS.NEWS,
  stocks: INTERVALS.STOCKS_OPEN,
  weather: INTERVALS.WEATHER,
  "ai-synthesis": 4 * 60 * MS_PER_MIN,
};

const lastFetch = new Map<string, FreshnessRecord>();
const badges = new Map<string, HTMLElement>();
let _tickInterval: ReturnType<typeof setInterval> | null = null;

// ── Public API ─────────────────────────────────────────────────────────────────

/** Record that `cardId` just received fresh data. */
export function markFresh(cardId: string, metadata: FreshnessMetadata = {}): void {
  const canonicalId = normalizeCardId(cardId);
  const currentMs = nowMs();
  const retrievedAtMs = normalizeTimestamp(metadata.retrievedAtMs, currentMs) ?? currentMs;
  const observedAtMs = normalizeTimestamp(metadata.observedAtMs, currentMs);
  const renderedAtMs = normalizeTimestamp(metadata.renderedAtMs, currentMs) ?? currentMs;
  const ttlMs = metadata.ttlMs ?? DEFAULT_TTLS[canonicalId] ?? 15 * MS_PER_MIN;

  lastFetch.set(canonicalId, {
    retrievedAtMs,
    observedAtMs,
    renderedAtMs,
    ttlMs,
  });
  const el = badges.get(canonicalId);
  if (el) updateBadge(canonicalId, el);
}

/** Get the timestamp of the last fetch for a card (or null if never fetched). */
export function getLastFetchMs(cardId: string): number | null {
  return lastFetch.get(normalizeCardId(cardId))?.retrievedAtMs ?? null;
}

/** Return the distinct upstream, retrieval, and render timestamps for a card. */
export function getFreshnessSnapshot(cardId: string): FreshnessSnapshot | null {
  const canonicalId = normalizeCardId(cardId);
  const record = lastFetch.get(canonicalId);
  if (!record) return null;

  const now = nowMs();
  const ageSourceMs = record.observedAtMs ?? record.retrievedAtMs;
  const ageMs = Math.max(0, now - ageSourceMs);
  return {
    cardId: canonicalId,
    retrievedAtMs: record.retrievedAtMs,
    observedAtMs: record.observedAtMs,
    renderedAtMs: record.renderedAtMs,
    ageMs,
    ttlMs: record.ttlMs,
    state: freshnessState(ageMs, record.ttlMs),
  };
}

/**
 * Mount a freshness `<time>` badge into the given container.
 * If a badge already exists for this card, it reuses it.
 * The badge auto-updates every 30 seconds via the shared tick.
 */
export function renderFreshnessBadge(cardId: string, container: HTMLElement): HTMLElement {
  const canonicalId = normalizeCardId(cardId);
  let el = badges.get(canonicalId);
  if (!el) {
    el = document.createElement("time");
    el.className = "freshness-badge";
    el.setAttribute("aria-live", "polite");
    badges.set(canonicalId, el);
    ensureTick();
  }
  if (!container.contains(el)) {
    container.appendChild(el);
  }
  updateBadge(canonicalId, el);
  return el;
}

/** Remove a badge (e.g., on card destroy). */
export function removeFreshnessBadge(cardId: string): void {
  const canonicalId = normalizeCardId(cardId);
  const el = badges.get(canonicalId);
  if (el) {
    el.remove();
    badges.delete(canonicalId);
  }
  if (badges.size === 0 && _tickInterval !== null) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
}

/** Format an elapsed duration as a Hebrew relative string. */
export function formatRelativeTime(elapsedMs: number): string {
  if (elapsedMs < MS_PER_MIN) return "עכשיו";
  const mins = Math.floor(elapsedMs / MS_PER_MIN);
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

/** Classify freshness into a state for CSS coloring. */
export function freshnessState(elapsedMs: number, ttlMs: number): "fresh" | "aging" | "stale" {
  const ageMs = Math.max(0, elapsedMs);
  if (ageMs <= ttlMs) return "fresh";
  if (ageMs <= ttlMs * 2) return "aging";
  return "stale";
}

// ── Internals ──────────────────────────────────────────────────────────────────

function updateBadge(cardId: string, el: HTMLElement): void {
  const snapshot = getFreshnessSnapshot(cardId);
  if (!snapshot) {
    el.textContent = "";
    el.removeAttribute("datetime");
    delete el.dataset["state"];
    delete el.dataset["retrievedAt"];
    delete el.dataset["renderedAt"];
    return;
  }
  const displayTimestamp = snapshot.observedAtMs ?? snapshot.retrievedAtMs;
  el.textContent = formatRelativeTime(snapshot.ageMs);
  el.setAttribute("datetime", fromEpochMs(displayTimestamp).toISOString());
  el.dataset["state"] = snapshot.state;
  el.dataset["retrievedAt"] = fromEpochMs(snapshot.retrievedAtMs).toISOString();
  el.dataset["renderedAt"] = fromEpochMs(snapshot.renderedAtMs).toISOString();
}

function tickAll(): void {
  for (const [cardId, el] of badges) {
    updateBadge(cardId, el);
  }
}

function ensureTick(): void {
  if (_tickInterval !== null) return;
  _tickInterval = setInterval(tickAll, 30_000);
}

/** Reset all state (testing). */
export function resetFreshness(): void {
  lastFetch.clear();
  for (const el of badges.values()) el.remove();
  badges.clear();
  if (_tickInterval !== null) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
}

function normalizeCardId(cardId: string): string {
  return CARD_ID_ALIASES[cardId] ?? cardId;
}

function normalizeTimestamp(value: number | undefined, now: number): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  // A provider clock can be slightly ahead, but a future observation is not a
  // reliable age source. Keep retrieval time as the honest fallback.
  return value <= now + 5 * MS_PER_MIN ? value : null;
}
