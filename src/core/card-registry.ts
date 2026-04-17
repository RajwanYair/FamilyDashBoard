/**
 * FamilyDashBoard v7 — Card Registry
 *
 * Central catalog of all available cards.
 * Cards are lazy-loaded (dynamic import) so only actively-used
 * card bundles are fetched on startup.
 *
 * Usage:
 *   registerCard(entry)         — add a card to the registry
 *   getCard(id)                 — get registry entry by id
 *   listCards()                 — sorted catalog for the card picker
 *   loadCard(id)                — dynamically import + return CardDefinition
 */

import type { CardDefinition, CardRegistryEntry } from "@/types/card";

// ── Internal registry map ──────────────────────────────────────────────────

const _registry = new Map<string, CardRegistryEntry>();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Register a card entry. Called by each card module's index.ts.
 * Safe to call multiple times with the same id (last wins).
 */
export function registerCard(entry: CardRegistryEntry): void {
  _registry.set(entry.id, entry);
}

/**
 * Lookup a registry entry by card id. Returns undefined if not found.
 */
export function getCard(id: string): CardRegistryEntry | undefined {
  return _registry.get(id);
}

/**
 * Return all registered entries, sorted by titleHe.
 */
export function listCards(): CardRegistryEntry[] {
  return [..._registry.values()].sort((a, b) =>
    a.titleHe.localeCompare(b.titleHe, "he"),
  );
}

/**
 * Lazy-load + return the full CardDefinition for a card.
 * Throws if the card id is not registered.
 */
export async function loadCard(id: string): Promise<CardDefinition> {
  const entry = _registry.get(id);
  if (!entry) throw new Error(`Card not registered: "${id}"`);
  return entry.load();
}

/**
 * Build a bare DOM shell for a card by id (Sprint 68).
 *
 * Returns a `<section data-card-id="[id]">` with an inner
 * `<div class="card-body">`.  The registry entry's icon and
 * `titleHe` are used to populate an accessible `aria-label`.
 *
 * Throws if the card id is not registered.
 *
 * @param id - Registered card id (e.g. `"weather"`, `"news"`)
 * @returns `{ root, body }` — minimal CardShell for the card
 */
export function createShell(id: string): { root: HTMLElement; body: HTMLElement } {
  const entry = _registry.get(id);
  if (!entry) throw new Error(`Card not registered: "${id}"`);
  const root = document.createElement("section");
  root.dataset["cardId"] = id;
  root.setAttribute("aria-label", `${entry.icon} ${entry.titleHe}`);
  const body = document.createElement("div");
  body.className = "card-body";
  root.appendChild(body);
  return { root, body };
}

// ── Built-in card registrations ────────────────────────────────────────────
// Cards added before v7 don't export CardDefinition objects yet.
// Each adapter wraps the existing initXxxCard() function so the registry
// can return a valid CardDefinition on load().

/** Create a minimal CardDefinition adapter around an existing init function. */
function legacyAdapter(
  id: string,
  icon: string,
  titleHe: string,
  titleEn: string,
  col: 0 | 1 | 2,
  order: number,
  flexGrow: number,
  initFn: () => void,
): CardDefinition {
  return {
    id,
    icon,
    titleHe,
    titleEn,
    defaultSlot: { col, order, flexGrow, hidden: false },
    defaultSize: "md" as const,
    render(): HTMLElement {
      return (
        document.querySelector(`[data-card-id="${id}"]`) ??
        document.createElement("section")
      );
    },
    init: initFn,
  };
}

registerCard({
  id: "news",
  icon: "📰",
  titleHe: "חדשות",
  titleEn: "News",
  load: async (): Promise<CardDefinition> => {
    const { initNewsCard } = await import("@/cards/news/news");
    return legacyAdapter("news", "📰", "חדשות", "News", 0, 0, 65, initNewsCard);
  },
});

registerCard({
  id: "weather",
  icon: "🌤",
  titleHe: "מזג אוויר",
  titleEn: "Weather",
  load: async (): Promise<CardDefinition> => {
    const { initWeatherCard } = await import("@/cards/weather/weather");
    return legacyAdapter(
      "weather",
      "🌤",
      "מזג אוויר",
      "Weather",
      0,
      1,
      35,
      initWeatherCard,
    );
  },
});

registerCard({
  id: "hebrew-cal",
  icon: "✡️",
  titleHe: "לוח עברי",
  titleEn: "Hebrew Calendar",
  load: async (): Promise<CardDefinition> => {
    const { initHebrewCalCard } = await import("@/cards/hebrew-cal/hebrew-cal");
    return legacyAdapter(
      "hebrew-cal",
      "✡️",
      "לוח עברי",
      "Hebrew Calendar",
      1,
      0,
      20,
      initHebrewCalCard,
    );
  },
});

registerCard({
  id: "calendar",
  icon: "📅",
  titleHe: "יומן",
  titleEn: "Calendar",
  load: async (): Promise<CardDefinition> => {
    const { initCalendarCard } = await import("@/cards/calendar/calendar");
    return legacyAdapter(
      "calendar",
      "📅",
      "יומן",
      "Calendar",
      1,
      1,
      65,
      initCalendarCard,
    );
  },
});

registerCard({
  id: "currency",
  icon: "💱",
  titleHe: "מטבעות",
  titleEn: "Currency",
  load: async (): Promise<CardDefinition> => {
    const { initCurrencyCard } = await import("@/cards/currency/currency");
    return legacyAdapter(
      "currency",
      "💱",
      "מטבעות",
      "Currency",
      1,
      2,
      15,
      initCurrencyCard,
    );
  },
});

registerCard({
  id: "stocks",
  icon: "📈",
  titleHe: "מניות",
  titleEn: "Stocks",
  load: async (): Promise<CardDefinition> => {
    const { initStocksCard } = await import("@/cards/stocks/stocks");
    return legacyAdapter(
      "stocks",
      "📈",
      "מניות",
      "Stocks",
      2,
      0,
      33,
      initStocksCard,
    );
  },
});

registerCard({
  id: "alerts",
  icon: "🚨",
  titleHe: "התראות",
  titleEn: "Alerts",
  load: async (): Promise<CardDefinition> => {
    const { initAlertsCard } = await import("@/cards/alerts/alerts");
    return legacyAdapter(
      "alerts",
      "🚨",
      "התראות",
      "Alerts",
      2,
      1,
      33,
      initAlertsCard,
    );
  },
});

registerCard({
  id: "motivation",
  icon: "💡",
  titleHe: "השראה",
  titleEn: "Motivation",
  load: async (): Promise<CardDefinition> => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
    return legacyAdapter(
      "motivation",
      "💡",
      "השראה",
      "Motivation",
      2,
      2,
      33,
      initMotivationCard,
    );
  },
});

registerCard({
  id: "tasks",
  icon: "✅",
  titleHe: "משימות",
  titleEn: "Tasks",
  load: async (): Promise<CardDefinition> => {
    const m = await import("@/cards/tasks/tasks");
    return m.tasksCard;
  },
});

registerCard({
  id: "system-info",
  icon: "🖥",
  titleHe: "מצב מערכת",
  titleEn: "System Info",
  load: async (): Promise<CardDefinition> => {
    const m = await import("@/cards/system-info/system-info");
    return m.systemInfoCard;
  },
});

registerCard({
  id: "countdown",
  icon: "💍",
  titleHe: "ספירה לאחור",
  titleEn: "Countdown",
  load: async (): Promise<CardDefinition> => {
    const { initCountdownCard } = await import(
      "@/cards/countdown/countdown"
    );
    return legacyAdapter(
      "countdown",
      "💍",
      "ספירה לאחור",
      "Countdown",
      2,
      3,
      12,
      initCountdownCard,
    );
  },
});
