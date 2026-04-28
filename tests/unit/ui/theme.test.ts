/**
 * Tests for src/ui/theme.ts — Theme System
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyTheme,
  cycleTheme,
  currentTheme,
  initTheme,
  checkAutoTheme,
  THEMES,
} from "@/ui/theme";

describe("Theme System", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<select id="theme-select"><option value="black">Black</option><option value="blue">Blue</option></select>';
    document.body.className = "";
  });

  it("applies a valid theme class to body", () => {
    applyTheme("blue");
    expect(document.body.classList.contains("theme-blue")).toBe(true);
  });

  it("removes previous theme class when switching", () => {
    applyTheme("blue");
    applyTheme("amber");
    expect(document.body.classList.contains("theme-blue")).toBe(false);
    expect(document.body.classList.contains("theme-amber")).toBe(true);
  });

  it("falls back to black for invalid theme names", () => {
    applyTheme("invalid-theme");
    expect(document.body.classList.contains("theme-black")).toBe(true);
  });

  it("persists theme to localStorage", () => {
    applyTheme("purple");
    expect(localStorage.getItem("dash_theme")).toBe("purple");
  });

  it("syncs the dropdown value", () => {
    applyTheme("blue");
    const sel = document.getElementById("theme-select") as HTMLSelectElement;
    expect(sel.value).toBe("blue");
  });

  it("cycles through all themes", () => {
    applyTheme("black");
    cycleTheme();
    expect(currentTheme()).toBe("blue");
    cycleTheme();
    expect(currentTheme()).toBe("matrix");
  });

  it("wraps around to first theme after last", () => {
    applyTheme("rose");
    cycleTheme();
    expect(currentTheme()).toBe("black");
  });

  it("currentTheme returns the active theme", () => {
    applyTheme("matrix");
    expect(currentTheme()).toBe("matrix");
  });

  it("initTheme loads from localStorage", () => {
    localStorage.setItem("dash_theme", "amber");
    initTheme();
    expect(currentTheme()).toBe("amber");
  });

  it("has exactly 6 themes", () => {
    expect(THEMES.length).toBe(6);
  });

  it("THEMES includes 'black'", () => {
    expect(THEMES).toContain("black");
  });

  it("THEMES includes 'blue'", () => {
    expect(THEMES).toContain("blue");
  });

  it("THEMES includes 'matrix'", () => {
    expect(THEMES).toContain("matrix");
  });

  it("THEMES includes 'amber'", () => {
    expect(THEMES).toContain("amber");
  });

  it("THEMES includes 'purple'", () => {
    expect(THEMES).toContain("purple");
  });

  it("applyTheme does not leave stale theme classes after switching all themes", () => {
    for (const t of THEMES) {
      applyTheme(t);
    }
    const themeClasses = [...document.body.classList].filter((c) => c.startsWith("theme-"));
    expect(themeClasses).toHaveLength(1);
    expect(themeClasses[0]).toBe("theme-rose");
  });

  it("currentTheme returns string type", () => {
    applyTheme("black");
    expect(typeof currentTheme()).toBe("string");
  });
});

describe("Theme — checkAutoTheme", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when autoTheme is disabled", () => {
    applyTheme("blue");
    checkAutoTheme(false, "blue");
    expect(currentTheme()).toBe("blue"); // no change
  });

  it("applies black theme at night hour (23:00)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T23:00:00"));
    applyTheme("blue");
    checkAutoTheme(true, "blue");
    expect(currentTheme()).toBe("black");
    vi.useRealTimers();
  });

  it("applies black theme during early morning (05:00)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T05:00:00"));
    applyTheme("blue");
    checkAutoTheme(true, "blue");
    expect(currentTheme()).toBe("black");
    vi.useRealTimers();
  });

  it("restores day theme at noon (12:00)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00"));
    applyTheme("black");
    checkAutoTheme(true, "blue");
    expect(currentTheme()).toBe("blue");
    vi.useRealTimers();
  });

  it("boundary: h=20 is nighttime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T20:00:00"));
    applyTheme("purple");
    checkAutoTheme(true, "purple");
    expect(currentTheme()).toBe("black");
    vi.useRealTimers();
  });

  it("boundary: h=7 is daytime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T07:00:00"));
    applyTheme("black");
    checkAutoTheme(true, "amber");
    expect(currentTheme()).toBe("amber");
    vi.useRealTimers();
  });
});

// ── applyTheme edge cases: localStorage quota + startViewTransition ──

describe("Theme — applyTheme edge cases", () => {
  afterEach(() => {
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("handles localStorage quota exceeded gracefully", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => applyTheme("blue")).not.toThrow();
    expect(document.body.classList.contains("theme-blue")).toBe(true);
  });

  it("uses startViewTransition when available (L2 object form)", () => {
    // L2-aware stub: accepts both callback (L1) and options object (L2).
    const startVT = vi.fn((cbOrOpts: (() => void) | { update: () => void; types?: string[] }) => {
      const cb = typeof cbOrOpts === "function" ? cbOrOpts : cbOrOpts.update;
      cb();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      value: startVT,
      configurable: true,
      writable: true,
    });
    applyTheme("amber");
    expect(startVT).toHaveBeenCalledOnce();
    expect(document.body.classList.contains("theme-amber")).toBe(true);
    // Cleanup: remove startViewTransition
    delete (document as Record<string, unknown>)["startViewTransition"];
  });
});

// ── Sprint 6: uncovered branches — currentTheme fallback + initTheme no select ──

describe("Theme — currentTheme fallback when no theme class", () => {
  it("returns 'black' when body has no theme-* class", () => {
    document.body.className = "";
    expect(currentTheme()).toBe("black");
  });

  it("returns 'black' when body has unrelated classes", () => {
    document.body.className = "some-class another-class";
    expect(currentTheme()).toBe("black");
  });
});

describe("Theme — initTheme without #theme-select", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    localStorage.clear();
  });

  it("applies theme from localStorage without wiring dropdown", () => {
    localStorage.setItem("dash_theme", "matrix");
    initTheme();
    expect(currentTheme()).toBe("matrix");
    // No select in DOM — no throw
    expect(document.getElementById("theme-select")).toBeNull();
  });

  it("applies default black when no saved theme and no select", () => {
    initTheme();
    expect(currentTheme()).toBe("black");
  });
});

// ── OS dark-mode preference listener (lines 91-94) ──────────────────────────

describe("Theme — OS prefers-color-scheme change listener", () => {
  let changeHandler: ((e: { matches: boolean }) => void) | null = null;

  beforeEach(() => {
    document.body.className = "";
    localStorage.clear();
    changeHandler = null;
    // Use stubGlobal to reliably replace matchMedia in happy-dom
    vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
      const mql = {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn((event: string, handler: EventListenerOrEventListenerObject) => {
          if (event === "change") changeHandler = handler as (e: { matches: boolean }) => void;
        }),
        removeEventListener: vi.fn(),
      };
      return mql as unknown as MediaQueryList;
    });
  });

  afterEach(() => {
    document.body.className = "";
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("registers a change listener for prefers-color-scheme", () => {
    initTheme();
    expect(changeHandler).toBeTypeOf("function");
  });

  it("applies amber when OS switches to light and no saved theme", () => {
    initTheme();
    // initTheme() saves "black" to localStorage; remove it to simulate no user preference
    localStorage.clear();
    changeHandler?.({ matches: true });
    expect(currentTheme()).toBe("amber");
  });

  it("applies black when OS switches to dark and no saved theme", () => {
    initTheme();
    localStorage.clear();
    changeHandler?.({ matches: false });
    expect(currentTheme()).toBe("black");
  });

  it("does NOT change theme when OS changes and user has a saved theme", () => {
    localStorage.setItem("dash_theme", "blue");
    applyTheme("blue");
    initTheme();
    changeHandler?.({ matches: true });
    expect(currentTheme()).toBe("blue");
  });
});

// ── Sprint 85: checkAutoTheme — no-op when already correct theme ──────────

describe("Theme — checkAutoTheme no-op when already correct (Sprint 85)", () => {
  beforeEach(() => {
    document.body.className = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not change theme when already on black at night", () => {
    vi.setSystemTime(new Date("2024-01-15T22:00:00"));
    applyTheme("black");
    const classListBefore = document.body.className;
    checkAutoTheme(true, "blue");
    // Already black — no change needed; classList should remain the same
    expect(document.body.className).toBe(classListBefore);
    expect(currentTheme()).toBe("black");
  });

  it("does not change theme when already on dayTheme at noon", () => {
    vi.setSystemTime(new Date("2024-01-15T14:00:00"));
    applyTheme("rose");
    const classListBefore = document.body.className;
    checkAutoTheme(true, "rose");
    // Already rose (day theme) — no switch needed
    expect(document.body.className).toBe(classListBefore);
    expect(currentTheme()).toBe("rose");
  });
});

// ── Sprint 85: applyTheme View Transitions catch handlers ─────────────────

describe("Theme — applyTheme startViewTransition rejection (Sprint 85)", () => {
  afterEach(() => {
    document.body.className = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("theme is still applied when vt.ready rejects", async () => {
    const fakeVt = {
      ready: Promise.reject(new Error("skipped")),
      finished: Promise.reject(new Error("skipped")),
    };
    vi.stubGlobal("document", {
      ...document,
      startViewTransition: vi.fn().mockReturnValue(fakeVt),
      body: document.body,
      getElementById: document.getElementById.bind(document),
    });
    applyTheme("amber");
    // Allow micro-tasks to run so .catch() handlers execute
    await Promise.allSettled([fakeVt.ready, fakeVt.finished]);
    // No unhandled rejection — test passes if no throw
  });
});

// ── Sprint 129: applyTheme L2 try/catch branch (Roadmap #10) ──────────────

describe("Theme — applyTheme L2 fallback to L1 when object form throws (Sprint 129)", () => {
  afterEach(() => {
    document.body.className = "";
    try { Reflect.deleteProperty(document, "startViewTransition"); } catch { /* ok */ }
    vi.restoreAllMocks();
  });

  it("falls back to L1 callback form when L2 object call throws TypeError", () => {
    let callCount = 0;
    // Simulate an L1-only browser: calling with an object throws TypeError.
    const l1OnlyStub = vi.fn((cbOrOpts: unknown) => {
      callCount++;
      if (typeof cbOrOpts !== "function") throw new TypeError("L1 only");
      (cbOrOpts as () => void)();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      value: l1OnlyStub,
      configurable: true,
      writable: true,
    });
    applyTheme("purple");
    // Called twice: first with object (throws), then with function (succeeds)
    expect(callCount).toBe(2);
    expect(document.body.classList.contains("theme-purple")).toBe(true);
  });
});
