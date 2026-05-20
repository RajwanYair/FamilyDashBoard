/**
 * Tests for src/core/refresh-governor.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  shouldSkipRender,
  markRendered,
  invalidateGovernor,
  resetGovernor,
  getGovernorStats,
  getAdaptiveMultiplier,
  _resetForTest,
  _fnv1a32ForTest,
} from "@/core/refresh-governor";

beforeEach(() => {
  _resetForTest();
});

describe("refresh-governor", () => {
  describe("shouldSkipRender", () => {
    it("returns false on first call for a card", () => {
      expect(shouldSkipRender("weather", { temp: 25 })).toBe(false);
    });

    it("returns true when same payload is rendered again", () => {
      const payload = { temp: 25, humidity: 60 };
      markRendered("weather", payload);
      expect(shouldSkipRender("weather", payload)).toBe(true);
    });

    it("returns false when payload changes", () => {
      markRendered("weather", { temp: 25 });
      // Advance time past MIN_RENDER_INTERVAL_MS
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3000);
      expect(shouldSkipRender("weather", { temp: 26 })).toBe(false);
      vi.restoreAllMocks();
    });

    it("different cards are tracked independently", () => {
      const payload = { value: 1 };
      markRendered("stocks", payload);
      expect(shouldSkipRender("stocks", payload)).toBe(true);
      expect(shouldSkipRender("currency", payload)).toBe(false);
    });

    it("throttles rapid re-renders even with different content", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      markRendered("news", { items: [1] });

      // 500ms later — still within throttle window
      vi.spyOn(Date, "now").mockReturnValue(now + 500);
      expect(shouldSkipRender("news", { items: [1, 2] })).toBe(true);

      // 3000ms later — past throttle window
      vi.spyOn(Date, "now").mockReturnValue(now + 3000);
      expect(shouldSkipRender("news", { items: [1, 2] })).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe("markRendered", () => {
    it("records the payload hash and timestamp", () => {
      const payload = { x: "hello" };
      markRendered("tasks", payload);
      expect(shouldSkipRender("tasks", payload)).toBe(true);
    });
  });

  describe("invalidateGovernor", () => {
    it("forces next render for a specific card", () => {
      const payload = { a: 1 };
      markRendered("weather", payload);
      expect(shouldSkipRender("weather", payload)).toBe(true);
      invalidateGovernor("weather");
      expect(shouldSkipRender("weather", payload)).toBe(false);
    });

    it("does not affect other cards", () => {
      markRendered("stocks", { b: 2 });
      markRendered("currency", { c: 3 });
      invalidateGovernor("stocks");
      expect(shouldSkipRender("currency", { c: 3 })).toBe(true);
    });
  });

  describe("resetGovernor", () => {
    it("clears all card state", () => {
      markRendered("weather", { temp: 25 });
      markRendered("stocks", { price: 100 });
      resetGovernor();
      expect(shouldSkipRender("weather", { temp: 25 })).toBe(false);
      expect(shouldSkipRender("stocks", { price: 100 })).toBe(false);
    });
  });

  describe("_fnv1a32ForTest (hash quality)", () => {
    it("returns consistent hash for same input", () => {
      expect(_fnv1a32ForTest("hello")).toBe(_fnv1a32ForTest("hello"));
    });

    it("returns different hashes for different inputs", () => {
      expect(_fnv1a32ForTest("hello")).not.toBe(_fnv1a32ForTest("world"));
    });

    it("returns a 32-bit unsigned integer", () => {
      const h = _fnv1a32ForTest("test string");
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    });

    it("handles empty string", () => {
      const h = _fnv1a32ForTest("");
      expect(h).toBe(2166136261); // FNV offset basis
    });
  });

  describe("getGovernorStats", () => {
    it("returns empty array when no cards tracked", () => {
      expect(getGovernorStats()).toEqual([]);
    });

    it("tracks render count per card", () => {
      markRendered("weather", { temp: 25 });
      markRendered("weather", { temp: 26 });
      const stats = getGovernorStats();
      const wx = stats.find((s) => s.cardId === "weather");
      expect(wx).toEqual({ cardId: "weather", renders: 2, skips: 0 });
    });

    it("tracks skip count when content is identical", () => {
      const payload = { temp: 25 };
      markRendered("stocks", payload);
      shouldSkipRender("stocks", payload); // identical → skip
      shouldSkipRender("stocks", payload); // identical → skip
      const stats = getGovernorStats();
      const stk = stats.find((s) => s.cardId === "stocks");
      expect(stk).toEqual({ cardId: "stocks", renders: 1, skips: 2 });
    });

    it("resets stats on resetGovernor", () => {
      markRendered("news", { items: [] });
      shouldSkipRender("news", { items: [] });
      resetGovernor();
      expect(getGovernorStats()).toEqual([]);
    });
  });

  describe("getAdaptiveMultiplier (S56)", () => {
    it("returns 1 when no skips recorded", () => {
      expect(getAdaptiveMultiplier("weather")).toBe(1);
    });

    it("increases after consecutive identical fetches", () => {
      const payload = { temp: 25 };
      markRendered("weather", payload);
      shouldSkipRender("weather", payload); // skip 1
      expect(getAdaptiveMultiplier("weather")).toBe(1.5);
      shouldSkipRender("weather", payload); // skip 2
      expect(getAdaptiveMultiplier("weather")).toBe(2);
    });

    it("caps at 4×", () => {
      const payload = { a: 1 };
      markRendered("stocks", payload);
      for (let i = 0; i < 20; i++) shouldSkipRender("stocks", payload);
      expect(getAdaptiveMultiplier("stocks")).toBe(4);
    });

    it("resets to 1 when data changes", () => {
      const payload = { temp: 25 };
      markRendered("weather", payload);
      shouldSkipRender("weather", payload);
      shouldSkipRender("weather", payload);
      expect(getAdaptiveMultiplier("weather")).toBe(2);

      // New data arrives — advance time past throttle
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
      shouldSkipRender("weather", { temp: 30 });
      expect(getAdaptiveMultiplier("weather")).toBe(1);
      vi.restoreAllMocks();
    });
  });
});
