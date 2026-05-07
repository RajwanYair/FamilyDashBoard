/**
 * Tests for connection-type sparkline in system-info.ts
 *
 * Verifies:
 *   - encodeConnType maps effectiveType strings to ordinal numbers
 *   - Unknown / empty strings map to 0
 *   - historyAppend is called with the encoded value when effectiveType present
 *   - sysinfo-conntype-spark element is populated when ≥ 2 readings exist
 *   - No DOM error when sysinfo-conntype-spark element is absent
 *
 * */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock history module ───────────────────────────────────────────────────────

const mockAppend = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue([]);
const mockSparkline = vi.fn().mockReturnValue('<polyline points="0,12 22,6 44,0"/>');

vi.mock("@/core/history", () => ({
  historyAppend: (...args: unknown[]) => mockAppend(...args),
  historyGet: (...args: unknown[]) => mockGet(...args),
  sparklineSvg: (...args: unknown[]) => mockSparkline(...args),
  _resetHistoryDb: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDom(withConnSpark = true) {
  document.body.innerHTML = `
    <div id="sysinfo-online"></div>
    <div id="sysinfo-battery"></div>
    <div id="sysinfo-net"></div>
    <svg id="sysinfo-downlink-spark" viewBox="0 0 44 12"></svg>
    ${withConnSpark ? '<svg id="sysinfo-conntype-spark" viewBox="0 0 44 12"></svg>' : ""}
    <div id="sysinfo-uptime"></div>
    <div id="sysinfo-load"></div>
    <div id="sysinfo-browser"></div>
    <div id="sysinfo-viewport"></div>
    <div id="sysinfo-memory"></div>
    <div id="sysinfo-cpu"></div>
    <div id="sysinfo-storage"></div>
    <div id="sysinfo-rtt"></div>
    <div id="sysinfo-heap"></div>
    <div id="sysinfo-gpu"></div>
  `;
}

function stubConnection(effectiveType: string | undefined, downlink = 5) {
  Object.defineProperty(navigator, "connection", {
    value: effectiveType !== undefined ? { effectiveType, downlink, rtt: 20 } : undefined,
    writable: true,
    configurable: true,
  });
}

function restoreConnection() {
  Object.defineProperty(navigator, "connection", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ── encodeConnType ────────────────────────────────────────────────────────────

describe("encodeConnType ", () => {
  let encodeConnType: (ct: string) => number;

  beforeEach(async () => {
    ({ encodeConnType } = await import("@/cards/system-info/system-info"));
  });

  it("encodes '4g' as 4", () => {
    expect(encodeConnType("4g")).toBe(4);
  });

  it("encodes '3g' as 3", () => {
    expect(encodeConnType("3g")).toBe(3);
  });

  it("encodes '2g' as 2", () => {
    expect(encodeConnType("2g")).toBe(2);
  });

  it("encodes 'slow-2g' as 1", () => {
    expect(encodeConnType("slow-2g")).toBe(1);
  });

  it("encodes unknown type as 0", () => {
    expect(encodeConnType("5g")).toBe(0);
  });

  it("encodes empty string as 0", () => {
    expect(encodeConnType("")).toBe(0);
  });
});

// ── renderSystemInfo: conntype sparkline ──────────────────────────────────────

describe("renderSystemInfo: connection-type sparkline ", () => {
  beforeEach(() => {
    buildDom();
    mockAppend.mockClear();
    mockGet.mockClear();
    mockSparkline.mockClear();
  });

  afterEach(() => {
    restoreConnection();
  });

  it("calls historyAppend('sysinfo:conntype') with encoded 4g value", async () => {
    stubConnection("4g");
    mockGet.mockResolvedValue([]);

    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await vi.runAllTimersAsync?.().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));

    const conntypeCalls = mockAppend.mock.calls.filter((c) => c[0] === "sysinfo:conntype");
    expect(conntypeCalls.length).toBeGreaterThanOrEqual(1);
    expect(conntypeCalls[0][1]).toBe(4);
  });

  it("populates sysinfo-conntype-spark when 2+ readings exist", async () => {
    stubConnection("4g");
    mockGet.mockImplementation((key: string) => {
      if (key === "sysinfo:conntype") return Promise.resolve([3, 4]);
      return Promise.resolve([]);
    });

    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise((r) => setTimeout(r, 0));

    const sparkEl = document.getElementById("sysinfo-conntype-spark");
    expect(sparkEl).not.toBeNull();
    // sparklineSvg was called for conntype
    const conntypeCalls = mockSparkline.mock.calls.filter(
      (c) => Array.isArray(c[0]) && c[0].includes(4),
    );
    expect(conntypeCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not throw when sysinfo-conntype-spark element is absent", async () => {
    buildDom(false);
    stubConnection("3g");
    mockGet.mockResolvedValue([3, 3, 4]);

    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await expect(renderSystemInfo()).resolves.not.toThrow();
  });

  it("does not call historyAppend sysinfo:conntype when effectiveType is absent", async () => {
    stubConnection(undefined);
    mockGet.mockResolvedValue([]);

    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise((r) => setTimeout(r, 0));

    const conntypeCalls = mockAppend.mock.calls.filter((c) => c[0] === "sysinfo:conntype");
    expect(conntypeCalls.length).toBe(0);
  });
});

// ── HTML: sysinfo-conntype-spark element exists ───────────────────────────────

describe("index.html: sysinfo-conntype-spark element ", () => {
  it("index.html contains sysinfo-conntype-spark SVG element", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __dir = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(resolve(__dir, "..", "..", "..", "src", "index.html"), "utf8");
    expect(html).toMatch(/id="sysinfo-conntype-spark"/);
  });
});
