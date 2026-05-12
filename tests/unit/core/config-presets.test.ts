/**
 * Tests for src/core/config-presets.ts — Config Presets
 */

import { describe, it, expect } from "vitest";
import { CONFIG_PRESETS, getPreset } from "@/core/config-presets";
import { THEMES, SCREEN_MODES } from "@/core/constants";

describe("Config Presets", () => {
  it("exports exactly 3 presets", () => {
    expect(CONFIG_PRESETS).toHaveLength(3);
  });

  it("each preset has a unique id", () => {
    const ids = CONFIG_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each preset has required fields", () => {
    for (const p of CONFIG_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.labelEn).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.overrides).toBeDefined();
    }
  });

  it("preset overrides contain only valid theme names", () => {
    for (const p of CONFIG_PRESETS) {
      if (p.overrides.theme) {
        expect(THEMES).toContain(p.overrides.theme);
      }
    }
  });

  it("preset overrides contain only valid screen modes", () => {
    for (const p of CONFIG_PRESETS) {
      if (p.overrides.screenMode) {
        expect(SCREEN_MODES).toContain(p.overrides.screenMode);
      }
    }
  });

  it("preset overrides have valid fontScale range (0.5–2.0)", () => {
    for (const p of CONFIG_PRESETS) {
      if (p.overrides.fontScale !== undefined) {
        expect(p.overrides.fontScale).toBeGreaterThanOrEqual(0.5);
        expect(p.overrides.fontScale).toBeLessThanOrEqual(2.0);
      }
    }
  });

  it("preset overrides have valid nightDimLevel range (0–100)", () => {
    for (const p of CONFIG_PRESETS) {
      if (p.overrides.nightDimLevel !== undefined) {
        expect(p.overrides.nightDimLevel).toBeGreaterThanOrEqual(0);
        expect(p.overrides.nightDimLevel).toBeLessThanOrEqual(100);
      }
    }
  });

  it("getPreset returns the correct preset by id", () => {
    const tv = getPreset("family-tv");
    expect(tv).toBeDefined();
    expect(tv!.id).toBe("family-tv");
    expect(tv!.overrides.screenMode).toBe("tv");
  });

  it("getPreset returns undefined for unknown id", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
    expect(getPreset("")).toBeUndefined();
  });

  it("family-tv preset targets TV mode with auto-theme", () => {
    const tv = getPreset("family-tv")!;
    expect(tv.overrides.screenMode).toBe("tv");
    expect(tv.overrides.autoTheme).toBe(true);
    expect(tv.overrides.nightDimScheduleEnabled).toBe(true);
    expect(tv.overrides.dimWarmTint).toBe(true);
  });

  it("kitchen-tablet preset targets tablet mode with minimal animation", () => {
    const tablet = getPreset("kitchen-tablet")!;
    expect(tablet.overrides.screenMode).toBe("tablet");
    expect(tablet.overrides.animLevel).toBe("minimal");
    expect(tablet.overrides.autoTheme).toBe(false);
  });

  it("office-monitor preset targets TV screen mode with full animation", () => {
    const monitor = getPreset("office-monitor")!;
    expect(monitor.overrides.screenMode).toBe("tv");
    expect(monitor.overrides.animLevel).toBe("full");
    expect(monitor.overrides.autoTheme).toBe(false);
  });
});
