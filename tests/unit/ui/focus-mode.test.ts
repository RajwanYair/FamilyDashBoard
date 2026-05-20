/**
 * Tests for src/ui/focus-mode.ts — Focus Mode (S53)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { isFocusMode, toggleFocusMode, getFocusCards } from "@/ui/focus-mode";

describe("focus-mode", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  it("isFocusMode returns false by default", () => {
    expect(isFocusMode()).toBe(false);
  });

  it("toggleFocusMode enables focus mode", () => {
    const result = toggleFocusMode();
    expect(result).toBe(true);
    expect(isFocusMode()).toBe(true);
    expect(document.body.classList.contains("focus-mode")).toBe(true);
  });

  it("toggleFocusMode disables when already active", () => {
    document.body.classList.add("focus-mode");
    const result = toggleFocusMode();
    expect(result).toBe(false);
    expect(isFocusMode()).toBe(false);
  });

  it("getFocusCards returns weather, news, alerts", () => {
    const cards = getFocusCards();
    expect(cards.has("weather")).toBe(true);
    expect(cards.has("news")).toBe(true);
    expect(cards.has("alerts")).toBe(true);
    expect(cards.size).toBe(3);
  });
});
