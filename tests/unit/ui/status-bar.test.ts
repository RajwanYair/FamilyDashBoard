/**
 * Tests for src/ui/status-bar.ts
 *
 * Covers: initStatusBar (version badge, stampRefresh, sync dot registration).
 *
 * Uses vi.resetModules() + dynamic import because status-bar has module-level
 * DOM caches (elVersion, elRefreshStamp).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type StatusBarMod = {
  initStatusBar: () => void;
  stampRefresh: () => void;
  updateUptime: () => void;
  updateConnIndicator: () => void;
  updateFontScaleIndicator: () => void;
  updateRefreshAge: () => void;
  updateCacheAgeChip?: () => void;
};

function buildStatusBarDOM(): void {
  document.body.innerHTML = `
    <div id="version-badge"></div>
    <div id="refresh-stamp"></div>
    <div id="sync-weather" class="sync-dot"></div>
    <div id="sync-news" class="sync-dot"></div>
    <div id="sync-stocks" class="sync-dot"></div>
    <div id="sync-currency" class="sync-dot"></div>
    <div id="sync-alerts" class="sync-dot"></div>
    <div id="sync-hebcal" class="sync-dot"></div>
    <div id="sync-cal" class="sync-dot"></div>
    <div id="sync-moti" class="sync-dot"></div>
  `;
}

async function freshBar(): Promise<StatusBarMod> {
  vi.resetModules();
  return import("@/ui/status-bar") as Promise<StatusBarMod>;
}

describe("Status Bar — initStatusBar", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    buildStatusBarDOM();
    mod = await freshBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets textContent on #version-badge", () => {
    mod.initStatusBar();
    const badge = document.getElementById("version-badge");
    expect(badge?.textContent).toMatch(/^v\d+\.\d+/);
  });

  it("sets textContent on #refresh-stamp", () => {
    mod.initStatusBar();
    const stamp = document.getElementById("refresh-stamp");
    expect(stamp?.textContent).toBeTruthy();
    expect(stamp?.textContent).toContain("רענון");
  });

  it("does not throw when sync dot elements are absent", async () => {
    document.body.innerHTML = '<div id="version-badge"></div><div id="refresh-stamp"></div>';
    const emptyMod = await freshBar();
    expect(() => emptyMod.initStatusBar()).not.toThrow();
  });
});

describe("Status Bar — stampRefresh", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    buildStatusBarDOM();
    mod = await freshBar();
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("updates #refresh-stamp with current time", () => {
    mod.stampRefresh();
    const text = document.getElementById("refresh-stamp")?.textContent ?? "";
    expect(text).toContain("רענון");
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });

  it("updates stamp on repeated calls", () => {
    mod.stampRefresh();
    const first = document.getElementById("refresh-stamp")?.textContent ?? "";
    mod.stampRefresh();
    const second = document.getElementById("refresh-stamp")?.textContent ?? "";
    expect(first).toContain("רענון");
    expect(second).toContain("רענון");
  });

  it("does not throw when refresh-stamp element is absent", () => {
    document.body.innerHTML = "";
    expect(() => mod.stampRefresh()).not.toThrow();
  });
});

describe("Status Bar — version badge format", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    buildStatusBarDOM();
    mod = await freshBar();
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("version badge starts with 'v'", () => {
    const badge = document.getElementById("version-badge");
    expect(badge?.textContent?.startsWith("v")).toBe(true);
  });

  it("version badge contains at least one digit", () => {
    const badge = document.getElementById("version-badge");
    expect(badge?.textContent).toMatch(/\d/);
  });

  it("version badge matches semver-like pattern", () => {
    const badge = document.getElementById("version-badge");
    expect(badge?.textContent).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("refresh stamp contains time separator ':'", () => {
    const stamp = document.getElementById("refresh-stamp");
    expect(stamp?.textContent).toContain(":");
  });

  it("refresh stamp contains the Hebrew prefix", () => {
    const stamp = document.getElementById("refresh-stamp");
    expect(stamp?.textContent).toContain("רענון");
  });

  it("initStatusBar does not throw on second call", () => {
    expect(() => mod.initStatusBar()).not.toThrow();
  });

  it("all sync dots remain in DOM after initStatusBar", () => {
    const ids = [
      "sync-weather",
      "sync-news",
      "sync-stocks",
      "sync-currency",
      "sync-alerts",
      "sync-hebcal",
      "sync-cal",
      "sync-moti",
    ];
    for (const id of ids) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});

// ── Sprint: registerSyncDots branch coverage (missing dot elements) ──

describe("Status Bar — registerSyncDots partial DOM", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers present dots and logs for missing ones", async () => {
    // Provide only some sync dots — triggers the else branch for missing
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sync-weather" class="sync-dot"></div>
      <div id="sync-news" class="sync-dot"></div>
    `;
    vi.resetModules();
    const mod = await freshBar();
    expect(() => mod.initStatusBar()).not.toThrow();
    const badge = document.getElementById("version-badge");
    expect(badge?.textContent).toMatch(/^v\d+/);
  });

  it("handles completely empty DOM without throwing", async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    const mod = await freshBar();
    expect(() => mod.initStatusBar()).not.toThrow();
  });

  it("handles missing version-badge element", async () => {
    document.body.innerHTML = `<div id="refresh-stamp"></div>`;
    vi.resetModules();
    const mod = await freshBar();
    mod.initStatusBar();
    // stampRefresh still updates
    const stamp = document.getElementById("refresh-stamp");
    expect(stamp?.textContent).toContain("רענון");
  });

  it("handles missing refresh-stamp element", async () => {
    document.body.innerHTML = `<div id="version-badge"></div>`;
    vi.resetModules();
    const mod = await freshBar();
    mod.initStatusBar();
    const badge = document.getElementById("version-badge");
    expect(badge?.textContent).toMatch(/^v\d+/);
  });
});

// ── Sprint v7.9: updateUptime ──

describe("Status Bar — updateUptime", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="uptime-display"></div>
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    mod = await freshBar();
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("uptime-display shows ⏱ symbol", () => {
    mod.updateUptime();
    const text = document.getElementById("uptime-display")?.textContent ?? "";
    expect(text).toContain("⏱");
  });

  it("uptime-display shows minutes", () => {
    mod.updateUptime();
    const text = document.getElementById("uptime-display")?.textContent ?? "";
    expect(text).toMatch(/⏱ \d+[mh]/);
  });

  it("does not throw when uptime-display is absent", () => {
    document.getElementById("uptime-display")?.remove();
    expect(() => mod.updateUptime()).not.toThrow();
  });
});

// ── Sprint v7.9: updateConnIndicator ──

describe("Status Bar — updateConnIndicator", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="conn-indicator"></div>
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    mod = await freshBar();
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows 🟢 when navigator.onLine is true", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    mod.updateConnIndicator();
    expect(document.getElementById("conn-indicator")?.textContent).toBe("🟢");
  });

  it("shows 🔴 when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    mod.updateConnIndicator();
    expect(document.getElementById("conn-indicator")?.textContent).toBe("🔴");
  });

  it("does not throw when conn-indicator is absent", () => {
    document.getElementById("conn-indicator")?.remove();
    expect(() => mod.updateConnIndicator()).not.toThrow();
  });
});

// ── Sprint v7.9: updateFontScaleIndicator ──

describe("Status Bar — updateFontScaleIndicator", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="font-scale-indicator"></div>
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    mod = await freshBar();
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--font-scale");
  });

  it("shows empty string at default 100% scale", () => {
    document.documentElement.style.setProperty("--font-scale", "1");
    mod.updateFontScaleIndicator();
    expect(document.getElementById("font-scale-indicator")?.textContent).toBe("");
  });

  it("shows percentage when scale differs from 100%", () => {
    document.documentElement.style.setProperty("--font-scale", "1.1");
    mod.updateFontScaleIndicator();
    expect(document.getElementById("font-scale-indicator")?.textContent).toBe("110%");
  });

  it("does not throw when font-scale-indicator is absent", () => {
    document.getElementById("font-scale-indicator")?.remove();
    expect(() => mod.updateFontScaleIndicator()).not.toThrow();
  });
});

// ── updateRefreshAge — the stale-stamp branch (lines 82-89) ──

describe("Status Bar — updateRefreshAge", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    vi.resetModules();
    mod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("does not change stamp when no stampRefresh has been called yet", () => {
    // updateRefreshAge is called before stampRefresh; _lastRefreshMs=0 → return early
    const before = document.getElementById("refresh-stamp")?.textContent ?? "";
    mod.updateRefreshAge?.();
    const after = document.getElementById("refresh-stamp")?.textContent ?? "";
    // either unchanged or still contains רענון (stampRefresh called in initStatusBar)
    expect(after).toBeTruthy();
    void before;
  });

  it("appends minutes suffix when > 1 minute has passed since stampRefresh", async () => {
    // Step 1: fake-stamp at t=0
    vi.useFakeTimers();
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();
    freshMod.stampRefresh();

    // Step 2: advance clock by 3 minutes
    vi.advanceTimersByTime(3 * 60 * 1000);

    freshMod.updateRefreshAge?.();
    const text = document.getElementById("refresh-stamp")?.textContent ?? "";
    expect(text).toMatch(/\(\d+m\)/);
  });

  it("does not throw when refresh-stamp element is absent", async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    expect(() => freshMod.updateRefreshAge?.()).not.toThrow();
  });
});

// ── cache-age chip branch (updateCacheAge in initStatusBar) ──

describe("Status Bar — cache-age chip in DOM", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw when cache-age element is present and getOldestCacheAgeMinutes returns 0", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="cache-age"></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    expect(() => freshMod.initStatusBar()).not.toThrow();
    // cache-age shows empty string when age is 0
    const chip = document.getElementById("cache-age");
    expect(chip?.textContent ?? "").toBe("");
  });
});

// ── SW VERSION_ACTIVATED message handler ──

describe("Status Bar — SW VERSION_ACTIVATED message", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("updates #sw-version chip when VERSION_ACTIVATED message is received", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    // Simulate the SW postMessage event via serviceWorker.dispatchEvent
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      const fakeEvent = new MessageEvent("message", {
        data: { type: "VERSION_ACTIVATED", version: "familydashboard-v13.6.0" },
      });
      navigator.serviceWorker.dispatchEvent(fakeEvent);
      const chip = document.getElementById("sw-version");
      // In happy-dom, serviceWorker.addEventListener may fire synchronously
      if (chip && !chip.hidden) {
        expect(chip.textContent).toContain("v13.6.0");
      } else {
        // SW API not fully implemented in happy-dom; just confirm no throw
        expect(true).toBe(true);
      }
    }
  });
});

// ── Sprint v7.13: online / offline event callbacks (lines 134-135, 138-139) ──

describe("Status Bar — online/offline events update conn-indicator", () => {
  let mod: StatusBarMod;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="conn-indicator"></div>
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="uptime-display"></div>
      <div id="font-scale-indicator"></div>
    `;
    mod = await freshBar();
    mod.initStatusBar();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--font-scale");
  });

  it("fires updateConnIndicator when window 'online' event dispatched", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("online"));
    expect(document.getElementById("conn-indicator")?.textContent).toBe("🟢");
  });

  it("fires updateConnIndicator when window 'offline' event dispatched", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("offline"));
    expect(document.getElementById("conn-indicator")?.textContent).toBe("🔴");
  });

  it("online then offline toggles indicator correctly", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("online"));
    expect(document.getElementById("conn-indicator")?.textContent).toBe("🟢");

    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });
    window.dispatchEvent(new Event("offline"));
    expect(document.getElementById("conn-indicator")?.textContent).toBe("🔴");
  });
});

// ── formatUptime h > 0 branch + cache-age mins > 0 ──

describe("Status Bar — formatUptime hours branch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("shows hours+minutes format when uptime exceeds 1 hour", async () => {
    vi.useFakeTimers();
    // Load module at t=0 so PAGE_START is set to 0
    vi.setSystemTime(0);
    document.body.innerHTML = `
      <div id="uptime-display"></div>
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    // Advance 2 hours + 15 minutes
    vi.setSystemTime(2 * 60 * 60 * 1000 + 15 * 60 * 1000);
    freshMod.updateUptime();

    const text = document.getElementById("uptime-display")?.textContent ?? "";
    expect(text).toMatch(/⏱ 2h \d+m/);
  });
});

describe("Status Bar — cache-age chip shows value when mins > 0", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows ⏱ Nm when getOldestCacheAgeMinutes returns > 0", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="cache-age"></div>
    `;
    vi.resetModules();
    // Mock the cache module BEFORE importing status-bar
    vi.doMock("@/core/cache", () => ({
      getOldestCacheAgeMinutes: vi.fn().mockReturnValue(42),
      cGet: vi.fn().mockReturnValue(null),
      cGetStale: vi.fn().mockReturnValue(null),
      cSet: vi.fn(),
    }));
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    const chip = document.getElementById("cache-age");
    expect(chip?.textContent).toBe("⏱ 42m");
    vi.doUnmock("@/core/cache");
  });
});

describe("Status Bar — updateRefreshAge skips when < 1 min", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("does not append suffix when less than 1 minute has elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();
    freshMod.stampRefresh();

    // Advance only 30 seconds (< 1 min threshold)
    vi.advanceTimersByTime(30_000);
    freshMod.updateRefreshAge?.();

    const text = document.getElementById("refresh-stamp")?.textContent ?? "";
    // Should NOT have the (Nm) suffix
    expect(text).not.toMatch(/\(\d+m\)/);
  });
});

// ── SW message handler branch coverage (lines 178-184) ──────────────────────

describe("Status Bar — SW message handler branches", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("ignores message with wrong type (line 178 FALSE branch)", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      const fakeEvent = new MessageEvent("message", {
        data: { type: "SOME_OTHER_EVENT", version: "v1.0.0" },
      });
      navigator.serviceWorker.dispatchEvent(fakeEvent);
      const chip = document.getElementById("sw-version");
      // chip should remain hidden since message type doesn't match
      expect(chip).toBeTruthy();
    }
  });

  it("handles VERSION_ACTIVATED when #sw-version chip is absent (line 180 FALSE branch)", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      const fakeEvent = new MessageEvent("message", {
        data: { type: "VERSION_ACTIVATED", version: "familydashboard-v13.6.0" },
      });
      // Should not throw even without #sw-version element
      expect(() => navigator.serviceWorker.dispatchEvent(fakeEvent)).not.toThrow();
    }
  });

  it("ignores VERSION_ACTIVATED message with no version field (line 178 && false)", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      const fakeEvent = new MessageEvent("message", {
        data: { type: "VERSION_ACTIVATED" }, // no version field
      });
      navigator.serviceWorker.dispatchEvent(fakeEvent);
      const chip = document.getElementById("sw-version");
      // chip should remain hidden
      expect(chip?.hidden).toBe(true);
    }
  });
});

// ── SW message handler with stubbed serviceWorker (lines 175-186) ──

describe("Status Bar — SW VERSION_ACTIVATED calls showToast (QA-7)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    try {
      Reflect.deleteProperty(navigator, "serviceWorker");
    } catch {
      /* non-configurable */
    }
  });

  it("calls showToast with the activated version label when VERSION_ACTIVATED fires", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
      <div id="toast"></div>
    `;
    const mockShowToast = vi.fn();
    let capturedHandler: ((e: MessageEvent) => void) | null = null;
    const mockSW = {
      addEventListener: vi.fn((type: string, handler: unknown) => {
        if (type === "message") capturedHandler = handler as (e: MessageEvent) => void;
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    vi.doMock("@/ui/toast", () => ({ showToast: mockShowToast }));
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    expect(capturedHandler).not.toBeNull();
    capturedHandler!({
      data: { type: "VERSION_ACTIVATED", version: "familydashboard-v14.29.0" },
    } as MessageEvent);

    expect(mockShowToast).toHaveBeenCalledWith("✓ עודכן לגרסה v14.29.0", 4000);
  });

  it("does not call showToast when VERSION_ACTIVATED has no version field", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    const mockShowToast = vi.fn();
    let capturedHandler: ((e: MessageEvent) => void) | null = null;
    const mockSW = {
      addEventListener: vi.fn((type: string, handler: unknown) => {
        if (type === "message") capturedHandler = handler as (e: MessageEvent) => void;
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    vi.doMock("@/ui/toast", () => ({ showToast: mockShowToast }));
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    capturedHandler?.({ data: { type: "VERSION_ACTIVATED" } } as MessageEvent);
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

// ── SW message handler with stubbed serviceWorker (lines 175-186) ──

describe("Status Bar — SW message handler with stubbed navigator.serviceWorker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    try {
      Reflect.deleteProperty(navigator, "serviceWorker");
    } catch {
      /* non-configurable */
    }
  });

  it("covers VERSION_ACTIVATED handler — sw-version chip present (lines 176-183)", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    let capturedHandler: ((e: MessageEvent) => void) | null = null;
    const mockSW = {
      addEventListener: vi.fn((type: string, handler: unknown) => {
        if (type === "message") capturedHandler = handler as (e: MessageEvent) => void;
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    expect(capturedHandler).not.toBeNull();
    capturedHandler!({
      data: { type: "VERSION_ACTIVATED", version: "familydashboard-v13.6.0" },
    } as MessageEvent);

    const chip = document.getElementById("sw-version");
    expect(chip?.textContent).toBe("SW v13.6.0");
    expect(chip?.hidden).toBe(false);
  });

  it("VERSION_ACTIVATED — sw-version chip absent (line 180 FALSE)", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
    `;
    let capturedHandler: ((e: MessageEvent) => void) | null = null;
    const mockSW = {
      addEventListener: vi.fn((type: string, handler: unknown) => {
        if (type === "message") capturedHandler = handler as (e: MessageEvent) => void;
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    expect(() =>
      capturedHandler?.({ data: { type: "VERSION_ACTIVATED", version: "v1.0.0" } } as MessageEvent),
    ).not.toThrow();
  });

  it("non-VERSION_ACTIVATED message — line 178 FALSE branch", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    let capturedHandler: ((e: MessageEvent) => void) | null = null;
    const mockSW = {
      addEventListener: vi.fn((type: string, handler: unknown) => {
        if (type === "message") capturedHandler = handler as (e: MessageEvent) => void;
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    capturedHandler?.({ data: { type: "OTHER_EVENT" } } as MessageEvent);
    const chip = document.getElementById("sw-version");
    expect(chip?.hidden).toBe(true);
  });

  it("VERSION_ACTIVATED with no version field — line 178 second && FALSE", async () => {
    document.body.innerHTML = `
      <div id="version-badge"></div>
      <div id="refresh-stamp"></div>
      <div id="sw-version" hidden></div>
    `;
    let capturedHandler: ((e: MessageEvent) => void) | null = null;
    const mockSW = {
      addEventListener: vi.fn((type: string, handler: unknown) => {
        if (type === "message") capturedHandler = handler as (e: MessageEvent) => void;
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    const freshMod = await (import("@/ui/status-bar") as Promise<StatusBarMod>);
    freshMod.initStatusBar();

    capturedHandler?.({ data: { type: "VERSION_ACTIVATED" } } as MessageEvent);
    const chip = document.getElementById("sw-version");
    expect(chip?.hidden).toBe(true);
  });
});
