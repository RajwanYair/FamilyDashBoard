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
  getFailedPanes,
  syncBurst,
  updateCardMiniInfo,
  clearSyncDots,
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

// ── getFailedPanes ────────────────────────────────────────────────────────────
describe("getFailedPanes", () => {
  beforeEach(() => {
    // Reset all keys that other tests and our own tests may dirty
    for (const k of [
      "fp-a",
      "fp-b",
      "fp-c",
      "test",
      "reset-test",
      "cap-test",
      "three",
      "fresh-key",
    ]) {
      recordSuccess(k);
    }
  });

  it("includes no fp-* entries when none were recorded yet", () => {
    const keys = getFailedPanes().map((p) => p.key);
    expect(keys).not.toContain("fp-a");
    expect(keys).not.toContain("fp-b");
    expect(keys).not.toContain("fp-c");
  });

  it("returns entry for a pane with one failure", () => {
    recordFailure("fp-a");
    const panes = getFailedPanes();
    expect(panes.some((p) => p.key === "fp-a")).toBe(true);
    const entry = panes.find((p) => p.key === "fp-a")!;
    expect(entry.delay).toBe(2); // 2^1
  });

  it("returns correct delay after multiple failures", () => {
    recordFailure("fp-b");
    recordFailure("fp-b");
    recordFailure("fp-b"); // 3 failures → delay 2^3 = 8
    const panes = getFailedPanes();
    const entry = panes.find((p) => p.key === "fp-b")!;
    expect(entry.delay).toBe(8);
  });

  it("omits panes with 0 failures (after recordSuccess reset)", () => {
    recordFailure("fp-c");
    recordSuccess("fp-c"); // reset
    const panes = getFailedPanes();
    expect(panes.some((p) => p.key === "fp-c")).toBe(false);
  });

  it("returns multiple entries when multiple panes have failures", () => {
    recordFailure("fp-a");
    recordFailure("fp-b");
    const panes = getFailedPanes();
    expect(panes.some((p) => p.key === "fp-a")).toBe(true);
    expect(panes.some((p) => p.key === "fp-b")).toBe(true);
  });
});

// ── clearSyncDots ─────────────────────────────────────────────────────────────
describe("clearSyncDots", () => {
  it("removes all registered sync dots without throwing", () => {
    document.body.innerHTML = '<div id="sync-clear"></div>';
    const dot = document.getElementById("sync-clear")!;
    registerSyncDot("clear-test", dot);
    expect(() => clearSyncDots()).not.toThrow();
    // After clearing, setSync should be a no-op
    expect(() => setSync("clear-test", "ok")).not.toThrow();
  });
});

// ── syncBurst with card DOM element (covers flashCardRefresh body) ────────────
describe("syncBurst — with card DOM element present", () => {
  it("adds card--refreshed class to the matching card element", () => {
    document.body.innerHTML = `
      <div id="sync-wx2"></div>
      <div class="card" data-card-id="weather">
        <span id="mini-weather"></span>
        <span id="wx-temp">22°C</span>
        <span id="wx-desc">שמש</span>
      </div>`;
    const dot = document.getElementById("sync-wx2")!;
    registerSyncDot("wx", dot);
    syncBurst("wx");
    const card = document.querySelector('[data-card-id="weather"]')!;
    expect(card.classList.contains("card--refreshed")).toBe(true);
  });

  it("covers flashCardRefresh with SYNC_TO_CARD_ID mapping (wx → weather)", () => {
    document.body.innerHTML = `
      <div id="sync-wx3"></div>
      <div class="card" data-card-id="weather"></div>`;
    const dot = document.getElementById("sync-wx3")!;
    registerSyncDot("wx", dot);
    expect(() => syncBurst("wx")).not.toThrow();
  });

  it("does not throw when card element is absent (covers early return path)", () => {
    document.body.innerHTML = '<div id="sync-wx4"></div>';
    const dot = document.getElementById("sync-wx4")!;
    registerSyncDot("wx", dot);
    expect(() => syncBurst("wx")).not.toThrow();
  });

  it("animationend listener removes card--refreshed class (covers the once-listener arrow fn)", () => {
    document.body.innerHTML = `
      <div id="sync-wx5"></div>
      <div class="card" data-card-id="weather"></div>`;
    const dot = document.getElementById("sync-wx5")!;
    registerSyncDot("wx", dot);
    syncBurst("wx");
    const card = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    // syncBurst adds card--refreshed and registers a once-listener for animationend
    expect(card.classList.contains("card--refreshed")).toBe(true);
    // Dispatch animationend to fire the listener → removes card--refreshed
    card.dispatchEvent(new Event("animationend"));
    expect(card.classList.contains("card--refreshed")).toBe(false);
  });
});

// ── Sprint 96: buildMiniText — countdown empty title branch ──────────────────
describe("buildMiniText countdown — empty title branch", () => {
  it("returns empty string for countdown when title element is absent", () => {
    // No #cd-wedding-title → title = "" → !title → return ""
    document.body.innerHTML = `
      <span id="cd-days">5</span>
      <span id="mini-countdown"></span>`;
    updateCardMiniInfo("countdown");
    expect(document.getElementById("mini-countdown")!.textContent).toBe("");
  });
});
