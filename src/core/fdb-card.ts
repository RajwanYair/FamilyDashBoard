/**
 * FamilyDashBoard v8.0 — FdbCard Base Class
 *
 * Vanilla Web Component base class. Cards extend FdbCard and gain:
 *   - `connectedCallback` / `disconnectedCallback` lifecycle hooks
 *   - `attributeChangedCallback` for reactive data-* attributes
 *   - `scheduleRefresh(ttl)` — debounced refresh scheduling
 *   - `setLoading(bool)` — updates aria-busy on the card element
 *   - `setError(msg)` — sets aria-label to indicate an error state
 *
 * Usage:
 *   class WeatherCard extends FdbCard {
 *     static override observedAttributes = [...FdbCard.observedAttributes, 'data-city'];
 *     override connectedCallback() { super.connectedCallback(); this.load(); }
 *     private async load() { ... }
 *   }
 *   customElements.define('fdb-weather', WeatherCard);
 *
 * Zero dependencies. No Shadow DOM — cards use global CSS for TV-scale theming.
 */

import { diagLog } from "./diag";

/** Attributes monitored on every FdbCard subclass. */
const BASE_OBSERVED: readonly string[] = Object.freeze([
  "data-card-id",
  "data-card-size",
  "hidden",
]);

export abstract class FdbCard extends HTMLElement {
  /** Subclasses extend this list. Always merge with BASE_OBSERVED. */
  static get observedAttributes(): string[] {
    return [...BASE_OBSERVED];
  }

  /** Scheduled refresh timer ID, cleared on disconnect. */
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Called when the element is connected to the DOM.
   * Subclasses MUST call `super.connectedCallback()` first.
   */
  connectedCallback(): void {
    diagLog(
      `FDB-059: [fdb-card] connected: ${this.getAttribute("data-card-id") ?? this.tagName}`,
    );
  }

  /**
   * Called when the element is removed from the DOM.
   * Clears any scheduled refresh timer. Subclasses should call
   * `super.disconnectedCallback()` to ensure cleanup.
   */
  disconnectedCallback(): void {
    this._clearRefreshTimer();
    diagLog(
      `FDB-060: [fdb-card] disconnected: ${this.getAttribute("data-card-id") ?? this.tagName}`,
    );
  }

  /**
   * Called when one of `observedAttributes` changes.
   * Override in subclasses to react to specific attribute changes.
   */
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (oldValue === newValue) return;
    // Subclasses handle their specific attributes; base class logs only.
    diagLog(
      `FDB-061: [fdb-card] attr ${name}: ${String(oldValue)} → ${String(newValue)}`,
    );
  }

  // ── Refresh Scheduling ────────────────────────────────────────────────────

  /**
   * Schedule a periodic refresh interval.
   * Clears any existing timer first to prevent stacking.
   * @param callback - The async function to call on each interval
   * @param intervalMs - Interval duration in milliseconds
   */
  scheduleRefresh(callback: () => Promise<void> | void, intervalMs: number): void {
    this._clearRefreshTimer();
    this._refreshTimer = setInterval(() => {
      void Promise.resolve(callback());
    }, intervalMs);
  }

  /** Cancel the scheduled refresh timer. */
  private _clearRefreshTimer(): void {
    if (this._refreshTimer !== null) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  // ── State Helpers ─────────────────────────────────────────────────────────

  /**
   * Set the loading state. Updates `aria-busy` for accessibility.
   * @param loading - true while fetching, false when complete
   */
  setLoading(loading: boolean): void {
    this.setAttribute("aria-busy", loading ? "true" : "false");
  }

  /**
   * Communicate an error state via `aria-label`.
   * @param message - Error description. Pass null/empty to clear.
   */
  setError(message: string | null): void {
    if (message) {
      this.setAttribute("aria-label", `שגיאה: ${message}`);
    } else {
      this.removeAttribute("aria-label");
    }
  }

  /** Convenience getter — the card's registry ID from `data-card-id`. */
  get cardId(): string {
    return this.getAttribute("data-card-id") ?? "";
  }

  /** Convenience getter — the card's size class from `data-card-size`. */
  get cardSize(): string {
    return this.getAttribute("data-card-size") ?? "md";
  }

  // ── CardRuntime Hooks (Sprint 50) ───────────────────────────────────────── 

  /**
   * Called when a config key that this card owns changes.
   * Override to react to individual config field changes without
   * reloading the full card state. Default implementation is a no-op.
   *
   * @param key   - Config field name
   * @param value - New value (unknown type — cast as needed)
   */
  onConfigChange(_key: string, _value: unknown): void {
    // No-op default. Subclasses override to handle specific keys.
  }

  /**
   * Called when cached data has exceeded the card's acceptable stale age.
   * Override to show a stale badge or trigger a background reload.
   * Default implementation is a no-op.
   *
   * @param ageMs - Age of the stale data in milliseconds
   */
  onStale(_ageMs: number): void {
    // No-op default. Subclasses override to update stale UX.
  }

  /**
   * Called when a load attempt fails after all retries.
   * Override to update error state indicators (chip, aria-label, etc.).
   * Default implementation delegates to `setError(err.message)`.
   *
   * @param err - The error that caused the failure
   */
  onError(err: Error): void {
    this.setError(err.message);
  }

  // ── Render Helpers (Sprint 54+55) ───────────────────────────────────────── 

  /**
   * Replace the card's content with a DocumentFragment built from the provided
   * child nodes or strings (Sprint 54).
   *
   * Prefers appending DOM nodes (safe). Passing a plain string sets
   * `textContent` on a `<p>` wrapper — NEVER use for unsanitized HTML.
   *
   * @param target - Element to update (defaults to `this`)
   * @param nodes  - One or more Node or string values
   */
  renderNodes(target: Element, ...nodes: Array<Node | string>): void {
    target.textContent = "";
    const frag = document.createDocumentFragment();
    for (const n of nodes) {
      if (typeof n === "string") {
        const p = document.createElement("span");
        p.textContent = n;
        frag.appendChild(p);
      } else {
        frag.appendChild(n);
      }
    }
    target.appendChild(frag);
  }

  /**
   * Run an async data-loading function with automatic loading-state management
   * (Sprint 55).
   *
   * Sets `aria-busy="true"` before calling `fn`, and clears it when `fn`
   * resolves or rejects. On rejection, delegates to `onError`.
   *
   * @param fn - Async loader to execute
   */
  async withLoading(fn: () => Promise<void>): Promise<void> {
    this.setLoading(true);
    try {
      await fn();
    } catch (err) {
      this.onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Dispatch a custom DOM event from this card element (Sprint 67).
   *
   * Events bubble by default and are composed (cross shadow-DOM boundary).
   * All FamilyDashBoard cards are non-shadow so `composed` has no effect,
   * but it is set for forward compatibility.
   *
   * @param type   - Event type name (e.g. `"fdb-refresh"`, `"fdb-config-change"`)
   * @param detail - Optional structured detail payload
   */
  emit<T = undefined>(type: string, detail?: T): void {
    this.dispatchEvent(
      new CustomEvent<T>(type, {
        detail: detail as T,
        bubbles: true,
        composed: true,
      }),
    );
  }
}
