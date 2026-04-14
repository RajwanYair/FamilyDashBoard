/**
 * Tests for src/ui/toast.ts
 *
 * Covers: showToast (shows/hides, sets text, respects duration).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showToast } from "@/ui/toast";

describe("Toast — showToast", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast"></div>';
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("sets textContent on the toast element", () => {
    showToast("שלום עולם");
    expect(document.getElementById("toast")?.textContent).toBe("שלום עולם");
  });

  it("adds the visible class", () => {
    showToast("test message");
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(true);
  });

  it("removes visible class after duration", () => {
    showToast("fade me", 1000);
    vi.advanceTimersByTime(1001);
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(false);
  });

  it("resets hide timer on repeated calls", () => {
    showToast("first", 3000);
    vi.advanceTimersByTime(2000);
    showToast("second", 3000);
    vi.advanceTimersByTime(2500);
    // First toast would have expired 1500ms ago, but second resets the timer
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(true);
  });

  it("does nothing when toast element is absent", () => {
    document.body.innerHTML = "";
    expect(() => showToast("no toast element")).not.toThrow();
  });

  it("uses default 3000ms duration when none specified", () => {
    showToast("default duration");
    vi.advanceTimersByTime(2999);
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(true);
    vi.advanceTimersByTime(2);
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(false);
  });

  it("shows Hebrew text correctly", () => {
    showToast("שגיאה בטעינת הנתונים");
    expect(document.getElementById("toast")?.textContent).toBe(
      "שגיאה בטעינת הנתונים",
    );
  });

  it("shows empty string toast without throwing", () => {
    expect(() => showToast("")).not.toThrow();
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(true);
  });

  it("toast is visible immediately after call", () => {
    showToast("immediate");
    expect(
      document.getElementById("toast")?.classList.contains("visible"),
    ).toBe(true);
  });

  it("toast text updates on second call", () => {
    showToast("first message");
    showToast("second message");
    expect(document.getElementById("toast")?.textContent).toBe(
      "second message",
    );
  });
});
