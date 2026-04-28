import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbWeatherCard } from "@/cards/weather/fdb-weather";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/cards/weather/weather", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/cards/weather/weather")>();
  return {
    ...actual,
    initWeatherCard: vi.fn(),
    destroyWeatherCard: vi.fn(),
    switchWeatherCity: vi.fn().mockResolvedValue(undefined),
  };
});

describe("FdbWeatherCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function mountCard(): FdbWeatherCard {
    const card = document.createElement("fdb-weather") as FdbWeatherCard;
    card.setAttribute("data-card-id", "weather");
    document.body.appendChild(card);
    return card;
  }

  it("builds the weather shell on connect", () => {
    const card = mountCard();

    expect(card.querySelector("#wx-city-tabs")).not.toBeNull();
    expect(card.querySelector("#wx-temp")).not.toBeNull();
    expect(card.querySelector("#wx-hourly")).not.toBeNull();
    expect(card.querySelector("#wx-forecast")).not.toBeNull();
    expect(card.querySelector("#wx-sky-pill")).not.toBeNull();
  });

  it("refresh delegates to switchWeatherCity for the active tab", async () => {
    const card = mountCard();
    const weatherModule = await import("@/cards/weather/weather");

    await card.refresh();

    expect(weatherModule.switchWeatherCity).toHaveBeenCalledWith(31.7683, 35.2137);
  });

  it("disconnect delegates teardown to destroyWeatherCard", async () => {
    const card = mountCard();
    const weatherModule = await import("@/cards/weather/weather");

    card.remove();

    expect(weatherModule.destroyWeatherCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-weather custom element", () => {
    expect(customElements.get("fdb-weather")).toBeDefined();
  });

  it("does not re-register when already defined (if-FALSE branch)", async () => {
    vi.resetModules();
    await import("@/cards/weather/fdb-weather");
    expect(customElements.get("fdb-weather")).toBeDefined();
  });

  it("skips body init when body already has children (line 10 FALSE branch)", async () => {
    const card = mountCard();
    const weatherModule = await import("@/cards/weather/weather");
    vi.mocked(weatherModule.initWeatherCard).mockClear();
    // Add a child to the body so reconnect skips init
    const body = card.querySelector(".card__body")!;
    const sentinel = document.createElement("div");
    sentinel.id = "skip-sentinel";
    body.appendChild(sentinel);
    // Reconnect triggers connect() with non-empty body
    card.remove();
    document.body.appendChild(card);
    // initWeatherCard is still called (it's outside the if block), but the body HTML is not rebuilt
    expect(document.getElementById("skip-sentinel")).not.toBeNull();
  });

  it("refresh uses default lat/lon when no active city tab (refresh ?? fallback)", async () => {
    const card = mountCard();
    const weatherModule = await import("@/cards/weather/weather");
    // Remove all active tabs so active is null
    card.querySelectorAll(".wx-city-tab.active").forEach((el) => el.remove());
    vi.mocked(weatherModule.switchWeatherCity).mockClear();
    await card.refresh();
    expect(weatherModule.switchWeatherCity).toHaveBeenCalledWith(31.7683, 35.2137);
  });
});
