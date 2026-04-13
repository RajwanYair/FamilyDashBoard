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
});
