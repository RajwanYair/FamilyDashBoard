/**
 * Tests for src/core/config.ts — Config Persistence
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadConfig,
  saveConfig,
  updateConfig,
  shareConfigHash,
  loadConfigFromHash,
} from "@/core/config";
import { DEFAULT_CONFIG } from "@/types/config";

describe("Config — loadConfig", () => {
  it("returns defaults when localStorage is empty", () => {
    const cfg = loadConfig();
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
    updateConfig("screenMode", "desk");
    expect(loadConfig().screenMode).toBe("desk");
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
