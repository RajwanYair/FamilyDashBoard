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

const html = readFileSync(resolve(__dirname, "../../../src/index.html"), "utf8");

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
  it("has #sw-update-banner", () => expect(hasId("sw-update-banner")).toBe(true));
  it("has #sw-update-reload-btn", () => expect(hasId("sw-update-reload-btn")).toBe(true));
});

describe("DOM Contract — First-run tour (v11.0-PWA-1)", () => {
  it("has #tour-overlay dialog element", () => expect(hasId("tour-overlay")).toBe(true));
  it("has #tour-dialog-title for aria-labelledby", () =>
    expect(hasId("tour-dialog-title")).toBe(true));
  it("has #tour-dismiss-btn", () => expect(hasId("tour-dismiss-btn")).toBe(true));
  it("tour-overlay has aria-labelledby=tour-dialog-title", () => {
    expect(html).toContain('aria-labelledby="tour-dialog-title"');
  });
});

describe("DOM Contract — Header elements", () => {
  it("has #clock", () => expect(hasId("clock")).toBe(true));
  it("has #eng-date", () => expect(hasId("eng-date")).toBe(true));
  it("has #greeting", () => expect(hasId("greeting")).toBe(true));
  it("has #day-bar", () => expect(hasId("day-bar")).toBe(true));
  it("has #year-bar", () => expect(hasId("year-bar")).toBe(true));
  it("has #hebrew-date", () => expect(hasId("hebrew-date")).toBe(true));
  it("has #top-temp", () => expect(hasId("top-temp")).toBe(true));
  it("has #header-event-count", () => expect(hasId("header-event-count")).toBe(true));
  it("has #notif-bell (no onclick)", () => {
    expect(hasId("notif-bell")).toBe(true);
    expect(html).not.toContain('notif-bell" onclick');
  });
  it("has #header-birthday-chip (F104)", () => expect(hasId("header-birthday-chip")).toBe(true));
  it("has #header-countdown (F139)", () => expect(hasId("header-countdown")).toBe(true));
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
  it("has #cfg-countdown-date (F139)", () => expect(hasId("cfg-countdown-date")).toBe(true));
  it("has #cfg-countdown-label (F139)", () => expect(hasId("cfg-countdown-label")).toBe(true));
  it("has .cfg-tab[data-tab] buttons (no onclick)", () => {
    const tabCount = (html.match(/class="cfg-tab[^"]*" data-tab="/g) ?? []).length;
    expect(tabCount).toBeGreaterThanOrEqual(5);
    expect(html).not.toMatch(/cfg-tab[^>]+onclick=/);
  });
  it("has #screen-mode-select", () => expect(hasId("screen-mode-select")).toBe(true));
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
  it("has #news-bkm-pill (B-key bookmarks)", () => expect(hasId("news-bkm-pill")).toBe(true));
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
  it("has #cal-week-grid", () => expect(hasId("cal-week-grid")).toBe(true));
  it("has #cal-countdown", () => expect(hasId("cal-countdown")).toBe(true));
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

// ── Tasks card buttons (v7.1) ──

describe("DOM Contract — Tasks card action buttons", () => {
  it("has #tasks-mark-all-btn", () => expect(hasId("tasks-mark-all-btn")).toBe(true));
  it("has #tasks-reset-btn", () => expect(hasId("tasks-reset-btn")).toBe(true));
});

// ── Currency last-fetch chip (v7.1) ──

describe("DOM Contract — Currency last-fetch chip", () => {
  it("has #cur-last-fetch", () => expect(hasId("cur-last-fetch")).toBe(true));
});

// ── A11y: ARIA landmarks (v11.0-A11Y-1) ──

describe("DOM Contract — A11y ARIA landmarks", () => {
  const CARD_IDS = [
    "news",
    "weather",
    "hebrew-cal",
    "calendar",
    "currency",
    "stocks",
    "alerts",
    "motivation",
    "countdown",
    "tasks",
    "system-info",
  ];

  it("all 11 cards have role=region", () => {
    for (const id of CARD_IDS) {
      expect(html, `card[data-card-id="${id}"] should have role="region"`).toContain(
        `role="region" data-card-id="${id}"`,
      );
    }
  });

  it("all 11 cards have aria-label", () => {
    for (const id of CARD_IDS) {
      const re = new RegExp(
        `data-card-id="${id}"[^>]+aria-label(?:ledby)?=|aria-label(?:ledby)?=[^>]+data-card-id="${id}"`,
      );
      expect(re.test(html), `card[data-card-id="${id}"] should have aria-label`).toBe(true);
    }
  });

  it("skip-link targets #main-content", () => {
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('class="skip-link"');
  });

  it("has SR-only h1 heading inside main for WCAG 2.4.6 compliance (Sprint 30 V12-A11Y)", () => {
    expect(html).toContain('id="page-heading"');
    expect(html).toContain('class="sr-only"');
    // The heading must be inside the main element (page-heading appears after main-content)
    const mainIdx = html.indexOf('id="main-content"');
    const h1Idx = html.indexOf('id="page-heading"');
    expect(h1Idx).toBeGreaterThan(mainIdx);
  });

  it("alerts scroll region has aria-live=assertive", () => {
    expect(html).toContain('aria-live="assertive"');
  });

  it("toast has aria-live=polite for status announcements", () => {
    expect(html).toContain('id="toast"');
    expect(html).toContain('aria-live="polite"');
  });

  it("news ticker has aria-live=polite", () => {
    expect(html).toContain('id="news-ticker"');
    // news-ticker is inside the news card and has aria-live="polite"
    const tickerIdx = html.indexOf('id="news-ticker"');
    const nearbyHtml = html.slice(Math.max(0, tickerIdx - 50), tickerIdx + 80);
    expect(nearbyHtml).toContain('aria-live="polite"');
  });

  // Sprint 7: dialog aria-labelledby + cfg tabpanel aria-labelledby
  it("help-overlay dialog uses aria-labelledby (not aria-label)", () => {
    expect(html).toContain('id="help-dialog-title"');
    expect(html).toContain('aria-labelledby="help-dialog-title"');
    // must NOT fall back to aria-label on the dialog element
    expect(html).not.toContain('<dialog id="help-overlay" aria-label=');
  });

  it("diag-overlay dialog has aria-labelledby=diag-dialog-title (V13-A11Y)", () => {
    expect(html).toContain('id="diag-dialog-title"');
    expect(html).toContain('aria-labelledby="diag-dialog-title"');
  });

  it("diag-overlay dialog has aria-modal=true (V13-A11Y)", () => {
    expect(html).toContain('id="diag-overlay"');
    const re = /id="diag-overlay"[^>]*aria-modal="true"|aria-modal="true"[^>]*id="diag-overlay"/;
    expect(re.test(html)).toBe(true);
  });

  it("all three dialogs have aria-labelledby (tour, help, diag)", () => {
    for (const [dialogId, titleId] of [
      ["tour-overlay", "tour-dialog-title"],
      ["help-overlay", "help-dialog-title"],
      ["diag-overlay", "diag-dialog-title"],
    ]) {
      expect(html, `${dialogId} should have aria-labelledby="${titleId}"`).toContain(
        `aria-labelledby="${titleId}"`,
      );
      expect(html, `${titleId} heading should exist`).toContain(`id="${titleId}"`);
    }
  });

  it("all 6 cfg-tab buttons have IDs matching their data-tab", () => {
    for (const tab of ["display", "calendar", "feeds", "alerts-tab", "cards", "advanced"]) {
      expect(html, `cfg-tab-${tab} should have id`).toContain(`id="cfg-tab-${tab}"`);
    }
  });

  it("all 6 cfg-section tabpanels reference their tab via aria-labelledby", () => {
    for (const tab of ["display", "calendar", "feeds", "alerts-tab", "cards", "advanced"]) {
      expect(html, `cfg-section-${tab} should have aria-labelledby="cfg-tab-${tab}"`).toContain(
        `aria-labelledby="cfg-tab-${tab}"`,
      );
    }
  });
});

// ── A11y: Voice-control accessible names (V13-A11Y) ──

describe("DOM Contract — A11y voice-control accessible names (V13-A11Y)", () => {
  /** Returns true when a button with the given id also carries aria-label on the same tag. */
  function buttonHasAriaLabel(id: string): boolean {
    const re = new RegExp(`id="${id}"[^>]*aria-label=|aria-label=[^>]*id="${id}"`);
    return re.test(html);
  }

  it("tasks-quick-add-btn (icon-only ➕) has aria-label", () => {
    expect(buttonHasAriaLabel("tasks-quick-add-btn")).toBe(true);
  });

  it("wx-chart-toggle (emoji+abbreviation) has aria-label", () => {
    expect(buttonHasAriaLabel("wx-chart-toggle")).toBe(true);
  });

  it("hc-daf-link (Sefaria daily) has aria-label", () => {
    expect(buttonHasAriaLabel("hc-daf-link")).toBe(true);
  });

  it("hc-parasha-link (Sefaria weekly) has aria-label", () => {
    expect(buttonHasAriaLabel("hc-parasha-link")).toBe(true);
  });

  it("hc-daf-link and hc-parasha-link have distinct aria-label values", () => {
    const dafMatch = html.match(/id="hc-daf-link"[^>]*aria-label="([^"]+)"/);
    const parashaMatch = html.match(/id="hc-parasha-link"[^>]*aria-label="([^"]+)"/);
    expect(dafMatch).not.toBeNull();
    expect(parashaMatch).not.toBeNull();
    if (dafMatch && parashaMatch) {
      expect(dafMatch[1]).not.toBe(parashaMatch[1]);
    }
  });

  it("cfg-gear-btn (icon-only ⚙️) has aria-label", () => {
    expect(buttonHasAriaLabel("cfg-gear-btn")).toBe(true);
  });
});

// ── F13: Speculation Rules API audit ─────────────────────────────────────────

const previewHtml = readFileSync(resolve(__dirname, "../../../src/preview.html"), "utf8");

describe("DOM Contract — F13 Speculation Rules API audit", () => {
  it("index.html contains a speculationrules script block", () => {
    expect(html).toContain('type="speculationrules"');
  });

  it("index.html speculationrules has prerender for preview.html", () => {
    expect(html).toContain('"prerender"');
    expect(html).toContain("/FamilyDashBoard/preview.html");
  });

  it("index.html prerender eagerness is conservative (avoids wasted bandwidth)", () => {
    // Extract the speculationrules block and verify prerender eagerness
    const srMatch = html.match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
    expect(srMatch).not.toBeNull();
    const srJson = JSON.parse(srMatch![1].trim()) as Record<string, unknown>;
    const prerender = (srJson["prerender"] as Array<{ eagerness?: string }>) ?? [];
    expect(prerender.length).toBeGreaterThan(0);
    expect(prerender[0]?.["eagerness"]).toBe("conservative");
  });

  it("index.html prefetch eagerness is moderate or conservative", () => {
    const srMatch = html.match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
    expect(srMatch).not.toBeNull();
    const srJson = JSON.parse(srMatch![1].trim()) as Record<string, unknown>;
    const prefetch = (srJson["prefetch"] as Array<{ eagerness?: string }>) ?? [];
    expect(prefetch.length).toBeGreaterThan(0);
    const allowedEagerness = ["conservative", "moderate"];
    expect(allowedEagerness).toContain(prefetch[0]?.["eagerness"]);
  });

  it("preview.html contains a speculationrules block for back-navigation (F13)", () => {
    expect(previewHtml).toContain('type="speculationrules"');
  });

  it("preview.html speculationrules targets the main dashboard URL", () => {
    const srMatch = previewHtml.match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
    expect(srMatch).not.toBeNull();
    const srJson = JSON.parse(srMatch![1].trim()) as Record<string, unknown>;
    const prefetch = (srJson["prefetch"] as Array<{ urls?: string[] }>) ?? [];
    const allUrls = prefetch.flatMap((r) => r.urls ?? []);
    const coversDashboard = allUrls.some((u) => u.includes("/FamilyDashBoard"));
    expect(coversDashboard).toBe(true);
  });

  it("no external (cross-origin) URLs appear in index.html speculationrules (F13 audit)", () => {
    // External links like Sefaria, Hebcal, IDF Tzeva-Adom cannot be targeted by Speculation Rules
    // Verify no http(s):// URLs slip into the JSON block
    const srMatch = html.match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
    expect(srMatch).not.toBeNull();
    const srJson = JSON.parse(srMatch![1].trim()) as Record<string, unknown>;
    const allRulesets = [
      ...((srJson["prerender"] as Array<{ urls?: string[] }>) ?? []),
      ...((srJson["prefetch"] as Array<{ urls?: string[] }>) ?? []),
    ];
    const allUrls = allRulesets.flatMap((r) => r.urls ?? []);
    const externalUrls = allUrls.filter((u) => u.startsWith("http://") || u.startsWith("https://"));
    expect(externalUrls).toHaveLength(0);
  });

  it("all speculationrules URLs in index.html are same-origin paths (start with /)", () => {
    const srMatch = html.match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
    expect(srMatch).not.toBeNull();
    const srJson = JSON.parse(srMatch![1].trim()) as Record<string, unknown>;
    const allRulesets = [
      ...((srJson["prerender"] as Array<{ urls?: string[] }>) ?? []),
      ...((srJson["prefetch"] as Array<{ urls?: string[] }>) ?? []),
    ];
    const allUrls = allRulesets.flatMap((r) => r.urls ?? []);
    allUrls.forEach((u) => {
      expect(u).toMatch(/^\//); // must be a root-relative path
    });
  });
});
