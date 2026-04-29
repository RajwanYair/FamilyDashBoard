/**
 * FamilyDashBoard — maximize.ts browser spec (Sprint 145)
 *
 * These tests run in real Chromium via @vitest/browser + playwright.
 * They cover behaviours that require actual layout (getBoundingClientRect)
 * and browser APIs (View Transitions) unavailable in happy-dom.
 *
 * Run: npx vitest --config vitest.browser.config.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  toggleCardMaximize,
  getMaximizedCard,
  computeFontScale,
  cardVtName,
  getCollapsedCards,
} from "@/ui/maximize";

// ── Pure function tests ────────────────────────────────────────────────────

describe("computeFontScale", () => {
  it("returns 1 when dimensions are equal", () => {
    const r = { width: 300, height: 200 } as DOMRect;
    expect(computeFontScale(r, r)).toBe(1);
  });

  it("clamps scale to max 4", () => {
    const first = { width: 100, height: 100 } as DOMRect;
    const last = { width: 2000, height: 2000 } as DOMRect;
    expect(computeFontScale(first, last)).toBe(4);
  });

  it("uses the smaller axis (width < height)", () => {
    const first = { width: 100, height: 100 } as DOMRect;
    const last = { width: 200, height: 400 } as DOMRect;
    // scaleW=2, scaleH=4 → min=2
    expect(computeFontScale(first, last)).toBe(2);
  });

  it("guards against zero-width first rect", () => {
    const first = { width: 0, height: 100 } as DOMRect;
    const last = { width: 200, height: 200 } as DOMRect;
    // width ratio uses (first.width || 1) = 1, so scaleW=200, scaleH=2 → min=2
    expect(computeFontScale(first, last)).toBe(2);
  });
});

describe("cardVtName", () => {
  it("generates ident from data-card-id", () => {
    const card = document.createElement("div");
    card.dataset["cardId"] = "weather";
    expect(cardVtName(card)).toBe("card-max-weather");
  });

  it("preserves hyphens in card id", () => {
    const card = document.createElement("div");
    card.dataset["cardId"] = "hebrew-cal";
    expect(cardVtName(card)).toBe("card-max-hebrew-cal");
  });

  it("falls back to element id", () => {
    const card = document.createElement("div");
    card.id = "fdb-weather";
    expect(cardVtName(card)).toBe("card-max-fdb-weather");
  });

  it("uses 'card' fallback when no id", () => {
    const card = document.createElement("div");
    expect(cardVtName(card)).toBe("card-max-card");
  });
});

// ── DOM / layout tests (real browser required) ────────────────────────────

describe("toggleCardMaximize — DOM state (browser layout)", () => {
  let card: HTMLDivElement;
  let originalVT: typeof document.startViewTransition;

  beforeEach(() => {
    // Patch startViewTransition to a synchronous stub so View Transition
    // promises settle immediately and never throw AbortError in tests.
    originalVT = document.startViewTransition;
    (document as Document & { startViewTransition: unknown }).startViewTransition = (
      arg: (() => void) | { update: () => void },
    ): ViewTransition => {
      const fn = typeof arg === "function" ? arg : arg.update;
      fn();
      const done = Promise.resolve(undefined);
      return {
        finished: done,
        ready: done,
        updateCallbackDone: done,
        skipTransition: () => undefined,
      } as unknown as ViewTransition;
    };

    // Give the card real dimensions so getBoundingClientRect is meaningful
    card = document.createElement("div");
    card.dataset["cardId"] = "test-card";
    card.style.cssText =
      "width:300px;height:200px;position:fixed;top:50px;left:50px;";
    document.body.appendChild(card);
  });

  afterEach(() => {
    // Restore original startViewTransition
    (document as Document & { startViewTransition: unknown }).startViewTransition = originalVT;
    // Clean up maximized state before removing element
    card.classList.remove("maximized");
    document.body.removeChild(card);
  });

  it("getBoundingClientRect returns real non-zero dimensions", () => {
    const r = card.getBoundingClientRect();
    // Real browser layout — width and height should match the inline style
    expect(r.width).toBe(300);
    expect(r.height).toBe(200);
  });

  it("adds .maximized class on first toggle", () => {
    toggleCardMaximize(card);
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("sets aria-expanded='true' on expand", () => {
    toggleCardMaximize(card);
    expect(card.getAttribute("aria-expanded")).toBe("true");
  });

  it("getMaximizedCard() returns the expanded card", () => {
    toggleCardMaximize(card);
    expect(getMaximizedCard()).toBe(card);
  });

  it("removes .maximized class on second toggle", () => {
    toggleCardMaximize(card);
    toggleCardMaximize(card);
    expect(card.classList.contains("maximized")).toBe(false);
  });

  it("sets --maximize-top CSS var on expand", () => {
    toggleCardMaximize(card);
    // Should have a numeric pixel value (may be 0 if no header in test DOM)
    const val = card.style.getPropertyValue("--maximize-top");
    expect(val).toMatch(/^\d+px$/);
  });

  it("sets --maximize-height CSS var on expand", () => {
    toggleCardMaximize(card);
    const val = card.style.getPropertyValue("--maximize-height");
    expect(val).toMatch(/^\d+px$/);
  });
});

// ── Collapsed-cards persistence (localStorage) ────────────────────────────

describe("getCollapsedCards", () => {
  it("returns an empty Set when localStorage is empty", () => {
    localStorage.clear();
    const set = getCollapsedCards();
    expect(set).toBeInstanceOf(Set);
    expect(set.size).toBe(0);
  });
});
