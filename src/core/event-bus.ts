/**
 * src/core/event-bus.ts
 *
 * Zero-dep signals-based pub/sub channel for cross-card coordination.
 * Built on top of src/core/signals.ts — no additional runtime dependencies.
 *
 * Exported channels:
 *   - globalSync          Aggregated network health across all cards.
 *   - globalAlertChannel  Broadcast cross-card pause requests (red-alert etc.).
 *   - globalThemeChannel  Propagates theme changes to cards that care.
 *   - globalOffline       Single truth for navigator.onLine state.
 *
 * Usage (reading):
 *   import { globalSync } from "../core/event-bus";
 *   effect(() => { if (globalSync.value === "error") { … } });
 *
 * Usage (writing):
 *   import { broadcastSync, broadcastAlert } from "../core/event-bus";
 *   broadcastSync("weather", "error");
 *   broadcastAlert({ source: "alerts", type: "pause" });
 *
 * Semantics follow ADR-038 (signals). All channels are writable only via
 * their dedicated broadcast functions so consumers can never accidentally
 * set them directly.
 */

import { signal, computed, type Signal, type ReadonlySignal } from "./signals";
import type { ThemeName } from "./constants";
import type { SyncState } from "./sync";

// ── Types ──────────────────────────────────────────────────────────────────

/** Emitted when a card wants all other cards to pause refresh. */
export interface AlertEvent {
  /** Card that triggered the event (e.g. "alerts"). */
  source: string;
  /** "pause" = stop loading; "resume" = resume normal operation. */
  type: "pause" | "resume";
}

// ── Internal state ─────────────────────────────────────────────────────────

/** Per-card sync state map. Keys are sync-dot IDs (e.g. "wx", "cal"). */
const _cardStates = signal<ReadonlyMap<string, SyncState>>(new Map());

// ── Exported read-only channels ────────────────────────────────────────────

/**
 * Aggregated sync state across all registered cards.
 * "loading" if any card is loading; "error" if any card errored (and none
 * loading); "ok" otherwise.
 */
export const globalSync: ReadonlySignal<SyncState> = computed<SyncState>(() => {
  const states = _cardStates.value;
  let hasError = false;
  for (const s of states.values()) {
    if (s === "loading") return "loading";
    if (s === "error") hasError = true;
  }
  return hasError ? "error" : "ok";
});

/**
 * Cross-card alert/pause channel.
 * null = no active cross-card alert. Set via `broadcastAlert()`.
 */
export const globalAlertChannel: Signal<AlertEvent | null> = signal<AlertEvent | null>(null);

/**
 * Theme change channel. Updated by the theme system via `broadcastTheme()`.
 * Cards that perform theme-sensitive work (e.g. chart redraws) subscribe here.
 */
export const globalThemeChannel: Signal<ThemeName> = signal<ThemeName>("black");

/**
 * Global offline state derived from navigator.onLine.
 * Updated by `initOfflineTracking()` — must be called once at startup.
 */
export const globalOffline: Signal<boolean> = signal<boolean>(
  typeof navigator !== "undefined" ? !navigator.onLine : false,
);

// ── Write helpers ──────────────────────────────────────────────────────────

/**
 * Update the sync state for a single card pane.
 * Should be called alongside (or instead of) `setSync()` from sync.ts.
 *
 * @param cardId  Sync-dot ID matching the card (e.g. "wx", "cal", "cur").
 * @param state   New state: "ok" | "loading" | "error".
 */
export function broadcastSync(cardId: string, state: SyncState): void {
  const current = _cardStates.value;
  if (current.get(cardId) === state) return; // no-op on unchanged value
  const next = new Map(current);
  next.set(cardId, state);
  _cardStates.value = next;
}

/**
 * Broadcast a cross-card alert event (e.g. "pause all cards during red alert").
 * Pass null to clear an active alert.
 */
export function broadcastAlert(event: AlertEvent | null): void {
  globalAlertChannel.value = event;
}

/**
 * Notify cards of a theme change.
 * Called by the theme system after applying the new theme class to <html>.
 */
export function broadcastTheme(theme: ThemeName): void {
  globalThemeChannel.value = theme;
}

/**
 * Wire up navigator.onLine events to `globalOffline`.
 * Must be called once from main.ts during startup. Safe to call in tests
 * (addEventListener is a no-op in happy-dom).
 */
export function initOfflineTracking(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => {
    globalOffline.value = false;
  });
  window.addEventListener("offline", () => {
    globalOffline.value = true;
  });
}

/**
 * Reset all internal bus state to defaults.
 * **For tests only** — do not call in production code.
 * @internal
 */
export function _resetBusForTesting(): void {
  _cardStates.value = new Map();
  globalAlertChannel.value = null;
  globalThemeChannel.value = "black";
  globalOffline.value = false;
}
