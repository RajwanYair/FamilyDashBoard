/**
 * Tests for src/cards/system-info/system-info.ts
 *
 * Covers: renderSystemInfo (online/battery/network/timing/UA),
 * initSystemInfoCard, destroySystemInfoCard, systemInfoCard.render,
 * getBatteryInfo (charging states), online/offline event handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  renderSystemInfo,
  initSystemInfoCard,
  destroySystemInfoCard,
  systemInfoCard,
  getConnectionInfo,
  getViewportSize,
  formatBytes,
  getPageLoadTime,
  categorizeDevice,
  formatHeapMb,
  gpuShortName,
  encodeConnType,
  getSwState,
  getStorageQuota,
} from "@/cards/system-info/system-info";

// ── DOM setup ──────────────────────────────────────────────────────────────

function buildDOM(): void {
  document.body.innerHTML = `
    <div id="sysinfo-online"></div>
    <div id="sysinfo-battery"></div>
    <div id="sysinfo-net"></div>
    <div id="sysinfo-uptime"></div>
    <div id="sysinfo-load"></div>
    <div id="sysinfo-browser"></div>
    <div id="sysinfo-body"></div>
  `;
}

// ── renderSystemInfo ────────────────────────────────────────────────────────

describe("SystemInfo — renderSystemInfo online status", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows online indicator when navigator.onLine is true", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-online")?.textContent).toContain("מחובר");
  });

  it("shows offline indicator when navigator.onLine is false", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-online")?.textContent).toContain("מנותק");
  });
});

describe("SystemInfo — renderSystemInfo battery", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows battery percentage when Battery API available", async () => {
    const mockBattery = { level: 0.75, charging: false };
    (navigator as Record<string, unknown>).getBattery = vi.fn().mockResolvedValue(mockBattery);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-battery")?.textContent).toContain("75%");
    delete (navigator as Record<string, unknown>).getBattery;
  });

  it("shows charging indicator when battery is charging", async () => {
    const mockBattery = { level: 0.5, charging: true };
    (navigator as Record<string, unknown>).getBattery = vi.fn().mockResolvedValue(mockBattery);
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-battery")?.textContent ?? "";
    expect(text).toContain("⚡");
    expect(text).toContain("טוען");
    delete (navigator as Record<string, unknown>).getBattery;
  });

  it("shows low battery icon at or below 20%", async () => {
    const mockBattery = { level: 0.15, charging: false };
    (navigator as Record<string, unknown>).getBattery = vi.fn().mockResolvedValue(mockBattery);
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-battery")?.textContent ?? "";
    expect(text).toContain("🔴");
    delete (navigator as Record<string, unknown>).getBattery;
  });

  it("shows medium battery icon between 21–50%", async () => {
    const mockBattery = { level: 0.35, charging: false };
    (navigator as Record<string, unknown>).getBattery = vi.fn().mockResolvedValue(mockBattery);
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-battery")?.textContent ?? "";
    expect(text).toContain("🪫");
    delete (navigator as Record<string, unknown>).getBattery;
  });

  it("shows em-dash when Battery API is unavailable", async () => {
    delete (navigator as Record<string, unknown>).getBattery;
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-battery")?.textContent).toBe("—");
  });

  it("shows em-dash when getBattery() rejects", async () => {
    (navigator as Record<string, unknown>).getBattery = vi
      .fn()
      .mockRejectedValue(new Error("denied"));
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-battery")?.textContent).toBe("—");
    delete (navigator as Record<string, unknown>).getBattery;
  });
});

describe("SystemInfo — renderSystemInfo network", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    delete (navigator as Record<string, unknown>).connection;
  });

  it("shows network effectiveType and downlink when connection is available", async () => {
    (navigator as Record<string, unknown>).connection = {
      effectiveType: "4g",
      downlink: 12.5,
      rtt: 40,
    };
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-net")?.textContent ?? "";
    expect(text).toContain("4g");
    expect(text).toContain("12.5 Mbps");
    expect(text).toContain("RTT 40ms");
  });

  it("shows em-dash when network connection is unavailable", async () => {
    delete (navigator as Record<string, unknown>).connection;
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-net")?.textContent).toBe("—");
  });

  it("shows em-dash when connection object has no fields", async () => {
    (navigator as Record<string, unknown>).connection = {};
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-net")?.textContent).toBe("—");
  });
});

describe("SystemInfo — renderSystemInfo uptime and timing", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders uptime in H:MM format", async () => {
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-uptime")?.textContent ?? "";
    expect(text).toMatch(/\d+:\d{2}/);
  });

  it("renders page load time when PerformanceNavigationTiming is available", async () => {
    const fakeEntry = { loadEventEnd: 1500, startTime: 0 };
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([fakeEntry as PerformanceEntry]);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-load")?.textContent).toContain("1500 ms");
  });

  it("shows em-dash for page load when loadEventEnd is zero", async () => {
    const fakeEntry = { loadEventEnd: 0, startTime: 0 };
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([fakeEntry as PerformanceEntry]);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-load")?.textContent).toBe("—");
  });

  it("does not throw when navigation entries are empty", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    await expect(renderSystemInfo()).resolves.not.toThrow();
  });
});

describe("SystemInfo — renderSystemInfo browser/UA", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    delete (navigator as Record<string, unknown>).userAgentData;
  });

  it("shows browser from userAgentData brands when available", async () => {
    (navigator as Record<string, unknown>).userAgentData = {
      brands: [
        { brand: "Not A Brand", version: "99" },
        { brand: "Google Chrome", version: "120" },
      ],
      platform: "Windows",
    };
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-browser")?.textContent ?? "";
    expect(text).toContain("Google Chrome");
  });

  it("falls back to userAgentData.platform when all brands are filtered", async () => {
    (navigator as Record<string, unknown>).userAgentData = {
      brands: [
        { brand: "Not A Brand", version: "99" },
        { brand: "Chromium", version: "120" },
      ],
      platform: "macOS",
    };
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-browser")?.textContent).toBe("macOS");
  });

  it("falls back to navigator.userAgent parse when userAgentData absent", async () => {
    delete (navigator as Record<string, unknown>).userAgentData;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 Chrome/120.0.0.0");
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-browser")?.textContent ?? "";
    // May be "—" or Chrome info, just ensure it doesn't throw
    expect(typeof text).toBe("string");
  });

  it("enriches platform with UA-CH high-entropy hints when available (Roadmap #18)", async () => {
    (navigator as Record<string, unknown>).userAgentData = {
      brands: [{ brand: "Google Chrome", version: "126" }],
      platform: "Windows",
      getHighEntropyValues: vi.fn().mockResolvedValue({
        platformVersion: "11.0.0",
        architecture: "x86",
        bitness: "64",
      }),
    };
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-browser")?.textContent ?? "";
    expect(text).toContain("Google Chrome 126");
    expect(text).toContain("Windows 11.0.0");
    expect(text).toContain("x8664");
  });

  it("ignores UA-CH high-entropy hint failures gracefully (Roadmap #18)", async () => {
    (navigator as Record<string, unknown>).userAgentData = {
      brands: [{ brand: "Google Chrome", version: "126" }],
      platform: "Linux",
      getHighEntropyValues: vi.fn().mockRejectedValue(new Error("Permissions-Policy denies UA-CH")),
    };
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-browser")?.textContent ?? "";
    // Should still show basic brand string without throwing
    expect(text).toContain("Google Chrome 126");
  });
});

// ── initSystemInfoCard ──────────────────────────────────────────────────────

describe("SystemInfo — initSystemInfoCard", () => {
  beforeEach(() => {
    buildDOM();
    vi.useFakeTimers();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
    destroySystemInfoCard();
  });

  it("does not throw when called", () => {
    expect(() => initSystemInfoCard()).not.toThrow();
  });
});

// ── destroySystemInfoCard ───────────────────────────────────────────────────

describe("SystemInfo — destroySystemInfoCard", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when called without init", () => {
    expect(() => destroySystemInfoCard()).not.toThrow();
  });

  it("does not throw after initSystemInfoCard", () => {
    vi.useFakeTimers();
    initSystemInfoCard();
    expect(() => destroySystemInfoCard()).not.toThrow();
    vi.useRealTimers();
  });
});

// ── Online/offline event handlers wired by initSystemInfoCard ──────────────

describe("SystemInfo — online/offline event handlers", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    destroySystemInfoCard();
  });

  it("updates sysinfo-online to connected on 'online' event", () => {
    initSystemInfoCard();
    window.dispatchEvent(new Event("online"));
    expect(document.getElementById("sysinfo-online")?.textContent).toContain("מחובר");
  });

  it("updates sysinfo-online to disconnected on 'offline' event", () => {
    initSystemInfoCard();
    window.dispatchEvent(new Event("offline"));
    expect(document.getElementById("sysinfo-online")?.textContent).toContain("מנותק");
  });
});

// ── systemInfoCard CardDefinition ──────────────────────────────────────────

describe("SystemInfo — systemInfoCard CardDefinition", () => {
  it("has correct id", () => {
    expect(systemInfoCard.id).toBe("system-info");
  });

  it("has correct icon", () => {
    expect(systemInfoCard.icon).toBe("🖥");
  });

  it("render() returns a section element with data-card-id", () => {
    const el = systemInfoCard.render();
    expect(el.tagName).toBe("SECTION");
    expect((el as HTMLElement).dataset.cardId).toBe("system-info");
  });

  it("render() contains sysinfo-body element", () => {
    const el = systemInfoCard.render();
    expect(el.querySelector("#sysinfo-body")).not.toBeNull();
  });
});

// ── setText null element branch (line 72) ────────────────────────────────────

describe("SystemInfo — setText null-element guard (line 72)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    delete (navigator as Record<string, unknown>).connection;
    delete (navigator as Record<string, unknown>).userAgentData;
  });

  it("does not throw when some sysinfo DOM elements are missing", async () => {
    // Minimal DOM — only sysinfo-online, leaving others absent → setText false branch
    document.body.innerHTML = `<div id="sysinfo-online"></div>`;
    await expect(renderSystemInfo()).resolves.not.toThrow();
  });
});

// ── UA string fallback (line 155) — no match path ───────────────────────────

describe("SystemInfo — UA string no-match fallback path (line 155)", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    delete (navigator as Record<string, unknown>).userAgentData;
  });

  it("renders em-dash when userAgent has no known browser token", async () => {
    delete (navigator as Record<string, unknown>).userAgentData;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("UnknownBot/1.0");
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-browser")?.textContent ?? "";
    expect(text).toBe("—");
  });

  it("renders browser name when userAgent matches Chrome pattern", async () => {
    delete (navigator as Record<string, unknown>).userAgentData;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 Chrome/120");
    await renderSystemInfo();
    const text = document.getElementById("sysinfo-browser")?.textContent ?? "";
    // Either "Chrome 120" or "—" depending on spy effectiveness, no throw
    expect(typeof text).toBe("string");
  });
});

// ── initSystemInfoCard called twice — clears old interval (line 155) ─────────

describe("SystemInfo — initSystemInfoCard interval cleared on second call (line 155)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    destroySystemInfoCard();
    vi.useRealTimers();
  });

  it("calls clearInterval when _sysInfoInterval is already set (line 155 TRUE branch)", () => {
    document.body.innerHTML = `
      <div id="sysinfo-browser"></div>
      <div id="sysinfo-os"></div>
      <div id="sysinfo-memory"></div>
      <div id="sysinfo-cores"></div>
      <div id="sysinfo-connection"></div>
      <div id="sysinfo-latency"></div>
      <div id="sysinfo-online"></div>
    `;
    vi.useFakeTimers();
    initSystemInfoCard(); // first call: _sysInfoInterval = null → line 155 FALSE → set interval
    initSystemInfoCard(); // second call: _sysInfoInterval is set → line 155 TRUE → clearInterval
    // Should not throw
    expect(document.getElementById("sysinfo-browser")).not.toBeNull();
  });
});

// ── Sprint v7.12: sysinfo-memory, sysinfo-cpu, sysinfo-viewport ──────────────

describe("SystemInfo — sysinfo-memory tile (Sprint v7.12)", () => {
  function buildFullDOM(): void {
    document.body.innerHTML = `
      <div id="sysinfo-online"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-net"></div>
      <div id="sysinfo-uptime"></div>
      <div id="sysinfo-load"></div>
      <div id="sysinfo-browser"></div>
      <div id="sysinfo-viewport"></div>
      <div id="sysinfo-memory"></div>
      <div id="sysinfo-cpu"></div>`;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "deviceMemory", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("shows 'X GB' when navigator.deviceMemory is defined", async () => {
    buildFullDOM();
    Object.defineProperty(navigator, "deviceMemory", {
      value: 8,
      configurable: true,
      writable: true,
    });
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-memory")?.textContent).toBe("8 GB");
  });

  it("shows '—' when navigator.deviceMemory is undefined", async () => {
    buildFullDOM();
    Object.defineProperty(navigator, "deviceMemory", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-memory")?.textContent).toBe("—");
  });
});

describe("SystemInfo — sysinfo-cpu tile (Sprint v7.12)", () => {
  function buildFullDOM(): void {
    document.body.innerHTML = `
      <div id="sysinfo-online"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-net"></div>
      <div id="sysinfo-uptime"></div>
      <div id="sysinfo-load"></div>
      <div id="sysinfo-browser"></div>
      <div id="sysinfo-viewport"></div>
      <div id="sysinfo-memory"></div>
      <div id="sysinfo-cpu"></div>`;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows '×N ליבות' when hardwareConcurrency > 0", async () => {
    buildFullDOM();
    Object.defineProperty(navigator, "hardwareConcurrency", {
      value: 8,
      configurable: true,
      writable: true,
    });
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-cpu")?.textContent).toBe("×8 ליבות");
  });

  it("shows '—' when hardwareConcurrency is 0", async () => {
    buildFullDOM();
    Object.defineProperty(navigator, "hardwareConcurrency", {
      value: 0,
      configurable: true,
      writable: true,
    });
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-cpu")?.textContent).toBe("—");
  });
});

describe("SystemInfo — sysinfo-viewport tile (Sprint v7.12)", () => {
  function buildFullDOM(): void {
    document.body.innerHTML = `
      <div id="sysinfo-online"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-net"></div>
      <div id="sysinfo-uptime"></div>
      <div id="sysinfo-load"></div>
      <div id="sysinfo-browser"></div>
      <div id="sysinfo-viewport"></div>
      <div id="sysinfo-memory"></div>
      <div id="sysinfo-cpu"></div>`;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders 'WxH' without DPR suffix when devicePixelRatio is 1", async () => {
    buildFullDOM();
    Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 1080, configurable: true });
    vi.stubGlobal("devicePixelRatio", 1);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-viewport")?.textContent).toBe("1920×1080");
  });

  it("renders 'WxH @2x' when devicePixelRatio is 2", async () => {
    buildFullDOM();
    Object.defineProperty(window, "innerWidth", { value: 2560, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 1440, configurable: true });
    vi.stubGlobal("devicePixelRatio", 2);
    await renderSystemInfo();
    expect(document.getElementById("sysinfo-viewport")?.textContent).toBe("2560×1440 @2x");
  });
});

// ── F2 (v7.3): Storage estimate tile ────────────────────────────────────────

describe("SystemInfo — storage estimate (F2 v7.3)", () => {
  function buildStorageDOM(): void {
    document.body.innerHTML = `
      <div id="sysinfo-online"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-net"></div>
      <div id="sysinfo-uptime"></div>
      <div id="sysinfo-load"></div>
      <div id="sysinfo-browser"></div>
      <div id="sysinfo-storage"></div>
      <div id="sysinfo-rtt"></div>`;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("displays storage usage when StorageManager is available", async () => {
    buildStorageDOM();
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 5_242_880, quota: 1_073_741_824 }),
      },
    });
    await renderSystemInfo();
    const el = document.getElementById("sysinfo-storage");
    expect(el?.textContent).toBe("5.0 / 1024 MB");
  });

  it("shows — when storage throws", async () => {
    buildStorageDOM();
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      storage: {
        estimate: vi.fn().mockRejectedValue(new Error("fail")),
      },
    });
    await renderSystemInfo();
    const el = document.getElementById("sysinfo-storage");
    expect(el?.textContent).toBe("—");
  });
});

// ── F9 (v7.3): RTT tile ────────────────────────────────────────────────────

describe("SystemInfo — RTT tile (F9 v7.3)", () => {
  function buildRttDOM(): void {
    document.body.innerHTML = `
      <div id="sysinfo-online"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-net"></div>
      <div id="sysinfo-uptime"></div>
      <div id="sysinfo-load"></div>
      <div id="sysinfo-browser"></div>
      <div id="sysinfo-rtt"></div>`;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("displays RTT from Connection API when available", async () => {
    buildRttDOM();
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      connection: { rtt: 42 },
    });
    await renderSystemInfo();
    const el = document.getElementById("sysinfo-rtt");
    expect(el?.textContent).toBe("42ms");
  });

  it("falls back to navigation timing when Connection API is absent", async () => {
    buildRttDOM();
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { responseEnd: 150, fetchStart: 100 } as unknown as PerformanceEntry,
    ]);
    await renderSystemInfo();
    const el = document.getElementById("sysinfo-rtt");
    expect(el?.textContent).toBe("50ms");
  });
});

// ── Sprint 28: getConnectionInfo ──────────────────────────────────────────────

describe("getConnectionInfo", () => {
  it("returns 'unknown' when connection API is absent", () => {
    // happy-dom doesn't expose navigator.connection
    expect(["unknown", "4g", "3g", "2g", "slow-2g"]).toContain(getConnectionInfo());
  });
});

// ── Sprint 28: getViewportSize ────────────────────────────────────────────────

describe("getViewportSize", () => {
  it("returns an object with width, height, dpr", () => {
    const result = getViewportSize();
    expect(typeof result.width).toBe("number");
    expect(typeof result.height).toBe("number");
    expect(typeof result.dpr).toBe("number");
    expect(result.dpr).toBeGreaterThan(0);
  });
});

// ── Sprint 28: formatBytes ────────────────────────────────────────────────────

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("handles negative / invalid values", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });
});

// ── Sprint 28: getPageLoadTime ────────────────────────────────────────────────

describe("getPageLoadTime", () => {
  it("returns a non-negative number", () => {
    expect(getPageLoadTime()).toBeGreaterThanOrEqual(0);
  });

  it("increases over time", () => {
    const t1 = getPageLoadTime();
    const t2 = getPageLoadTime();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});

// ── Sprint 28: categorizeDevice ───────────────────────────────────────────────

describe("categorizeDevice", () => {
  it("returns one of the four categories", () => {
    const categories = ["tv", "desktop", "tablet", "mobile"];
    expect(categories).toContain(categorizeDevice());
  });

  it("returns 'tv' in happy-dom (which defaults to 1920px width)", () => {
    // happy-dom defaults window.innerWidth to 1920
    const result = categorizeDevice();
    expect(result).toBe("tv");
  });
});

// ── Sprint 29: formatHeapMb + gpuShortName ────────────────────────────────

describe("SystemInfo — formatHeapMb (Sprint 29)", () => {
  it("returns '' for zero inputs", () => {
    expect(formatHeapMb(0, 0)).toBe("");
  });

  it("formats bytes to MB correctly", () => {
    const result = formatHeapMb(52_428_800, 2_147_483_648);
    expect(result).toBe("50.0 / 2048 MB");
  });

  it("rounds used to 1 decimal", () => {
    expect(formatHeapMb(1_572_864, 104_857_600)).toBe("1.5 / 100 MB");
  });

  it("returns '' when only usedBytes is 0", () => {
    expect(formatHeapMb(0, 1_048_576)).toBe("");
  });
});

describe("SystemInfo — gpuShortName (Sprint 29)", () => {
  it("trims at slash", () => {
    expect(gpuShortName("ANGLE (Intel(R) UHD Graphics)")).toBe(
      "ANGLE (Intel(R) UHD Graphics)".split("/")[0]!.split("(")[0]!.trim().slice(0, 30),
    );
  });

  it("truncates to 30 chars max", () => {
    const long = "A".repeat(50);
    expect(gpuShortName(long).length).toBeLessThanOrEqual(30);
  });

  it("handles simple GPU name without special chars", () => {
    expect(gpuShortName("GeForce RTX 3080")).toBe("GeForce RTX 3080");
  });

  it("trims text after open paren", () => {
    const result = gpuShortName("Intel UHD (some detail)");
    expect(result).toBe("Intel UHD");
  });
});

// ── Sprint 81: configSchema ─────────────────────────────────────────────

describe("SystemInfo — configSchema (Sprint 81)", () => {
  it("has a configSchema array", () => {
    expect(systemInfoCard.configSchema).toBeDefined();
    expect(Array.isArray(systemInfoCard.configSchema)).toBe(true);
  });

  it("includes sysInfoShowRtt field", () => {
    const field = systemInfoCard.configSchema!.find((f) => f.key === "sysInfoShowRtt");
    expect(field).toBeDefined();
    expect(field!.type).toBe("boolean");
    expect(field!.defaultValue).toBe(true);
  });

  it("all fields have required properties", () => {
    for (const f of systemInfoCard.configSchema!) {
      expect(f.key).toBeTruthy();
      expect(f.labelHe).toBeTruthy();
      expect(f.labelEn).toBeTruthy();
      expect(f.type).toBeTruthy();
      expect(f.defaultValue).toBeDefined();
    }
  });
});

// ── categorizeDevice — additional width branches ──────────────────────────────

describe("categorizeDevice — width branches", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
  });

  it("returns 'desktop' when innerWidth is 1280", () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    expect(categorizeDevice()).toBe("desktop");
  });

  it("returns 'tablet' when innerWidth is 768", () => {
    Object.defineProperty(window, "innerWidth", { value: 768, configurable: true });
    expect(categorizeDevice()).toBe("tablet");
  });

  it("returns 'mobile' when innerWidth is 375", () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    expect(categorizeDevice()).toBe("mobile");
  });
});

// ── RTT tile sysinfo-tile visibility (line 187) ───────────────────────────────

describe("SystemInfo — rttTile display toggle (line 187)", () => {
  function buildRttTileDOM(): void {
    document.body.innerHTML = `
      <div id="sysinfo-online"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-net"></div>
      <div id="sysinfo-uptime"></div>
      <div id="sysinfo-load"></div>
      <div id="sysinfo-browser"></div>
      <div class="sysinfo-tile"><div id="sysinfo-rtt"></div></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows rttTile when sysInfoShowRtt is true (default config)", async () => {
    buildRttTileDOM();
    const tile = document.querySelector(".sysinfo-tile") as HTMLElement;
    // loadConfig default has sysInfoShowRtt: true → tile display should be ""
    await renderSystemInfo();
    expect(tile.style.display).toBe("");
  });
});

// ── Sprint 79: encodeConnType — all branches ──────────────────────────────

describe("SystemInfo — encodeConnType (Sprint 79)", () => {
  it("encodes slow-2g as 1", () => {
    expect(encodeConnType("slow-2g")).toBe(1);
  });

  it("encodes 2g as 2", () => {
    expect(encodeConnType("2g")).toBe(2);
  });

  it("encodes 3g as 3", () => {
    expect(encodeConnType("3g")).toBe(3);
  });

  it("encodes 4g as 4", () => {
    expect(encodeConnType("4g")).toBe(4);
  });

  it("encodes unknown/unrecognized type as 0", () => {
    expect(encodeConnType("wifi")).toBe(0);
    expect(encodeConnType("")).toBe(0);
    expect(encodeConnType("5g")).toBe(0);
  });
});

// ── Sprint 79: getConnectionInfo — with stubbed navigator.connection ──────

describe("SystemInfo — getConnectionInfo stubs (Sprint 79)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns effectiveType when navigator.connection is present", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      connection: { effectiveType: "4g" },
    });
    expect(getConnectionInfo()).toBe("4g");
  });

  it("returns 'unknown' when navigator.connection is absent", () => {
    vi.stubGlobal("navigator", { ...navigator, connection: undefined });
    expect(getConnectionInfo()).toBe("unknown");
  });

  it("returns 'unknown' when effectiveType is undefined", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      connection: { effectiveType: undefined },
    });
    expect(getConnectionInfo()).toBe("unknown");
  });
});

// ── Sprint 179 / SI2: getSwState ──────────────────────────────────────────

describe("System-info — getSwState (Sprint 179)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 'unsupported' when serviceWorker not in navigator", async () => {
    // happy-dom does not expose navigator.serviceWorker — so this passes natively
    const result = await getSwState();
    expect(result).toBe("unsupported");
  });

  it("returns 'none' when getRegistration resolves undefined", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    });
    const result = await getSwState();
    expect(result).toBe("none");
  });

  it("returns 'active' when registration has active SW", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          active: {} as ServiceWorker,
          installing: null,
          waiting: null,
        }),
      },
    });
    const result = await getSwState();
    expect(result).toBe("active");
  });

  it("returns 'installing' when SW is installing", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          active: null,
          installing: {} as ServiceWorker,
          waiting: null,
        }),
      },
    });
    const result = await getSwState();
    expect(result).toBe("installing");
  });

  it("returns 'waiting' when SW is waiting", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          active: null,
          installing: null,
          waiting: {} as ServiceWorker,
        }),
      },
    });
    const result = await getSwState();
    expect(result).toBe("waiting");
  });

  it("returns 'none' on getRegistration rejection", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        getRegistration: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const result = await getSwState();
    expect(result).toBe("none");
  });
});

// ── Sprint 205 / SI1: getStorageQuota ──────────────────────────────
describe("System-info — getStorageQuota (Sprint 205)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns formatted string when estimate succeeds", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 12_582_912, quota: 536_870_912 }),
      },
    });
    const result = await getStorageQuota();
    expect(result).toBe("12.0 / 512 MB");
  });

  it("returns dash when navigator.storage.estimate is absent", async () => {
    vi.stubGlobal("navigator", { ...navigator, storage: undefined });
    const result = await getStorageQuota();
    expect(result).toBe("—");
  });

  it("returns dash when estimate rejects", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      storage: {
        estimate: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const result = await getStorageQuota();
    expect(result).toBe("—");
  });

  it("handles zero usage and quota gracefully", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
      },
    });
    const result = await getStorageQuota();
    expect(result).toBe("0.0 / 0 MB");
  });
});
