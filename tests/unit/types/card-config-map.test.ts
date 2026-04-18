/**
 * Sprint 98 — Per-card config namespace types
 */
import { describe, it, expect } from "vitest";
import type {
  CardConfig,
  CardConfigMap,
  WeatherCardConfig,
  NewsCardConfig,
  StocksCardConfig,
  CountdownCardConfig,
  TasksCardConfig,
  SystemInfoCardConfig,
  MotivationCardConfig,
} from "@/types/config";

describe("CardConfigMap types (Sprint 98)", () => {
  it("weather config accepts typed settings", () => {
    const cfg: WeatherCardConfig = {
      size: "lg",
      settings: {
        tempUnit: "C",
        homeCity: "jerusalem",
        showHourly: true,
        showWind: true,
        showSunrise: true,
        showDetails: true,
      },
    };
    expect(cfg.settings?.tempUnit).toBe("C");
  });

  it("news config accepts typed settings", () => {
    const cfg: NewsCardConfig = {
      settings: { maxItems: 5, showSource: true },
    };
    expect(cfg.settings?.maxItems).toBe(5);
  });

  it("stocks config accepts typed settings", () => {
    const cfg: StocksCardConfig = {
      settings: { showPortfolio: true, groupBySector: false },
    };
    expect(cfg.settings?.showPortfolio).toBe(true);
  });

  it("countdown config accepts typed settings", () => {
    const cfg: CountdownCardConfig = {
      settings: {
        title: "Event",
        date: "2026-01-01",
        time: "18:00",
        doneMsg: "done",
        startDate: "2025-01-01",
      },
    };
    expect(cfg.settings?.title).toBe("Event");
  });

  it("tasks config accepts typed settings", () => {
    const cfg: TasksCardConfig = {
      settings: { showDone: true, showCategories: false, resetHour: 6 },
    };
    expect(cfg.settings?.resetHour).toBe(6);
  });

  it("system-info config accepts typed settings", () => {
    const cfg: SystemInfoCardConfig = {
      settings: { showRtt: true },
    };
    expect(cfg.settings?.showRtt).toBe(true);
  });

  it("motivation config accepts typed settings", () => {
    const cfg: MotivationCardConfig = {
      settings: { interval: 10 },
    };
    expect(cfg.settings?.interval).toBe(10);
  });

  it("CardConfigMap index signature allows arbitrary cards", () => {
    const map: CardConfigMap = {
      weather: { size: "lg" },
      news: {},
      stocks: {},
      countdown: {},
      tasks: {},
      "system-info": {},
      motivation: {},
      "custom-card": { size: "sm" },
    };
    expect(map["custom-card"].size).toBe("sm");
  });

  it("CardConfig base interface is compatible with all typed configs", () => {
    const base: CardConfig = { size: "md" };
    const weather: WeatherCardConfig = base;
    expect(weather.size).toBe("md");
  });
});
