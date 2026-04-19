/**
 * FamilyDashBoard v8.0 — Reactive State Store
 *
 * Lightweight (~60 lines) EventTarget-based pub/sub state management.
 * Zero dependencies. Three slices: config (persisted), cache (ephemeral), ui (transient).
 *
 * API:
 *   state.get('config.tempUnit')            → current value
 *   state.set('config.tempUnit', 'F')       → dispatch change event
 *   state.on('config.tempUnit', callback)   → subscribe
 *   state.off('config.tempUnit', callback)  → unsubscribe
 *
 * DevTools: window.__FDB_STATE__ in development builds.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** All 3 state slices as a flat key-value Record. */
export interface StateSlices {
  /** Persisted slice: mirrors DashboardConfig (reactive wrapper). */
  config: Record<string, unknown>;
  /** Ephemeral slice: API data keyed by card. */
  cache: Record<string, unknown>;
  /** Transient UI slice: theme, overlays, maximize state. */
  ui: Record<string, unknown>;
}

type SliceName = keyof StateSlices;

/** A fully-qualified state key like "config.tempUnit" or "ui.theme". */
type StateKey = `${SliceName}.${string}`;

type StateChangeCallback<T = unknown> = (value: T, key: StateKey) => void;

// ── Store ─────────────────────────────────────────────────────────────────────

class FdbStateStore extends EventTarget {
  private readonly _data: StateSlices = {
    config: {},
    cache: {},
    ui: {},
  };

  /**
   * Read a value from the store.
   * @param key - Fully-qualified key, e.g. "config.tempUnit"
   */
  get<T = unknown>(key: StateKey): T | undefined {
    const dot = key.indexOf(".");
    const slice = key.slice(0, dot) as SliceName;
    const field = key.slice(dot + 1);
    return this._data[slice]?.[field] as T | undefined;
  }

  /**
   * Write a value and dispatch a change event.
   * @param key   - Fully-qualified key
   * @param value - New value (any serialisable type)
   */
  set<T = unknown>(key: StateKey, value: T): void {
    const dot = key.indexOf(".");
    const slice = key.slice(0, dot) as SliceName;
    const field = key.slice(dot + 1);

    if (!(slice in this._data)) return; // guard against typos

    const previous = this._data[slice][field];
    if (previous === value) return; // skip no-op writes

    this._data[slice][field] = value;
    this.dispatchEvent(
      Object.assign(new CustomEvent(key, { detail: value }), { key }),
    );
  }

  /**
   * Subscribe to changes for a specific key.
   * @param key      - Fully-qualified key
   * @param callback - Called with (newValue, key) on each change
   */
  on<T = unknown>(key: StateKey, callback: StateChangeCallback<T>): void {
    this.addEventListener(key, ((e: Event) => {
      callback((e as CustomEvent<T>).detail, key);
    }) as EventListener);
  }

  /**
   * Unsubscribe. The exact same function reference used in `on()` must be passed.
   * Note: For one-time subscriptions prefer closure-based on + off pattern.
   */
  off(key: StateKey, callback: EventListener): void {
    this.removeEventListener(key, callback);
  }

  /**
   * Bulk-seed the config slice from a DashboardConfig object.
   * Fires one change event per field that differs from current value.
   * @param cfg - DashboardConfig (or partial)
   */
  seedConfig(cfg: Record<string, unknown>): void {
    for (const [field, value] of Object.entries(cfg)) {
      this.set(`config.${field}` as StateKey, value);
    }
  }

  /**
   * Returns a snapshot of all three slices.
   * Used internally and exposed via `window.__FDB_STATE__` in dev builds.
   */
  snapshot(): Readonly<StateSlices> {
    return {
      config: { ...this._data.config },
      cache: { ...this._data.cache },
      ui: { ...this._data.ui },
    };
  }
}

/** Singleton state store — import and use directly. */
export const state = new FdbStateStore();

// ── DevTools hook (development builds only) ───────────────────────────────────

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as typeof window & { __FDB_STATE__?: FdbStateStore })
    .__FDB_STATE__ = state;
}

// ── Test isolation helper ─────────────────────────────────────────────────────

/**
 * Reset the singleton store to a clean, empty baseline.
 * **For use in Vitest tests only.** Clears all three slices so that each
 * test starts from a pristine state without needing `vi.resetModules()`.
 *
 * Because FdbStateStore extends EventTarget there is no built-in "clear"
 * method. We replace the internal slice data in place so existing module
 * references to `state` still point to the same object.
 *
 * @example
 *   import { _resetForTest } from "@/core/state";
 *   afterEach(_resetForTest);
 */
export function _resetForTest(): void {
  // Access private _data via type assertion (test-only pattern)
  const store = state as unknown as { _data: { config: Record<string, unknown>; cache: Record<string, unknown>; ui: Record<string, unknown> } };
  store._data.config = {};
  store._data.cache = {};
  store._data.ui = {};
}
