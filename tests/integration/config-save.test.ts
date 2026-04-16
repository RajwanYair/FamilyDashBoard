/**
 * Integration: Config save → load round-trip
 *
 * Tests that saveConfig + loadConfig correctly persist and restore all
 * major DashboardConfig fields, including the configVersion field.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, saveConfig } from "@/core/config";
import type { DashboardConfig } from "@/types/config";

describe("Config — save and load round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadConfig returns default when nothing saved", () => {
    const c = loadConfig();
    expect(typeof c.theme).toBe("string");
    expect(typeof c.familyName).toBe("string");
    expect(typeof c.configVersion).toBe("number");
  });

  it("saveConfig persists theme, familyName, and tempUnit", () => {
    const base = loadConfig();
    const updated: DashboardConfig = {
      ...base,
      theme: "matrix",
      familyName: "משפחת כהן",
      tempUnit: "F",
    };
    saveConfig(updated);

    const reloaded = loadConfig();
    expect(reloaded.theme).toBe("matrix");
    expect(reloaded.familyName).toBe("משפחת כהן");
    expect(reloaded.tempUnit).toBe("F");
  });

  it("configVersion is saved and reloaded", () => {
    const c = loadConfig();
    saveConfig(c);
    const reloaded = loadConfig();
    expect(reloaded.configVersion).toBe(c.configVersion);
  });

  it("hiddenCards list is preserved across save/load", () => {
    const base = loadConfig();
    const updated: DashboardConfig = {
      ...base,
      hiddenCards: ["weather", "stocks"],
    };
    saveConfig(updated);
    const reloaded = loadConfig();
    expect(reloaded.hiddenCards).toContain("weather");
    expect(reloaded.hiddenCards).toContain("stocks");
  });

  it("members array is preserved across save/load", () => {
    const base = loadConfig();
    const updated: DashboardConfig = {
      ...base,
      members: ["דנה", "יוסי", "מיכל"],
    };
    saveConfig(updated);
    const reloaded = loadConfig();
    expect(reloaded.members).toEqual(["דנה", "יוסי", "מיכל"]);
  });

  it("fontScale is preserved across save/load", () => {
    const base = loadConfig();
    const updated: DashboardConfig = { ...base, fontScale: 1.25 };
    saveConfig(updated);
    const reloaded = loadConfig();
    expect(reloaded.fontScale).toBe(1.25);
  });

  it("bgImages array is preserved across save/load", () => {
    const urls = ["https://example.com/a.jpg", "https://example.com/b.jpg"];
    const base = loadConfig();
    saveConfig({ ...base, bgImages: urls });
    const reloaded = loadConfig();
    expect(reloaded.bgImages).toEqual(urls);
  });
});
