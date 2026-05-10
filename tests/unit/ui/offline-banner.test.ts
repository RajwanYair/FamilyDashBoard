/**
 * Tests for src/ui/offline-banner.ts
 *
 * (X6 · ): reactive offline indicator driven by event-bus.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initOfflineBanner, _disposeOfflineBanner } from "@/ui/offline-banner";
import { globalOffline, _resetBusForTesting } from "@/core/event-bus";

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Minimal DOM
  document.body.innerHTML = '<div id="offline-banner"></div><div id="toast"></div>';
  _resetBusForTesting();
  vi.useFakeTimers();
});

afterEach(() => {
  _disposeOfflineBanner();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// ── initOfflineBanner ─────────────────────────────────────────────────────────

describe("initOfflineBanner", () => {
  it("banner is hidden on init when online", () => {
    globalOffline.value = false;
    initOfflineBanner(() => {});
    const banner = document.getElementById("offline-banner");
    expect(banner?.classList.contains("visible")).toBe(false);
  });

  it("shows banner when globalOffline becomes true", () => {
    initOfflineBanner(() => {});
    globalOffline.value = true;
    const banner = document.getElementById("offline-banner");
    expect(banner?.classList.contains("visible")).toBe(true);
  });

  it("hides banner when globalOffline returns to false", () => {
    initOfflineBanner(() => {});
    globalOffline.value = true;
    globalOffline.value = false;
    const banner = document.getElementById("offline-banner");
    expect(banner?.classList.contains("visible")).toBe(false);
  });

  it("does NOT call onReconnect on first offline→online without prior offline", () => {
    const cb = vi.fn();
    initOfflineBanner(cb);
    // going from false → false (no transition) should not call cb
    globalOffline.value = false;
    vi.runAllTimers();
    expect(cb).not.toHaveBeenCalled();
  });

  it("calls onReconnect after 500 ms on reconnect", () => {
    const cb = vi.fn();
    initOfflineBanner(cb);
    globalOffline.value = true; // go offline
    globalOffline.value = false; // come back online
    expect(cb).not.toHaveBeenCalled(); // not yet
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("does NOT call onReconnect if went online without prior offline", () => {
    const cb = vi.fn();
    initOfflineBanner(cb);
    // direct online event without prior offline transition
    globalOffline.value = false;
    vi.runAllTimers();
    expect(cb).not.toHaveBeenCalled();
  });

  it("is safe when #offline-banner element is missing", () => {
    document.body.innerHTML = '<div id="toast"></div>';
    expect(() => {
      initOfflineBanner(() => {});
      globalOffline.value = true;
      globalOffline.value = false;
    }).not.toThrow();
  });

  it("handles multiple offline/online cycles", () => {
    const cb = vi.fn();
    initOfflineBanner(cb);

    // first cycle
    globalOffline.value = true;
    globalOffline.value = false;
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);

    // second cycle
    globalOffline.value = true;
    globalOffline.value = false;
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

// ── _disposeOfflineBanner ─────────────────────────────────────────────────────

describe("_disposeOfflineBanner", () => {
  it("stops reacting to globalOffline after dispose", () => {
    initOfflineBanner(() => {});
    _disposeOfflineBanner();
    globalOffline.value = true;
    const banner = document.getElementById("offline-banner");
    // After dispose, banner should NOT have been updated
    expect(banner?.classList.contains("visible")).toBe(false);
  });

  it("is safe to call before init", () => {
    expect(() => _disposeOfflineBanner()).not.toThrow();
  });

  it("is safe to call multiple times", () => {
    initOfflineBanner(() => {});
    expect(() => {
      _disposeOfflineBanner();
      _disposeOfflineBanner();
    }).not.toThrow();
  });
});

// ── navigator event integration ───────────────────────────────────────────────

describe("navigator.onLine integration", () => {
  it("globalOffline updates to true on window offline event", () => {
    initOfflineBanner(() => {});
    window.dispatchEvent(new Event("offline"));
    expect(globalOffline.value).toBe(true);
  });

  it("globalOffline updates to false on window online event", () => {
    initOfflineBanner(() => {});
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    expect(globalOffline.value).toBe(false);
  });
});
