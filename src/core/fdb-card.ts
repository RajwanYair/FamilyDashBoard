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

  /** Bound visibility listener, stored for proper removal (Sprint 84). */
  private readonly _visListener = (): void => {
    if (document.hidden) {
      this.onHidden();
    } else {
      this.onVisible();
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Called when the element is connected to the DOM.
   * Subclasses MUST call `super.connectedCallback()` first.
   */
  connectedCallback(): void {
    document.addEventListener("visibilitychange", this._visListener);
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
    document.removeEventListener("visibilitychange", this._visListener);
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
  scheduleRefresh(
    callback: () => Promise<void> | void,
    intervalMs: number,
  ): void {
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

  /**
   * Called when the page becomes visible (Sprint 84).
   * Override to trigger data refresh or resume animations.
   * Default implementation is a no-op.
   */
  onVisible(): void {
    // No-op default. Subclasses override to react to page becoming visible.
  }

  /**
   * Called when the page becomes hidden (Sprint 84).
   * Override to pause expensive operations or animations.
   * Default implementation is a no-op.
   */
  onHidden(): void {
    // No-op default. Subclasses override to react to page becoming hidden.
  }

  /**
   * Show or hide a stale-data indicator chip on the card (Sprint 85).
   *
   * When `ageMs > 0`, a `<span class="stale-chip">` is inserted (or
   * updated) as the first child of the card. When `ageMs <= 0` any
   * existing chip is removed.
   *
   * The chip text shows the age in human-readable form (e.g. "5 דק׳").
   * @param ageMs - Stale age in milliseconds (0 = not stale / clear)
   */
  staleChip(ageMs: number): void {
    const existing = this.querySelector<HTMLElement>(".stale-chip");
    if (ageMs <= 0) {
      if (existing) existing.remove();
      return;
    }
    const mins = Math.round(ageMs / 60_000);
    const label =
      mins < 1 ? "< 1 דק׳" : mins < 60 ? `${mins} דק׳` : `${Math.round(mins / 60)} שע׳`;
    if (existing) {
      existing.textContent = `⏳ ${label}`;
    } else {
      const chip = document.createElement("span");
      chip.className = "stale-chip";
      chip.setAttribute("aria-label", `נתונים מיושנים: ${label}`);
      chip.textContent = `⏳ ${label}`;
      this.prepend(chip);
    }
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

  /**
   * Set the card's visible title text (Sprint 72).
   *
   * Looks for a `[data-card-title]` descendant and safely sets its
   * `textContent`. If no title element exists, the call is a no-op so
   * cards without a title bar are unaffected.
   *
   * @param text - New title text (plain text, not HTML)
   */
  setTitle(text: string): void {
    const el = this.querySelector<HTMLElement>("[data-card-title]");
    if (el) el.textContent = text;
  }

  /**
   * Show or clear a numeric notification badge on the card header (Sprint 73).
   *
   * Looks for a `[data-card-badge]` descendant. When `count > 0` the badge
   * is made visible with the numeric value. When `count <= 0` the badge is
   * hidden (aria-hidden + empty text).
   *
   * @param count - Badge count; 0 or negative hides the badge
   */
  setBadge(count: number): void {
    const el = this.querySelector<HTMLElement>("[data-card-badge]");
    if (!el) return;
    if (count > 0) {
      el.textContent = String(count);
      el.removeAttribute("aria-hidden");
    } else {
      el.textContent = "";
      el.setAttribute("aria-hidden", "true");
    }
  }

  /**
   * Remove all child nodes from a target element (Sprint 78).
   * Defaults to `this` (the card root). Safer than setting innerHTML.
   * @param target - Element to clear (defaults to this)
   */
  clearContent(target: Element = this): void {
    while (target.firstChild) target.firstChild.remove();
  }

  /**
   * Type-safe querySelector scoped to this card (Sprint 79).
   * Returns null if no match found — no casting required by callers.
   * @param selector - CSS selector string
   */
  qs<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return this.querySelector<T>(selector);
  }

  /**
   * Create an HTML element with optional class and text content (Sprint 80).
   * Reduces boilerplate in card render methods.
   * @param tag       - HTML tag name (e.g. "div", "span")
   * @param className - CSS class(es) to set (space-separated)
   * @param text      - Optional textContent (safe, no innerHTML)
   */
  static createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
}
