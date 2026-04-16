/**
 * FamilyDashBoard v6 — User Config Types
 */

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
};
