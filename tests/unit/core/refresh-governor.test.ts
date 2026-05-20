/**
 * Tests for src/core/refresh-governor.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  shouldSkipRender,
  markRendered,
  invalidateGovernor,
  resetGovernor,
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
});
