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

import type {
  CardDefinition,
  CardRegistryEntry,
  CardConfigField,
  CardShell,
  FdbCardDefinition,
} from "@/types/card";
import { getLocalizedCardTitle, getInterfaceLanguage } from "@/core/i18n";
import { diagLog } from "@/core/diag";

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
  return [..._registry.values()].sort((a, b) => a.titleHe.localeCompare(b.titleHe, "he"));
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
 * @returns CardShell with root, body, header, and footer elements
 */
export function createShell(id: string): CardShell {
  const entry = _registry.get(id);
  if (!entry) throw new Error(`Card not registered: "${id}"`);
  const language = getInterfaceLanguage();
  const localizedTitle = getLocalizedCardTitle(entry, language);
  const localizedTitleWithIcon = getLocalizedCardTitle(entry, language, true);

  const root = document.createElement("section");
  root.dataset["cardId"] = id;
  root.className = "card";
  root.setAttribute("aria-label", localizedTitleWithIcon);

  // Header: icon + title + sync dot
  const header = document.createElement("header");
  header.className = "card__header";

  const titleSpan = document.createElement("span");
  titleSpan.className = "card__title";
  titleSpan.setAttribute("data-card-title", "");
  titleSpan.textContent = `${entry.icon} ${localizedTitle}`;
  header.appendChild(titleSpan);

  const syncDot = document.createElement("span");
  syncDot.className = "sync-dot";
  syncDot.id = `sync-${id}`;
  syncDot.setAttribute("aria-hidden", "true");
  header.appendChild(syncDot);

  root.appendChild(header);

  // Body: main content area
  const body = document.createElement("div");
  body.className = "card__body";
  root.appendChild(body);

  // Footer: stale chip slot + actions
  const footer = document.createElement("footer");
  footer.className = "card__footer";
  root.appendChild(footer);

  return { root, body, header, footer };
}

/**
 * Auto-mount shells for any registered card that is NOT already present in the DOM.
 *
 * This enables new cards to be added to the registry without editing `index.html`.
 * Each unmounted card with a `defaultSlot` gets a `createShell()` wrapper appended
 * to the target grid column.  Cards with `defaultSlot.hidden === true` start hidden.
 *
 * Legacy cards (the 11 pre-v7 cards already hard-coded in `index.html`) are skipped
 * because `querySelector("[data-card-id=...]")` finds them first.
 *
 * Call this once from `main.ts` before card initialisation.
 */
export function mountRegisteredCards(): void {
  const cols: (HTMLElement | null)[] = [
    document.querySelector<HTMLElement>(".grid-col-left"),
    document.querySelector<HTMLElement>(".grid-col-mid"),
    document.querySelector<HTMLElement>(".grid-col-right"),
  ];

  for (const entry of listCards()) {
    // Already in the DOM — nothing to do
    if (document.querySelector(`[data-card-id="${entry.id}"]`)) continue;

    const slot = entry.defaultSlot;
    if (!slot) continue;

    const col = cols[slot.col];
    if (!col) continue;

    const shell = createShell(entry.id);
    // Cards that default to hidden start with display:none
    if (slot.hidden) shell.root.style.display = "none";
    // Honour configured flex-grow weight
    shell.root.style.flexGrow = String(slot.flexGrow);

    col.appendChild(shell.root);
    diagLog(`[registry] auto-mounted shell for "${entry.id}" in col ${slot.col}`);
  }
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
  configSchema?: CardConfigField[],
): CardDefinition {
  return {
    id,
    icon,
    titleHe,
    titleEn,
    defaultSlot: { col, order, flexGrow, hidden: false },
    defaultSize: "md" as const,
    render(): HTMLElement {
      return document.querySelector(`[data-card-id="${id}"]`) ?? document.createElement("section");
    },
    init: initFn,
    ...(configSchema ? { configSchema } : {}),
  };
}

registerCard({
  id: "news",
  icon: "📰",
  titleHe: "חדשות",
  titleEn: "News",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ newsCard }, { FdbNewsCard }] = await Promise.all([
      import("@/cards/news/news"),
      import("@/cards/news/fdb-news"),
    ]);

    return {
      ...newsCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-news");
        element.setAttribute("data-card-id", "news");
        element.setAttribute("data-card-size", newsCard.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      destroy(): void {
        // Lifecycle is owned by the custom element's disconnect() hook.
      },
      elementClass: FdbNewsCard,
      tagName: "fdb-news",
    };
  },
});

registerCard({
  id: "weather",
  icon: "🌤",
  titleHe: "מזג אוויר",
  titleEn: "Weather",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ weatherCard }, { FdbWeatherCard }] = await Promise.all([
      import("@/cards/weather/weather"),
      import("@/cards/weather/fdb-weather"),
    ]);

    return {
      ...weatherCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-weather");
        element.setAttribute("data-card-id", "weather");
        element.setAttribute("data-card-size", weatherCard.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      destroy(): void {
        // Lifecycle is owned by the custom element's disconnect() hook.
      },
      elementClass: FdbWeatherCard,
      tagName: "fdb-weather",
    };
  },
});

registerCard({
  id: "hebrew-cal",
  icon: "✡️",
  titleHe: "לוח עברי",
  titleEn: "Hebrew Calendar",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ hebrewCalConfigSchema, destroyHebrewCalCard }, { FdbHebrewCalCard }] =
      await Promise.all([
        import("@/cards/hebrew-cal/hebrew-cal"),
        import("@/cards/hebrew-cal/fdb-hebrew-cal"),
      ]);
    // init is a no-op here — lifecycle owned by FdbHebrewCalCard.connect()
    const def = legacyAdapter(
      "hebrew-cal",
      "✡️",
      "לוח עברי",
      "Hebrew Calendar",
      1,
      0,
      20,
      () => {},
      hebrewCalConfigSchema,
    );
    return {
      ...def,
      destroy: destroyHebrewCalCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-hebrew-cal");
        element.setAttribute("data-card-id", "hebrew-cal");
        element.setAttribute("data-card-size", def.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      elementClass: FdbHebrewCalCard,
      tagName: "fdb-hebrew-cal",
    };
  },
});

registerCard({
  id: "calendar",
  icon: "📅",
  titleHe: "יומן",
  titleEn: "Calendar",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ calendarConfigSchema, destroyCalendarCard }, { FdbCalendarCard }] = await Promise.all([
      import("@/cards/calendar/calendar"),
      import("@/cards/calendar/fdb-calendar"),
    ]);
    // init is a no-op here — lifecycle owned by FdbCalendarCard.connect()
    const def = legacyAdapter(
      "calendar",
      "📅",
      "יומן",
      "Calendar",
      1,
      1,
      65,
      () => {},
      calendarConfigSchema,
    );
    return {
      ...def,
      destroy: destroyCalendarCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-calendar");
        element.setAttribute("data-card-id", "calendar");
        element.setAttribute("data-card-size", def.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      elementClass: FdbCalendarCard,
      tagName: "fdb-calendar",
    };
  },
});

registerCard({
  id: "currency",
  icon: "💱",
  titleHe: "מטבעות",
  titleEn: "Currency",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ currencyConfigSchema, destroyCurrencyCard }, { FdbCurrencyCard }] = await Promise.all([
      import("@/cards/currency/currency"),
      import("@/cards/currency/fdb-currency"),
    ]);
    // init is a no-op here — lifecycle owned by FdbCurrencyCard.connect()
    const def = legacyAdapter(
      "currency",
      "💱",
      "מטבעות",
      "Currency",
      1,
      2,
      15,
      () => {},
      currencyConfigSchema,
    );
    return {
      ...def,
      destroy: destroyCurrencyCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-currency");
        element.setAttribute("data-card-id", "currency");
        element.setAttribute("data-card-size", def.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      elementClass: FdbCurrencyCard,
      tagName: "fdb-currency",
    };
  },
});

registerCard({
  id: "stocks",
  icon: "📈",
  titleHe: "מניות",
  titleEn: "Stocks",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ stocksCard }, { FdbStocksCard }] = await Promise.all([
      import("@/cards/stocks/stocks"),
      import("@/cards/stocks/fdb-stocks"),
    ]);

    return {
      ...stocksCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-stocks");
        element.setAttribute("data-card-id", "stocks");
        element.setAttribute("data-card-size", stocksCard.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      destroy(): void {
        // Lifecycle is owned by the custom element's disconnect() hook.
      },
      elementClass: FdbStocksCard,
      tagName: "fdb-stocks",
    };
  },
});

registerCard({
  id: "alerts",
  icon: "🚨",
  titleHe: "התראות",
  titleEn: "Alerts",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ alertsConfigSchema, destroyAlertsCard }, { FdbAlertsCard }] = await Promise.all([
      import("@/cards/alerts/alerts"),
      import("@/cards/alerts/fdb-alerts"),
    ]);
    // init is a no-op here — lifecycle owned by FdbAlertsCard.connect()
    const def = legacyAdapter(
      "alerts",
      "🚨",
      "התראות",
      "Alerts",
      2,
      1,
      33,
      () => {},
      alertsConfigSchema,
    );
    return {
      ...def,
      destroy: destroyAlertsCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-alerts");
        element.setAttribute("data-card-id", "alerts");
        element.setAttribute("data-card-size", def.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      elementClass: FdbAlertsCard,
      tagName: "fdb-alerts",
    };
  },
});

registerCard({
  id: "motivation",
  icon: "💡",
  titleHe: "השראה",
  titleEn: "Motivation",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ initMotivationCard, motivationConfigSchema }, { FdbMotivationCard }] =
      await Promise.all([
        import("@/cards/motivation/motivation"),
        import("@/cards/motivation/fdb-motivation"),
      ]);
    const def = legacyAdapter(
      "motivation",
      "💡",
      "השראה",
      "Motivation",
      2,
      2,
      33,
      initMotivationCard,
      motivationConfigSchema,
    );
    return {
      ...def,
      elementClass: FdbMotivationCard,
      tagName: "fdb-motivation",
    };
  },
});

registerCard({
  id: "tasks",
  icon: "✅",
  titleHe: "משימות",
  titleEn: "Tasks",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ tasksCard }, { FdbTasksCard }] = await Promise.all([
      import("@/cards/tasks/tasks"),
      import("@/cards/tasks/fdb-tasks"),
    ]);

    return {
      ...tasksCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-tasks");
        element.setAttribute("data-card-id", "tasks");
        element.setAttribute("data-card-size", tasksCard.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      destroy(): void {
        // Lifecycle is owned by the custom element's disconnect() hook.
      },
      elementClass: FdbTasksCard,
      tagName: "fdb-tasks",
    };
  },
});

registerCard({
  id: "system-info",
  icon: "🖥",
  titleHe: "מצב מערכת",
  titleEn: "System Info",
  load: async (): Promise<FdbCardDefinition> => {
    const [{ systemInfoCard }, { FdbSystemInfoCard }] = await Promise.all([
      import("@/cards/system-info/system-info"),
      import("@/cards/system-info/fdb-system-info"),
    ]);
    return {
      ...systemInfoCard,
      render(): HTMLElement {
        const element = document.createElement("fdb-system-info");
        element.setAttribute("data-card-id", "system-info");
        element.setAttribute("data-card-size", systemInfoCard.defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle is owned by the custom element's connect() hook.
      },
      destroy(): void {
        // Lifecycle is owned by the custom element's disconnect() hook.
      },
      elementClass: FdbSystemInfoCard,
      tagName: "fdb-system-info",
    };
  },
});

registerCard({
  id: "countdown",
  icon: "💍",
  titleHe: "ספירה לאחור",
  titleEn: "Countdown",
  load: async (): Promise<CardDefinition> => {
    const { initCountdownCard, countdownConfigSchema } =
      await import("@/cards/countdown/countdown");
    return legacyAdapter(
      "countdown",
      "💍",
      "ספירה לאחור",
      "Countdown",
      2,
      3,
      12,
      initCountdownCard,
      countdownConfigSchema,
    );
  },
});

registerCard({
  id: "video-news",
  icon: "📺",
  titleHe: "ערוץ חדשות",
  titleEn: "Video News",
  defaultSlot: { col: 1, order: 5, flexGrow: 25, hidden: true },
  load: async (): Promise<FdbCardDefinition> => {
    const [, { FdbVideoNewsCard }] = await Promise.all([
      import("@/cards/video-news/video-news"),
      import("@/cards/video-news/fdb-video-news"),
    ]);

    const defaultSize = "lg" as const;

    return {
      id: "video-news",
      icon: "📺",
      titleHe: "ערוץ חדשות",
      titleEn: "Video News",
      defaultSlot: { col: 1, order: 5, flexGrow: 25, hidden: true },
      defaultSize,
      configSchema: [
        {
          key: "video_channel",
          labelHe: "ערוץ",
          labelEn: "Channel",
          type: "select" as const,
          defaultValue: "c14",
          options: [
            { value: "c14", label: "ערוץ 14" },
            { value: "i24he", label: "i24NEWS עברית" },
            { value: "i24en", label: "i24NEWS English" },
            { value: "kan11", label: "כאן 11" },
            { value: "n12", label: "ערוץ 12" },
            { value: "keshet13", label: "ערוץ 13" },
            { value: "arutz7", label: "ערוץ 7" },
          ],
          tab: "feeds" as const,
        },
      ],
      render(): HTMLElement {
        const element = document.createElement("fdb-video-news");
        element.setAttribute("data-card-id", "video-news");
        element.setAttribute("data-card-size", defaultSize);
        return element;
      },
      init(): void {
        // Lifecycle owned by the custom element's connect() hook.
      },
      destroy(): void {
        // Lifecycle owned by the custom element's disconnect() hook.
      },
      elementClass: FdbVideoNewsCard,
      tagName: "fdb-video-news",
    };
  },
});

// Sprint 202 / X9: Daily AI Synthesis tile (opt-in, hidden by default)
registerCard({
  id: "ai-synthesis",
  icon: "🤖",
  titleHe: "תקציר AI יומי",
  titleEn: "Daily AI Synthesis",
  defaultSlot: { col: 2, order: 99, flexGrow: 10, hidden: true },
  load: async (): Promise<CardDefinition> => {
    const { initAiSynthesisCard, aiSynthesisConfigSchema } =
      await import("@/cards/ai-synthesis/ai-synthesis");
    return legacyAdapter(
      "ai-synthesis",
      "🤖",
      "תקציר AI יומי",
      "Daily AI Synthesis",
      2,
      99,
      10,
      initAiSynthesisCard,
      aiSynthesisConfigSchema,
    );
  },
});
