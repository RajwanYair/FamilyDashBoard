/**
 * src/core/app-signals.ts — Sprint 121 + Sprint 140 (Roadmap #1)
 *
 * Named application-level signals for gradual `state.ts` → `signals.ts`
 * migration (ADR-038).  Each signal here is a single source of truth for
 * one named config/UI value.
 *
 * Bridge pattern:
 *   - `state.ts` calls `syncAppSignal(key, value)` when a config key is
 *     written, keeping these signals in sync with the legacy EventTarget
 *     store so that both migrated (effect) and unmigrated (state.on)
 *     consumers work simultaneously.
 *   - Migrated cards subscribe via `effect()` on these signals.
 *   - Unmigrated cards continue using `state.on()` / `state.addEventListener`.
 *
 * Migration status (Roadmap #1): ≥ 50 % of `state.ts` call-site subscriptions.
 *   Sprint 121: weather.ts subscription migrated (first card-at-a-time step).
 *   Sprint 140: fdb-motivation.ts motivationInterval migrated → 100 % of
 *               reactive config subscriptions now on signals.
 */

import { signal } from "./signals";
import type { ThemeName, ScreenModeName } from "./constants";

// ── Config signals ────────────────────────────────────────────────────────────

/**
 * Current temperature unit.  Bridged from `state.set("config.tempUnit", …)`.
 * Cards subscribe via: `effect(() => { tempUnit.value; … })`
 */
export const tempUnit = signal<"C" | "F">("C");

/**
 * Current UI theme.  Bridged from `state.set("config.theme", …)`.
 */
export const appTheme = signal<ThemeName>("black");

/**
 * Motivation card auto-advance interval in minutes (0 = disabled).
 * Bridged from `state.set("config.motivationInterval", …)`.
 * FdbMotivationCard subscribes via: `effect(() => { motivationInterval.value; … })`
 */
export const motivationInterval = signal<number>(0);

/**
 * Current screen mode ("tv" | "tablet" | "phone").
 * Bridged from `state.set("config.screenMode", …)`.
 * Consumers subscribe via: `effect(() => { screenMode.value; … })`
 */
export const screenMode = signal<ScreenModeName>("tv");

/**
 * Whether the red-alerts card is enabled.
 * Bridged from `state.set("config.alertsEnabled", …)`.
 * Consumers subscribe via: `effect(() => { alertsEnabled.value; … })`
 */
export const alertsEnabled = signal<boolean>(true);

// ── Bridge: state.ts → app-signals ───────────────────────────────────────────

/**
 * Called by `state.ts` whenever a `config.*` key changes.
 * Updates the corresponding named signal so that effect()-based subscribers
 * are notified alongside legacy `state.on()` subscribers.
 *
 * This is an internal bridge function — not for use by application code.
 * @internal
 */
export function syncAppSignal(key: string, value: unknown): void {
  switch (key) {
    case "config.tempUnit":
      if (value === "C" || value === "F") tempUnit.value = value;
      break;
    case "config.theme":
      appTheme.value = (value as ThemeName) ?? "black";
      break;
    case "config.motivationInterval":
      motivationInterval.value = typeof value === "number" ? value : 0;
      break;
    case "config.screenMode":
      if (value === "tv" || value === "tablet" || value === "phone")
        screenMode.value = value;
      break;
    case "config.alertsEnabled":
      alertsEnabled.value = Boolean(value);
      break;
    default:
      break;
  }
}
