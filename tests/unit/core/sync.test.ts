/**
 * Tests for src/core/sync.ts — Sync Indicators & Health Tracking
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setSync,
  registerSyncDot,
  recordFailure,
  recordSuccess,
  getBackoffDelay,
  syncBurst,
  updateCardMiniInfo,
} from "@/core/sync";

describe("Sync Indicators", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="sync-wx"></div>';
  });

  it("updates sync dot class to loading", () => {
    const dot = document.getElementById("sync-wx")!;
    registerSyncDot("wx", dot);
    setSync("wx", "loading");
    expect(dot.classList.contains("loading")).toBe(true);
  });

  it("updates sync dot class to error", () => {
    const dot = document.getElementById("sync-wx")!;
    registerSyncDot("wx", dot);
    setSync("wx", "error");
    expect(dot.classList.contains("error")).toBe(true);
  });

  it("resets to ok (no extra classes)", () => {
    const dot = document.getElementById("sync-wx")!;
    registerSyncDot("wx", dot);
    setSync("wx", "error");
    setSync("wx", "ok");
    expect(dot.classList.contains("error")).toBe(false);
    expect(dot.className).toBe("sync-dot");
  });

  it("ignores unknown sync dot names", () => {
    // Should not throw
    expect(() => setSync("unknown", "ok")).not.toThrow();
  });
});

describe("Exponential Backoff", () => {
  it("starts with delay multiplier of 1", () => {
    expect(getBackoffDelay("fresh-key")).toBe(1);
  });

  it("doubles delay on each failure", () => {
    recordFailure("test");
    expect(getBackoffDelay("test")).toBe(2);
    recordFailure("test");
    expect(getBackoffDelay("test")).toBe(4);
  });

  it("resets on success", () => {
    recordFailure("reset-test");
    recordFailure("reset-test");
    recordSuccess("reset-test");
    expect(getBackoffDelay("reset-test")).toBe(1);
  });

  it("caps at 5 failures (32x multiplier)", () => {
    for (let i = 0; i < 10; i++) {
      recordFailure("cap-test");
    }
    expect(getBackoffDelay("cap-test")).toBe(32); // 2^5
  });

  it("returns 1 for a fresh key with no failures", () => {
    expect(getBackoffDelay("brand-new")).toBe(1);
  });

  it("doubles correctly on third failure (8x)", () => {
    recordFailure("three");
    recordFailure("three");
    recordFailure("three");
    expect(getBackoffDelay("three")).toBe(8);
  });

  it("recordSuccess on never-failed key does not throw", () => {
    expect(() => recordSuccess("fresh-key")).not.toThrow();
  });

  it("getBackoffDelay returns a number", () => {
    expect(typeof getBackoffDelay("type-check")).toBe("number");
  });
});

describe("Sync Indicators — advanced", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sync-a" class="sync-dot"></div>
      <div id="sync-b" class="sync-dot"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets loading then error replaces loading class", () => {
    const dot = document.getElementById("sync-a")!;
    registerSyncDot("pane-a", dot);
    setSync("pane-a", "loading");
    expect(dot.classList.contains("loading")).toBe(true);
    setSync("pane-a", "error");
    expect(dot.classList.contains("loading")).toBe(false);
    expect(dot.classList.contains("error")).toBe(true);
  });

  it("ok state removes all state classes", () => {
    const dot = document.getElementById("sync-a")!;
    registerSyncDot("pane-reset", dot);
    setSync("pane-reset", "error");
    setSync("pane-reset", "ok");
    expect(dot.classList.contains("error")).toBe(false);
    expect(dot.classList.contains("loading")).toBe(false);
    expect(dot.className).toBe("sync-dot");
  });

  it("syncBurst adds burst class momentarily", () => {
    const dot = document.getElementById("sync-b")!;
    registerSyncDot("pane-burst", dot);
    syncBurst("pane-burst");
    expect(dot.classList.contains("burst")).toBe(true);
  });

  it("syncBurst on unregistered name does not throw", () => {
    expect(() => syncBurst("nobody")).not.toThrow();
  });

  it("registerSyncDot overwrites existing registration", () => {
    const dotA = document.getElementById("sync-a")!;
    const dotB = document.getElementById("sync-b")!;
    registerSyncDot("overwrite", dotA);
    registerSyncDot("overwrite", dotB);
    setSync("overwrite", "error");
    expect(dotB.classList.contains("error")).toBe(true);
    expect(dotA.classList.contains("error")).toBe(false);
  });
});

// ── Sprint 45: aria-busy on parent card ──────────────────────────────────────
describe("Sync — aria-busy on parent card (Sprint 45)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="card">
        <div id="sync-a45"></div>
      </div>`;
  });

  it("sets aria-busy=true on parent card when loading", () => {
    const dot = document.getElementById("sync-a45")!;
    registerSyncDot("a45", dot);
    setSync("a45", "loading");
    expect(dot.closest(".card")?.getAttribute("aria-busy")).toBe("true");
  });

  it("sets aria-busy=false on parent card when ok", () => {
    const dot = document.getElementById("sync-a45")!;
    registerSyncDot("a45", dot);
    setSync("a45", "loading");
    setSync("a45", "ok");
    expect(dot.closest(".card")?.getAttribute("aria-busy")).toBe("false");
  });

  it("sets aria-busy=false on parent card when error", () => {
    const dot = document.getElementById("sync-a45")!;
    registerSyncDot("a45", dot);
    setSync("a45", "error");
    expect(dot.closest(".card")?.getAttribute("aria-busy")).toBe("false");
  });

  it("does not throw when sync dot has no .card ancestor", () => {
    document.body.innerHTML = '<div id="sync-no-card"></div>';
    const dot = document.getElementById("sync-no-card")!;
    registerSyncDot("no-card", dot);
    expect(() => setSync("no-card", "loading")).not.toThrow();
  });
});

// ── updateCardMiniInfo ────────────────────────────────────────────────────────
describe("updateCardMiniInfo", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("populates weather mini-info from wx-temp and wx-desc", () => {
    document.body.innerHTML = `
      <span id="wx-temp">22°C</span>
      <span id="wx-desc">בהיר</span>
      <span id="mini-weather"></span>`;
    updateCardMiniInfo("weather");
    expect(document.getElementById("mini-weather")!.textContent).toBe("22°C · בהיר");
  });

  it("skips placeholder values like --", () => {
    document.body.innerHTML = `
      <span id="wx-temp">--</span>
      <span id="wx-desc">בהיר</span>
      <span id="mini-weather"></span>`;
    updateCardMiniInfo("weather");
    expect(document.getElementById("mini-weather")!.textContent).toBe("בהיר");
  });

  it("handles countdown card with title and days", () => {
    document.body.innerHTML = `
      <span id="cd-wedding-title">חתונה</span>
      <span id="cd-days">45</span>
      <span id="mini-countdown"></span>`;
    updateCardMiniInfo("countdown");
    expect(document.getElementById("mini-countdown")!.textContent).toBe("חתונה \u2014 45 ימים");
  });

  it("countdown with -- days shows only title", () => {
    document.body.innerHTML = `
      <span id="cd-wedding-title">חתונה</span>
      <span id="cd-days">--</span>
      <span id="mini-countdown"></span>`;
    updateCardMiniInfo("countdown");
    expect(document.getElementById("mini-countdown")!.textContent).toBe("חתונה");
  });

  it("does nothing when mini element does not exist", () => {
    expect(() => updateCardMiniInfo("weather")).not.toThrow();
  });

  it("truncates motivation quote beyond 50 chars", () => {
    document.body.innerHTML = `
      <span id="moti-text">${"א".repeat(60)}</span>
      <span id="mini-motivation"></span>`;
    updateCardMiniInfo("motivation");
    const text = document.getElementById("mini-motivation")!.textContent!;
    expect(text.length).toBeLessThanOrEqual(53); // 50 chars + "…"
    expect(text.endsWith("…")).toBe(true);
  });

  it("ignores unknown card IDs without throwing", () => {
    document.body.innerHTML = '<span id="mini-unknown"></span>';
    updateCardMiniInfo("unknown");
    expect(document.getElementById("mini-unknown")!.textContent).toBe("");
  });

  it("leaves mini-info empty when source element has no text", () => {
    document.body.innerHTML = `
      <span id="wx-temp"></span>
      <span id="wx-desc"></span>
      <span id="mini-weather"></span>`;
    updateCardMiniInfo("weather");
    expect(document.getElementById("mini-weather")!.textContent).toBe("");
  });
});
