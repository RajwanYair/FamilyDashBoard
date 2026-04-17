/**
 * FamilyDashBoard v6 — Config (Settings Persistence)
 *
 * Load/save user settings from localStorage. Share via URL hash.
 */

import type { DashboardConfig } from "../types/config";
import {
  DEFAULT_CONFIG,
  CONFIG_VERSION,
  isValidTheme,
  isValidScreenMode,
  isValidTempUnit,
  isValidFontScale,
  isValidAlertVolume,
  isValidNightDimLevel,
  isValidNewsMaxItems,
  isValidTickerSpeed,
  isValidHour,
  type CardConfig,
} from "../types/config";
import { diagLog } from "./diag";
import { state } from "./state";

const LS_KEY = "dash_v2_config";

/**
 * Run forward migrations on a raw config object.
 * Each branch handles a specific version-to-version upgrade.
 * Safe to call with any version (no-ops for current version).
 */
export function migrateConfig(raw: Partial<DashboardConfig>): Partial<DashboardConfig> {
  const version = typeof raw.configVersion === "number" ? raw.configVersion : 0;
  const cfg: Partial<DashboardConfig> = { ...raw };

  // v0 → v1: configVersion field did not exist
  if (version < 1) {
    cfg.configVersion = 1;
    diagLog("[config] migrated v0 → v1");
  }

  // v1 → v2: added newsMaxItems, weatherShowDetails, tasksShowDone,
  //           stocksShowPortfolio, nightDimScheduleEnabled/StartHour/EndHour
  if (version < 2) {
    cfg.newsMaxItems = DEFAULT_CONFIG.newsMaxItems;
    cfg.weatherShowDetails = DEFAULT_CONFIG.weatherShowDetails;
    cfg.tasksShowDone = DEFAULT_CONFIG.tasksShowDone;
    cfg.stocksShowPortfolio = DEFAULT_CONFIG.stocksShowPortfolio;
    cfg.nightDimScheduleEnabled = DEFAULT_CONFIG.nightDimScheduleEnabled;
    cfg.nightDimStartHour = DEFAULT_CONFIG.nightDimStartHour;
    cfg.nightDimEndHour = DEFAULT_CONFIG.nightDimEndHour;
    cfg.configVersion = 2;
    diagLog("[config] migrated v1 → v2");
  }

  // v2 → v3: added per-card settings (weatherShowHourly/Wind/Sunrise,
  //           stocksGroupBySector, tasksShowCategories, newsShowSource, sysInfoShowRtt)
  if (version < 3) {
    cfg.weatherShowHourly = DEFAULT_CONFIG.weatherShowHourly;
    cfg.weatherShowWind = DEFAULT_CONFIG.weatherShowWind;
    cfg.weatherShowSunrise = DEFAULT_CONFIG.weatherShowSunrise;
    cfg.stocksGroupBySector = DEFAULT_CONFIG.stocksGroupBySector;
    cfg.tasksShowCategories = DEFAULT_CONFIG.tasksShowCategories;
    cfg.newsShowSource = DEFAULT_CONFIG.newsShowSource;
    cfg.sysInfoShowRtt = DEFAULT_CONFIG.sysInfoShowRtt;
    cfg.configVersion = 3;
    diagLog("[config] migrated v2 → v3");
  }

  // v3 → v4: introduced namespaced cards record populated from flat per-card props
  if (version < 4) {
    const cards: Record<string, CardConfig> = {};
    cards["weather"] = {
      settings: {
        showDetails: cfg.weatherShowDetails ?? DEFAULT_CONFIG.weatherShowDetails,
        showHourly: cfg.weatherShowHourly ?? DEFAULT_CONFIG.weatherShowHourly,
        showWind: cfg.weatherShowWind ?? DEFAULT_CONFIG.weatherShowWind,
        showSunrise: cfg.weatherShowSunrise ?? DEFAULT_CONFIG.weatherShowSunrise,
      },
    };
    cards["news"] = {
      settings: {
        maxItems: cfg.newsMaxItems ?? DEFAULT_CONFIG.newsMaxItems,
        showSource: cfg.newsShowSource ?? DEFAULT_CONFIG.newsShowSource,
      },
    };
    cards["stocks"] = {
      settings: {
        showPortfolio: cfg.stocksShowPortfolio ?? DEFAULT_CONFIG.stocksShowPortfolio,
        groupBySector: cfg.stocksGroupBySector ?? DEFAULT_CONFIG.stocksGroupBySector,
      },
    };
    cards["tasks"] = {
      settings: {
        showDone: cfg.tasksShowDone ?? DEFAULT_CONFIG.tasksShowDone,
        showCategories: cfg.tasksShowCategories ?? DEFAULT_CONFIG.tasksShowCategories,
        resetHour: cfg.tasksResetHour ?? DEFAULT_CONFIG.tasksResetHour,
      },
    };
    cards["system-info"] = {
      settings: {
        showRtt: cfg.sysInfoShowRtt ?? DEFAULT_CONFIG.sysInfoShowRtt,
      },
    };
    cfg.cards = cards;
    cfg.configVersion = 4;
    diagLog("[config] migrated v3 → v4");
  }

  return cfg;
}

/**
 * Sanitize enum fields using type guards so stale/invalid values
 * from old formats are replaced with defaults rather than crashing.
 */
function sanitize(cfg: DashboardConfig): DashboardConfig {
  if (!isValidTheme(cfg.theme)) cfg.theme = DEFAULT_CONFIG.theme;
  if (!isValidScreenMode(cfg.screenMode)) cfg.screenMode = DEFAULT_CONFIG.screenMode;
  if (!isValidTempUnit(cfg.tempUnit)) cfg.tempUnit = DEFAULT_CONFIG.tempUnit;
  if (!isValidFontScale(cfg.fontScale)) cfg.fontScale = DEFAULT_CONFIG.fontScale;
  if (!isValidAlertVolume(cfg.alertVolume)) cfg.alertVolume = DEFAULT_CONFIG.alertVolume;
  if (!isValidNightDimLevel(cfg.nightDimLevel)) cfg.nightDimLevel = DEFAULT_CONFIG.nightDimLevel;
  if (!isValidNewsMaxItems(cfg.newsMaxItems)) cfg.newsMaxItems = DEFAULT_CONFIG.newsMaxItems;
  if (!isValidTickerSpeed(cfg.tickerSpeed)) cfg.tickerSpeed = DEFAULT_CONFIG.tickerSpeed;
  if (!isValidHour(cfg.nightDimStartHour)) cfg.nightDimStartHour = DEFAULT_CONFIG.nightDimStartHour;
  if (!isValidHour(cfg.nightDimEndHour)) cfg.nightDimEndHour = DEFAULT_CONFIG.nightDimEndHour;
  // v3 boolean fields — coerce non-boolean to default
  if (typeof cfg.weatherShowHourly !== "boolean") cfg.weatherShowHourly = DEFAULT_CONFIG.weatherShowHourly;
  if (typeof cfg.weatherShowWind !== "boolean") cfg.weatherShowWind = DEFAULT_CONFIG.weatherShowWind;
  if (typeof cfg.weatherShowSunrise !== "boolean") cfg.weatherShowSunrise = DEFAULT_CONFIG.weatherShowSunrise;
  if (typeof cfg.stocksGroupBySector !== "boolean") cfg.stocksGroupBySector = DEFAULT_CONFIG.stocksGroupBySector;
  if (typeof cfg.tasksShowCategories !== "boolean") cfg.tasksShowCategories = DEFAULT_CONFIG.tasksShowCategories;
  if (typeof cfg.newsShowSource !== "boolean") cfg.newsShowSource = DEFAULT_CONFIG.newsShowSource;
  if (typeof cfg.sysInfoShowRtt !== "boolean") cfg.sysInfoShowRtt = DEFAULT_CONFIG.sysInfoShowRtt;
  return cfg;
}

/**
 * Load user config from localStorage, merging with defaults.
 * Does NOT seed the reactive state store — call seedConfig() or saveConfig()
 * after loading if reactive state sync is needed (e.g., on app init).
 */
export function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null)
      return { ...DEFAULT_CONFIG };
    const migrated = migrateConfig(parsed as Partial<DashboardConfig>);
    const config: DashboardConfig = { ...DEFAULT_CONFIG, ...migrated };
    // Log if schema is behind current version
    if (config.configVersion !== CONFIG_VERSION) {
      diagLog(`[config] version ${config.configVersion} → ${CONFIG_VERSION}`);
    }
    return sanitize(config);
  } catch {
    diagLog("[config] Failed to parse localStorage config");
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save the full config object to localStorage and sync the reactive state store.
 */
export function saveConfig(config: DashboardConfig): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
    state.seedConfig(config as unknown as Record<string, unknown>);
  } catch {
    diagLog("[config] Failed to save config");
  }
}

/**
 * Update a single config field and persist.
 */
export function updateConfig<K extends keyof DashboardConfig>(
  key: K,
  value: DashboardConfig[K],
): void {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

/**
 * Encode config into a URL hash for sharing.
 */
export function shareConfigHash(config: DashboardConfig): string {
  const json = JSON.stringify(config);
  return "#cfg=" + btoa(unescape(encodeURIComponent(json)));
}

/**
 * Reset config to defaults and persist. Returns the fresh default config.
 */
export function resetConfig(): DashboardConfig {
  const fresh = { ...DEFAULT_CONFIG };
  saveConfig(fresh);
  diagLog("[config] reset to defaults");
  return fresh;
}

/**
 * Dispatch a 'configchange' CustomEvent on document after any config save.
 * Cards and UI modules can listen to keep themselves in sync.
 * Also syncs the reactive state store as a canonical state source.
 */
export function dispatchConfigChange(config: DashboardConfig): void {
  state.seedConfig(config as unknown as Record<string, unknown>);
  document.dispatchEvent(
    new CustomEvent<DashboardConfig>("configchange", { detail: config }),
  );
}

/**
 * Decode config from a URL hash fragment.
 */
export function loadConfigFromHash(hash: string): DashboardConfig | null {
  if (!hash.startsWith("#cfg=")) return null;
  try {
    const b64 = hash.slice(5);
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return { ...DEFAULT_CONFIG, ...(parsed as Partial<DashboardConfig>) };
  } catch {
    diagLog("[config] Invalid hash config");
    return null;
  }
}
