/**
 * FamilyDashBoard v13 — Config (Settings Persistence)
 *
 * Load/save user settings from localStorage. Share via URL hash.
 */

import type { DashboardConfig } from "../types/config";
import {
  DEFAULT_CONFIG,
  CONFIG_VERSION,
  isValidInterfaceLanguage,
  isValidTheme,
  isValidScreenMode,
  isValidTempUnit,
  isValidFontScale,
  isValidAlertVolume,
  isValidNightDimLevel,
  isValidNewsMaxItems,
  isValidTickerSpeed,
  isValidHour,
  isValidAnimLevel,
  type CardConfig,
} from "../types/config";
import { diagLog } from "./diag";
import { state } from "./state";
import { nowISO } from "./temporal";
import { LS_CONFIG, LS_NETWORK_MODE } from "./constants";

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

  // v4 → v5: introduced featureFlags map with default opt-in feature set
  if (version < 5) {
    cfg.featureFlags = {
      ...DEFAULT_CONFIG.featureFlags,
      ...(typeof (cfg as { featureFlags?: Record<string, boolean> }).featureFlags === "object"
        ? (cfg as { featureFlags?: Record<string, boolean> }).featureFlags
        : {}),
    };
    cfg.configVersion = 5;
    diagLog("[config] migrated v4 → v5");
  }

  // v5 → v6: move remaining flat per-card props into cards namespace
  if (version < 6) {
    const cards: Record<string, CardConfig> = cfg.cards ?? {};

    // Weather: pull in tempUnit, homeCity
    const wSettings = cards["weather"]?.settings ?? {};
    if (cfg.tempUnit && !wSettings["tempUnit"]) wSettings["tempUnit"] = cfg.tempUnit;
    if (cfg.homeCity && !wSettings["homeCity"]) wSettings["homeCity"] = cfg.homeCity;
    cards["weather"] = { ...cards["weather"], settings: wSettings };

    // Motivation: pull in motivationInterval
    const mSettings = cards["motivation"]?.settings ?? {};
    if (typeof cfg.motivationInterval === "number" && !("interval" in mSettings)) {
      mSettings["interval"] = cfg.motivationInterval;
    }
    cards["motivation"] = { ...cards["motivation"], settings: mSettings };

    // Countdown: pull in countdownCard* flat props
    const cSettings = cards["countdown"]?.settings ?? {};
    if (cfg.countdownCardTitle && !cSettings["title"]) cSettings["title"] = cfg.countdownCardTitle;
    if (cfg.countdownCardDate && !cSettings["date"]) cSettings["date"] = cfg.countdownCardDate;
    if (cfg.countdownCardTime && !cSettings["time"]) cSettings["time"] = cfg.countdownCardTime;
    if (cfg.countdownCardDoneMsg && !cSettings["doneMsg"])
      cSettings["doneMsg"] = cfg.countdownCardDoneMsg;
    if (cfg.countdownCardStartDate && !cSettings["startDate"])
      cSettings["startDate"] = cfg.countdownCardStartDate;
    cards["countdown"] = { ...cards["countdown"], settings: cSettings };

    cfg.cards = cards;
    cfg.configVersion = 6;
    diagLog("[config] migrated v5 → v6");
  }

  // v6 → v7: move alerts flat props into cards.alerts.settings
  if (version < 7) {
    const cards: Record<string, CardConfig> = cfg.cards ?? {};

    // Alerts: pull in alertsEnabled, alertSound, realtimeAlerts, alertVolume
    const aSettings = cards["alerts"]?.settings ?? {};
    if (cfg.alertsEnabled !== undefined && !("enabled" in aSettings))
      aSettings["enabled"] = cfg.alertsEnabled;
    if (cfg.alertSound !== undefined && !("sound" in aSettings))
      aSettings["sound"] = cfg.alertSound;
    if (cfg.realtimeAlerts !== undefined && !("realtime" in aSettings))
      aSettings["realtime"] = cfg.realtimeAlerts;
    if (cfg.alertVolume !== undefined && !("volume" in aSettings))
      aSettings["volume"] = cfg.alertVolume;
    cards["alerts"] = { ...cards["alerts"], settings: aSettings };

    // Calendar: pull in calendarDaysAhead if present
    const calSettings = cards["calendar"]?.settings ?? {};
    if (cfg.calendarDaysAhead !== undefined && !("daysAhead" in calSettings))
      calSettings["daysAhead"] = cfg.calendarDaysAhead;
    cards["calendar"] = { ...cards["calendar"], settings: calSettings };

    cfg.cards = cards;
    cfg.configVersion = 7;
    diagLog("[config] migrated v6 → v7");
  }

  // v7 → v8: introduced interfaceLanguage for bilingual UI.
  if (version < 8) {
    cfg.interfaceLanguage = isValidInterfaceLanguage(cfg.interfaceLanguage)
      ? cfg.interfaceLanguage
      : DEFAULT_CONFIG.interfaceLanguage;
    cfg.configVersion = 8;
    diagLog("[config] migrated v7 → v8");
  }

  // v8 → v9: introduced tempUnit — default to 'C' only when not already a valid value.
  if (version < 9) {
    if (!isValidTempUnit(cfg.tempUnit)) cfg.tempUnit = "C";
    cfg.configVersion = 9;
    diagLog("[config] migrated v8 → v9: tempUnit ensured");
  }

  // v9 → v10: introduced animLevel (none/minimal/normal/full) — default to 'normal'.
  if (version < 10) {
    if (!isValidAnimLevel(cfg.animLevel)) cfg.animLevel = DEFAULT_CONFIG.animLevel;
    cfg.configVersion = 10;
    diagLog("[config] migrated v9 → v10: animLevel ensured");
  }

  // v10 → v11: pre-populate countdownCard2 with "ספירת הגומר" (19 Jun 2026) when still empty.
  if (version < 11) {
    if (!cfg.countdownCard2Date) cfg.countdownCard2Date = DEFAULT_CONFIG.countdownCard2Date;
    if (!cfg.countdownCard2Title) cfg.countdownCard2Title = DEFAULT_CONFIG.countdownCard2Title;
    if (!cfg.countdownCard2Time) cfg.countdownCard2Time = DEFAULT_CONFIG.countdownCard2Time;
    cfg.configVersion = 11;
    diagLog("[config] migrated v10 → v11: countdownCard2 defaults set");
  }

  // v11 → v12: introduced weatherUsTravelMode (default false).
  if (version < 12) {
    if (typeof cfg.weatherUsTravelMode !== "boolean") cfg.weatherUsTravelMode = false;
    cfg.configVersion = 12;
    diagLog("[config] migrated v11 → v12: weatherUsTravelMode defaulted to false");
  }

  return cfg;
}

/**
 * Sanitize enum fields using type guards so stale/invalid values
 * from old formats are replaced with defaults rather than crashing.
 */
function sanitize(cfg: DashboardConfig): DashboardConfig {
  if (!isValidInterfaceLanguage(cfg.interfaceLanguage)) {
    cfg.interfaceLanguage = DEFAULT_CONFIG.interfaceLanguage;
  }
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
  if (typeof cfg.weatherShowHourly !== "boolean")
    cfg.weatherShowHourly = DEFAULT_CONFIG.weatherShowHourly;
  if (typeof cfg.weatherShowWind !== "boolean")
    cfg.weatherShowWind = DEFAULT_CONFIG.weatherShowWind;
  if (typeof cfg.weatherShowSunrise !== "boolean")
    cfg.weatherShowSunrise = DEFAULT_CONFIG.weatherShowSunrise;
  if (typeof cfg.stocksGroupBySector !== "boolean")
    cfg.stocksGroupBySector = DEFAULT_CONFIG.stocksGroupBySector;
  if (typeof cfg.tasksShowCategories !== "boolean")
    cfg.tasksShowCategories = DEFAULT_CONFIG.tasksShowCategories;
  if (typeof cfg.newsShowSource !== "boolean") cfg.newsShowSource = DEFAULT_CONFIG.newsShowSource;
  if (typeof cfg.sysInfoShowRtt !== "boolean") cfg.sysInfoShowRtt = DEFAULT_CONFIG.sysInfoShowRtt;
  if (!isValidAnimLevel(cfg.animLevel)) cfg.animLevel = DEFAULT_CONFIG.animLevel;
  return cfg;
}

/**
 * Load user config from localStorage, merging with defaults.
 * Does NOT seed the reactive state store — call seedConfig() or saveConfig()
 * after loading if reactive state sync is needed (e.g., on app init).
 */
export function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_CONFIG };
    const migrated = migrateConfig(parsed);
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
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));
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
  document.dispatchEvent(new CustomEvent<DashboardConfig>("configchange", { detail: config }));
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

// ── Config import validation ( , v7.13) ──────────────────────────

/** Result type for config import validation. */
export interface ConfigImportResult {
  /** Whether the import was accepted (possibly after migration). */
  ok: boolean;
  /** Human-readable message for display in the config panel. */
  message: string;
  /** The validated+merged config if ok=true, else null. */
  config: DashboardConfig | null;
}

/**
 * Validate and sanitize a raw object from a config JSON import.
 *
 * Checks performed:
 * 1. Input must be a non-null object.
 * 2. If configVersion is present, it must be a number ≤ CONFIG_VERSION.
 * 3. Theme, screenMode, and tempUnit must be valid if present.
 * 4. Runs migrateConfig() + sanitize() on success.
 *
 * This prevents: corrupt files, wrong-app configs, and cross-version confusion.
 *
 * @param raw - The parsed JSON value from the import file.
 */
export function validateImportedConfig(raw: unknown): ConfigImportResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "קובץ ההגדרות אינו תקין (לא JSON אובייקט)", config: null };
  }
  let obj = raw as Record<string, unknown>;

  // unwrap ConfigExportEnvelope if detected
  if (
    "config" in obj &&
    typeof obj["config"] === "object" &&
    obj["config"] !== null &&
    "appVersion" in obj
  ) {
    diagLog("[config] detected export envelope — unwrapping");
    obj = obj["config"] as Record<string, unknown>;
  }

  // Version check — imported config must not be from a future version
  if ("configVersion" in obj) {
    const ver = obj["configVersion"];
    if (typeof ver !== "number") {
      return { ok: false, message: "גרסת הגדרות לא תקינה", config: null };
    }
    if (ver > CONFIG_VERSION) {
      return {
        ok: false,
        message: `גרסת הגדרות ${String(ver)} גבוהה מגרסה נוכחית ${String(CONFIG_VERSION)}`,
        config: null,
      };
    }
  }

  // Enum sanity check for most critical fields
  if ("theme" in obj && obj["theme"] !== undefined && !isValidTheme(obj["theme"])) {
    return { ok: false, message: `ערך עיצוב לא תקין: "${String(obj["theme"])}"`, config: null };
  }
  if (
    "screenMode" in obj &&
    obj["screenMode"] !== undefined &&
    !isValidScreenMode(obj["screenMode"])
  ) {
    return { ok: false, message: `מצב מסך לא תקין: "${String(obj["screenMode"])}"`, config: null };
  }
  if ("tempUnit" in obj && obj["tempUnit"] !== undefined && !isValidTempUnit(obj["tempUnit"])) {
    return {
      ok: false,
      message: `יחידת טמפרטורה לא תקינה: "${String(obj["tempUnit"])}"`,
      config: null,
    };
  }

  // Run migration + merge with defaults + sanitize
  try {
    const migrated = migrateConfig(obj);
    const merged: DashboardConfig = { ...DEFAULT_CONFIG, ...migrated };
    const clean = sanitize(merged);
    diagLog("[config] import validated and merged OK");
    return { ok: true, message: "ההגדרות יובאו בהצלחה", config: clean };
  } catch {
    return { ok: false, message: "שגיאה בעיבוד קובץ ההגדרות", config: null };
  }
}

// ── Config export enrichment ( , v7.13) ───────────────────────────

/** Metadata envelope wrapping an exported config. */
export interface ConfigExportEnvelope {
  /** Semantic version of the app at export time (from __APP_VERSION__). */
  appVersion: string;
  /** Config schema version number. */
  configSchemaVersion: number;
  /** ISO timestamp of when the export was created. */
  exportedAt: string;
  /** The full config payload. */
  config: DashboardConfig;
}

/**
 * Build an enriched export envelope for download.
 * Wraps the config with app version, schema version, and timestamp.
 * The envelope format is backwards-compatible — old importers can ignore the wrapper
 * fields and read `config` directly.
 */
export function buildExportEnvelope(config: DashboardConfig): ConfigExportEnvelope {
  return {
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    configSchemaVersion: CONFIG_VERSION,
    exportedAt: nowISO(),
    config,
  };
}

/**
 * Serialize the export envelope to a JSON string suitable for download.
 */
export function serializeConfigExport(config: DashboardConfig): string {
  return JSON.stringify(buildExportEnvelope(config), null, 2);
}

// Config export validation ──────────────────────────────────

export interface ConfigExportValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Validate an export envelope before download.
 * Catches structural issues (missing fields, wrong types, invalid version).
 */
export function validateExportPayload(envelope: unknown): ConfigExportValidation {
  const errors: string[] = [];
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
    return { ok: false, errors: ["Envelope is not a valid object"] };
  }
  const env = envelope as Record<string, unknown>;

  if (typeof env["appVersion"] !== "string" || !env["appVersion"]) {
    errors.push("Missing or invalid appVersion");
  }
  if (typeof env["configSchemaVersion"] !== "number") {
    errors.push("Missing or invalid configSchemaVersion");
  } else if (env["configSchemaVersion"] > CONFIG_VERSION) {
    errors.push(
      `configSchemaVersion ${String(env["configSchemaVersion"])} exceeds current ${String(CONFIG_VERSION)}`,
    );
  }
  if (typeof env["exportedAt"] !== "string" || !env["exportedAt"]) {
    errors.push("Missing or invalid exportedAt timestamp");
  } else if (isNaN(Date.parse(env["exportedAt"]))) {
    errors.push("exportedAt is not a valid ISO date");
  }
  if (typeof env["config"] !== "object" || env["config"] === null || Array.isArray(env["config"])) {
    errors.push("Missing or invalid config payload");
  } else {
    const cfg = env["config"] as Record<string, unknown>;
    if (typeof cfg["theme"] === "string" && !isValidTheme(cfg["theme"])) {
      errors.push(`Invalid theme: "${String(cfg["theme"])}"`);
    }
    if (typeof cfg["screenMode"] === "string" && !isValidScreenMode(cfg["screenMode"])) {
      errors.push(`Invalid screenMode: "${String(cfg["screenMode"])}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Read a feature flag from the current config.
 *
 * Feature flags live in `DashboardConfig.featureFlags` (added in config v5).
 * Reads localStorage config on each call — use sparingly in hot paths.
 *
 * @param key          - Feature flag name (e.g. `"workerFetch"`, `"idbCache"`)
 * @param defaultValue - Fallback if the key is absent (defaults to `false`)
 * @returns The flag value, or `defaultValue` when the flag is not set
 *
 * @example
 * if (readFeatureFlag("idbCache")) await warmIdbCache();
 */
export function readFeatureFlag(key: string, defaultValue = false): boolean {
  try {
    const config = loadConfig();
    const flags = config.featureFlags;
    return typeof flags[key] === "boolean" ? flags[key] : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Config diff utility ──────────────────────────────────────

export interface ConfigDiffEntry {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Compare two DashboardConfig objects and return an array of differences.
 * Only compares top-level keys (shallow diff).
 * Useful for showing what changed before save, or in diagnostics.
 */
export function diffConfigs(a: DashboardConfig, b: DashboardConfig): ConfigDiffEntry[] {
  const diffs: ConfigDiffEntry[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof DashboardConfig>;

  for (const key of allKeys) {
    const va = (a as unknown as Record<string, unknown>)[key as string];
    const vb = (b as unknown as Record<string, unknown>)[key as string];
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffs.push({ key: key, oldValue: va, newValue: vb });
    }
  }

  return diffs;
}

// Per-card config reset ────────────────────────────────────

/**
 * Reset settings for a single card to defaults.
 * Removes the card's entry from `config.cards[cardId]` and saves.
 * Does NOT reset global config — only the namespaced card settings.
 *
 * @param cardId Card identifier (e.g. "weather", "news")
 * @returns true if the card had settings that were reset
 */
export function resetCardConfig(cardId: string): boolean {
  const config = loadConfig();
  if (!config.cards[cardId]) return false;
  delete config.cards[cardId];
  saveConfig(config);
  diagLog(`[config] reset card settings: ${cardId}`);
  return true;
}

// LS key audit ─────────────────────────────────────────────

/**
 * Set of all known localStorage key prefixes used by the app.
 * Keys that don't match any of these are considered orphaned.
 */
const KNOWN_LS_PREFIXES: readonly string[] = [
  "dash_v2_",
  "dash_theme",
  "dash_visited_news",
  "dash_bookmarks",
  "dash_tasks_done",
  "dash_tasks_reset_date",
  "dash_chores",
  "dash_custom_proxy",
  "dash_ics_url",
  "dash_wx_chart_mode",
  LS_NETWORK_MODE, // user override for fetch path selection
];

export interface LsAuditResult {
  known: string[];
  orphaned: string[];
  total: number;
}

/**
 * Audit localStorage keys — identify known vs orphaned entries.
 * Orphaned keys are those that don't match any known prefix used by the app.
 */
export function auditLocalStorageKeys(): LsAuditResult {
  const known: string[] = [];
  const orphaned: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const isKnown = KNOWN_LS_PREFIXES.some((prefix) => key.startsWith(prefix));
    if (isKnown) known.push(key);
    else orphaned.push(key);
  }

  return { known, orphaned, total: localStorage.length };
}

/**
 * Remove orphaned localStorage keys that don't match any known prefix.
 * Returns the count of removed keys.
 */
export function removeOrphanedLsKeys(): number {
  const { orphaned } = auditLocalStorageKeys();
  for (const key of orphaned) localStorage.removeItem(key);
  diagLog(`[config] removed ${String(orphaned.length)} orphaned LS keys`);
  return orphaned.length;
}
