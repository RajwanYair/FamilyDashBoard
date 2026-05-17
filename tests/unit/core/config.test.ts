/**
 * Tests for src/core/config.ts — Config Persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  loadConfig,
  saveConfig,
  updateConfig,
  shareConfigHash,
  loadConfigFromHash,
  migrateConfig,
  resetConfig,
  dispatchConfigChange,
  validateImportedConfig,
  buildExportEnvelope,
  serializeConfigExport,
  readFeatureFlag,
  validateExportPayload,
  resetCardConfig,
  diffConfigs,
  auditLocalStorageKeys,
  removeOrphanedLsKeys,
} from "@/core/config";
import {
  DEFAULT_CONFIG,
  isValidTheme,
  isValidScreenMode,
  isValidTempUnit,
  isValidFontScale,
  CONFIG_VERSION,
  isValidAlertVolume,
  isValidNightDimLevel,
  isValidNewsMaxItems,
  isValidTickerSpeed,
  isValidHour,
  isValidInterfaceLanguage,
  isValidAnimLevel,
} from "@/types/config";

describe("Config — loadConfig", () => {
  it("returns defaults when localStorage is empty", () => {
    const cfg = loadConfig();
    expect(cfg.interfaceLanguage).toBe("he");
    expect(cfg.theme).toBe("black");
    expect(cfg.tempUnit).toBe("C");
    expect(cfg.screenMode).toBe("tv");
  });

  it("merges saved values with defaults", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ theme: "blue" }));
    const cfg = loadConfig();
    expect(cfg.theme).toBe("blue");
    expect(cfg.tempUnit).toBe("C"); // default preserved
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("dash_v2_config", "not-json");
    const cfg = loadConfig();
    expect(cfg.theme).toBe("black"); // defaults
  });
});

describe("Config — saveConfig", () => {
  it("persists config to localStorage", () => {
    const cfg = { ...DEFAULT_CONFIG, theme: "purple" as const };
    saveConfig(cfg);
    const raw = localStorage.getItem("dash_v2_config");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).theme).toBe("purple");
  });
});

describe("Config — updateConfig", () => {
  it("updates a single field and persists", () => {
    updateConfig("tempUnit", "F");
    const cfg = loadConfig();
    expect(cfg.tempUnit).toBe("F");
  });
});

describe("Config — shareConfigHash", () => {
  it("encodes config to a URL hash", () => {
    const hash = shareConfigHash(DEFAULT_CONFIG);
    expect(hash.startsWith("#cfg=")).toBe(true);
  });

  it("round-trips through encode/decode", () => {
    const original = { ...DEFAULT_CONFIG, theme: "amber" as const };
    const hash = shareConfigHash(original);
    const decoded = loadConfigFromHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.theme).toBe("amber");
  });
});

describe("Config — loadConfigFromHash", () => {
  it("returns null for invalid hash", () => {
    expect(loadConfigFromHash("#other=123")).toBeNull();
    expect(loadConfigFromHash("")).toBeNull();
  });

  it("returns null for corrupted base64", () => {
    expect(loadConfigFromHash("#cfg=!!!invalid!!!")).toBeNull();
  });
});

describe("Config — extra coverage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadConfig returns an object with all expected keys", () => {
    const cfg = loadConfig();
    expect(cfg).toHaveProperty("interfaceLanguage");
    expect(cfg).toHaveProperty("theme");
    expect(cfg).toHaveProperty("tempUnit");
    expect(cfg).toHaveProperty("screenMode");
    expect(cfg).toHaveProperty("homeCity");
  });

  it("saveConfig then loadConfig round-trips all fields", () => {
    const toSave = {
      ...DEFAULT_CONFIG,
      theme: "amber" as const,
      tempUnit: "F" as const,
    };
    saveConfig(toSave);
    const loaded = loadConfig();
    expect(loaded.theme).toBe("amber");
    expect(loaded.tempUnit).toBe("F");
  });

  it("updateConfig with theme persists correctly", () => {
    updateConfig("theme", "blue");
    expect(loadConfig().theme).toBe("blue");
  });

  it("updateConfig with screenMode persists correctly", () => {
    updateConfig("screenMode", "tablet");
    expect(loadConfig().screenMode).toBe("tablet");
  });

  it("shareConfigHash encodes different configs differently", () => {
    const hash1 = shareConfigHash({
      ...DEFAULT_CONFIG,
      theme: "black" as const,
    });
    const hash2 = shareConfigHash({
      ...DEFAULT_CONFIG,
      theme: "amber" as const,
    });
    expect(hash1).not.toBe(hash2);
  });

  it("loadConfigFromHash returns null for plain string without #", () => {
    expect(loadConfigFromHash("cfg=abc")).toBeNull();
  });

  it("loadConfigFromHash null for hash with empty cfg value", () => {
    expect(loadConfigFromHash("#cfg=")).toBeNull();
  });

  it("loadConfig returns defaults when stored value is a non-object JSON (number)", () => {
    localStorage.setItem("dash_v2_config", "42");
    const cfg = loadConfig();
    expect(cfg.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it("loadConfig returns defaults when stored value is a JSON string", () => {
    localStorage.setItem("dash_v2_config", '"hello"');
    const cfg = loadConfig();
    expect(cfg.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it("loadConfig returns defaults when stored value is JSON null", () => {
    localStorage.setItem("dash_v2_config", "null");
    const cfg = loadConfig();
    expect(cfg.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it("saveConfig catch block handles localStorage quota error", () => {
    const orig = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    // Should not throw — the catch silently logs
    expect(() => saveConfig(DEFAULT_CONFIG)).not.toThrow();
    vi.mocked(Storage.prototype.setItem).mockRestore();
  });
});

// ── saveConfig catch path via localStorage direct spy (line 37) ──────────────

describe("Config — saveConfig localStorage.setItem catch (line 37)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("executes catch branch diagLog when localStorage.setItem throws (line 37)", () => {
    // Spy directly on the instance method to ensure it throws in happy-dom
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    // saveConfig's try block catches the error → line 37 diagLog runs
    expect(() => saveConfig(DEFAULT_CONFIG)).not.toThrow();
  });
});
// ── loadConfigFromHash non-object parsed (line 70) ────────────────────────────

describe("Config — loadConfigFromHash non-object parsed value (line 70)", () => {
  it("returns null when decoded JSON is a primitive string (line 70 typeof check)", () => {
    // Encode a JSON string (not an object) → typeof parsed !== "object" → return null
    const hash = "#cfg=" + btoa(unescape(encodeURIComponent(JSON.stringify("hello"))));
    const result = loadConfigFromHash(hash);
    expect(result).toBeNull();
  });

  it("returns null when decoded JSON is JSON null (line 70 parsed===null branch)", () => {
    const hash = "#cfg=" + btoa(unescape(encodeURIComponent(JSON.stringify(null))));
    const result = loadConfigFromHash(hash);
    expect(result).toBeNull();
  });
});

// ── (v7.4) + v7.8 config v2: migrateConfig + type guards + configVersion ──

describe("Config — migrateConfig (v7.4)", () => {
  it("migrates to configVersion=5 when version is missing (v0→v1→v2→v3→v4→v5)", () => {
    const result = migrateConfig({ theme: "blue" });
    expect(result.configVersion).toBe(CONFIG_VERSION);
  });

  it("migrates to configVersion=5 when version is 0", () => {
    const result = migrateConfig({ configVersion: 0 });
    expect(result.configVersion).toBe(CONFIG_VERSION);
  });

  it("migrates version 1 to version 5, adding v2+v3+v4+v5 fields", () => {
    const result = migrateConfig({ configVersion: 1, theme: "rose" as const });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.theme).toBe("rose");
    expect(result.newsMaxItems).toBe(5);
    expect(result.weatherShowDetails).toBe(true);
  });

  it("migrates config at v3 to v5", () => {
    const result = migrateConfig({ configVersion: 3, theme: "rose" as const });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.theme).toBe("rose");
  });

  it("preserves all existing fields during migration", () => {
    const result = migrateConfig({ theme: "matrix" as const, tempUnit: "F" as const });
    expect(result.theme).toBe("matrix");
    // v9 migration defaults to 'C' only when tempUnit is absent/invalid;
    // an existing valid 'F' value is preserved (user preference respected).
    expect(result.tempUnit).toBe("F");
  });
});

describe("Config — type guards (v7.4)", () => {
  it("isValidInterfaceLanguage accepts he and en", () => {
    expect(isValidInterfaceLanguage("he")).toBe(true);
    expect(isValidInterfaceLanguage("en")).toBe(true);
  });

  it("isValidInterfaceLanguage rejects other values", () => {
    expect(isValidInterfaceLanguage("fr")).toBe(false);
    expect(isValidInterfaceLanguage(42)).toBe(false);
    expect(isValidInterfaceLanguage(null)).toBe(false);
  });

  it("isValidTheme accepts all 6 theme names", () => {
    for (const t of ["black", "blue", "matrix", "amber", "purple", "rose"]) {
      expect(isValidTheme(t)).toBe(true);
    }
  });

  it("isValidTheme rejects invalid strings", () => {
    expect(isValidTheme("dark")).toBe(false);
    expect(isValidTheme("")).toBe(false);
    expect(isValidTheme(null)).toBe(false);
    expect(isValidTheme(42)).toBe(false);
  });

  it("isValidScreenMode accepts tv, tablet, phone", () => {
    expect(isValidScreenMode("tv")).toBe(true);
    expect(isValidScreenMode("tablet")).toBe(true);
    expect(isValidScreenMode("phone")).toBe(true);
  });

  it("isValidScreenMode rejects invalid strings", () => {
    expect(isValidScreenMode("desk")).toBe(false);
    expect(isValidScreenMode("")).toBe(false);
    expect(isValidScreenMode(undefined)).toBe(false);
  });

  it("isValidTempUnit accepts C and F", () => {
    expect(isValidTempUnit("C")).toBe(true);
    expect(isValidTempUnit("F")).toBe(true);
  });

  it("isValidTempUnit rejects other values", () => {
    expect(isValidTempUnit("K")).toBe(false);
    expect(isValidTempUnit("c")).toBe(false);
    expect(isValidTempUnit(null)).toBe(false);
  });
});

describe("Config — isValidFontScale (v7.4)", () => {
  it("accepts values in 0.5–2.0 range", () => {
    expect(isValidFontScale(0.5)).toBe(true);
    expect(isValidFontScale(1.0)).toBe(true);
    expect(isValidFontScale(2.0)).toBe(true);
    expect(isValidFontScale(1.3)).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(isValidFontScale(0.4)).toBe(false);
    expect(isValidFontScale(2.1)).toBe(false);
    expect(isValidFontScale(-1)).toBe(false);
    expect(isValidFontScale(0)).toBe(false);
  });

  it("rejects non-numeric values", () => {
    expect(isValidFontScale("1.0")).toBe(false);
    expect(isValidFontScale(null)).toBe(false);
    expect(isValidFontScale(NaN)).toBe(false);
    expect(isValidFontScale(Infinity)).toBe(false);
  });
});

describe("Config — configVersion sanity (v7.4)", () => {
  it("DEFAULT_CONFIG has configVersion 5", () => {
    expect(DEFAULT_CONFIG.configVersion).toBe(CONFIG_VERSION);
  });

  it("CONFIG_VERSION constant matches DEFAULT_CONFIG", () => {
    expect(CONFIG_VERSION).toBe(DEFAULT_CONFIG.configVersion);
  });

  it("loadConfig resets invalid theme to default", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ theme: "neon" }));
    const cfg = loadConfig();
    expect(cfg.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it("loadConfig resets invalid screenMode to default", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ screenMode: "widescreen" }));
    const cfg = loadConfig();
    expect(cfg.screenMode).toBe(DEFAULT_CONFIG.screenMode);
  });

  it("loadConfig resets invalid tempUnit to default", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ tempUnit: "K" }));
    const cfg = loadConfig();
    expect(cfg.tempUnit).toBe(DEFAULT_CONFIG.tempUnit);
  });
});

// ── (v7.8): resetConfig + dispatchConfigChange ─────────────────────

describe("Config — resetConfig ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a config equal to DEFAULT_CONFIG", () => {
    // First set something non-default
    saveConfig({ ...DEFAULT_CONFIG, theme: "amber", tempUnit: "F" });
    const reset = resetConfig();
    expect(reset.theme).toBe(DEFAULT_CONFIG.theme);
    expect(reset.tempUnit).toBe(DEFAULT_CONFIG.tempUnit);
  });

  it("persists the reset config to localStorage", () => {
    saveConfig({ ...DEFAULT_CONFIG, theme: "rose" });
    resetConfig();
    const reloaded = loadConfig();
    expect(reloaded.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it("returns an object with all required config keys", () => {
    const reset = resetConfig();
    expect(reset).toHaveProperty("theme");
    expect(reset).toHaveProperty("tempUnit");
    expect(reset).toHaveProperty("screenMode");
    expect(reset).toHaveProperty("configVersion");
    expect(reset.configVersion).toBe(CONFIG_VERSION);
  });
});

describe("Config — dispatchConfigChange ", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires a 'configchange' CustomEvent on document", () => {
    const listener = vi.fn();
    document.addEventListener("configchange", listener);
    dispatchConfigChange(DEFAULT_CONFIG);
    document.removeEventListener("configchange", listener);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("passes the config as event.detail", () => {
    let received: unknown = null;
    const listener = (e: Event) => {
      received = (e as CustomEvent).detail;
    };
    document.addEventListener("configchange", listener);
    dispatchConfigChange({ ...DEFAULT_CONFIG, theme: "matrix" });
    document.removeEventListener("configchange", listener);
    expect((received as typeof DEFAULT_CONFIG | null)?.theme).toBe("matrix");
  });
});

// ── (v7.8): New type guards ─────────────────────────────────────────

describe("Config — isValidAlertVolume ", () => {
  it("accepts 0–100", () => {
    expect(isValidAlertVolume(0)).toBe(true);
    expect(isValidAlertVolume(50)).toBe(true);
    expect(isValidAlertVolume(100)).toBe(true);
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(isValidAlertVolume(-1)).toBe(false);
    expect(isValidAlertVolume(101)).toBe(false);
    expect(isValidAlertVolume("50")).toBe(false);
    expect(isValidAlertVolume(null)).toBe(false);
    expect(isValidAlertVolume(NaN)).toBe(false);
  });
});

describe("Config — isValidNightDimLevel ", () => {
  it("accepts 0–100", () => {
    expect(isValidNightDimLevel(0)).toBe(true);
    expect(isValidNightDimLevel(55)).toBe(true);
    expect(isValidNightDimLevel(100)).toBe(true);
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(isValidNightDimLevel(-1)).toBe(false);
    expect(isValidNightDimLevel(101)).toBe(false);
    expect(isValidNightDimLevel("55")).toBe(false);
    expect(isValidNightDimLevel(undefined)).toBe(false);
  });
});

describe("Config — isValidNewsMaxItems ", () => {
  it("accepts 1–10", () => {
    expect(isValidNewsMaxItems(1)).toBe(true);
    expect(isValidNewsMaxItems(5)).toBe(true);
    expect(isValidNewsMaxItems(10)).toBe(true);
  });

  it("rejects 0, 11, and non-numeric values", () => {
    expect(isValidNewsMaxItems(0)).toBe(false);
    expect(isValidNewsMaxItems(11)).toBe(false);
    expect(isValidNewsMaxItems("5")).toBe(false);
    expect(isValidNewsMaxItems(null)).toBe(false);
  });
});

describe("Config — isValidTickerSpeed ", () => {
  it("accepts 1–5", () => {
    expect(isValidTickerSpeed(1)).toBe(true);
    expect(isValidTickerSpeed(3)).toBe(true);
    expect(isValidTickerSpeed(5)).toBe(true);
  });

  it("rejects 0, 6, and non-numeric values", () => {
    expect(isValidTickerSpeed(0)).toBe(false);
    expect(isValidTickerSpeed(6)).toBe(false);
    expect(isValidTickerSpeed("3")).toBe(false);
    expect(isValidTickerSpeed(NaN)).toBe(false);
  });
});

describe("Config — isValidHour ", () => {
  it("accepts 0–23", () => {
    expect(isValidHour(0)).toBe(true);
    expect(isValidHour(12)).toBe(true);
    expect(isValidHour(23)).toBe(true);
  });

  it("rejects -1, 24, and non-numeric values", () => {
    expect(isValidHour(-1)).toBe(false);
    expect(isValidHour(24)).toBe(false);
    expect(isValidHour("12")).toBe(false);
    expect(isValidHour(null)).toBe(false);
    expect(isValidHour(1.5)).toBe(false);
  });
});

// ── (v7.9): Config v3 migration + per-card settings ─────────────────

describe("Config — migrateConfig v2→v3 ", () => {
  it("migrates v2 config to v5, adding all per-card fields", () => {
    const result = migrateConfig({ configVersion: 2, theme: "blue" });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.weatherShowHourly).toBe(true);
    expect(result.weatherShowWind).toBe(true);
    expect(result.weatherShowSunrise).toBe(true);
    expect(result.stocksGroupBySector).toBe(true);
    expect(result.tasksShowCategories).toBe(true);
    expect(result.newsShowSource).toBe(true);
    expect(result.sysInfoShowRtt).toBe(true);
  });

  it("migrates v0 all the way to v5 in one call", () => {
    const result = migrateConfig({});
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.weatherShowHourly).toBe(true);
    expect(result.newsMaxItems).toBe(5); // v2 field also present
  });

  it("does not re-run v3 migration for a v3 config, but runs v4+v5 migration", () => {
    const result = migrateConfig({ configVersion: 3, weatherShowHourly: false });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    // weatherShowHourly is preserved from input (v3 migration skipped)
    expect(result.weatherShowHourly).toBe(false);
  });

  it("does not modify config already at current version (v5)", () => {
    const result = migrateConfig({ configVersion: 5, theme: "rose" as const } as Parameters<
      typeof migrateConfig
    >[0]);
    expect(result.configVersion).toBe(CONFIG_VERSION);
  });

  it("CONFIG_VERSION constant is 5", () => {
    expect(CONFIG_VERSION).toBe(12);
  });

  it("DEFAULT_CONFIG has all v3 fields with correct defaults", () => {
    expect(DEFAULT_CONFIG.weatherShowHourly).toBe(true);
    expect(DEFAULT_CONFIG.weatherShowWind).toBe(true);
    expect(DEFAULT_CONFIG.weatherShowSunrise).toBe(true);
    expect(DEFAULT_CONFIG.stocksGroupBySector).toBe(true);
    expect(DEFAULT_CONFIG.tasksShowCategories).toBe(true);
    expect(DEFAULT_CONFIG.newsShowSource).toBe(true);
    expect(DEFAULT_CONFIG.sysInfoShowRtt).toBe(true);
  });
});

// ── v7.10: Config v4 — namespaced cards migration ──────────────────────────────

describe("Config — migrateConfig v3→v4 (v7.10)", () => {
  it("v3 config gets cards record with 5 card entries", () => {
    const result = migrateConfig({ configVersion: 3 });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.cards).toBeDefined();
    expect(typeof result.cards).toBe("object");
    expect(result.cards!["weather"]).toBeDefined();
    expect(result.cards!["news"]).toBeDefined();
    expect(result.cards!["stocks"]).toBeDefined();
    expect(result.cards!["tasks"]).toBeDefined();
    expect(result.cards!["system-info"]).toBeDefined();
  });

  it("weather card settings are namespaced from flat props", () => {
    const result = migrateConfig({
      configVersion: 3,
      weatherShowDetails: false,
      weatherShowHourly: false,
      weatherShowWind: true,
      weatherShowSunrise: false,
    });
    const ws = result.cards!["weather"]?.settings;
    expect(ws?.["showDetails"]).toBe(false);
    expect(ws?.["showHourly"]).toBe(false);
    expect(ws?.["showWind"]).toBe(true);
    expect(ws?.["showSunrise"]).toBe(false);
  });

  it("news card settings contain maxItems and showSource", () => {
    const result = migrateConfig({ configVersion: 3, newsMaxItems: 7, newsShowSource: false });
    const ns = result.cards!["news"]?.settings;
    expect(ns?.["maxItems"]).toBe(7);
    expect(ns?.["showSource"]).toBe(false);
  });

  it("stocks card settings contain showPortfolio and groupBySector", () => {
    const result = migrateConfig({
      configVersion: 3,
      stocksShowPortfolio: false,
      stocksGroupBySector: false,
    });
    const ss = result.cards!["stocks"]?.settings;
    expect(ss?.["showPortfolio"]).toBe(false);
    expect(ss?.["groupBySector"]).toBe(false);
  });

  it("tasks card settings contain showDone, showCategories, resetHour", () => {
    const result = migrateConfig({
      configVersion: 3,
      tasksShowDone: false,
      tasksShowCategories: false,
      tasksResetHour: 8,
    });
    const ts = result.cards!["tasks"]?.settings;
    expect(ts?.["showDone"]).toBe(false);
    expect(ts?.["showCategories"]).toBe(false);
    expect(ts?.["resetHour"]).toBe(8);
  });

  it("system-info card settings contain showRtt", () => {
    const result = migrateConfig({ configVersion: 3, sysInfoShowRtt: false });
    const si = result.cards!["system-info"]?.settings;
    expect(si?.["showRtt"]).toBe(false);
  });

  it("v4 config is not re-migrated (cards preserved)", () => {
    const existing = {
      configVersion: 4 as const,
      cards: { weather: { settings: { showDetails: false } } },
    };
    const result = migrateConfig(existing);
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.cards!["weather"]?.settings?.["showDetails"]).toBe(false);
  });

  it("uses defaults for missing per-card props during migration", () => {
    const result = migrateConfig({ configVersion: 3 });
    const ws = result.cards!["weather"]?.settings;
    expect(ws?.["showDetails"]).toBe(true);
    expect(ws?.["showHourly"]).toBe(true);
    expect(ws?.["showWind"]).toBe(true);
    expect(ws?.["showSunrise"]).toBe(true);
  });

  it("DEFAULT_CONFIG.cards is an empty object", () => {
    expect(DEFAULT_CONFIG.cards).toEqual({});
  });

  it("DEFAULT_CONFIG.configVersion is 5", () => {
    expect(DEFAULT_CONFIG.configVersion).toBe(CONFIG_VERSION);
  });
});

// ── (v7.13): validateImportedConfig ─────────────────────────────────

describe("Config — validateImportedConfig ", () => {
  it("accepts a valid DEFAULT_CONFIG object", () => {
    const result = validateImportedConfig({ ...DEFAULT_CONFIG });
    expect(result.ok).toBe(true);
    expect(result.config).not.toBeNull();
  });

  it("accepts a partial config missing optional fields", () => {
    const result = validateImportedConfig({ theme: "blue", tempUnit: "C" });
    expect(result.ok).toBe(true);
    expect(result.config?.theme).toBe("blue");
  });

  it("rejects null input", () => {
    const result = validateImportedConfig(null);
    expect(result.ok).toBe(false);
    expect(result.config).toBeNull();
  });

  it("rejects non-object primitive", () => {
    const result = validateImportedConfig("hello");
    expect(result.ok).toBe(false);
    expect(result.config).toBeNull();
  });

  it("rejects array input", () => {
    const result = validateImportedConfig([1, 2, 3]);
    expect(result.ok).toBe(false);
  });

  it("rejects future schema version", () => {
    const result = validateImportedConfig({ configVersion: 9999 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("9999");
  });

  it("rejects non-numeric configVersion", () => {
    const result = validateImportedConfig({ configVersion: "four" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid theme value", () => {
    const result = validateImportedConfig({ theme: "neon" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("neon");
  });

  it("rejects invalid screenMode value", () => {
    const result = validateImportedConfig({ screenMode: "widescreen" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid tempUnit value", () => {
    const result = validateImportedConfig({ tempUnit: "K" });
    expect(result.ok).toBe(false);
  });

  it("returns ok message in Hebrew on success", () => {
    const result = validateImportedConfig({ theme: "amber" });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("בהצלחה");
  });

  it("migrates older schema version to current on success", () => {
    const result = validateImportedConfig({ configVersion: 0, theme: "matrix" });
    expect(result.ok).toBe(true);
    expect(result.config?.configVersion).toBe(CONFIG_VERSION); // migrated to current
  });

  it("accepts config at current CONFIG_VERSION", () => {
    const result = validateImportedConfig({ configVersion: CONFIG_VERSION });
    expect(result.ok).toBe(true);
  });
});

// ── (v7.13): Config export envelope ────────────────────────────────

describe("Config — buildExportEnvelope ", () => {
  it("wraps config with appVersion, configSchemaVersion, exportedAt", () => {
    const env = buildExportEnvelope(DEFAULT_CONFIG);
    expect(env.config).toEqual(DEFAULT_CONFIG);
    expect(typeof env.appVersion).toBe("string");
    expect(env.configSchemaVersion).toBe(CONFIG_VERSION);
    expect(typeof env.exportedAt).toBe("string");
  });

  it("exportedAt is a valid ISO date string", () => {
    const env = buildExportEnvelope(DEFAULT_CONFIG);
    expect(() => new Date(env.exportedAt)).not.toThrow();
    expect(new Date(env.exportedAt).toISOString()).toBe(env.exportedAt);
  });

  it("configSchemaVersion matches CONFIG_VERSION", () => {
    const env = buildExportEnvelope(DEFAULT_CONFIG);
    expect(env.configSchemaVersion).toBe(CONFIG_VERSION);
  });
});

describe("Config — serializeConfigExport ", () => {
  it("returns a valid JSON string", () => {
    const json = serializeConfigExport(DEFAULT_CONFIG);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("parsed JSON contains config and envelope fields", () => {
    const parsed = JSON.parse(serializeConfigExport(DEFAULT_CONFIG)) as Record<string, unknown>;
    expect(parsed).toHaveProperty("config");
    expect(parsed).toHaveProperty("appVersion");
    expect(parsed).toHaveProperty("configSchemaVersion");
    expect(parsed).toHaveProperty("exportedAt");
  });

  it("inner config.theme is preserved", () => {
    const parsed = JSON.parse(serializeConfigExport({ ...DEFAULT_CONFIG, theme: "rose" })) as {
      config: { theme: string };
    };
    expect(parsed.config.theme).toBe("rose");
  });
});

// ── sanitize — invalid field fallback paths (lines 231, 245-253) ──────────

describe("Config — sanitize resets invalid field values to defaults (lines 231, 245-253)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("resets invalid interfaceLanguage to default (line 231)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ ...DEFAULT_CONFIG, interfaceLanguage: "klingon" }),
    );
    const cfg = loadConfig();
    expect(cfg.interfaceLanguage).toBe(DEFAULT_CONFIG.interfaceLanguage);
  });

  it("resets non-boolean weatherShowHourly/Wind/Sunrise and stocks/tasks flags (lines 245-253)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        ...DEFAULT_CONFIG,
        weatherShowHourly: "yes",
        weatherShowWind: "no",
        weatherShowSunrise: 1,
        stocksGroupBySector: "true",
        tasksShowCategories: null,
      }),
    );
    const cfg = loadConfig();
    expect(typeof cfg.weatherShowHourly).toBe("boolean");
    expect(typeof cfg.weatherShowWind).toBe("boolean");
    expect(typeof cfg.weatherShowSunrise).toBe("boolean");
    expect(typeof cfg.stocksGroupBySector).toBe("boolean");
    expect(typeof cfg.tasksShowCategories).toBe("boolean");
  });
});

// ── readFeatureFlag  ────────────────────────────────────────────

describe("Config — readFeatureFlag ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default false when flag is absent", () => {
    expect(readFeatureFlag("nonExistentFlag")).toBe(false);
  });

  it("returns custom defaultValue when flag is absent", () => {
    expect(readFeatureFlag("nonExistentFlag", true)).toBe(true);
  });

  it("returns stored flag value from config", () => {
    const cfg = loadConfig();
    cfg.featureFlags["idbCache"] = true;
    saveConfig(cfg);
    expect(readFeatureFlag("idbCache")).toBe(true);
  });

  it("returns false for flag explicitly set to false", () => {
    const cfg = loadConfig();
    cfg.featureFlags["workerFetch"] = false;
    saveConfig(cfg);
    expect(readFeatureFlag("workerFetch")).toBe(false);
  });
});

// ── Config v4→v5 migration  ────────────────────────────────────

describe("Config — migrateConfig v4→v5 ", () => {
  it("bumps configVersion to 5 when migrating from v4", () => {
    const result = migrateConfig({ configVersion: 4 });
    expect(result.configVersion).toBe(CONFIG_VERSION);
  });

  it("populates featureFlags with default values", () => {
    const result = migrateConfig({ configVersion: 4 });
    expect(typeof result.featureFlags).toBe("object");
    expect(result.featureFlags).toHaveProperty("workerFetch");
    expect(result.featureFlags).toHaveProperty("idleSchedule");
    expect(result.featureFlags).toHaveProperty("idbCache");
  });

  it("merges existing featureFlags when present in raw config", () => {
    const result = migrateConfig({
      configVersion: 4,
      featureFlags: { customFlag: true },
    } as Parameters<typeof migrateConfig>[0]);
    expect(result.featureFlags?.["customFlag"]).toBe(true);
    expect(result.featureFlags?.["workerFetch"]).toBeDefined();
  });

  it("does not re-run v5 migration for a current config", () => {
    const result = migrateConfig({
      configVersion: 5,
      featureFlags: { workerFetch: false },
    } as Parameters<typeof migrateConfig>[0]);
    // featureFlags should remain as-is (not overwritten)
    expect(result.featureFlags?.["workerFetch"]).toBe(false);
  });
});

// ── v5→v6 migration ──────────────────────────────────────────

describe("migrateConfig v5→v6 ", () => {
  it("copies tempUnit into cards.weather.settings", () => {
    const result = migrateConfig({ configVersion: 5, tempUnit: "F" } as Parameters<
      typeof migrateConfig
    >[0]);
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect((result.cards?.["weather"]?.settings as Record<string, unknown>)?.["tempUnit"]).toBe(
      "F",
    );
  });

  it("copies homeCity into cards.weather.settings", () => {
    const result = migrateConfig({ configVersion: 5, homeCity: "tel-aviv" } as Parameters<
      typeof migrateConfig
    >[0]);
    expect((result.cards?.["weather"]?.settings as Record<string, unknown>)?.["homeCity"]).toBe(
      "tel-aviv",
    );
  });

  it("copies motivationInterval into cards.motivation.settings", () => {
    const result = migrateConfig({ configVersion: 5, motivationInterval: 15 } as Parameters<
      typeof migrateConfig
    >[0]);
    expect((result.cards?.["motivation"]?.settings as Record<string, unknown>)?.["interval"]).toBe(
      15,
    );
  });

  it("copies countdownCardStartDate into cards.countdown.settings (line 148)", () => {
    const result = migrateConfig({
      configVersion: 5,
      countdownCardStartDate: "2024-01-01",
    } as Parameters<typeof migrateConfig>[0]);
    const s = result.cards?.["countdown"]?.settings as Record<string, unknown> | undefined;
    expect(s?.["startDate"]).toBe("2024-01-01");
  });

  it("copies countdownCard* props into cards.countdown.settings", () => {
    const result = migrateConfig({
      configVersion: 5,
      countdownCardTitle: "My Event",
      countdownCardDate: "2026-01-01",
      countdownCardTime: "20:00",
    } as Parameters<typeof migrateConfig>[0]);
    const s = result.cards?.["countdown"]?.settings as Record<string, unknown> | undefined;
    expect(s?.["title"]).toBe("My Event");
    expect(s?.["date"]).toBe("2026-01-01");
    expect(s?.["time"]).toBe("20:00");
  });

  it("preserves existing cards namespace entries from v4→v5", () => {
    const result = migrateConfig({
      configVersion: 5,
      cards: { weather: { settings: { showDetails: true } } },
      tempUnit: "F",
    } as Parameters<typeof migrateConfig>[0]);
    const s = result.cards?.["weather"]?.settings as Record<string, unknown> | undefined;
    expect(s?.["showDetails"]).toBe(true);
    expect(s?.["tempUnit"]).toBe("F");
  });

  it("does not re-run v6 migration for configVersion 6", () => {
    const result = migrateConfig({ configVersion: 6 } as Parameters<typeof migrateConfig>[0]);
    expect(result.configVersion).toBe(CONFIG_VERSION);
  });
});

// ── v6→v7 migration ──────────────────────────────────────────

describe("migrateConfig v6→v7 (alerts + calendar flat props → cards namespace)", () => {
  it("copies alertSound, realtimeAlerts, alertVolume into cards.alerts.settings (lines 165-169)", () => {
    const result = migrateConfig({
      configVersion: 6,
      alertSound: true,
      realtimeAlerts: true,
      alertVolume: 80,
    } as Parameters<typeof migrateConfig>[0]);
    const s = result.cards?.["alerts"]?.settings as Record<string, unknown> | undefined;
    expect(s?.["sound"]).toBe(true);
    expect(s?.["realtime"]).toBe(true);
    expect(s?.["volume"]).toBe(80);
  });

  it("copies calendarDaysAhead into cards.calendar.settings (line 175)", () => {
    const result = migrateConfig({
      configVersion: 6,
      calendarDaysAhead: 21,
    } as Parameters<typeof migrateConfig>[0]);
    const s = result.cards?.["calendar"]?.settings as Record<string, unknown> | undefined;
    expect(s?.["daysAhead"]).toBe(21);
  });
});

// ── envelope-aware import ────────────────────────────────────────

describe("validateImportedConfig envelope unwrap ", () => {
  it("unwraps a ConfigExportEnvelope and returns valid config", () => {
    const envelope = {
      appVersion: "7.17.0",
      configSchemaVersion: CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      config: { ...DEFAULT_CONFIG, theme: "amber" },
    };
    const result = validateImportedConfig(envelope);
    expect(result.ok).toBe(true);
    expect(result.config?.theme).toBe("amber");
  });

  it("still accepts a raw config (no envelope)", () => {
    const result = validateImportedConfig({ theme: "blue", tempUnit: "C" });
    expect(result.ok).toBe(true);
    expect(result.config?.theme).toBe("blue");
  });

  it("rejects envelope with invalid inner config", () => {
    const envelope = {
      appVersion: "7.17.0",
      config: { theme: "neon" },
    };
    const result = validateImportedConfig(envelope);
    expect(result.ok).toBe(false);
  });
});

// ── Config v10 — animLevel (migration + type guard + DEFAULT_CONFIG) ──────────

describe("Config — isValidAnimLevel", () => {
  it("accepts all four valid levels", () => {
    expect(isValidAnimLevel("none")).toBe(true);
    expect(isValidAnimLevel("minimal")).toBe(true);
    expect(isValidAnimLevel("normal")).toBe(true);
    expect(isValidAnimLevel("full")).toBe(true);
  });

  it("rejects invalid strings, numbers, and null", () => {
    expect(isValidAnimLevel("high")).toBe(false);
    expect(isValidAnimLevel("all")).toBe(false);
    expect(isValidAnimLevel(2)).toBe(false);
    expect(isValidAnimLevel(null)).toBe(false);
    expect(isValidAnimLevel(undefined)).toBe(false);
  });
});

describe("Config — migrateConfig v9→v10 (animLevel)", () => {
  it("adds animLevel=normal when migrating from v9", () => {
    const result = migrateConfig({ configVersion: 9 });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.animLevel).toBe("normal");
  });

  it("preserves existing animLevel when already valid", () => {
    const result = migrateConfig({ configVersion: 9, animLevel: "full" } as Parameters<
      typeof migrateConfig
    >[0]);
    expect(result.animLevel).toBe("full");
  });

  it("DEFAULT_CONFIG has animLevel=normal", () => {
    expect(DEFAULT_CONFIG.animLevel).toBe("normal");
  });

  it("CONFIG_VERSION is 10", () => {
    expect(CONFIG_VERSION).toBe(12);
  });

  it("migrates v0 all the way to v10 including animLevel", () => {
    const result = migrateConfig({});
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.animLevel).toBe("normal");
  });
});

describe("Config — migrateConfig v10→v11 (countdownCard2 defaults)", () => {
  it("sets countdownCard2 defaults when migrating from v10 with empty fields", () => {
    const result = migrateConfig({ configVersion: 10 });
    expect(result.configVersion).toBe(CONFIG_VERSION);
    expect(result.countdownCard2Date).toBe("2026-06-19");
    expect(result.countdownCard2Title).toBe("ספירת הגומר");
  });

  it("preserves existing countdownCard2 data when already set", () => {
    const result = migrateConfig({
      configVersion: 10,
      countdownCard2Date: "2027-01-01",
      countdownCard2Title: "חתונה",
    } as Parameters<typeof migrateConfig>[0]);
    expect(result.countdownCard2Date).toBe("2027-01-01");
    expect(result.countdownCard2Title).toBe("חתונה");
  });

  it("DEFAULT_CONFIG has countdownCard2 pre-set", () => {
    expect(DEFAULT_CONFIG.countdownCard2Date).toBe("2026-06-19");
    expect(DEFAULT_CONFIG.countdownCard2Title).toBe("ספירת הגומר");
  });
});

// ── resetCardConfig ─────────────────────────────────────────────

describe("Config — resetCardConfig ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when cardId is not in config.cards", () => {
    const result = resetCardConfig("nonExistentCard");
    expect(result).toBe(false);
  });

  it("returns true and removes the card settings when cardId exists", () => {
    const cfg = loadConfig();
    cfg.cards["weather"] = { visible: false };
    saveConfig(cfg);
    const result = resetCardConfig("weather");
    expect(result).toBe(true);
    // Card should no longer exist in config
    const newCfg = loadConfig();
    expect(newCfg.cards["weather"]).toBeUndefined();
  });
});

// ── validateExportPayload edge cases ────────────────────────────

describe("Config — validateExportPayload edge cases ", () => {
  it("fails when envelope is null", () => {
    const result = validateExportPayload(null);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fails when envelope is a string", () => {
    const result = validateExportPayload("bad");
    expect(result.ok).toBe(false);
  });

  it("fails when required appVersion is missing from envelope", () => {
    const result = validateExportPayload({ config: {} });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("appVersion"))).toBe(true);
  });
});

// ── diffConfigs ─────────────────────────────────────────────────────────────

describe("Config — diffConfigs", () => {
  it("returns empty array for identical configs", () => {
    const a = loadConfig();
    const diffs = diffConfigs(a, { ...a });
    expect(diffs).toEqual([]);
  });

  it("detects a changed top-level key", () => {
    const a = loadConfig();
    const b = { ...a, theme: "blue" as const };
    const diffs = diffConfigs(a, b);
    expect(diffs.length).toBe(1);
    expect(diffs[0]!.key).toBe("theme");
    expect(diffs[0]!.oldValue).toBe("black");
    expect(diffs[0]!.newValue).toBe("blue");
  });

  it("detects multiple changed keys", () => {
    const a = loadConfig();
    const b = { ...a, theme: "matrix" as const, tempUnit: "F" as const };
    const diffs = diffConfigs(a, b);
    expect(diffs.length).toBe(2);
    const keys = diffs.map((d) => d.key);
    expect(keys).toContain("theme");
    expect(keys).toContain("tempUnit");
  });
});

// ── auditLocalStorageKeys / removeOrphanedLsKeys ────────────────────────────

describe("Config — auditLocalStorageKeys", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty audit when localStorage is empty", () => {
    const result = auditLocalStorageKeys();
    expect(result.known).toEqual([]);
    expect(result.orphaned).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("classifies known-prefix keys correctly", () => {
    localStorage.setItem("dash_v2_config", "{}");
    const result = auditLocalStorageKeys();
    expect(result.known).toContain("dash_v2_config");
    expect(result.orphaned).toEqual([]);
  });

  it("classifies unknown-prefix keys as orphaned", () => {
    localStorage.setItem("random_key_abc", "1");
    const result = auditLocalStorageKeys();
    expect(result.orphaned).toContain("random_key_abc");
    expect(result.known).toEqual([]);
  });

  it("removeOrphanedLsKeys removes only orphaned keys", () => {
    localStorage.setItem("dash_v2_config", "{}");
    localStorage.setItem("orphan_xyz", "1");
    const removed = removeOrphanedLsKeys();
    expect(removed).toBe(1);
    expect(localStorage.getItem("dash_v2_config")).toBe("{}");
    expect(localStorage.getItem("orphan_xyz")).toBeNull();
  });
});
