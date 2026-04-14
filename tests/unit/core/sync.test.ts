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
