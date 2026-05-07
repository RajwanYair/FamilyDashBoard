/**
 * FamilyDashBoard v13 — FdbCard Base Class
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
import { setSync, type SyncState } from "./sync";
import { cGet, cGetStale, cSet } from "./cache";
import { isPageVisible } from "./idle";
import { getInterfaceLanguage } from "./i18n";
import { state } from "./state";
import { effect } from "./signals";
import { globalThemeChannel, globalAlertChannel, type AlertEvent } from "./event-bus";
import type { ThemeName } from "./constants";
import { isValidCardSize, type CardRuntime, type CardSize } from "../types/card";

/** Attributes monitored on every FdbCard subclass. */
const BASE_OBSERVED: readonly string[] = Object.freeze([
  "data-card-id",
  "data-card-size",
  "hidden",
]);

export abstract class FdbCard extends HTMLElement implements CardRuntime {
  /** Subclasses extend this list. Always merge with BASE_OBSERVED. */
  static get observedAttributes(): string[] {
    return [...BASE_OBSERVED];
  }

  /** Scheduled refresh timer ID, cleared on disconnect. */
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  /** State listeners bound via watchConfig(), cleared on disconnect. */
  private readonly _configListeners = new Map<string, EventListener>();

  /** Bound visibility listener, stored for proper removal. */
  private readonly _visListener = (): void => {
    if (document.hidden) {
      this.onHidden();
    } else {
      this.onVisible();
    }
  };

  /** Dispose function for the globalThemeChannel effect. */
  private _disposeTheme: (() => void) | null = null;

  /** Dispose function for the globalAlertChannel effect. */
  private _disposeAlert: (() => void) | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Called when the element is connected to the DOM.
   * Subclasses MUST call `super.connectedCallback()` first.
   */
  connectedCallback(): void {
    document.addEventListener("visibilitychange", this._visListener);
    // wire theme and alert lifecycle hooks via event-bus effects
    this._disposeTheme = effect(() => {
      const theme = globalThemeChannel.value;
      this.onThemeChange(theme);
    });
    this._disposeAlert = effect(() => {
      const event = globalAlertChannel.value;
      this.onAlert(event);
    });
    diagLog(`FDB-059: [fdb-card] connected: ${this.getAttribute("data-card-id") ?? this.tagName}`);
    this.connect();
  }

  /**
   * Called when the element is removed from the DOM.
   * Clears any scheduled refresh timer. Subclasses should call
   * `super.disconnectedCallback()` to ensure cleanup.
   */
  disconnectedCallback(): void {
    this.disconnect();
    this._clearConfigListeners();
    this._clearRefreshTimer();
    // dispose theme and alert subscriptions
    this._disposeTheme?.();
    this._disposeTheme = null;
    this._disposeAlert?.();
    this._disposeAlert = null;
    document.removeEventListener("visibilitychange", this._visListener);
    diagLog(
      `FDB-060: [fdb-card] disconnected: ${this.getAttribute("data-card-id") ?? this.tagName}`,
    );
  }

  /**
   * Called when one of `observedAttributes` changes.
   * Override in subclasses to react to specific attribute changes.
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    // Subclasses handle their specific attributes; base class logs only.
    diagLog(`FDB-061: [fdb-card] attr ${name}: ${String(oldValue)} → ${String(newValue)}`);
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
  get cardSize(): CardSize {
    const size = this.getAttribute("data-card-size");
    return isValidCardSize(size) ? size : "md";
  }

  /**
   * CardRuntime hook called after the element is connected.
   * Subclasses override this instead of re-implementing connectedCallback.
   */
  connect(): void {
    // No-op default. Subclasses override.
  }

  /**
   * CardRuntime hook called before the element disconnect cleanup runs.
   * Subclasses override this instead of re-implementing disconnectedCallback.
   */
  disconnect(): void {
    // No-op default. Subclasses override.
  }

  /**
   * CardRuntime hook for an immediate manual refresh.
   * Subclasses override when they support explicit reload triggers.
   */
  refresh(): Promise<void> {
    return Promise.resolve();
  }

  // ── CardRuntime Hooks ─────────────────────────────────────────

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
   * Subscribe this card to a config field in the reactive state store.
   * Registered listeners are automatically removed on disconnect.
   *
   * @param field - Config field name without the `config.` prefix
   * @param invokeImmediately - When true, call onConfigChange with current value now
   */
  protected watchConfig(field: string, invokeImmediately = false): void {
    const key = `config.${field}`;
    if (this._configListeners.has(key)) return;

    const listener = ((event: Event) => {
      this.onConfigChange(field, (event as CustomEvent<unknown>).detail);
    }) as EventListener;

    this._configListeners.set(key, listener);
    state.addEventListener(key, listener);

    if (invokeImmediately) {
      this.onConfigChange(field, state.get(key as `config.${string}`));
    }
  }

  /** Remove a single config subscription created by watchConfig(). */
  protected unwatchConfig(field: string): void {
    const key = `config.${field}`;
    const listener = this._configListeners.get(key);
    if (!listener) return;

    state.removeEventListener(key, listener);
    this._configListeners.delete(key);
  }

  private _clearConfigListeners(): void {
    for (const [key, listener] of this._configListeners) {
      state.removeEventListener(key, listener);
    }
    this._configListeners.clear();
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
   * Called when the page becomes visible.
   * Override to trigger data refresh or resume animations.
   * Default implementation is a no-op.
   */
  onVisible(): void {
    // No-op default. Subclasses override to react to page becoming visible.
  }

  /**
   * Called when the page becomes hidden.
   * Override to pause expensive operations or animations.
   * Default implementation is a no-op.
   */
  onHidden(): void {
    // No-op default. Subclasses override to react to page becoming hidden.
  }

  /**
   * Called when the active dashboard theme changes.
   * Override in cards that perform theme-sensitive work, such as SVG
   * colour recalculation or canvas redraws that depend on CSS variables.
   * Default implementation is a no-op.
   *
   * @param theme - The new theme name (e.g. "black", "blue", "matrix")
   */
  onThemeChange(_theme: ThemeName): void {
    // No-op default. Subclasses override to react to theme changes.
  }

  /**
   * Called when a cross-card alert event is broadcast.
   * Cards opt-in to dim/quiet mode by overriding this hook.
   * Called with `null` when the alert is cleared.
   * Default implementation is a no-op.
   *
   * @param event - The alert event, or null when the alert is cleared
   */
  onAlert(_event: AlertEvent | null): void {
    // No-op default. Subclasses override to enter dim/quiet mode on alert.
  }

  /**
   * Show or hide a stale-data indicator chip on the card.
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
    const label = mins < 1 ? "< 1 דק׳" : mins < 60 ? `${mins} דק׳` : `${Math.round(mins / 60)} שע׳`;
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

  // ── Render Helpers ( +55) ─────────────────────────────────────────

  /**
   * Replace the card's content with a DocumentFragment built from the provided
   * child nodes or strings.
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
   *.
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
   * Dispatch a custom DOM event from this card element.
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
   * Set the card's visible title text.
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
   * Show or clear a numeric notification badge on the card header.
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
   * Remove all child nodes from a target element.
   * Defaults to `this` (the card root). Safer than setting innerHTML.
   * @param target - Element to clear (defaults to this)
   */
  clearContent(target: Element = this): void {
    while (target.firstChild) target.firstChild.remove();
  }

  /**
   * Type-safe querySelector scoped to this card.
   * Returns null if no match found — no casting required by callers.
   * @param selector - CSS selector string
   */
  qs<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return this.querySelector<T>(selector);
  }

  /**
   * Create an HTML element with optional class and text content.
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

  /**
   * Update the card's sync dot status.
   *
   * Delegates to `setSync(cardId, state)` — if the card has no sync dot
   * registered for its ID the call is silently ignored.
   *
   * @param state - "ok" | "loading" | "error"
   */
  setSyncState(state: SyncState): void {
    const id = this.cardId;
    if (id) setSync(id, state);
  }

  // ── Render Primitives ( — 133) ──────────────────────────────────

  // Card Shell Builder ──────────────────────────────────────

  // Data loading template ─────────────────────────────────

  /**
   * Template method: fetch fresh data for this card.
   * Subclasses override to implement their specific fetch logic.
   * Returns null to indicate "no data available" (not an error).
   */
  protected fetchCardData(): Promise<unknown> {
    return Promise.resolve(null);
  }

  /**
   * Template method: render data into the card body.
   * Subclasses override to paint their specific UI.
   */
  protected renderCardData(_data: unknown): void {
    // No-op default — subclasses override.
  }

  /**
   * Standard data-loading cycle with cache + sync integration.
   * Cards call this from connectedCallback or scheduleRefresh.
   * Uses cGet/cSet for caching, setSync for status dots.
   *
   * @param cacheKey  Cache key for cGet/cSet
   * @param ttl       Cache TTL in milliseconds
   */
  protected async loadData(cacheKey: string, ttl: number): Promise<void> {
    if (!isPageVisible()) return;
    this.setSyncState("loading");

    // Cache check
    const fresh = cGet(cacheKey, ttl);
    if (fresh !== null) {
      this.renderCardData(fresh);
      this.setSyncState("ok");
      return;
    }

    // Stale fallback
    const stale = cGetStale(cacheKey);
    if (stale !== null) this.renderCardData(stale);

    try {
      const data = await this.fetchCardData();
      if (data !== null) {
        cSet(cacheKey, data);
        this.renderCardData(data);
        this.setSyncState("ok");
      } else {
        this.setSyncState(stale !== null ? "ok" : "error");
      }
    } catch (err) {
      diagLog(`FDB-062: [${this.cardId}] loadData failed: ${String(err)}`);
      this.onError(err instanceof Error ? err : new Error(String(err)));
      this.setSyncState(stale !== null ? "ok" : "error");
    }
  }

  // Card Shell Builder ──────────────────────────────────────

  /**
   * Build the standard card shell inside this element.
   * Creates header (icon + title + sync dot), body, and footer.
   * Idempotent — skips if shell already built.
   *
   * @param icon    Emoji icon for the header
   * @param titleHe Hebrew title text
   * @param titleEn English title text
   */
  buildShell(
    icon: string,
    titleHe: string,
    titleEn = titleHe,
  ): {
    header: HTMLElement;
    body: HTMLElement;
    footer: HTMLElement;
  } {
    // Prevent duplicates
    let body = this.querySelector<HTMLElement>(".card__body");
    if (body) {
      return {
        header: this.querySelector<HTMLElement>(".card__header")!,
        body,
        footer: this.querySelector<HTMLElement>(".card__footer")!,
      };
    }

    this.classList.add("card");

    const header = document.createElement("header");
    header.className = "card__header";
    const language = getInterfaceLanguage();
    const title = language === "en" ? titleEn : titleHe;

    // ── Start slot: status indicators (sync-dot, collapse-btn) ──
    const startSlot = document.createElement("div");
    startSlot.className = "card__hd-start";

    const syncDot = document.createElement("span");
    syncDot.className = "sync-dot";
    syncDot.id = `sync-${this.cardId}`;
    syncDot.setAttribute("aria-hidden", "true");
    startSlot.appendChild(syncDot);
    header.appendChild(startSlot);

    // ── Center slot: icon + title (+ mini-info appended by subclasses) ──
    const centerSlot = document.createElement("div");
    centerSlot.className = "card__hd-center";

    const titleSpan = document.createElement("span");
    titleSpan.className = "card__title";
    titleSpan.setAttribute("data-card-title", "");
    titleSpan.textContent = `${icon} ${title}`;
    centerSlot.appendChild(titleSpan);
    header.appendChild(centerSlot);

    // ── End slot: action buttons (settings gear, etc.) ──
    const endSlot = document.createElement("div");
    endSlot.className = "card__hd-end";
    header.appendChild(endSlot);

    this.appendChild(header);

    body = document.createElement("div");
    body.className = "card__body";
    this.appendChild(body);

    const footer = document.createElement("footer");
    footer.className = "card__footer";
    this.appendChild(footer);

    return { header, body, footer };
  }

  /**
   * Create a metric tile element.
   *
   * Returns a `<div class="metric-tile">` with label, value, and optional unit.
   * Use inside card body for structured data display (e.g. temperature, rate).
   *
   * @param label  Hebrew/English label text
   * @param value  Display value (number or string)
   * @param unit   Optional unit suffix (e.g. "°C", "%")
   */
  static renderMetricTile(label: string, value: string | number, unit?: string): HTMLElement {
    const tile = document.createElement("div");
    tile.className = "metric-tile";

    const lbl = document.createElement("span");
    lbl.className = "metric-tile__label";
    lbl.textContent = label;
    tile.appendChild(lbl);

    const val = document.createElement("span");
    val.className = "metric-tile__value";
    val.textContent = unit ? `${String(value)}${unit}` : String(value);
    tile.appendChild(val);

    return tile;
  }

  /**
   * Create an empty state element.
   *
   * Returns a `<div class="card-empty">` with icon and message.
   * Use when a card has no data to display (e.g. no events, no tasks).
   *
   * @param message  Hebrew message to display
   * @param icon     Optional emoji icon (default: "📭")
   */
  static renderEmpty(message: string, icon = "📭"): HTMLElement {
    const el = document.createElement("div");
    el.className = "card-empty";

    const ico = document.createElement("span");
    ico.className = "card-empty__icon";
    ico.textContent = icon;
    el.appendChild(ico);

    const msg = document.createElement("span");
    msg.className = "card-empty__msg";
    msg.textContent = message;
    el.appendChild(msg);

    return el;
  }

  /**
   * Create an error state element.
   *
   * Returns a `<div class="card-error" role="alert">` with icon and message.
   * Use when a card fails to load data after all retries.
   *
   * @param message  Hebrew error message to display
   * @param icon     Optional emoji icon (default: "⚠️")
   */
  static renderError(message: string, icon = "⚠️"): HTMLElement {
    const el = document.createElement("div");
    el.className = "card-error";
    el.setAttribute("role", "alert");

    const ico = document.createElement("span");
    ico.className = "card-error__icon";
    ico.textContent = icon;
    el.appendChild(ico);

    const msg = document.createElement("span");
    msg.className = "card-error__msg";
    msg.textContent = message;
    el.appendChild(msg);

    return el;
  }

  /**
   * Create a skeleton loader element.
   *
   * Returns a `<div class="card-skeleton">` with N shimmer lines.
   * Use as placeholder content while data is loading.
   *
   * @param lines  Number of skeleton lines (default: 3)
   */
  static renderSkeleton(lines = 3): HTMLElement {
    const el = document.createElement("div");
    el.className = "card-skeleton";
    el.setAttribute("aria-hidden", "true");

    for (let i = 0; i < lines; i++) {
      const line = document.createElement("div");
      line.className = "skeleton";
      el.appendChild(line);
    }

    return el;
  }
}
