/**
 * FamilyDashBoard v6 — User Config Types
 */

/**
 * Per-card namespaced settings (Config v4+).
 * Cards can store any boolean/number/string setting here.
 * This supplements (and will eventually replace) the flat per-card props on DashboardConfig.
 */
export interface CardConfig {
  /** Optional: card size override. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Per-card settings keyed by setting name. */
  settings?: Record<string, boolean | number | string>;
}

export interface DashboardConfig {
  theme: "black" | "blue" | "matrix" | "amber" | "purple" | "rose";
  screenMode: "tv" | "tablet" | "phone";
  tempUnit: "C" | "F";
  fontScale: number;
  alertsEnabled: boolean;
  alertSound: boolean;
  alertZone: string;
  realtimeAlerts: boolean;
  autoTheme: boolean;
  clockSeconds: boolean;
  nightDimLevel: number;
  homeCity: string;
  geonameid: string;
  calendarUrls: string[];
  disabledFeeds: string[];
  hiddenStocks: string[];
  customProxy: string;
  familyName: string;
  members: string[];
  birthdays: Array<{ name: string; month: number; day: number }>;
  countdownLabel: string;
  countdownDate: string;
  /** Countdown card — event title (default: חתונת אליאור וטובה) */
  countdownCardTitle: string;
  /** Countdown card — target date YYYY-MM-DD (default: 2026-05-07) */
  countdownCardDate: string;
  /** Countdown card — target time HH:MM (default: 18:00) */
  countdownCardTime: string;
  /** Countdown card — message shown after event passes */
  countdownCardDoneMsg: string;
  /** Countdown card — start date YYYY-MM-DD for progress bar (default: 1 year before target) */
  countdownCardStartDate: string;
  bgImages: string[];
  /** Ordered list of card IDs per column: [col0_ids, col1_ids, col2_ids]. Null = use hardcoded layout. */
  cardLayout: [string[], string[], string[]] | null;
  /** IDs of cards hidden from the dashboard. */
  hiddenCards: string[];
  /** Per-card size override: { [card-id]: "sm"|"md"|"lg"|"xl" } */
  cardSizes: Record<string, string>;
  /** Hour (0-23) at which the daily tasks checklist resets (default: 6 = 6 AM) */
  tasksResetHour: number;
  /** Ticker scroll speed 1=slowest … 5=fastest (default: 3). Maps to 60/45/30/20/12 seconds. */
  tickerSpeed: number;
  /** Alert beep volume 0–100 (default: 18). Applied to AudioContext gain. */
  alertVolume: number;
  /** Night dimmer warm amber tint — applies CSS sepia filter for eye-comfort. */
  dimWarmTint: boolean;
  /** Countdown card 2 — event title */
  countdownCard2Title: string;
  /** Countdown card 2 — target date YYYY-MM-DD */
  countdownCard2Date: string;
  /** Countdown card 2 — target time HH:MM */
  countdownCard2Time: string;
  /** Countdown card 2 — message shown after event passes */
  countdownCard2DoneMsg: string;
  /** Countdown card 3 — event title */
  countdownCard3Title: string;
  /** Countdown card 3 — target date YYYY-MM-DD */
  countdownCard3Date: string;
  /** Countdown card 3 — target time HH:MM */
  countdownCard3Time: string;
  /** Countdown card 3 — message shown after event passes */
  countdownCard3DoneMsg: string;
  /** Motivation card — auto-advance interval in minutes (0 = off). */
  motivationInterval: number;
  /**
   * Schema version — used to run forward migrations when loading older stored configs.
   * Increment each time the config shape changes in a breaking way.
   */
  configVersion: number;

  // ── Config v2 additions (v7.8) ──

  /** Max news items shown per feed (default: 5; range 1–10). */
  newsMaxItems: number;
  /** Show humidity / UV / moon details in weather card (default: true). */
  weatherShowDetails: boolean;
  /** Show "done" tasks in the tasks card (default: true). */
  tasksShowDone: boolean;
  /** Show portfolio P&L summary row in stocks card (default: true). */
  stocksShowPortfolio: boolean;
  /** Night dimmer schedule enabled (default: false). */
  nightDimScheduleEnabled: boolean;
  /** Night dimmer auto-start hour 0–23 (default: 22). */
  nightDimStartHour: number;
  /** Night dimmer auto-end hour 0–23 (default: 7). */
  nightDimEndHour: number;

  // ── Config v3 additions (v7.9) — per-card settings ──

  /** Weather card: show hourly forecast strip (next 6h). Default: true. */
  weatherShowHourly: boolean;
  /** Weather card: show wind speed and direction. Default: true. */
  weatherShowWind: boolean;
  /** Weather card: show sunrise/sunset times. Default: true. */
  weatherShowSunrise: boolean;
  /** Stocks card: group by sector in display. Default: false. */
  stocksGroupBySector: boolean;
  /** Tasks card: enable category labels (freeform string per task). Default: false. */
  tasksShowCategories: boolean;
  /** News card: show source domain badge on each news item. Default: true. */
  newsShowSource: boolean;
  /** System info card: show network RTT tile. Default: true. */
  sysInfoShowRtt: boolean;

  // ── Config v4 additions (v7.10) — namespaced per-card settings ──

  /**
   * Namespaced per-card settings. Populated by v3→v4 migration.
   * Keys are card IDs (e.g. "weather", "news", "stocks").
   */
  cards: Record<string, CardConfig>;
}

export const DEFAULT_CONFIG: DashboardConfig = {
  theme: "black",
  screenMode: "tv",
  tempUnit: "C",
  fontScale: 1,
  alertsEnabled: false,
  alertSound: false,
  alertZone: "",
  realtimeAlerts: false,
  autoTheme: true,
  clockSeconds: false,
  nightDimLevel: 55,
  homeCity: "jerusalem",
  geonameid: "281184",
  calendarUrls: [],
  disabledFeeds: [],
  hiddenStocks: [],
  customProxy: "",
  familyName: "",
  members: [],
  birthdays: [],
  countdownLabel: "",
  countdownDate: "",
  countdownCardTitle: "חתונת אליאור וטובה",
  countdownCardDate: "2026-05-07",
  countdownCardTime: "18:00",
  countdownCardDoneMsg: "🎉 מזל טוב לאליאור ולטובה!",
  countdownCardStartDate: "",
  bgImages: [],
  cardLayout: null,
  hiddenCards: [],
  cardSizes: {},
  tasksResetHour: 6,
  tickerSpeed: 3,
  alertVolume: 18,
  dimWarmTint: false,
  countdownCard2Title: "",
  countdownCard2Date: "",
  countdownCard2Time: "18:00",
  countdownCard2DoneMsg: "🎉 מזל טוב!",
  countdownCard3Title: "",
  countdownCard3Date: "",
  countdownCard3Time: "18:00",
  countdownCard3DoneMsg: "🎉 מזל טוב!",
  motivationInterval: 0,
  configVersion: 4,

  // Config v2 defaults
  newsMaxItems: 5,
  weatherShowDetails: true,
  tasksShowDone: true,
  stocksShowPortfolio: true,
  nightDimScheduleEnabled: false,
  nightDimStartHour: 22,
  nightDimEndHour: 7,

  // Config v3 defaults
  weatherShowHourly: true,
  weatherShowWind: true,
  weatherShowSunrise: true,
  stocksGroupBySector: true,
  tasksShowCategories: true,
  newsShowSource: true,
  sysInfoShowRtt: true,

  // Config v4 defaults
  cards: {},
};

/** Current config schema version — bump when shape changes. */
export const CONFIG_VERSION = 4;

/** Type guard: checks if a string is a valid theme name. */
export function isValidTheme(v: unknown): v is DashboardConfig["theme"] {
  return (
    typeof v === "string" &&
    ["black", "blue", "matrix", "amber", "purple", "rose"].includes(v)
  );
}

/** Type guard: checks if a string is a valid screen mode. */
export function isValidScreenMode(v: unknown): v is DashboardConfig["screenMode"] {
  return typeof v === "string" && ["tv", "tablet", "phone"].includes(v);
}

/** Type guard: checks if a string is a valid temperature unit. */
export function isValidTempUnit(v: unknown): v is DashboardConfig["tempUnit"] {
  return typeof v === "string" && ["C", "F"].includes(v);
}

/** Type guard: checks if a number is a valid font scale (0.5–2.0 in 0.1 steps). */
export function isValidFontScale(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 0.5 && v <= 2.0;
}

/** Type guard: checks if a number is a valid alert volume (0–100). */
export function isValidAlertVolume(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 0 && v <= 100;
}

/** Type guard: checks if a number is a valid night dim level (0–100). */
export function isValidNightDimLevel(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 0 && v <= 100;
}

/** Type guard: checks if a number is a valid news max items (1–10). */
export function isValidNewsMaxItems(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 1 && v <= 10;
}

/** Type guard: checks if a number is a valid ticker speed (1–5). */
export function isValidTickerSpeed(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 1 && v <= 5;
}

/** Type guard: checks a dim hour (0–23). */
export function isValidHour(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23;
}
