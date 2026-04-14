/**
 * DOM-Contract tests — src/index.html
 *
 * Validates that src/index.html contains every element ID referenced by
 * TypeScript modules, and that no CSP-violating inline onclick handlers
 * remain. Runs as a string-level check on the raw HTML file so no
 * browser/DOM environment is needed.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(
  resolve(__dirname, "../../../src/index.html"),
  "utf8",
);

// Helper: check that id="X" exists in the HTML
function hasId(id: string): boolean {
  return html.includes(`id="${id}"`);
}

// ── No inline onclick handlers ──

describe("DOM Contract — no inline onclick handlers", () => {
  it("has zero onclick= attributes (CSP compliance)", () => {
    const matches = html.match(/\bonclick=/gi);
    expect(matches).toBeNull();
  });
});

// ── Core infrastructure elements ──

describe("DOM Contract — SW update banner", () => {
  it("has #sw-update-banner", () =>
    expect(hasId("sw-update-banner")).toBe(true));
  it("has #sw-update-reload-btn", () =>
    expect(hasId("sw-update-reload-btn")).toBe(true));
});

describe("DOM Contract — Header elements", () => {
  it("has #clock", () => expect(hasId("clock")).toBe(true));
  it("has #eng-date", () => expect(hasId("eng-date")).toBe(true));
  it("has #greeting", () => expect(hasId("greeting")).toBe(true));
  it("has #day-bar", () => expect(hasId("day-bar")).toBe(true));
  it("has #year-bar", () => expect(hasId("year-bar")).toBe(true));
  it("has #hebrew-date", () => expect(hasId("hebrew-date")).toBe(true));
  it("has #top-temp", () => expect(hasId("top-temp")).toBe(true));
  it("has #header-event-count", () =>
    expect(hasId("header-event-count")).toBe(true));
  it("has #notif-bell (no onclick)", () => {
    expect(hasId("notif-bell")).toBe(true);
    expect(html).not.toContain('notif-bell" onclick');
  });
  it("has #header-birthday-chip (F104)", () =>
    expect(hasId("header-birthday-chip")).toBe(true));
  it("has #header-countdown (F139)", () =>
    expect(hasId("header-countdown")).toBe(true));
});

// ── Overlays ──

describe("DOM Contract — Overlays", () => {
  it("has #help-overlay", () => expect(hasId("help-overlay")).toBe(true));
  it("has #config-overlay", () => expect(hasId("config-overlay")).toBe(true));
  it("has #config-panel", () => expect(hasId("config-panel")).toBe(true));
  it("has #diag-overlay", () => expect(hasId("diag-overlay")).toBe(true));
  it("has #night-dim", () => expect(hasId("night-dim")).toBe(true));
  it("has #toast", () => expect(hasId("toast")).toBe(true));
});

// ── Config panel inputs ──

describe("DOM Contract — Config panel form", () => {
  it("has #cfg-gear-btn", () => expect(hasId("cfg-gear-btn")).toBe(true));
  it("has #cfg-save-btn", () => expect(hasId("cfg-save-btn")).toBe(true));
  it("has #cfg-close-btn", () => expect(hasId("cfg-close-btn")).toBe(true));
  it("has #cfg-export-btn (no onclick)", () => {
    expect(hasId("cfg-export-btn")).toBe(true);
    expect(html).not.toContain('cfg-export-btn" onclick');
  });
  it("has #cfg-import-btn (no onclick)", () => {
    expect(hasId("cfg-import-btn")).toBe(true);
    expect(html).not.toContain('cfg-import-btn" onclick');
  });
  it("has #cfg-share-btn (no onclick)", () => {
    expect(hasId("cfg-share-btn")).toBe(true);
    expect(html).not.toContain('cfg-share-btn" onclick');
  });
  it("has #cfg-import-file", () => expect(hasId("cfg-import-file")).toBe(true));
  it("has #cfg-countdown-date (F139)", () =>
    expect(hasId("cfg-countdown-date")).toBe(true));
  it("has #cfg-countdown-label (F139)", () =>
    expect(hasId("cfg-countdown-label")).toBe(true));
  it("has .cfg-tab[data-tab] buttons (no onclick)", () => {
    const tabCount = (html.match(/class="cfg-tab[^"]*" data-tab="/g) ?? [])
      .length;
    expect(tabCount).toBeGreaterThanOrEqual(5);
    expect(html).not.toMatch(/cfg-tab[^>]+onclick=/);
  });
  it("has #screen-mode-select", () =>
    expect(hasId("screen-mode-select")).toBe(true));
  it("has #theme-select", () => expect(hasId("theme-select")).toBe(true));
  it("has #cfg-ics-url", () => expect(hasId("cfg-ics-url")).toBe(true));
  it("has #diag-copy-btn (no onclick)", () => {
    expect(hasId("diag-copy-btn")).toBe(true);
    expect(html).not.toContain('diag-copy-btn" onclick');
  });
  it("has #diag-panes", () => expect(hasId("diag-panes")).toBe(true));
  it("has #diag-log", () => expect(hasId("diag-log")).toBe(true));
});

// ── Halacha ticker ──

describe("DOM Contract — Halacha ticker", () => {
  it("has #halacha-ticker (not #ticker-content)", () => {
    expect(hasId("halacha-ticker")).toBe(true);
    expect(html).not.toContain('id="ticker-content"');
  });
});

// ── News card ──

describe("DOM Contract — News card", () => {
  it("has #rss-scroll", () => expect(hasId("rss-scroll")).toBe(true));
  it("has #news-ticker", () => expect(hasId("news-ticker")).toBe(true));
  it("has #news-search", () => expect(hasId("news-search")).toBe(true));
  it("has #news-filter-bar", () => expect(hasId("news-filter-bar")).toBe(true));
  it("has #sync-news", () => expect(hasId("sync-news")).toBe(true));
  it("has #news-bkm-pill (B-key bookmarks)", () =>
    expect(hasId("news-bkm-pill")).toBe(true));
});

// ── Weather card ──

describe("DOM Contract — Weather card", () => {
  it("has #wx-temp", () => expect(hasId("wx-temp")).toBe(true));
  it("has #wx-desc", () => expect(hasId("wx-desc")).toBe(true));
  it("has #wx-icon", () => expect(hasId("wx-icon")).toBe(true));
  it("has #wx-hum", () => expect(hasId("wx-hum")).toBe(true));
  it("has #wx-wind", () => expect(hasId("wx-wind")).toBe(true));
  it("has #wx-uv", () => expect(hasId("wx-uv")).toBe(true));
  it("has #wx-rise", () => expect(hasId("wx-rise")).toBe(true));
  it("has #wx-feels", () => expect(hasId("wx-feels")).toBe(true));
  it("has #wx-hourly", () => expect(hasId("wx-hourly")).toBe(true));
  it("has #wx-forecast", () => expect(hasId("wx-forecast")).toBe(true));
  it("has #wx-chart-toggle (no onclick)", () => {
    expect(hasId("wx-chart-toggle")).toBe(true);
    expect(html).not.toContain('wx-chart-toggle" onclick');
  });
  it("has #sync-wx", () => expect(hasId("sync-wx")).toBe(true));
});

// ── Hebrew Calendar card ──

describe("DOM Contract — Hebrew Calendar card", () => {
  it("has #hc-candles", () => expect(hasId("hc-candles")).toBe(true));
  it("has #hc-havdala", () => expect(hasId("hc-havdala")).toBe(true));
  it("has #hc-holiday", () => expect(hasId("hc-holiday")).toBe(true));
  it("has #hc-holiday-row", () => expect(hasId("hc-holiday-row")).toBe(true));
  it("has #hc-omer", () => expect(hasId("hc-omer")).toBe(true));
  it("has #hc-omer-row", () => expect(hasId("hc-omer-row")).toBe(true));
  it("has #hc-parasha", () => expect(hasId("hc-parasha")).toBe(true));
  it("has #hc-parasha-row", () => expect(hasId("hc-parasha-row")).toBe(true));
  it("has #hc-daf", () => expect(hasId("hc-daf")).toBe(true));
  it("has #hc-daf-row", () => expect(hasId("hc-daf-row")).toBe(true));
  it("has #hc-saying", () => expect(hasId("hc-saying")).toBe(true));
  it("has #hc-halacha", () => expect(hasId("hc-halacha")).toBe(true));
  it("has #hc-halacha-row", () => expect(hasId("hc-halacha-row")).toBe(true));
});

// ── Google Calendar card ──

describe("DOM Contract — Calendar card", () => {
  it("has #cal-agenda", () => expect(hasId("cal-agenda")).toBe(true));
  it("has #cal-today-strip", () => expect(hasId("cal-today-strip")).toBe(true));
  it("has #cal-countdown", () => expect(hasId("cal-countdown")).toBe(true));
  it("has #cal-week-strip", () => expect(hasId("cal-week-strip")).toBe(true));
});

// ── Stocks card ──

describe("DOM Contract — Stocks card", () => {
  it("has #stk-summary", () => expect(hasId("stk-summary")).toBe(true));
  it("has #sync-stk", () => expect(hasId("sync-stk")).toBe(true));
  it("has #market-badge", () => expect(hasId("market-badge")).toBe(true));
});

// ── Currency card ──

describe("DOM Contract — Currency card", () => {
  it("has #currency-body", () => expect(hasId("currency-body")).toBe(true));
  it("has #curUsd", () => expect(hasId("curUsd")).toBe(true));
  it("has #curEur", () => expect(hasId("curEur")).toBe(true));
  it("has #curGbp", () => expect(hasId("curGbp")).toBe(true));
  it("has #curGold", () => expect(hasId("curGold")).toBe(true));
  it("has #curSilver", () => expect(hasId("curSilver")).toBe(true));
});

// ── Red Alerts card ──

describe("DOM Contract — Red Alerts card", () => {
  it("has #alerts-scroll", () => expect(hasId("alerts-scroll")).toBe(true));
  it("has #alerts-badge (not #alerts-badge-count)", () => {
    expect(hasId("alerts-badge")).toBe(true);
    expect(html).not.toContain('id="alerts-badge-count"');
  });
  it("has #sync-alerts", () => expect(hasId("sync-alerts")).toBe(true));
});

// ── Motivation card ──

describe("DOM Contract — Motivation card", () => {
  it("has #moti-text", () => expect(hasId("moti-text")).toBe(true));
  it("has #moti-author", () => expect(hasId("moti-author")).toBe(true));
});

// ── Status bar ──

describe("DOM Contract — Status bar", () => {
  it("has #version-badge", () => expect(hasId("version-badge")).toBe(true));
  it("has #refresh-stamp", () => expect(hasId("refresh-stamp")).toBe(true));
});
