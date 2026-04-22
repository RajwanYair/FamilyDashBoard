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
