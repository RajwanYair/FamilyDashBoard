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
  bgImages: string[];
  /** Ordered list of card IDs per column: [col0_ids, col1_ids, col2_ids]. Null = use hardcoded layout. */
  cardLayout: [string[], string[], string[]] | null;
  /** IDs of cards hidden from the dashboard. */
  hiddenCards: string[];
  /** Per-card size override: { [card-id]: "sm"|"md"|"lg"|"xl" } */
  cardSizes: Record<string, string>;
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
  bgImages: [],
  cardLayout: null,
  hiddenCards: [],
  cardSizes: {},
};
