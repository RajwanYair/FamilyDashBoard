/**
 * FamilyDashBoard v7 — Card Type Definitions
 *
 * CardDefinition: contract every card module must satisfy.
 * CardConfigField: schema for config panel auto-generation.
 * CardSlot: persisted grid placement.
 */

// ── Config schema ──────────────────────────────────────────────────────────

export type ConfigFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "textarea"
  | "url"
  | "date"
  | "range";

export interface ConfigSelectOption {
  value: string;
  label: string;
}

export interface CardConfigField {
  /** localStorage key (must be unique across all cards). */
  key: string;
  /** Hebrew label shown in config panel. */
  labelHe: string;
  /** English fallback label. */
  labelEn: string;
  type: ConfigFieldType;
  defaultValue: string | number | boolean;
  /** For range inputs. */
  min?: number;
  max?: number;
  step?: number;
  /** For select fields. */
  options?: ConfigSelectOption[];
  placeholder?: string;
  /** Config tab to place this field in. */
  tab?: "display" | "feeds" | "alerts" | "calendar" | "advanced";
  /**
   * Accordion group name (Sprint 58).
   * Fields in the same group are rendered inside a collapsible `<details>`
   * element in the config panel. Optional; ungrouped fields render flat.
   */
  group?: string;
  /**
   * Whether the accordion group starts expanded (Sprint 58).
   * Only applies when `group` is set. Defaults to false (collapsed).
   */
  groupOpenByDefault?: boolean;
}

// ── Card size ──────────────────────────────────────────────────────────────

export type CardSize = "sm" | "md" | "lg" | "xl";

// ── Card slot (persisted layout) ──────────────────────────────────────────

export interface CardSlot {
  id: string;
  col: 0 | 1 | 2;
  /** Order within the column (lower = higher). */
  order: number;
  /** Flex-grow value (proportional height within column). */
  flexGrow: number;
  hidden: boolean;
}

// ── Card definition ────────────────────────────────────────────────────────

export interface CardDefinition {
  /** Unique slug — matches `data-card-id` in HTML. */
  id: string;
  icon: string;
  titleHe: string;
  titleEn: string;

  /** Default grid placement. */
  defaultSlot: Omit<CardSlot, "id">;
  defaultSize: CardSize;

  /**
   * Create the card's root DOM element.
   * Called once when the card is first added to the layout.
   */
  render(): HTMLElement;

  /**
   * Start data loading and refresh intervals.
   * Called after render() inserts the element into the DOM.
   */
  init(): void;

  /**
   * Stop all intervals and clean up event listeners.
   * Called when the card is removed from the layout.
   */
  destroy?(): void;

  /** Config fields contributed by this card. */
  configSchema?: CardConfigField[];
}

// ── CardRuntime interface ──────────────────────────────────────────────────

/**
 * CardRuntime — the complete lifecycle contract for a v8 card instance.
 *
 * Cards that extend FdbCard implement this interface to indicate they
 * own their refresh schedule, subscriptions, and cleanup.
 *
 * Stream B: Card Architecture Convergence (v7.13).
 */
export interface CardRuntime {
  /** Card's registry ID — matches `data-card-id`. */
  readonly cardId: string;
  /** Current size class. */
  readonly cardSize: CardSize;

  /**
   * Connect this card to the DOM. Called by connectedCallback.
   * Must start data loading and schedule refresh.
   */
  connect(): void;

  /**
   * Disconnect this card from the DOM. Called by disconnectedCallback.
   * Must cancel all intervals and unsubscribe from state events.
   */
  disconnect(): void;

  /**
   * Trigger an immediate data refresh.
   * May be called externally (e.g., by the config panel on save).
   */
  refresh(): Promise<void>;

  /**
   * Called when a config key this card cares about changes.
   * Cards subscribe via state.on() and call this handler.
   * @param key - The config key that changed (e.g. 'config.tempUnit')
   * @param value - The new value
   */
  onConfigChange?(key: string, value: unknown): void;

  /**
   * Called when cached data becomes stale (age > threshold).
   * Cards may show a stale indicator or trigger a background refresh.
   * @param ageMs - How old the cached data is in milliseconds
   */
  onStale?(ageMs: number): void;

  /**
   * Called when a fetch fails after all retries.
   * Cards may show an error state or degraded UI.
   * @param err - The error that caused the failure
   */
  onError?(err: Error): void;
}

// ── Card registry entry ────────────────────────────────────────────────────

export interface CardRegistryEntry {
  id: string;
  icon: string;
  titleHe: string;
  titleEn: string;
  /** Lazy loader — returns the full CardDefinition. */
  load: () => Promise<CardDefinition>;
}

// ── CardShell interface (Sprint 56) ───────────────────────────────────────

/**
 * CardShell describes the minimal DOM anatomy that every rendered card
 * must expose (Stream F: Visual System, v7.15).
 *
 * All card root elements created by `CardDefinition.render()` or
 * registry-driven shell creation should implement this shape.
 *
 * Not a run-time class — checked via duck-typing or brand property at
 * key integration points (e.g., diag overlay card list).
 */
export interface CardShell {
  /** The outermost card element. */
  root: HTMLElement;
  /**
   * Content area inside the card frame — the target for data renders.
   * Typically a `<div class="card__body">` or `<section>`.
   */
  body: HTMLElement;
  /**
   * Optional header bar — shows title icon, titleHe, and sync dot.
   * Absent on size "sm" cards that have no title bar.
   */
  header?: HTMLElement;
  /**
   * Optional footer bar — staleness chip, action buttons.
   */
  footer?: HTMLElement;
}

// ── Card size guards (Sprint 69) ───────────────────────────────────────────

const CARD_SIZES: readonly CardSize[] = ["sm", "md", "lg", "xl"] as const;

/**
 * Type guard — returns `true` if `value` is a valid `CardSize`.
 *
 * Use in config import validation and URL-param parsing where card size
 * values arrive as raw strings.
 *
 * @example
 * const s = userInput;               // string
 * if (isValidCardSize(s)) card.size = s;  // s: CardSize
 */
export function isValidCardSize(value: unknown): value is CardSize {
  return typeof value === "string" && (CARD_SIZES as readonly string[]).includes(value);
}

/**
 * Assertion — throws `TypeError` if `value` is not a valid `CardSize`.
 *
 * @example
 * assertCardSize(savedConfig.defaultSize);  // now typed as CardSize
 */
export function assertCardSize(value: unknown): asserts value is CardSize {
  if (!isValidCardSize(value)) {
    throw new TypeError(
      `Expected CardSize ("sm"|"md"|"lg"|"xl"), got: ${JSON.stringify(value)}`,
    );
  }
}

// ── Sprint 185: FdbCardDefinition ─────────────────────────────────────────

import type { FdbCard } from "../core/fdb-card";

/**
 * Bridge type: a CardDefinition backed by an FdbCard custom element.
 *
 * Used in the card registry to support both legacy initXxxCard() adapters
 * and new FdbCard subclasses in the same `registerCard()` catalog.
 *
 * The `elementClass` field carries the custom element constructor so the
 * registry can define it and create instances.
 */
export interface FdbCardDefinition extends CardDefinition {
  /** The FdbCard subclass constructor — used by `customElements.define()`. */
  elementClass: typeof FdbCard;
  /** Custom element tag name (e.g. "fdb-motivation"). */
  tagName: string;
}
