import { describe, expect, it } from "vitest";
import {
  getConfigSettingKey,
  getConfigValue,
  isConfigValue,
  setConfigValue,
} from "@/core/config-path";

describe("config path helpers", () => {
  it("reads flat and dotted values", () => {
    const config = {
      newsMaxItems: 12,
      cards: { "video-news": { settings: { autoplay: false } } },
    };

    expect(getConfigValue(config, "newsMaxItems")).toBe(12);
    expect(getConfigValue(config, "cards.video-news.settings.autoplay")).toBe(false);
    expect(getConfigValue(config, "cards.video-news.settings.missing")).toBeUndefined();
  });

  it("writes a dotted path without replacing sibling settings", () => {
    const config = {
      cards: { "video-news": { settings: { autoplay: true, showOverlay: true } } },
    };

    setConfigValue(config, "cards.video-news.settings.autoplay", false);

    expect(config.cards["video-news"].settings).toEqual({
      autoplay: false,
      showOverlay: true,
    });
  });

  it("creates missing path segments and identifies the leaf setting", () => {
    const config: Record<string, unknown> = {};

    setConfigValue(config, "cards.weather.settings.showWind", true);

    expect(getConfigValue(config, "cards.weather.settings.showWind")).toBe(true);
    expect(getConfigSettingKey("cards.weather.settings.showWind")).toBe("showWind");
  });

  it("accepts only serializable schema values", () => {
    expect(isConfigValue("text")).toBe(true);
    expect(isConfigValue(1)).toBe(true);
    expect(isConfigValue(false)).toBe(true);
    expect(isConfigValue(null)).toBe(false);
    expect(isConfigValue({})).toBe(false);
  });
});
