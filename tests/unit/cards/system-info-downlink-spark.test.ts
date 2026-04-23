/**
 * Tests for V13-DATA: 7-reading downlink sparkline in system-info.ts
 *
 * Mocks @/core/history to keep assertions deterministic.
 */

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

// ── DOM helpers ───────────────────────────────────────────────────────────────

function buildDom(downlinkSpark = true) {
  document.body.innerHTML = `
    <div id="sysinfo-online"></div>
    <div id="sysinfo-battery"></div>
    <div id="sysinfo-net"></div>
    ${downlinkSpark ? '<svg id="sysinfo-downlink-spark" viewBox="0 0 44 12"></svg>' : ""}
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

/** Stub navigator.connection with a given downlink value */
function stubConnection(downlink: number | undefined) {
  Object.defineProperty(navigator, "connection", {
    value: { effectiveType: "4g", downlink, rtt: 20 },
    writable: true,
    configurable: true,
  });
}

/** Remove the navigator.connection stub */
function clearConnection() {
  Object.defineProperty(navigator, "connection", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("System-info — downlink sparkline (V13-DATA)", () => {
  beforeEach(() => {
    mockAppend.mockClear();
    mockGet.mockClear();
    mockSparkline.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearConnection();
  });

  it("sysinfo-downlink-spark element is present in DOM", () => {
    buildDom();
    expect(document.getElementById("sysinfo-downlink-spark")).not.toBeNull();
  });

  it("historyAppend is called with 'sysinfo:downlink' when downlink is available", async () => {
    buildDom();
    stubConnection(10.5);
    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockAppend).toHaveBeenCalledWith("sysinfo:downlink", 10.5);
  });

  it("historyGet is called with 'sysinfo:downlink' and limit 7", async () => {
    buildDom();
    stubConnection(5);
    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockGet).toHaveBeenCalledWith("sysinfo:downlink", 7);
  });

  it("sparkline SVG gets innerHTML when historyGet returns ≥2 values", async () => {
    buildDom();
    stubConnection(8);
    mockGet.mockResolvedValue([5, 7, 8]);
    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise<void>((r) => setTimeout(r, 0));
    const sparkEl = document.getElementById("sysinfo-downlink-spark");
    expect(sparkEl?.innerHTML).not.toBe("");
  });

  it("sparkline SVG remains empty when historyGet returns <2 values", async () => {
    buildDom();
    stubConnection(8);
    mockGet.mockResolvedValue([8]); // only 1 point
    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise<void>((r) => setTimeout(r, 0));
    const sparkEl = document.getElementById("sysinfo-downlink-spark");
    expect(sparkEl?.innerHTML).toBe("");
  });

  it("historyAppend is NOT called when downlink is undefined", async () => {
    buildDom();
    stubConnection(undefined);
    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await renderSystemInfo();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockAppend).not.toHaveBeenCalledWith("sysinfo:downlink", expect.anything());
  });

  it("does not throw when sparkline element is absent from DOM", async () => {
    buildDom(false); // no SVG
    stubConnection(5);
    mockGet.mockResolvedValue([3, 4, 5]);
    const { renderSystemInfo } = await import("@/cards/system-info/system-info");
    await expect(renderSystemInfo()).resolves.not.toThrow();
  });
});
