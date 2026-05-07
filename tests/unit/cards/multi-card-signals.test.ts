/**
 * X12 + X15 multi-card adoption smoke tests.
 *
 * Verifies that each card adopted in v13.40.0 publishes the expected
 * CardSignal key under its registered cardId. Uses the public render*
 * entry points only — no DOM-heavy init() to keep the suite fast.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderCurrency } from "../../../src/cards/currency/currency";
import { renderAlerts, cacheDom as cacheAlertsDom } from "../../../src/cards/alerts/alerts";
import { renderNews, cacheDom as cacheNewsDom } from "../../../src/cards/news/news";
import {
  getCardSignal,
  _resetCardSignals,
} from "../../../src/core/card-signal-protocol";
import type { AlertEvent, NewsItem } from "../../../src/types/api";

beforeEach(() => {
  _resetCardSignals();
  document.body.innerHTML = "";
});

describe("Currency × X12 ", () => {
  it("publishes (currency, usd-ils) and (currency, eur-ils) on render", () => {
    renderCurrency({ USD: 0.27, EUR: 0.25 });
    const usd = getCardSignal<{ ils: number }>("currency", "usd-ils");
    const eur = getCardSignal<{ ils: number }>("currency", "eur-ils");
    expect(usd).not.toBeNull();
    expect(eur).not.toBeNull();
    expect(usd!.value.ils).toBeCloseTo(1 / 0.27, 4);
    expect(eur!.value.ils).toBeCloseTo(1 / 0.25, 4);
    expect(Object.isFrozen(usd!.value)).toBe(true);
  });

  it("skips publishing when rate is zero or missing", () => {
    renderCurrency({ USD: 0 });
    expect(getCardSignal("currency", "usd-ils")).toBeNull();
    expect(getCardSignal("currency", "eur-ils")).toBeNull();
  });
});

describe("Alerts × X12 ", () => {
  it("publishes (alerts, active) when an alert is within 600s window", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cacheAlertsDom();
    const now = Math.floor(Date.now() / 1000);
    const data: AlertEvent[] = [
      { alerts: [{ cities: ["שדרות", "אשקלון"], threat: 0, time: now - 60 }] },
    ];
    renderAlerts(data, false);
    const sig = getCardSignal<{ count: number; areas: string[] }>("alerts", "active");
    expect(sig).not.toBeNull();
    expect(sig!.value.count).toBe(2);
    expect(sig!.value.areas).toContain("שדרות");
  });

  it("publishes null when no alerts are within the active window", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cacheAlertsDom();
    const old = Math.floor(Date.now() / 1000) - 3600;
    renderAlerts([{ alerts: [{ cities: ["a"], threat: 0, time: old }] }], false);
    const sig = getCardSignal("alerts", "active");
    expect(sig?.value).toBeNull();
  });
});

describe("News × X12 ", () => {
  it("publishes (news, top) for the first item", () => {
    document.body.innerHTML = `<div id="rss-scroll" class="rss-scroll"></div>`;
    cacheNewsDom();
    const items: NewsItem[] = [
      {
        title: "כותרת ראשית",
        link: "https://example.com/a",
        pubDate: new Date().toISOString(),
        source: "ynet",
      },
      {
        title: "second",
        link: "https://example.com/b",
        pubDate: new Date().toISOString(),
        source: "ynet",
      },
    ];
    renderNews(items);
    const sig = getCardSignal<{ title: string; source: string; link: string }>("news", "top");
    expect(sig).not.toBeNull();
    expect(sig!.value.title).toBe("כותרת ראשית");
    expect(sig!.value.source).toBe("ynet");
  });

  it("publishes null when items is empty", () => {
    document.body.innerHTML = `<div id="rss-scroll" class="rss-scroll"></div>`;
    cacheNewsDom();
    renderNews([]);
    const sig = getCardSignal("news", "top");
    expect(sig?.value).toBeNull();
  });
});
