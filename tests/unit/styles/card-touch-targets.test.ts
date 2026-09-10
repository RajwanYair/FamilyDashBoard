import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readCss(relativePath: string): string {
  return readFileSync(resolve(__dirname, "../../../src", relativePath), "utf-8");
}

function selectorBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g")))
    .map((match) => match[1] ?? "")
    .join("\n");
}

describe("card touch-target contracts", () => {
  it("keeps task actions touch-sized", () => {
    const block = selectorBlock(readCss("cards/tasks/tasks.css"), ".tasks-action-btn");

    expect(block).toContain("min-block-size: 2.75rem");
    expect(block).toContain("touch-action: manipulation");
  });

  it("keeps motivation and synthesis controls touch-sized", () => {
    const motivation = readCss("cards/motivation/motivation.css");
    const synthesis = readCss("cards/ai-synthesis/ai-synthesis.css");

    expect(selectorBlock(motivation, "#moti-share-btn")).toContain("min-block-size: 2.75rem");
    expect(selectorBlock(motivation, "#moti-next-btn")).toContain("min-block-size: 2.75rem");
    expect(selectorBlock(motivation, "#moti-fav-btn")).toContain("min-inline-size: 2.75rem");
    expect(selectorBlock(synthesis, ".synth-speak-btn")).toContain("min-inline-size: 2.75rem");
  });

  it("keeps modal close buttons touch-sized", () => {
    const hebrewCalendar = readCss("cards/hebrew-cal/hebrew-cal.css");
    const news = readCss("cards/news/news.css");

    expect(selectorBlock(hebrewCalendar, ".hc-yz-close-btn")).toContain("width: 2.75rem");
    expect(selectorBlock(hebrewCalendar, ".hc-yz-close-btn")).toContain(
      "touch-action: manipulation",
    );
    expect(selectorBlock(news, ".news-starred-close-btn")).toContain("height: 2.75rem");
    expect(selectorBlock(news, ".news-starred-close-btn")).toContain("touch-action: manipulation");
  });

  it("keeps video channel tabs touch-sized", () => {
    const css = readCss("cards/video-news/video-news.css");
    const block = selectorBlock(css, ".video-news__tab");

    expect(block).toContain("min-block-size: 2.75rem");
    expect(block).toContain("touch-action: manipulation");
  });

  it("keeps weather, alert, and currency controls touch-sized", () => {
    const weather = readCss("cards/weather/weather.css");
    const alerts = readCss("cards/alerts/alerts.css");
    const currency = readCss("cards/currency/currency.css");

    expect(selectorBlock(weather, ".wx-city-tab")).toContain("min-block-size: 2.75rem");
    expect(selectorBlock(weather, ".wx-city-tab")).toContain("touch-action: manipulation");
    expect(selectorBlock(alerts, ".alerts-history-toggle")).toContain("min-block-size: 2.75rem");
    expect(selectorBlock(currency, ".cur-calc-pair")).toContain("min-block-size: 2.75rem");
  });
});
