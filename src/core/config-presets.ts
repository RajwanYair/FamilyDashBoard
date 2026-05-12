/**
 * FamilyDashBoard v15 — Config Presets
 *
 * Three device-optimized presets: Family TV, Kitchen Tablet, Office Monitor.
 * Each preset overrides a subset of DashboardConfig with values tuned
 * for the target device's screen size, viewing distance, and use case.
 *
 * Presets are applied on top of the current config — they do not reset
 * unrelated settings (calendar URLs, family name, etc.).
 */

import type { DashboardConfig } from "../types/config";
import type { ThemeName, ScreenModeName } from "./constants";

export interface ConfigPreset {
  /** Machine-readable ID. */
  readonly id: string;
  /** Hebrew label shown in the config panel. */
  readonly label: string;
  /** English label shown in parentheses. */
  readonly labelEn: string;
  /** Emoji icon for the preset selector. */
  readonly icon: string;
  /** Partial config overrides applied when the preset is selected. */
  readonly overrides: Partial<
    Pick<
      DashboardConfig,
      | "screenMode"
      | "theme"
      | "fontScale"
      | "nightDimLevel"
      | "nightDimScheduleEnabled"
      | "nightDimStartHour"
      | "nightDimEndHour"
      | "nightDimIdleMinutes"
      | "animLevel"
      | "tickerSpeed"
      | "autoTheme"
      | "dimWarmTint"
    >
  >;
}

/**
 * Preset: Family TV — always-on 55″+ at 3 m viewing distance.
 * Large font, slow ticker, night dimmer on schedule, warm tint at night.
 */
const PRESET_TV: ConfigPreset = {
  id: "family-tv",
  label: "טלוויזיה משפחתית",
  labelEn: "Family TV",
  icon: "📺",
  overrides: {
    screenMode: "tv" as ScreenModeName,
    theme: "black" as ThemeName,
    fontScale: 1.0,
    nightDimScheduleEnabled: true,
    nightDimStartHour: 22,
    nightDimEndHour: 7,
    nightDimLevel: 55,
    nightDimIdleMinutes: 30,
    animLevel: "normal",
    tickerSpeed: 3,
    autoTheme: true,
    dimWarmTint: true,
  },
};

/**
 * Preset: Kitchen Tablet — iPad-sized (10–13″) at arm's length.
 * Smaller font, faster ticker, no night dimmer, reduced animations.
 */
const PRESET_TABLET: ConfigPreset = {
  id: "kitchen-tablet",
  label: "טאבלט מטבח",
  labelEn: "Kitchen Tablet",
  icon: "📱",
  overrides: {
    screenMode: "tablet" as ScreenModeName,
    theme: "blue" as ThemeName,
    fontScale: 0.9,
    nightDimScheduleEnabled: false,
    nightDimLevel: 40,
    nightDimIdleMinutes: 10,
    animLevel: "minimal",
    tickerSpeed: 4,
    autoTheme: false,
    dimWarmTint: false,
  },
};

/**
 * Preset: Office Monitor — 24–27″ desktop at 60 cm.
 * Default font, full animations, no auto-theme, high-contrast option.
 */
const PRESET_MONITOR: ConfigPreset = {
  id: "office-monitor",
  label: "מסך משרדי",
  labelEn: "Office Monitor",
  icon: "🖥️",
  overrides: {
    screenMode: "tv" as ScreenModeName,
    theme: "blue" as ThemeName,
    fontScale: 0.85,
    nightDimScheduleEnabled: false,
    nightDimLevel: 30,
    nightDimIdleMinutes: 15,
    animLevel: "full",
    tickerSpeed: 3,
    autoTheme: false,
    dimWarmTint: false,
  },
};

/** All available presets, ordered for display. */
export const CONFIG_PRESETS: readonly ConfigPreset[] = [
  PRESET_TV,
  PRESET_TABLET,
  PRESET_MONITOR,
] as const;

/** Look up a preset by ID. Returns undefined if not found. */
export function getPreset(id: string): ConfigPreset | undefined {
  return CONFIG_PRESETS.find((p) => p.id === id);
}
