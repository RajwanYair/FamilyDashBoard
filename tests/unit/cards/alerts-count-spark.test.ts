/**
 * — Alerts 7-day incident count sparkline tests
 *
 * Verifies that loadAlerts():
 *   1. Calls historyAppend("alerts:count", validData.length) on successful fetch.
 *   2. Calls historyGet("alerts:count", 7) to retrieve the rolling window.
 *   3. Sets elSpark.innerHTML when sparkVals.length >= 2.
 *   4. Does NOT update elSpark when sparkVals.length < 2.
 *   5. Does NOT throw when the DOM element is absent (elSpark === null).
 *   6. Passes "var(--negative)" colour to sparklineSvg.
 *   7. Does NOT call historyAppend when the fetch returns an empty array.
 *   8. historyGet is NOT called when validData is empty (historyAppend branch skipped).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock history module ──────────────────────────────────────────────────────

const mockAppend = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue([]);
const mockSparklineSvg = vi.fn().mockReturnValue('<polyline points="0,12 22,6 44,0"/>');

vi.mock("@/core/history", () => ({
  historyAppend: (...args: unknown[]) => mockAppend(...args),
  historyGet: (...args: unknown[]) => mockGet(...args),
  sparklineSvg: (...args: unknown[]) => mockSparklineSvg(...args),
  _resetHistoryDb: vi.fn(),
}));

// ── Mock infrastructure (avoid real network / storage) ───────────────────────

vi.mock("@/core/cache", () => ({
  cGetStale: vi.fn().mockReturnValue(null),
  cSetAsync: vi.fn().mockResolvedValue(undefined),
  cGet: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));

vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
  syncBurst: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock("@/core/idle", () => ({
  isPageVisible: vi.fn().mockReturnValue(true),
  initVisibility: vi.fn(),
  onVisibilityChange: vi.fn(),
  scheduleIdle: vi.fn((fn: () => void) => fn()),
  shouldWakeRefresh: vi.fn().mockReturnValue(false),
}));

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/core/trusted-types", () => ({
  trustedHTML: (s: string) => s,
  trustedScript: (s: string) => s,
}));

vi.mock("@/core/constants", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/core/constants")>();
  return {
    ...orig,
    isWorkerEnabled: () => false,
    WORKER_BASE_URL: "https://worker.test",
    API: { ALERTS: "https://alerts.test/alerts" },
    PROXIES: [],
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

type AlertsPayload = Array<{
  id: string;
  alerts: Array<{ cities: string[]; threat: number; time: number }>;
}>;

/** Build a minimal valid alerts payload with `count` events. */
function makeAlerts(count: number): AlertsPayload {
  return Array.from({ length: count }, (_, i) => ({
    id: `ev-${i}`,
    alerts: [{ cities: ["Tel Aviv"], threat: 1, time: Math.floor(Date.now() / 1000) - i * 60 }],
  }));
}

/** Mount the minimal DOM needed by cacheDom() and renderAlerts(). */
function buildDom(withSparkEl = true): void {
  document.body.innerHTML = `
    <div id="alerts-scroll"></div>
    <div id="alerts-badge"></div>
    ${withSparkEl ? '<svg id="alerts-count-spark" viewBox="0 0 44 12"></svg>' : ""}
  `;
}

/** Stub global fetch to return the given payload as JSON. */
function stubFetch(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    }),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Alerts 7-day count sparkline ", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAppend.mockClear();
    mockGet.mockClear();
    mockSparklineSvg.mockClear();
    mockGet.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("calls historyAppend('alerts:count', 3) when 3 valid alerts arrive", async () => {
    buildDom();
    stubFetch(makeAlerts(3));

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();

    await loadAlerts();

    expect(mockAppend).toHaveBeenCalledWith("alerts:count", 3);
  });

  it("calls historyGet('alerts:count', 7) after appending", async () => {
    buildDom();
    stubFetch(makeAlerts(2));

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    expect(mockGet).toHaveBeenCalledWith("alerts:count", 7);
  });

  it("sets elSpark innerHTML when sparkVals has ≥ 2 entries", async () => {
    buildDom();
    stubFetch(makeAlerts(1));
    mockGet.mockResolvedValue([1, 2, 3, 4, 5]);

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    const sparkEl = document.getElementById("alerts-count-spark");
    expect(sparkEl).not.toBeNull();
    expect(sparkEl!.innerHTML).toContain("polyline");
  });

  it("does NOT update elSpark when sparkVals has < 2 entries", async () => {
    buildDom();
    stubFetch(makeAlerts(1));
    mockGet.mockResolvedValue([5]); // only 1 value

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    const sparkEl = document.getElementById("alerts-count-spark");
    expect(sparkEl).not.toBeNull();
    expect(sparkEl!.innerHTML).toBe(""); // untouched
  });

  it("does NOT throw when alerts-count-spark element is absent", async () => {
    buildDom(false); // no spark element
    stubFetch(makeAlerts(2));
    mockGet.mockResolvedValue([1, 2, 3]);

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();

    await expect(loadAlerts()).resolves.not.toThrow();
  });

  it("passes 'var(--negative)' colour string to sparklineSvg", async () => {
    buildDom();
    stubFetch(makeAlerts(1));
    mockGet.mockResolvedValue([3, 7]);

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    expect(mockSparklineSvg).toHaveBeenCalledWith(expect.any(Array), "var(--negative)");
  });

  it("does NOT call historyAppend when fetch returns empty array", async () => {
    buildDom();
    stubFetch([]); // no alerts

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    expect(mockAppend).not.toHaveBeenCalled();
  });

  it("does NOT call historyGet when validData is empty", async () => {
    buildDom();
    stubFetch([]); // empty

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("stores the count of valid (not raw) alerts", async () => {
    // 3 valid events + 1 structurally invalid event
    const payload = [
      ...makeAlerts(3),
      { id: "bad", alerts: "not-an-array" }, // invalid — missing cities/time
    ];
    buildDom();
    stubFetch(payload);

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    // historyAppend should be called with 3 (valid only), not 4
    expect(mockAppend).toHaveBeenCalledWith("alerts:count", 3);
  });

  it("renders sparkline with correct values from historyGet", async () => {
    buildDom();
    stubFetch(makeAlerts(5));
    const sparkVals = [2, 3, 5, 1, 4, 2, 5];
    mockGet.mockResolvedValue(sparkVals);

    const { cacheDom, loadAlerts, _resetAlertsForTest } = await import("@/cards/alerts/alerts");
    _resetAlertsForTest();
    cacheDom();
    await loadAlerts();

    expect(mockSparklineSvg).toHaveBeenCalledWith(sparkVals, "var(--negative)");
  });
});
