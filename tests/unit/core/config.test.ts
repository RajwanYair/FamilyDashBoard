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
