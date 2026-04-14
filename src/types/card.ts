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

// ── Card registry entry ────────────────────────────────────────────────────

export interface CardRegistryEntry {
  id: string;
  icon: string;
  titleHe: string;
  titleEn: string;
  /** Lazy loader — returns the full CardDefinition. */
  load: () => Promise<CardDefinition>;
}
