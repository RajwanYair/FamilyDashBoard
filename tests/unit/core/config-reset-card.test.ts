/**
 * Per-card config reset tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, saveConfig, resetCardConfig } from "@/core/config";
import { DEFAULT_CONFIG } from "@/types/config";

describe("resetCardConfig ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when card has no settings", () => {
    expect(resetCardConfig("nonexistent")).toBe(false);
  });

  it("removes card settings and returns true", () => {
    const config = { ...DEFAULT_CONFIG, cards: { weather: { settings: { showHourly: false } } } };
    saveConfig(config);

    const result = resetCardConfig("weather");
    expect(result).toBe(true);

    const reloaded = loadConfig();
    expect(reloaded.cards["weather"]).toBeUndefined();
  });

  it("does not affect other cards", () => {
    const config = {
      ...DEFAULT_CONFIG,
      cards: {
        weather: { settings: { showHourly: false } },
        news: { settings: { maxItems: 3 } },
      },
    };
    saveConfig(config);
    resetCardConfig("weather");

    const reloaded = loadConfig();
    expect(reloaded.cards["news"]).toBeDefined();
    expect((reloaded.cards["news"].settings as Record<string, unknown>)?.["maxItems"]).toBe(3);
  });
});
