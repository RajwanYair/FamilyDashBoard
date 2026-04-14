/**
 * Tests for src/core/idle.ts
 *
 * Covers: scheduleIdle, isPageVisible, onVisibilityChange,
 * shouldWakeRefresh, initVisibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use fresh module per test to reset internal state
type IdleMod = typeof import("@/core/idle");

async function freshIdle(): Promise<IdleMod> {
  vi.resetModules();
  return import("@/core/idle");
}

describe("Idle — scheduleIdle", () => {
  it("calls the function (via setTimeout fallback)", async () => {
    const { scheduleIdle } = await freshIdle();
    vi.useFakeTimers();
    const fn = vi.fn();
    scheduleIdle(fn);
    vi.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("uses requestIdleCallback when available", async () => {
    const ricMock = vi.fn((cb: IdleRequestCallback) => {
      cb({} as IdleDeadline);
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", ricMock);
    const { scheduleIdle } = await freshIdle();
    const fn = vi.fn();
    scheduleIdle(fn);
    expect(ricMock).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe("Idle — isPageVisible", () => {
  it("returns true by default", async () => {
    const { isPageVisible } = await freshIdle();
    expect(isPageVisible()).toBe(true);
  });

  it("returns false when page is hidden via visibilitychange", async () => {
    const { isPageVisible, initVisibility } = await freshIdle();
    initVisibility();

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isPageVisible()).toBe(false);

    // restore
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("returns true when page becomes visible again", async () => {
    const { isPageVisible, initVisibility } = await freshIdle();
    initVisibility();

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isPageVisible()).toBe(true);
  });
});

describe("Idle — onVisibilityChange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset hidden
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("fires callback with false when page hides", async () => {
    const { onVisibilityChange, initVisibility } = await freshIdle();
    initVisibility();

    const cb = vi.fn();
    onVisibilityChange(cb);

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledWith(false);
  });

  it("fires callback with true when page shows", async () => {
    const { onVisibilityChange, initVisibility } = await freshIdle();
    initVisibility();

    const cb = vi.fn();
    onVisibilityChange(cb);

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(cb).toHaveBeenNthCalledWith(2, true);
  });

  it("fires multiple registered callbacks", async () => {
    const { onVisibilityChange, initVisibility } = await freshIdle();
    initVisibility();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    onVisibilityChange(cb1);
    onVisibilityChange(cb2);

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });
});

describe("Idle — shouldWakeRefresh", () => {
  afterEach(() => {
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("returns false before any hide event", async () => {
    const { shouldWakeRefresh } = await freshIdle();
    expect(shouldWakeRefresh()).toBe(false);
  });

  it("returns false immediately after page hides", async () => {
    const { shouldWakeRefresh, initVisibility } = await freshIdle();
    initVisibility();

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Not enough time has passed
    expect(shouldWakeRefresh()).toBe(false);

    // Restore
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  it("returns false after page comes back quickly", async () => {
    const { shouldWakeRefresh, initVisibility } = await freshIdle();
    initVisibility();

    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // After coming back, lastHiddenAt is reset to null
    expect(shouldWakeRefresh()).toBe(false);
  });
});

describe("Idle — initVisibility", () => {
  it("does not throw on multiple calls", async () => {
    const { initVisibility } = await freshIdle();
    expect(() => {
      initVisibility();
      initVisibility();
    }).not.toThrow();
  });

  it("handles visibilitychange to visible without prior hide", async () => {
    const { initVisibility, isPageVisible } = await freshIdle();
    initVisibility();
    // Fire visible event directly (lastHiddenAt is null → wasAway = "")
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isPageVisible()).toBe(true);
  });
});
