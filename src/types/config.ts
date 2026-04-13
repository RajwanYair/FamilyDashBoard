/**
 * FamilyDashBoard v6 — User Config Types
 */

export interface DashboardConfig {
  theme: "black" | "blue" | "matrix" | "amber" | "purple";
  screenMode: "tv" | "tablet" | "phone";
  tempUnit: "C" | "F";
  fontScale: number;
  alertsEnabled: boolean;
  alertSound: boolean;
  alertZone: string;
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
}

export const DEFAULT_CONFIG: DashboardConfig = {
  theme: "black",
  screenMode: "tv",
  tempUnit: "C",
  fontScale: 1,
  alertsEnabled: false,
  alertSound: false,
  alertZone: "",
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
};
