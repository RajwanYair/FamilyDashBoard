import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const config = { hiddenCards: [] as string[] };
  return {
    config,
    loadConfig: vi.fn(() => config),
    saveConfig: vi.fn(),
  };
});

vi.mock("@/core/config", () => ({
  loadConfig: mocks.loadConfig,
  saveConfig: mocks.saveConfig,
}));

import { initCardQuickToggle } from "@/ui/card-quick-toggle";

describe("card quick-toggle controls", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <article data-card-id="weather">
        <div class="card__hd-end"></div>
      </article>
      <article data-card-id="news">
        <div class="card__hd-end"></div>
      </article>
    `;
    mocks.config.hiddenCards = [];
    mocks.loadConfig.mockClear();
    mocks.saveConfig.mockClear();
  });

  it("injects a visible, touch-sized hide control with an accessible name", () => {
    initCardQuickToggle();
    const button = document.querySelector<HTMLButtonElement>(".card-quick-hide-btn");

    expect(button?.type).toBe("button");
    expect(button?.ariaLabel).toBe("הסתר כרטיסייה");
    expect(button?.title).toContain("Hide card");
    expect(button?.textContent).toContain("👁");
  });

  it("hides the selected card and offers an accessible restore control", () => {
    initCardQuickToggle();
    const weather = document.querySelector<HTMLElement>('[data-card-id="weather"]');
    const button = weather?.querySelector<HTMLButtonElement>(".card-quick-hide-btn");

    button?.click();

    expect(mocks.config.hiddenCards).toEqual(["weather"]);
    expect(weather?.style.display).toBe("none");
    expect(mocks.saveConfig).toHaveBeenCalledWith(mocks.config);
    const restore = document.querySelector<HTMLButtonElement>("#card-quick-restore-btn");
    expect(restore?.ariaLabel).toContain("1");
  });

  it("restores all hidden cards and removes the restore control", () => {
    mocks.config.hiddenCards = ["weather", "news"];
    initCardQuickToggle();
    const restore = document.querySelector<HTMLButtonElement>("#card-quick-restore-btn");
    const weather = document.querySelector<HTMLElement>('[data-card-id="weather"]');
    const news = document.querySelector<HTMLElement>('[data-card-id="news"]');

    restore?.click();

    expect(mocks.config.hiddenCards).toEqual([]);
    expect(weather?.style.display).toBe("");
    expect(news?.style.display).toBe("");
    expect(document.getElementById("card-quick-restore-btn")).toBeNull();
  });

  it("does not inject duplicate controls when initialized twice", () => {
    initCardQuickToggle();
    initCardQuickToggle();

    expect(document.querySelectorAll(".card-quick-hide-btn")).toHaveLength(2);
  });
});
