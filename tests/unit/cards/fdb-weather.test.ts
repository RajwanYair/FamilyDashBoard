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
});
