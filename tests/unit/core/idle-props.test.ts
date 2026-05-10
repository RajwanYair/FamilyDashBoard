/**
 * fast-check property tests for src/core/idle.ts
 *
 * Verifies invariants of `shouldWakeRefresh` and `pageVisibleSignal`
 * across arbitrary visibility transitions.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { isPageVisible, pageVisibleSignal, shouldWakeRefresh, initVisibility } from "@/core/idle";
import { WAKE_REFRESH_MS } from "@/core/constants";

let visibility: "visible" | "hidden" = "visible";
let initialised = false;

function setVisibility(state: "visible" | "hidden"): void {
  visibility = state;
  // Override document.hidden + visibilityState
  Object.defineProperty(document, "hidden", { value: state === "hidden", configurable: true });
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("idle — fast-check properties (IDP1-IDP3 )", () => {
  beforeEach(() => {
    if (!initialised) {
      initVisibility();
      initialised = true;
    }
    setVisibility("visible");
  });

  it("IDP1: pageVisibleSignal.value mirrors document.hidden across arbitrary toggle sequences", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (toggles) => {
        for (const visible of toggles) {
          setVisibility(visible ? "visible" : "hidden");
          expect(pageVisibleSignal.value).toBe(visible);
          expect(isPageVisible()).toBe(visible);
        }
      }),
      { numRuns: 20 },
    );
  });

  it("IDP2: shouldWakeRefresh is false while the page is visible (no hidden timestamp)", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        setVisibility("visible");
        expect(shouldWakeRefresh()).toBe(false);
      }),
      { numRuns: 5 },
    );
  });

  it("IDP3: shouldWakeRefresh becomes true only after the page has been hidden longer than WAKE_REFRESH_MS", () => {
    vi.useFakeTimers();
    try {
      const start = new Date("2026-04-30T12:00:00Z").getTime();
      vi.setSystemTime(start);
      setVisibility("visible");
      setVisibility("hidden");
      // Just before the threshold — should NOT trigger wake
      vi.setSystemTime(start + WAKE_REFRESH_MS - 100);
      expect(shouldWakeRefresh()).toBe(false);
      // Just past the threshold — SHOULD trigger wake
      vi.setSystemTime(start + WAKE_REFRESH_MS + 100);
      expect(shouldWakeRefresh()).toBe(true);
      // Once visible again, lastHiddenAt is cleared → no wake required
      setVisibility("visible");
      expect(shouldWakeRefresh()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
