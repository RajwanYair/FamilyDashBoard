/**
 * Tests for src/core/freshness.ts
 *
 * Covers: markFresh, formatRelativeTime, freshnessState,
 * renderFreshnessBadge, removeFreshnessBadge, getLastFetchMs.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  markFresh,
  formatRelativeTime,
  freshnessState,
  classifyFreshness,
  renderFreshnessBadge,
  removeFreshnessBadge,
  getLastFetchMs,
  resetFreshness,
} from "../../../src/core/freshness";

beforeEach(() => {
  resetFreshness();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelativeTime", () => {
  it("returns 'עכשיו' for < 1 minute", () => {
    expect(formatRelativeTime(0)).toBe("עכשיו");
    expect(formatRelativeTime(59_999)).toBe("עכשיו");
  });

  it("returns minutes for 1-59 minutes", () => {
    expect(formatRelativeTime(60_000)).toBe("לפני 1 דק׳");
    expect(formatRelativeTime(5 * 60_000)).toBe("לפני 5 דק׳");
    expect(formatRelativeTime(59 * 60_000)).toBe("לפני 59 דק׳");
  });

  it("returns hours for 1-23 hours", () => {
    expect(formatRelativeTime(60 * 60_000)).toBe("לפני 1 שע׳");
    expect(formatRelativeTime(3 * 60 * 60_000)).toBe("לפני 3 שע׳");
  });

  it("returns days for 24+ hours", () => {
    expect(formatRelativeTime(24 * 60 * 60_000)).toBe("לפני 1 ימים");
    expect(formatRelativeTime(72 * 60 * 60_000)).toBe("לפני 3 ימים");
  });
});

describe("freshnessState", () => {
  it("returns 'fresh' when within TTL", () => {
    expect(freshnessState(0, 900_000)).toBe("fresh");
    expect(freshnessState(900_000, 900_000)).toBe("fresh");
  });

  it("returns 'aging' when between 1x and 2x TTL", () => {
    expect(freshnessState(900_001, 900_000)).toBe("aging");
    expect(freshnessState(1_800_000, 900_000)).toBe("aging");
  });

  it("returns 'stale' when beyond 2x TTL", () => {
    expect(freshnessState(1_800_001, 900_000)).toBe("stale");
    expect(freshnessState(5_000_000, 900_000)).toBe("stale");
  });
});

describe("classifyFreshness", () => {
  const NOW = 1_000_000;
  const TTL = 15 * 60_000;

  it("returns unknown when no retrieval timestamp exists", () => {
    expect(classifyFreshness(null, NOW, TTL)).toBe("unknown");
    expect(classifyFreshness(Number.NaN, NOW, TTL)).toBe("unknown");
  });

  it("returns unknown for a future retrieval timestamp", () => {
    expect(classifyFreshness(NOW + 1, NOW, TTL)).toBe("unknown");
  });

  it("preserves the TTL and twice-TTL boundaries", () => {
    expect(classifyFreshness(NOW - TTL, NOW, TTL)).toBe("fresh");
    expect(classifyFreshness(NOW - TTL - 1, NOW, TTL)).toBe("aging");
    expect(classifyFreshness(NOW - 2 * TTL, NOW, TTL)).toBe("aging");
    expect(classifyFreshness(NOW - 2 * TTL - 1, NOW, TTL)).toBe("stale");
  });
});

describe("markFresh / getLastFetchMs", () => {
  it("records timestamp on markFresh", () => {
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    markFresh("weather");
    expect(getLastFetchMs("weather")).toBe(new Date("2025-06-01T12:00:00Z").getTime());
  });

  it("returns null for unknown card", () => {
    expect(getLastFetchMs("unknown")).toBeNull();
  });
});

describe("renderFreshnessBadge", () => {
  it("creates a <time> element inside container", () => {
    const container = document.createElement("div");
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    markFresh("stocks");
    const el = renderFreshnessBadge("stocks", container);
    expect(el.tagName).toBe("TIME");
    expect(container.contains(el)).toBe(true);
    expect(el.className).toBe("freshness-badge");
    expect(el.textContent).toBe("עכשיו");
  });

  it("does not announce every periodic age tick", () => {
    const container = document.createElement("div");
    markFresh("quiet-status");
    const el = renderFreshnessBadge("quiet-status", container);
    expect(el.getAttribute("aria-live")).toBe("off");
  });

  it("reuses existing badge for same card", () => {
    const container = document.createElement("div");
    markFresh("news");
    const el1 = renderFreshnessBadge("news", container);
    const el2 = renderFreshnessBadge("news", container);
    expect(el1).toBe(el2);
  });

  it("sets data-state attribute based on freshness", () => {
    const container = document.createElement("div");
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    markFresh("currency");
    vi.setSystemTime(new Date("2025-06-01T12:20:00Z")); // 20 min later — aging (> 15 min TTL, < 30 min)
    const el = renderFreshnessBadge("currency", container);
    expect(el.dataset["state"]).toBe("aging");
  });

  it("does not present a future retrieval timestamp as fresh", () => {
    const container = document.createElement("div");
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    markFresh("future");
    vi.setSystemTime(new Date("2025-06-01T11:00:00Z"));
    const el = renderFreshnessBadge("future", container);
    expect(el.textContent).toBe("");
    expect(el.dataset["state"]).toBe("unknown");
    expect(el.hasAttribute("datetime")).toBe(false);
  });
});

describe("removeFreshnessBadge", () => {
  it("removes the badge element from DOM", () => {
    const container = document.createElement("div");
    markFresh("alerts");
    renderFreshnessBadge("alerts", container);
    expect(container.children.length).toBe(1);
    removeFreshnessBadge("alerts");
    expect(container.children.length).toBe(0);
  });
});
