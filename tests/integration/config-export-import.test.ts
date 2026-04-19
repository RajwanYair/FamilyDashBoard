/**
 * Sprint 173 — Integration: config export → import round-trip
 * Tests shareConfigHash ⇄ loadConfigFromHash and JSON serialization integrity.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadConfig,
  saveConfig,
  shareConfigHash,
  loadConfigFromHash,
  resetConfig,
} from "@/core/config";

describe("Config export → import round-trip (Sprint 173)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shareConfigHash → loadConfigFromHash preserves all fields", () => {
    const original = loadConfig();
    original.theme = "matrix";
    original.familyName = "משפחת כהן";
    original.tempUnit = "F";
    saveConfig(original);

    const hash = shareConfigHash(original);
    const restored = loadConfigFromHash(hash);

    expect(restored).not.toBeNull();
    expect(restored!.theme).toBe("matrix");
    expect(restored!.familyName).toBe("משפחת כהן");
    expect(restored!.tempUnit).toBe("F");
  });

  it("JSON.stringify → JSON.parse preserves config shape", () => {
    const original = loadConfig();
    original.theme = "amber";
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json) as typeof original;
    expect(parsed.theme).toBe("amber");
    expect(parsed.configVersion).toBe(original.configVersion);
  });

  it("resetConfig returns defaults after customization", () => {
    const c = loadConfig();
    c.theme = "rose";
    saveConfig(c);
    expect(loadConfig().theme).toBe("rose");

    const fresh = resetConfig();
    expect(fresh.theme).not.toBe("rose");
    expect(loadConfig().theme).toBe(fresh.theme);
  });
});
