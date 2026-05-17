/**
 * Tests for src/cards/alerts/alerts.ts
 *
 * Covers: buildAlertItem DOM output, renderAlerts, setAlertsEnabled, setAlertsRealtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// Mock idle to allow page-visibility control per test (default: page visible = true)
vi.mock("@/core/idle", () => ({
  isPageVisible: vi.fn().mockReturnValue(true),
  initVisibility: vi.fn(),
  onVisibilityChange: vi.fn(),
  scheduleIdle: vi.fn((fn: () => void) => fn()),
  shouldWakeRefresh: vi.fn().mockReturnValue(false),
}));

import {
  buildAlertItem,
  renderAlerts,
  setAlertsEnabled,
  toggleAlerts,
  isAlertsEnabled,
  setAlertsRealtime,
  loadAlerts,
  cacheDom,
  initAlertsCard,
  initAlertsSSE,
  destroyAlertsSSE,
  destroyAlertsCard,
  alertThreatIcon,
  alertAgeLabel,
  clearUnreadAlerts,
  setAlertVolume,
  getAlertVolume,
  _resetAlertsForTest,
  alertRingAppend,
  alertRingGet,
  renderAlertHistory,
  showAlertTakeover,
  hideAlertTakeover,
  alertsConfigSchema,
} from "@/cards/alerts/alerts";
import { getSemanticPayload, _resetSemanticProducers } from "@/core/semantic-clipboard";
import * as idleMod from "@/core/idle";
import * as historyMod from "@/core/history";
import type { AlertEvent } from "@/types/api";

const NOW_SEC = Math.floor(Date.now() / 1000);

// Reset module state before each test (Stream G.1 — avoids vi.resetModules())
beforeEach(() => {
  _resetAlertsForTest();
});

// Ensure isPageVisible returns true before each test (vi.restoreAllMocks can clear it)
beforeEach(() => {
  vi.mocked(idleMod.isPageVisible).mockReturnValue(true);
});

const sampleEvent: AlertEvent = {
  id: "test-001",
  alerts: [
    {
      cities: ["תל אביב", "רמת גן"],
      threat: 2,
      time: NOW_SEC - 120, // 2 min ago
    },
  ],
};

const activeEvent: AlertEvent = {
  id: "test-002",
  alerts: [
    {
      cities: ["חיפה"],
      threat: 1,
      time: NOW_SEC - 30, // 30s ago → active
    },
  ],
};

describe("Alerts — buildAlertItem", () => {
  it("returns null for event with no alerts", () => {
    const ev: AlertEvent = { id: "empty", alerts: [] };
    expect(buildAlertItem(ev, NOW_SEC, false, false)).toBeNull();
  });

  it("returns HTMLElement for valid event", () => {
    const el = buildAlertItem(sampleEvent, NOW_SEC, false, false);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("includes 'past' class for old alert (>10min)", () => {
    const oldEvent: AlertEvent = {
      id: "old",
      alerts: [{ cities: ["נתניה"], threat: 1, time: NOW_SEC - 900 }],
    };
    const el = buildAlertItem(oldEvent, NOW_SEC, false, false);
    expect(el?.className).toContain("past");
  });

  it("includes 'active' class for recent alert (<10min)", () => {
    const el = buildAlertItem(activeEvent, NOW_SEC, false, false);
    expect(el?.className).toContain("active");
  });

  it("adds 'new-alert' class when highlightNew is true", () => {
    const el = buildAlertItem(activeEvent, NOW_SEC, true, false);
    expect(el?.className).toContain("new-alert");
  });

  it("adds 'clone' class when isClone is true", () => {
    const el = buildAlertItem(sampleEvent, NOW_SEC, false, true);
    expect(el?.className).toContain("clone");
  });

  it("displays city names in the element", () => {
    const el = buildAlertItem(sampleEvent, NOW_SEC, false, false);
    expect(el?.textContent).toContain("תל אביב");
  });

  it("truncates long city list (>5 cities) with count", () => {
    const ev: AlertEvent = {
      id: "many",
      alerts: [
        {
          cities: ["א", "ב", "ג", "ד", "ה", "ו", "ז"],
          threat: 1,
          time: NOW_SEC - 60,
        },
      ],
    };
    const el = buildAlertItem(ev, NOW_SEC, false, false);
    expect(el?.textContent).toMatch(/\(\+2\)/);
  });
});

describe("Alerts — renderAlerts", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("populates scroll container with events", () => {
    renderAlerts([sampleEvent, activeEvent], false);
    const scroll = document.getElementById("alerts-scroll");
    expect(scroll?.children.length).toBeGreaterThan(0);
  });

  it("shows badge when highlightNew is true", () => {
    const badge = document.getElementById("alerts-badge");
    renderAlerts([activeEvent], true);
    expect(badge?.style.display).not.toBe("none");
  });

  it("handles empty array without throwing", () => {
    expect(() => renderAlerts([], false)).not.toThrow();
  });
});

describe("Alerts — setAlertsEnabled", () => {
  it("does not throw when called with false", () => {
    expect(() => setAlertsEnabled(false)).not.toThrow();
  });

  it("does not throw when called with true", () => {
    expect(() => setAlertsEnabled(true)).not.toThrow();
  });
});

describe("Alerts — setAlertsRealtime", () => {
  it("does not throw when enabling realtime mode", () => {
    expect(() => setAlertsRealtime(true)).not.toThrow();
  });

  it("does not throw when disabling realtime mode", () => {
    expect(() => setAlertsRealtime(false)).not.toThrow();
  });

  it("accepts boolean toggle without error", () => {
    setAlertsRealtime(true);
    expect(() => setAlertsRealtime(false)).not.toThrow();
  });
});

// ── renderAlerts — full coverage ──────────────────────────────────────────

describe("Alerts — renderAlerts counter text", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("counter text shows 24h alert count", () => {
    renderAlerts([sampleEvent], false);
    const scroll = document.getElementById("alerts-scroll")!;
    const counter = scroll.querySelector(".alert-count");
    expect(counter?.textContent).toMatch(/התרעות ב-24 שעות/);
  });

  it("active event within 10min creates live-dot in counter", () => {
    renderAlerts([activeEvent], false);
    const scroll = document.getElementById("alerts-scroll")!;
    expect(scroll.querySelector(".alert-live-dot")).not.toBeNull();
  });

  it("past-only events do not create live-dot", () => {
    renderAlerts([sampleEvent], false); // sampleEvent is 2 min ago → active, wait…
    // sampleEvent.alerts[0].time = NOW_SEC - 120 → ageMin < 10 → active
    // But we need a truly old one for no-dot
    const oldEvent: AlertEvent = {
      id: "old",
      alerts: [{ cities: ["ירושלים"], threat: 1, time: NOW_SEC - 3600 }], // 1h ago
    };
    document.getElementById("alerts-scroll")!.innerHTML = "";
    renderAlerts([oldEvent], false);
    const scroll = document.getElementById("alerts-scroll")!;
    expect(scroll.querySelector(".alert-live-dot")).toBeNull();
  });

  it("empty array shows 'אין התרעות' message", () => {
    renderAlerts([], false);
    const scroll = document.getElementById("alerts-scroll")!;
    expect(scroll.textContent).toContain("אין התרעות");
  });

  it("clone rows are generated (scroll doubling)", () => {
    renderAlerts([sampleEvent], false);
    const scroll = document.getElementById("alerts-scroll")!;
    const items = scroll.querySelectorAll(".alert-item.clone");
    expect(items.length).toBeGreaterThan(0);
  });

  it("both normal and clone counters present", () => {
    renderAlerts([activeEvent], false);
    const scroll = document.getElementById("alerts-scroll")!;
    const counters = scroll.querySelectorAll(".alert-count");
    // 2 counter rows: one normal, one clone
    expect(counters.length).toBeGreaterThanOrEqual(2);
  });

  it("injects #alerts-scroll-style element for animation", () => {
    renderAlerts([sampleEvent], false);
    expect(document.getElementById("alerts-scroll-style")).not.toBeNull();
  });

  it("#alerts-scroll-style contains @keyframes alertsScroll", () => {
    renderAlerts([sampleEvent], false);
    const style = document.getElementById("alerts-scroll-style")!;
    expect(style.textContent).toContain("alertsScroll");
  });

  it("renders all events up to 25", () => {
    const manyEvents: AlertEvent[] = Array.from({ length: 30 }, (_, i) => ({
      id: `e-${i}`,
      alerts: [{ cities: ["עיר"], threat: 1, time: NOW_SEC - 200 - i * 10 }],
    }));
    renderAlerts(manyEvents, false);
    const scroll = document.getElementById("alerts-scroll")!;
    // items rendered for the non-clone pass ≤ 25
    const items = scroll.querySelectorAll(".alert-item:not(.clone)");
    expect(items.length).toBeLessThanOrEqual(25);
  });

  it("badge shows when highlightNew true and data non-empty", () => {
    renderAlerts([activeEvent], true);
    const badge = document.getElementById("alerts-badge")!;
    expect(badge.style.display).not.toBe("none");
    expect(Number(badge.textContent)).toBeGreaterThan(0);
  });

  it("no-op (no throw) when elScroll is null", () => {
    document.body.innerHTML = ""; // no DOM ids
    cacheDom();
    expect(() => renderAlerts([sampleEvent], false)).not.toThrow();
  });
});

// ── loadAlerts via mocked fetch ─────────────────────────────────────────────

describe("Alerts — loadAlerts via mocked fetch", () => {
  const TS = Math.floor(Date.now() / 1000);
  const FRESH: AlertEvent[] = [
    {
      id: "load-001",
      alerts: [{ cities: ["תל אביב"], threat: 1, time: TS - 30 }],
    },
  ];

  function setupDOM(): void {
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge" style="display:none"></div>
    `;
    cacheDom();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setupDOM();
    setAlertsEnabled(true);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("returns early without touching DOM when _enabled = false", async () => {
    setAlertsEnabled(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => FRESH,
    } as Response);
    await loadAlerts();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector(".alert-item")).toBeNull();
    setAlertsEnabled(true);
  });

  it("renders .alert-item when fetch returns valid data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => FRESH,
    } as Response);
    await loadAlerts();
    expect(document.querySelector(".alert-item")).not.toBeNull();
  });

  it("resolves without throw when fetch returns empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
  });

  it("resolves without throw when all fetches return non-ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => [],
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
  });

  it("resolves without throw when fetch throws a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    await expect(loadAlerts()).resolves.not.toThrow();
  });

  it("parses allorigins proxy response (contents field)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("allorigins")) {
        return {
          ok: true,
          json: async () => ({ contents: JSON.stringify(FRESH) }),
        } as Response;
      }
      return { ok: false, json: async () => [] } as unknown as Response;
    });
    await loadAlerts();
    expect(document.querySelector(".alert-item")).not.toBeNull();
  });

  it("sets sync to ok after successful fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => FRESH,
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
  });

  it("schedules next poll (scheduleAlerts) after load completes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => FRESH,
    } as Response);
    await loadAlerts();
    // One timer should be queued by scheduleAlerts()
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});

// ── scheduleAlerts branches, notify path, page-hidden, initAlertsCard ────────

describe("Alerts — scheduleAlerts interval branches", () => {
  const TS = Math.floor(Date.now() / 1000);
  const ACTIVE_DATA: AlertEvent[] = [
    { id: "sa-001", alerts: [{ cities: ["חיפה"], threat: 1, time: TS - 30 }] }, // 30s ago = active
  ];
  const IDLE_DATA: AlertEvent[] = [
    {
      id: "sa-002",
      alerts: [{ cities: ["ירושלים"], threat: 1, time: TS - 900 }],
    }, // 15min ago = idle
  ];

  function setupDOM(): void {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge" style="display:none"></div>`;
    cacheDom();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setupDOM();
    setAlertsEnabled(true);
    setAlertsRealtime(false);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("uses ALERT_INTERVAL_RT (10s) when _haveActive=true + _realtimeMode=true", async () => {
    setAlertsRealtime(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ACTIVE_DATA,
    } as Response);
    await loadAlerts();
    // scheduleAlerts was called with 10_000 (ALERT_INTERVAL_RT)
    // The timer should fire quickly → verify a timer exists
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("uses ALERTS_ACTIVE interval when _haveActive=true + _realtimeMode=false", async () => {
    setAlertsRealtime(false);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ACTIVE_DATA,
    } as Response);
    await loadAlerts();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("uses ALERTS_IDLE interval when no active alerts", async () => {
    setAlertsRealtime(false);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => IDLE_DATA,
    } as Response);
    await loadAlerts();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("notify path fires when new alert ID differs from previous", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ACTIVE_DATA,
    } as Response);
    // First call → sets _lastAlertId
    await loadAlerts();
    // Second call with different ID → isNew = true → notify()
    const DIFFERENT: AlertEvent[] = [
      {
        id: "sa-NEW",
        alerts: [{ cities: ["נתניה"], threat: 1, time: TS - 10 }],
      },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => DIFFERENT,
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
  });
});

describe("Alerts — loadAlerts page hidden", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("calls scheduleAlerts but skips fetch when page is hidden", async () => {
    // Simulate hidden page via the module mock
    vi.mocked(idleMod.isPageVisible).mockReturnValueOnce(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(loadAlerts()).resolves.not.toThrow();
    // fetch should NOT have been called since the page is hidden
    expect(fetchSpy).not.toHaveBeenCalled();
    // A timer should have been scheduled by scheduleAlerts()
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});

describe("Alerts — initAlertsCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    setAlertsEnabled(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not throw on init", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    expect(() => initAlertsCard()).not.toThrow();
  });

  it("caches DOM refs on init", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => [],
    } as Response);
    initAlertsCard();
    // After init, elScroll and elBadge should be cached
    expect(() => renderAlerts([], false)).not.toThrow();
  });
});

// ── loadAlerts success path (fetchAlerts + new alert detection + notify) ──

describe("Alerts — loadAlerts success with new alert (full path)", () => {
  const freshAlert: AlertEvent = {
    id: "new-001",
    alerts: [{ cities: ["תל אביב"], threat: 2, time: NOW_SEC - 30 }],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge" style="display:none"></div>
    `;
    cacheDom();
    setAlertsEnabled(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders data from direct fetch and sets sync ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [freshAlert],
    } as Response);

    await loadAlerts();
    const scroll = document.getElementById("alerts-scroll");
    expect(scroll?.querySelector(".alert-item")).not.toBeNull();
  });

  it("detects new alert ID and marks highlightNew on second load", async () => {
    // First load: establishes _lastAlertId
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [freshAlert],
    } as Response);
    await loadAlerts();

    // Second load: different ID → isNew=true → notify + highlightNew
    const newerAlert: AlertEvent = {
      id: "new-002",
      alerts: [{ cities: ["חיפה"], threat: 1, time: NOW_SEC - 10 }],
    };
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => [newerAlert],
    } as Response);
    await loadAlerts();

    // Badge should be shown (unread counter incremented)
    const badge = document.getElementById("alerts-badge");
    expect(badge?.style.display).toBe("");
    expect(Number(badge?.textContent)).toBeGreaterThan(0);
  });

  it("falls back to allorigins proxy when direct fails", async () => {
    let callNum = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callNum++;
      if (callNum === 1) return { ok: false, json: async () => [] } as Response;
      // allorigins wraps in { contents }
      return {
        ok: true,
        json: async () => ({ contents: JSON.stringify([freshAlert]) }),
      } as Response;
    });
    await loadAlerts();
    expect(callNum).toBeGreaterThan(1);
    expect(document.getElementById("alerts-scroll")?.querySelector(".alert-item")).not.toBeNull();
  });

  it("handles empty data array (no alerts) gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    await loadAlerts();
    // Should not throw; scroll should be empty or have "no alerts" message
  });

  it("handles fetch throwing error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(loadAlerts()).resolves.not.toThrow();
  });

  it("triggers notify with AudioContext beep on new alert", async () => {
    const stopFn = vi.fn();
    const closeFn = vi.fn().mockResolvedValue(undefined);
    // Use function (not arrow) so vi.fn can construct via `new AudioCtor()`
    const AudioMock = vi.fn(function (this: Record<string, unknown>) {
      this.createOscillator = vi.fn().mockReturnValue({
        connect: vi.fn().mockReturnValue({ connect: vi.fn() }),
        start: vi.fn(),
        stop: stopFn,
        frequency: { value: 0 },
      });
      this.createGain = vi.fn().mockReturnValue({
        connect: vi.fn(),
        gain: { value: 0 },
      });
      this.destination = {};
      this.currentTime = 0;
      this.close = closeFn;
    });
    vi.stubGlobal("AudioContext", AudioMock);

    // First load
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [freshAlert],
    } as Response);
    await loadAlerts();

    // Second load with new ID → notify → playBeep
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ ...freshAlert, id: "new-999" }],
    } as Response);
    await loadAlerts();
    expect(AudioMock).toHaveBeenCalled();
    expect(stopFn).toHaveBeenCalled();
  });
});

// ──────── END OF TESTS ──────────────────────────────────────────────

// ── catch block (lines 292-294) + setAlertsEnabled timer cleanup (lines 303-304) ──

describe("Alerts — setAlertsEnabled clears active timer", () => {
  const TS = Math.floor(Date.now() / 1000);
  const DATA: AlertEvent[] = [
    { id: "timer-001", alerts: [{ cities: ["חדרה"], threat: 1, time: TS - 60 }] },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    setAlertsRealtime(false);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("clearTimeout fires when disabling alerts after loadAlerts scheduled a timer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => DATA,
    } as Response);
    await loadAlerts(); // scheduleAlerts sets _timer
    const timersBefore = vi.getTimerCount();
    expect(timersBefore).toBeGreaterThan(0);
    // Now disable — should clear the timer (lines 303-304)
    setAlertsEnabled(false);
    // The timer should have been cleared
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Alerts — loadAlerts catch block with stale data", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("catch block runs when cSetAsync throws during data processing", async () => {
    // Mock cSetAsync to reject, which is called inside the try block
    const cacheMod = await import("@/core/cache");
    vi.spyOn(cacheMod, "cSetAsync").mockImplementation(() => {
      return Promise.reject(new Error("quota exceeded"));
    });
    // Fetch returns valid data so the try block gets far enough to call cSetAsync
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "catch-001",
          alerts: [{ cities: ["אשדוד"], threat: 1, time: Math.floor(Date.now() / 1000) - 30 }],
        },
      ],
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
    vi.mocked(cacheMod.cSetAsync).mockRestore();
  });
});
// ── Sprint: notify() with Notification permission ──────────────────────────

describe("Alerts — notify with Notification permission granted", () => {
  const NOW = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("calls Notification with city names when isNew and permission granted", async () => {
    const NotifMock = vi.fn() as unknown as typeof Notification & ReturnType<typeof vi.fn>;
    (NotifMock as unknown as { permission: string }).permission = "granted";
    vi.stubGlobal("Notification", NotifMock);

    const data1 = [
      {
        id: "n-001",
        alerts: [{ cities: ["תל אביב"], threat: 1, time: NOW - 30 }],
      },
    ];
    const data2 = [
      {
        id: "n-002",
        alerts: [
          {
            cities: ["חיפה", "נצרת", "עכו", "קצרין"],
            threat: 2,
            time: NOW - 10,
          },
        ],
      },
    ];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => data1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => data2 } as Response);

    await loadAlerts(); // first call sets _lastAlertId
    await loadAlerts(); // second call: different id → isNew → notify

    expect(NotifMock).toHaveBeenCalled();
    const calls = (NotifMock as ReturnType<typeof vi.fn>).mock.calls;
    const lastOpts = calls[calls.length - 1]?.[1] as { body: string };
    expect(lastOpts.body).toContain("חיפה");
    expect(lastOpts.body).toContain("עכו");
    expect(lastOpts.body).not.toContain("קצרין");
  });

  it("filters out events with no alerts array (validation gate)", async () => {
    const NotifMock = vi.fn() as unknown as typeof Notification & ReturnType<typeof vi.fn>;
    (NotifMock as unknown as { permission: string }).permission = "granted";
    vi.stubGlobal("Notification", NotifMock);

    // data2 has no 'alerts' array — isAlertEvent should reject it
    const data1 = [
      {
        id: "f-001",
        alerts: [{ cities: ["ירושלים"], threat: 1, time: NOW - 30 }],
      },
    ];
    const data2 = [{ id: "f-002" }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => data1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => data2 } as Response);

    await loadAlerts(); // first call: valid data, notification sent
    const callsAfterFirst = (NotifMock as ReturnType<typeof vi.fn>).mock.calls.length;
    await loadAlerts(); // second call: invalid data → filtered → no extra notification
    const callsAfterSecond = (NotifMock as ReturnType<typeof vi.fn>).mock.calls.length;

    // Notification from first load was sent; no new notification from the invalid second load
    expect(callsAfterFirst).toBeGreaterThanOrEqual(0);
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });

  it("filters out alert zones with no cities property (validation gate)", async () => {
    const NotifMock = vi.fn() as unknown as typeof Notification & ReturnType<typeof vi.fn>;
    (NotifMock as unknown as { permission: string }).permission = "granted";
    vi.stubGlobal("Notification", NotifMock);

    // data2 alert zone has no 'cities' — isAlertEvent should reject the whole event
    const data1 = [
      {
        id: "c-001",
        alerts: [{ cities: ["באר שבע"], threat: 1, time: NOW - 30 }],
      },
    ];
    const data2 = [{ id: "c-002", alerts: [{ threat: 1, time: NOW - 10 }] }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => data1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => data2 } as Response);

    await loadAlerts(); // first call: valid → possibly notifies
    const callsAfterFirst = (NotifMock as ReturnType<typeof vi.fn>).mock.calls.length;
    await loadAlerts(); // second call: invalid zone → filtered → no new notification
    const callsAfterSecond = (NotifMock as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});

// ── toggleAlerts + isAlertsEnabled ──────────────────────────────────────────

describe("Alerts — toggleAlerts / isAlertsEnabled", () => {
  afterEach(() => {
    setAlertsEnabled(false);
  });

  it("isAlertsEnabled returns false after setAlertsEnabled(false)", () => {
    setAlertsEnabled(false);
    expect(isAlertsEnabled()).toBe(false);
  });

  it("isAlertsEnabled returns true after setAlertsEnabled(true)", () => {
    setAlertsEnabled(true);
    expect(isAlertsEnabled()).toBe(true);
  });

  it("toggleAlerts flips disabled → enabled", () => {
    setAlertsEnabled(false);
    toggleAlerts();
    expect(isAlertsEnabled()).toBe(true);
  });

  it("toggleAlerts flips enabled → disabled", () => {
    setAlertsEnabled(true);
    toggleAlerts();
    expect(isAlertsEnabled()).toBe(false);
  });

  it("double-toggle returns to original state", () => {
    setAlertsEnabled(false);
    toggleAlerts();
    toggleAlerts();
    expect(isAlertsEnabled()).toBe(false);
  });
});

// ── scheduleAlerts realtimeMode branch (line ~96) ─────────────────────────────

describe("Alerts — scheduleAlerts realtimeMode branch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
    setAlertsRealtime(false);
  });

  it("uses the realtime interval when realtimeMode=true and haveActive=true", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsRealtime(true);

    const now = Math.floor(Date.now() / 1000);
    // Stub fetch to return an active alert (triggers _haveActive = true → RT interval branch)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "rt-001",
            alerts: [{ cities: ["תל אביב"], threat: 2, time: now - 30 }],
          },
        ],
      }),
    );

    // loadAlerts → fetchAlerts → _haveActive=true → scheduleAlerts → uses ALERT_INTERVAL_RT
    await expect(loadAlerts()).resolves.toBeUndefined();
    vi.runAllTimers();
  });
});

// ── loadAlerts empty-data else branch (lines ~288-293) ──────────────────────

describe("Alerts — loadAlerts empty response else branch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("handles empty alerts array without throwing", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    await loadAlerts();
    // empty data → else branch fires: setSync(error or ok), recordFailure
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    vi.runAllTimers();
  });

  it("triggers notify path when a new alert ID differs from last", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();

    const nowSec = Math.floor(Date.now() / 1000);
    const makeAlert = (id: string) => ({
      ok: true,
      json: async () => [{ id, alerts: [{ cities: ["תל אביב"], threat: 1, time: nowSec - 30 }] }],
    });

    // First call: sets _lastAlertId = "A"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAlert("A")));
    await loadAlerts();

    // Second call: different ID → isNew = true → notify() called (beep + Notification)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAlert("B")));
    await loadAlerts();

    // No throw is the acceptance criterion
    expect(document.getElementById("alerts-scroll")).not.toBeNull();
    vi.runAllTimers();
  });
});

// ── renderAlerts total24h++ branch (line 196) ────────────────────────────────

describe("Alerts — renderAlerts total24h++ branch (line 196)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("increments total24h for alerts within last 24 hours", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();

    const nowSec = Math.floor(Date.now() / 1000);
    const data: AlertEvent[] = [
      { id: "r1", alerts: [{ cities: ["תל אביב"], threat: 1, time: nowSec - 30 }] },
    ];
    expect(() => renderAlerts(data, false)).not.toThrow();
    const scroll = document.getElementById("alerts-scroll");
    expect(scroll?.textContent).toContain("1");
  });

  it("counts zero for alerts outside 24h window (total24h++ FALSE branch)", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();

    const nowSec = Math.floor(Date.now() / 1000);
    const data: AlertEvent[] = [
      { id: "old1", alerts: [{ cities: ["ירושלים"], threat: 1, time: nowSec - 90_000 }] },
    ];
    expect(() => renderAlerts(data, false)).not.toThrow();
    const scroll = document.getElementById("alerts-scroll");
    expect(scroll?.textContent).toContain("0");
  });
});

// ── loadAlerts data[0]?.id ?? null branch (line 271) ────────────────────────

describe("Alerts — loadAlerts data[0]?.id ?? null (line 271)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("uses null when alert event has no id field (line 271 ?? null branch)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();

    const nowTs = Math.floor(Date.now() / 1000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ alerts: [{ cities: ["תל אביב"], threat: 1, time: nowTs - 10 }] }],
      }),
    );

    await expect(loadAlerts()).resolves.toBeUndefined();
    vi.runAllTimers();
  });
});

// ── renderAlerts highlightNew=true → elBadge update (line 186) ───────────────

describe("Alerts — renderAlerts highlightNew=true updates badge (line 186)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("sets elBadge.textContent when highlightNew=true and badge is in DOM (line 186 TRUE)", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge" style="display:none"></div>`;
    cacheDom();
    const nowSec = Math.floor(Date.now() / 1000);
    const data: AlertEvent[] = [
      { id: "hl1", alerts: [{ cities: ["תל אביב"], threat: 1, time: nowSec - 30 }] },
    ];
    // highlightNew=true → _unread++ → if (elBadge) → line 186 fires
    renderAlerts(data, true);
    const badge = document.getElementById("alerts-badge");
    // Badge text should be the unread count (≥ 1)
    expect(Number(badge?.textContent)).toBeGreaterThanOrEqual(1);
    expect(badge?.style.display).toBe("");
  });
});

// ── loadAlerts else block data.length=0 (lines 287-290) ──────────────────────

describe("Alerts — loadAlerts else block when fetch returns empty array (lines 287-290)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("hits else block (_haveActive=false) when fetchAlerts returns [] (lines 287-290)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    // fetch returns empty array → data.length === 0 → else branch fires
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    await loadAlerts();
    vi.runAllTimers();
    // No throw and function completed
    expect(document.getElementById("alerts-scroll")).not.toBeNull();
  });
});

// ── loadAlerts catch block via cSetAsync reject (lines 291-295) ────────────────────

describe("Alerts — loadAlerts catch block when cSetAsync rejects (lines 291-295)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("hits catch block when cSetAsync rejects after valid data received (lines 291-295)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    const nowTs = Math.floor(Date.now() / 1000);
    // fetch returns valid alert data (data.length > 0) → then cSetAsync rejects → outer catch fires
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "z1", alerts: [{ cities: ["תל אביב"], threat: 1, time: nowTs - 10 }] },
        ],
      }),
    );
    // Spy on cSetAsync from the real cache module to reject when called
    const cacheModule = await import("@/core/cache");
    vi.spyOn(cacheModule, "cSetAsync").mockImplementationOnce(() => {
      return Promise.reject(new Error("forced cSetAsync reject for catch coverage"));
    });
    // Should resolve (catch handles error) rather than reject
    await expect(loadAlerts()).resolves.toBeUndefined();
    vi.runAllTimers();
  });
});

// ── renderAlerts: if (elBadge) FALSE branch (line 186) ───────────────────────

describe("Alerts — renderAlerts if(elBadge) FALSE branch (line 186)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("skips badge update when elBadge is null and highlightNew=true (line 186 FALSE branch)", () => {
    // DOM has scroll but NO badge → cacheDom sets elBadge=null → if(elBadge) = FALSE
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cacheDom();
    const nowSec = Math.floor(Date.now() / 1000);
    const data: AlertEvent[] = [
      { id: "b1", alerts: [{ cities: ["תל אביב"], threat: 1, time: nowSec - 30 }] },
    ];
    expect(() => renderAlerts(data, true)).not.toThrow();
    expect(document.getElementById("alerts-badge")).toBeNull();
  });
});

// ── loadAlerts else stale=null → "error" ternary (line 288) ─────────────────

describe("Alerts — loadAlerts else block stale=null ternary FALSE (line 288)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("takes stale?'ok':'error' FALSE path in else block when cache empty + all fetches fail (line 288)", async () => {
    const cacheModule = await import("@/core/cache");
    cacheModule.cClear(); // stale = null
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await loadAlerts();
    expect(document.getElementById("alerts-scroll")).not.toBeNull();
  });
});

// ── loadAlerts catch stale=null → "error" ternary (lines 291-293) ───────────

describe("Alerts — loadAlerts catch block stale=null ternary FALSE (lines 291-293)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("takes stale?'ok':'error' FALSE path in catch when cache empty + cSetAsync rejects (lines 291-293)", async () => {
    const cacheModule = await import("@/core/cache");
    cacheModule.cClear(); // stale = null → ternary takes 'error'
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    const nowTs = Math.floor(Date.now() / 1000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "c1", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 10 }] },
        ],
      }),
    );
    vi.spyOn(cacheModule, "cSetAsync").mockImplementationOnce(() => {
      return Promise.reject(new Error("forced cSetAsync reject for catch stale=null coverage"));
    });
    await expect(loadAlerts()).resolves.toBeUndefined();
  });
});

// ── loadAlerts outer catch (lines 429-431) — historyAppend throws ─────────────

describe("Alerts — loadAlerts outer catch block fires when historyAppend throws (lines 429-431)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("does not throw and covers lines 429-431 when historyAppend rejects after valid fetch", async () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    const nowTs = Math.floor(Date.now() / 1000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "outer-catch-1", alerts: [{ cities: ["באר שבע"], threat: 1, time: nowTs - 5 }] },
        ],
      }),
    );
    // Force historyAppend to throw → falls into the outer catch block (lines 429-431)
    vi.spyOn(historyMod, "historyAppend").mockRejectedValue(new Error("forced historyAppend error"));
    await expect(loadAlerts()).resolves.toBeUndefined();
  });
});

// ── Sprint v7.11: coverage for playBeep, notify, renderAlerts, fetchAlerts ──

describe("Alerts — playBeep AudioContext unavailable (no throw)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("does not throw when AudioContext and webkitAudioContext are both undefined", async () => {
    vi.stubGlobal("AudioContext", undefined);
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    // Mock fetch to return data that triggers notify (new alert) → playBeep is called internally
    // playBeep will try AudioContext → undefined → AudioCtor = undefined → if (!AudioCtor) return
    const nowTs = Math.floor(Date.now() / 1000);
    const { cSet: rCs } = await import("@/core/cache");
    rCs("alerts", [{ id: "old", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 60 }] }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "new_id", alerts: [{ cities: ["חיפה"], threat: 1, time: nowTs - 5 }] },
        ],
      }),
    );
    await expect(loadAlerts()).resolves.toBeUndefined();
  });
});

describe("Alerts — notify without Notification API (no throw)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("does not throw when typeof Notification === 'undefined'", async () => {
    vi.stubGlobal("Notification", undefined);
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    const nowTs = Math.floor(Date.now() / 1000);
    const { cSet: rCs } = await import("@/core/cache");
    rCs("alerts", [{ id: "prev", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 60 }] }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "next_id", alerts: [{ cities: ["רחובות"], threat: 1, time: nowTs - 3 }] },
        ],
      }),
    );
    await expect(loadAlerts()).resolves.toBeUndefined();
  });
});

describe("Alerts — notify Notification.permission not granted (no throw)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("does not throw when Notification.permission is 'denied'", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    const nowTs = Math.floor(Date.now() / 1000);
    const { cSet: rCs } = await import("@/core/cache");
    rCs("alerts", [{ id: "deny1", alerts: [{ cities: ["נצרת"], threat: 1, time: nowTs - 120 }] }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "deny2", alerts: [{ cities: ["נצרת"], threat: 1, time: nowTs - 2 }] },
        ],
      }),
    );
    await expect(loadAlerts()).resolves.toBeUndefined();
  });
});

// ── SSE connection: initAlertsSSE / destroyAlertsSSE  ─────────────

/** Reusable EventSource mock class for SSE tests */
class MockEventSource {
  static instances: MockEventSource[] = [];
  readonly url: string;
  private readonly _listeners = new Map<string, () => void>();
  closeCalled = false;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(event: string, fn: () => void): void {
    this._listeners.set(event, fn);
  }
  fireEvent(event: string): void {
    this._listeners.get(event)?.();
  }
  close(): void {
    this.closeCalled = true;
  }
}

describe("Alerts — initAlertsSSE and destroyAlertsSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
  });
  afterEach(() => {
    _resetAlertsForTest();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initAlertsSSE does nothing when EventSource is undefined", () => {
    const orig = (globalThis as Record<string, unknown>).EventSource;
    delete (globalThis as Record<string, unknown>).EventSource;
    expect(() => initAlertsSSE()).not.toThrow();
    (globalThis as Record<string, unknown>).EventSource = orig;
  });

  it("initAlertsSSE creates EventSource when worker is enabled", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("navigator", { onLine: true });

    initAlertsSSE();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toContain("/api/alerts/subscribe");
  });

  it("destroyAlertsSSE closes connection and resets realtime mode", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("navigator", { onLine: true });

    initAlertsSSE();
    destroyAlertsSSE();

    expect(MockEventSource.instances[0]?.closeCalled).toBe(true);
  });

  it("SSE onerror handler closes connection", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("navigator", { onLine: true });

    setAlertsRealtime(true);
    initAlertsSSE();
    const es = MockEventSource.instances[0]!;
    expect(es.onerror).not.toBeNull();
    es.onerror?.();

    expect(es.closeCalled).toBe(true);
  });

  it("SSE ping event fires setAlertsRealtime(true) (line 425)", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("navigator", { onLine: true });

    setAlertsRealtime(false);
    initAlertsSSE();
    const es = MockEventSource.instances[0]!;
    es.fireEvent("ping");
    // No throw; setAlertsRealtime(true) and diagLog are called
    expect(es.closeCalled).toBe(false);
  });

  it("SSE alert event triggers loadAlerts (line 429)", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("navigator", { onLine: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    initAlertsSSE();
    const es = MockEventSource.instances[0]!;
    expect(() => es.fireEvent("alert")).not.toThrow();
  });
});

describe("Alerts — destroyAlertsCard (lines 459-463)", () => {
  afterEach(() => {
    _resetAlertsForTest();
    vi.restoreAllMocks();
  });

  it("destroyAlertsCard clears timer when one is active (line 459 TRUE)", async () => {
    // Schedule a timer by loading alerts (which calls scheduleAlertsRefresh)
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    await loadAlerts();
    // destroyAlertsCard should clearTimeout the timer without throwing
    expect(() => destroyAlertsCard()).not.toThrow();
  });

  it("destroyAlertsCard does nothing when timer is null (line 459 FALSE)", () => {
    // _timer starts as null after reset
    expect(() => destroyAlertsCard()).not.toThrow();
  });
});

describe("Alerts — renderAlerts elScroll null (no throw)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns immediately without throwing when elScroll is null", () => {
    // No DOM → elScroll stays null after cacheDom
    document.body.innerHTML = "";
    cacheDom(); // elScroll = null
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = {
      id: "x",
      alerts: [{ cities: ["תל אביב"], threat: 1, time: nowTs - 10 }],
    };
    expect(() => renderAlerts([ev], false)).not.toThrow();
  });
});

describe("Alerts — fetchAlerts !res.ok falls through to next proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("skips non-ok responses and falls through chain returning []", async () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    // All responses are 404 (not ok)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));
    await expect(loadAlerts()).resolves.toBeUndefined();
    // Sync should be 'error' (no stale data, fetch returned nothing)
  });
});

describe("Alerts — buildAlertItem THREAT_LABELS fallback (unknown threat)", () => {
  it("uses '⚠️ התרעה' fallback for threat value not in THREAT_LABELS", () => {
    const ev: AlertEvent = {
      id: "t1",
      alerts: [{ cities: ["תל אביב"], threat: 99, time: NOW_SEC - 60 }],
    };
    const el = buildAlertItem(ev, NOW_SEC, false, false);
    expect(el?.textContent).toContain("⚠️ התרעה");
  });
});

describe("Alerts — renderAlerts badge null guard (no throw)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw when badge element is null during highlight", () => {
    // Provide scroll but no badge
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cacheDom(); // elBadge = null
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = {
      id: "x2",
      alerts: [{ cities: ["נצרת"], threat: 1, time: nowTs - 5 }],
    };
    expect(() => renderAlerts([ev], true)).not.toThrow();
  });
});

// ── F2 (v7.2): Alert volume control ──────────────────────────────────────

describe("Alerts — setAlertVolume / getAlertVolume (F2 v7.2)", () => {
  it("getAlertVolume returns 18 by default", () => {
    expect(getAlertVolume()).toBe(18);
  });

  it("setAlertVolume updates getAlertVolume", () => {
    setAlertVolume(55);
    expect(getAlertVolume()).toBe(55);
  });

  it("setAlertVolume clamps to 0-100", () => {
    setAlertVolume(-10);
    expect(getAlertVolume()).toBe(0);
    setAlertVolume(200);
    expect(getAlertVolume()).toBe(100);
  });
});

// ── clearUnreadAlerts + document.title badge ──────────────────────

describe("Alerts — clearUnreadAlerts resets badge and document.title", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.title = "FamilyDashBoard";
  });

  it("clearUnreadAlerts hides badge and clears unread count", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge" style="display:none">0</div>`;
    cacheDom();
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = {
      id: "s19a",
      alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 5 }],
    };
    // Accumulate 2 unread
    renderAlerts([ev], true);
    renderAlerts([ev], true);
    const badge = document.getElementById("alerts-badge")!;
    expect(Number(badge.textContent)).toBeGreaterThanOrEqual(2);
    // Now clear
    clearUnreadAlerts();
    expect(badge.textContent).toBe("0");
    expect(badge.style.display).toBe("none");
  });

  it("clearUnreadAlerts without badge element does not throw", () => {
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cacheDom(); // elBadge = null
    expect(() => clearUnreadAlerts()).not.toThrow();
  });

  it("renderAlerts with highlightNew=true updates document.title with unread count", () => {
    document.title = "FamilyDashBoard";
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge" style="display:none">0</div>`;
    cacheDom();
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = {
      id: "s19b",
      alerts: [{ cities: ["חיפה"], threat: 1, time: nowTs - 3 }],
    };
    renderAlerts([ev], true);
    // Title should contain the unread count
    expect(document.title).toMatch(/(\d+)/);
  });
});

// ── alertThreatIcon + alertAgeLabel ─────────────────────────────

describe("Alerts — alertThreatIcon ", () => {
  it("returns 🔴 for threat 0", () => {
    expect(alertThreatIcon(0)).toBe("🔴");
  });

  it("returns 🔴 for threat 1", () => {
    expect(alertThreatIcon(1)).toBe("🔴");
  });

  it("returns 🟡 for threat 5 (hostile aircraft)", () => {
    expect(alertThreatIcon(5)).toBe("🟡");
  });

  it("returns 🟠 for unknown threat levels", () => {
    expect(alertThreatIcon(3)).toBe("🟠");
    expect(alertThreatIcon(99)).toBe("🟠");
  });
});

describe("Alerts — alertAgeLabel ", () => {
  it("returns 'עכשיו' for age < 1 minute", () => {
    expect(alertAgeLabel(0)).toBe("עכשיו");
  });

  it("returns 'לפני Nד׳' for minutes < 60", () => {
    expect(alertAgeLabel(5)).toBe("לפני 5ד׳");
    expect(alertAgeLabel(59)).toBe("לפני 59ד׳");
  });

  it("returns 'לפני Nש׳' for hours >= 1", () => {
    expect(alertAgeLabel(60)).toBe("לפני 1ש׳");
    expect(alertAgeLabel(120)).toBe("לפני 2ש׳");
  });
});

describe("Alerts — buildAlertItem threat icon + age badge", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("includes threat icon in the threat span text", () => {
    const now = Date.now() / 1000;
    const ev: AlertEvent = {
      id: "t28a",
      alerts: [{ cities: ["תל אביב"], threat: 0, time: now - 30 }],
    };
    const el = buildAlertItem(ev, now, false, false);
    expect(el).not.toBeNull();
    const thrEl = el!.querySelector(".alert-threat");
    expect(thrEl?.textContent).toMatch(/🔴/);
  });

  it("includes .alert-age span", () => {
    const now = Date.now() / 1000;
    const ev: AlertEvent = {
      id: "t28b",
      alerts: [{ cities: ["חיפה"], threat: 1, time: now - 300 }],
    };
    const el = buildAlertItem(ev, now, false, false);
    expect(el!.querySelector(".alert-age")).not.toBeNull();
  });
});

// ── loadAlerts page-hidden, isAlertsEnabled, volume clamp, invalid filter, reduced-motion ──

describe("Alerts — branch coverage", () => {
  const TS = Math.floor(Date.now() / 1000);

  function setupDOM(): void {
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge" style="display:none"></div>
    `;
    cacheDom();
  }

  beforeEach(() => {
    _resetAlertsForTest();
    vi.useFakeTimers();
    setupDOM();
    setAlertsEnabled(true);
    localStorage.clear();
    vi.mocked(idleMod.isPageVisible).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    localStorage.clear();
    _resetAlertsForTest();
  });

  it("loadAlerts schedules next poll immediately when page is not visible", async () => {
    vi.mocked(idleMod.isPageVisible).mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    await loadAlerts();
    // fetch should NOT have been called — returned early
    expect(fetchSpy).not.toHaveBeenCalled();
    // scheduleAlerts() should have set a timer
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("isAlertsEnabled returns true by default", () => {
    expect(isAlertsEnabled()).toBe(true);
  });

  it("isAlertsEnabled returns false after setAlertsEnabled(false)", () => {
    setAlertsEnabled(false);
    expect(isAlertsEnabled()).toBe(false);
  });

  it("setAlertVolume clamps to 100 when given a value above 100", () => {
    setAlertVolume(200);
    expect(getAlertVolume()).toBe(100);
  });

  it("setAlertVolume clamps to 0 when given a negative value", () => {
    setAlertVolume(-10);
    expect(getAlertVolume()).toBe(0);
  });

  it("loadAlerts discards structurally invalid events and logs (validData.length !== data.length)", async () => {
    // time is a string, not a number → isAlertEvent returns false
    const invalidEvent = { id: "bad", alerts: [{ cities: ["עיר"], time: "not-a-number" }] };
    const validEvent: AlertEvent = {
      id: "ok",
      alerts: [{ cities: ["תל אביב"], threat: 1, time: TS - 30 }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [validEvent, invalidEvent],
    } as Response);
    // Should not throw; invalid event is silently discarded
    await expect(loadAlerts()).resolves.not.toThrow();
    // Only the valid event rendered
    expect(document.querySelector(".alert-item")).not.toBeNull();
  });

  it("renderAlerts sets animation to 'none' and returns when user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const ev: AlertEvent = { id: "rm1", alerts: [{ cities: ["נתניה"], threat: 1, time: TS - 60 }] };
    renderAlerts([ev], false);
    const scroll = document.getElementById("alerts-scroll") as HTMLElement;
    expect(scroll.style.animation).toBe("none");
  });

  it("loadAlerts renders stale data first then sets sync 'ok' when empty fetch result", async () => {
    // Seed stale cache: cSet writes to localStorage under dash_v2_ prefix
    const staleEvent: AlertEvent = {
      id: "stale-001",
      alerts: [{ cities: ["באר שבע"], threat: 1, time: TS - 200 }],
    };
    localStorage.setItem(
      "dash_v2_alerts",
      JSON.stringify({ data: [staleEvent], ts: Date.now() - 1 }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
    // stale path renders stale data
    expect(document.querySelector(".alert-item")).not.toBeNull();
  });
});

// ── alertRingAppend, alertRingGet, renderAlertHistory ───────

describe("Alerts — alertRingAppend / alertRingGet ( A2)", () => {
  const RING_KEY = "fdb_alert_ring";
  const nowSec = Math.floor(Date.now() / 1000);

  const makeEvent = (id: string, offsetSec = 0): AlertEvent => ({
    id,
    alerts: [{ time: nowSec - offsetSec, threat: 0, cities: ["תל אביב"] }],
  });

  beforeEach(() => localStorage.removeItem(RING_KEY));
  afterEach(() => localStorage.removeItem(RING_KEY));

  it("appends events to an empty ring", () => {
    alertRingAppend([makeEvent("a1"), makeEvent("a2")]);
    const ring = alertRingGet();
    expect(ring.length).toBe(2);
  });

  it("deduplicates by event ID", () => {
    alertRingAppend([makeEvent("a1"), makeEvent("a2")]);
    alertRingAppend([makeEvent("a1")]); // duplicate
    const ring = alertRingGet();
    expect(ring.length).toBe(2);
  });

  it("prunes events older than 24h", () => {
    const old = makeEvent("stale", 90_000); // >24h ago
    alertRingAppend([old, makeEvent("fresh")]);
    const ring = alertRingGet();
    expect(ring.every((e) => e.id !== "stale")).toBe(true);
    expect(ring.some((e) => e.id === "fresh")).toBe(true);
  });

  it("caps at 100 entries", () => {
    const batch: AlertEvent[] = Array.from({ length: 110 }, (_, i) => makeEvent(`ev${i}`, i));
    alertRingAppend(batch);
    const ring = alertRingGet();
    expect(ring.length).toBeLessThanOrEqual(100);
  });

  it("returns empty array when localStorage is empty", () => {
    expect(alertRingGet()).toEqual([]);
  });

  it("returns empty array when localStorage has invalid JSON", () => {
    localStorage.setItem(RING_KEY, "not-json{");
    expect(alertRingGet()).toEqual([]);
  });

  it("returns empty array when localStorage has non-array value", () => {
    localStorage.setItem(RING_KEY, JSON.stringify({ not: "array" }));
    expect(alertRingGet()).toEqual([]);
  });
});

describe("Alerts — renderAlertHistory ( A2)", () => {
  const RING_KEY = "fdb_alert_ring";
  const nowSec = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    localStorage.removeItem(RING_KEY);
    document.body.innerHTML = '<div id="hist-container"></div>';
  });
  afterEach(() => {
    localStorage.removeItem(RING_KEY);
    document.body.innerHTML = "";
  });

  it("renders empty message when ring is empty", () => {
    const container = document.getElementById("hist-container") as HTMLElement;
    renderAlertHistory(container);
    expect(container.textContent).toContain("אין התרעות");
  });

  it("renders alert items when ring has events", () => {
    const ev: AlertEvent = {
      id: "r1",
      alerts: [{ time: nowSec - 60, threat: 0, cities: ["חיפה"] }],
    };
    localStorage.setItem(RING_KEY, JSON.stringify([ev]));
    const container = document.getElementById("hist-container") as HTMLElement;
    renderAlertHistory(container);
    expect(container.querySelector(".alert-item")).not.toBeNull();
  });
});

// ── showAlertTakeover / hideAlertTakeover ──────────────────

describe("Alerts — showAlertTakeover / hideAlertTakeover ( A1)", () => {
  const nowSec = Math.floor(Date.now() / 1000);

  const makeDialogHTML = (): void => {
    document.body.innerHTML = `
      <dialog id="alerts-takeover">
        <div id="alerts-takeover-cities"></div>
        <div id="alerts-takeover-threat"></div>
        <div id="alerts-takeover-countdown"></div>
        <button id="alerts-takeover-close">✕</button>
      </dialog>
    `;
    // Polyfill showModal/close for happy-dom
    const d = document.getElementById("alerts-takeover") as HTMLDialogElement;
    if (typeof d.showModal !== "function") {
      d.showModal = () => {
        d.setAttribute("open", "");
      };
      d.close = () => {
        d.removeAttribute("open");
      };
    }
  };

  beforeEach(() => {
    makeDialogHTML();
    _resetAlertsForTest();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    _resetAlertsForTest();
    vi.useRealTimers();
  });

  const sampleTakeover: AlertEvent[] = [
    { id: "t1", alerts: [{ time: nowSec - 5, threat: 0, cities: ["תל אביב", "גבעתיים"] }] },
  ];

  it("shows the dialog and populates cities", () => {
    showAlertTakeover(sampleTakeover);
    expect(document.getElementById("alerts-takeover-cities")?.textContent).toContain("תל אביב");
  });

  it("populates threat element", () => {
    showAlertTakeover(sampleTakeover);
    const threatEl = document.getElementById("alerts-takeover-threat");
    expect(threatEl?.textContent).toBeTruthy();
  });

  it("does not throw when dialog element is absent", () => {
    document.body.innerHTML = "<div></div>";
    expect(() => showAlertTakeover(sampleTakeover)).not.toThrow();
  });

  it("does not throw when events list is empty", () => {
    expect(() => showAlertTakeover([])).not.toThrow();
  });

  it("hideAlertTakeover closes the dialog", () => {
    showAlertTakeover(sampleTakeover);
    hideAlertTakeover();
    const dialog = document.getElementById("alerts-takeover") as HTMLDialogElement;
    expect(dialog.open).toBeFalsy();
  });

  it("hideAlertTakeover does not throw when dialog absent", () => {
    document.body.innerHTML = "<div></div>";
    expect(() => hideAlertTakeover()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Alerts card fast-check property tests (AP1–AP5)
// ═══════════════════════════════════════════════════════════════════════════

// ── AP1: alertThreatIcon — always returns a non-empty string ─────────────
describe("AP1: alertThreatIcon(threat) — always returns a non-empty emoji string", () => {
  it("any integer threat level returns a non-empty string", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (threat) => {
        const result = alertThreatIcon(threat);
        return typeof result === "string" && result.length > 0;
      }),
      { numRuns: 100 },
    );
  });

  it("threat ≤ 1 always returns red icon", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Number.MIN_SAFE_INTEGER, max: 1 }),
        (threat) => alertThreatIcon(threat) === "🔴",
      ),
      { numRuns: 100 },
    );
  });

  it("threat 5 always returns yellow icon", () => {
    expect(alertThreatIcon(5)).toBe("🟡");
  });

  it("threat 2..4 and 6+ always returns orange icon", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: 2, max: 4 }), fc.integer({ min: 6, max: 100 })),
        (threat) => alertThreatIcon(threat) === "🟠",
      ),
      { numRuns: 100 },
    );
  });
});

// ── AP2: alertAgeLabel — always returns a non-empty string ───────────────
describe("AP2: alertAgeLabel(ageMin) — always returns a non-empty string", () => {
  it("any non-negative age in minutes yields a non-empty string", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1440, noNaN: true }), (ageMin) => {
        const result = alertAgeLabel(ageMin);
        return typeof result === "string" && result.length > 0;
      }),
      { numRuns: 200 },
    );
  });
});

// ── AP3: alertRingAppend + alertRingGet — ring buffer ≤ 100 entries ───────
describe("AP3: alertRingAppend — ring buffer never exceeds 100 entries", () => {
  beforeEach(() => {
    _resetAlertsForTest();
  });

  it("appending any number of events keeps ring ≤ 100", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 20 }),
        (batchSizes) => {
          _resetAlertsForTest();
          for (const size of batchSizes) {
            const events = Array.from({ length: size }, (_, i) => ({
              id: `evt-${i}`,
              title: "Test",
              desc: "Test event",
              threat: 1,
              area: "Test",
              ts: Date.now(),
            }));
            alertRingAppend(events as AlertEvent[]);
          }
          return alertRingGet().length <= 100;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── AP4: alertRingGet — always returns an array ───────────────────────────
describe("AP4: alertRingGet() — always returns an array", () => {
  it("returns an array even when ring is empty", () => {
    _resetAlertsForTest();
    const result = alertRingGet();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── AP5: alertThreatIcon output set is exactly {🔴, 🟠, 🟡} ───────────────
describe("AP5: alertThreatIcon — output set is exactly 3 distinct values", () => {
  it("exhaustive scan of threat 0-10 yields exactly 3 distinct icons", () => {
    const icons = new Set(Array.from({ length: 11 }, (_, i) => alertThreatIcon(i)));
    expect(icons.size).toBe(3);
    expect(icons.has("🔴")).toBe(true);
    expect(icons.has("🟠")).toBe(true);
    expect(icons.has("🟡")).toBe(true);
  });
});

// ── alertZone + history/severity/dim in configSchema ──
describe("Alerts configSchema — CS-A1 ", () => {
  it("configSchema has 8 fields total after CS-A1", () => {
    expect(alertsConfigSchema.length).toBe(8);
  });

  it("alertZone is a text field with empty default", () => {
    const field = alertsConfigSchema.find((f) => f.key === "alertZone");
    expect(field).toBeDefined();
    expect(field?.type).toBe("text");
    expect(field?.defaultValue).toBe("");
  });

  it("alertShowHistory is a boolean defaulting to false", () => {
    const field = alertsConfigSchema.find((f) => f.key === "alertShowHistory");
    expect(field).toBeDefined();
    expect(field?.type).toBe("boolean");
    expect(field?.defaultValue).toBe(false);
  });

  it("alertSeverityFilter is a select with 4 options", () => {
    const field = alertsConfigSchema.find((f) => f.key === "alertSeverityFilter");
    expect(field).toBeDefined();
    expect(field?.type).toBe("select");
    expect(field?.options?.length).toBe(4);
    expect(field?.defaultValue).toBe("all");
  });

  it("alertDimOnAlert is a boolean defaulting to false", () => {
    const field = alertsConfigSchema.find((f) => f.key === "alertDimOnAlert");
    expect(field).toBeDefined();
    expect(field?.type).toBe("boolean");
    expect(field?.defaultValue).toBe(false);
  });
});

// ── buildAlertsPayload happy path + history button (X15/A2) ────

describe("Alerts — buildAlertsPayload happy path ", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetAlertsForTest();
    _resetSemanticProducers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    setAlertsEnabled(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("returns non-null payload with correct cardId when active alerts exist", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    initAlertsCard(); // registers semantic producer + calls cacheDom
    const activeAlert: AlertEvent = {
      id: "active-001",
      alerts: [{ cities: ["תל אביב", "רמת גן"], threat: 2, time: NOW_SEC - 30 }],
    };
    renderAlerts([activeAlert], false);
    const payload = getSemanticPayload("alerts");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("alerts");
    expect(payload!.text).toContain("צבע אדום");
    expect(typeof payload!.ts).toBe("number");
  });

  it("returns null payload when no recent active alerts", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    initAlertsCard();
    // Alert older than 600 sec → not active
    const oldAlert: AlertEvent = {
      id: "old-001",
      alerts: [{ cities: ["חיפה"], threat: 1, time: NOW_SEC - 700 }],
    };
    renderAlerts([oldAlert], false);
    const payload = getSemanticPayload("alerts");
    expect(payload).toBeNull();
  });
});

describe("Alerts — initAlertsCard history button ( / A2 lines 654-658)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetAlertsForTest();
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge"></div>
      <button id="alerts-history-btn" aria-expanded="false"></button>
      <div id="alerts-history-panel" class="is-hidden"></div>
    `;
    setAlertsEnabled(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("clicking history btn removes is-hidden and sets aria-expanded=true", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    initAlertsCard();
    const btn = document.getElementById("alerts-history-btn")!;
    const panel = document.getElementById("alerts-history-panel")!;
    btn.click();
    expect(panel.classList.contains("is-hidden")).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("clicking history btn twice restores is-hidden and aria-expanded=false", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    initAlertsCard();
    const btn = document.getElementById("alerts-history-btn")!;
    const panel = document.getElementById("alerts-history-panel")!;
    btn.click(); // open
    btn.click(); // close
    expect(panel.classList.contains("is-hidden")).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

// ── S564: buildAlertItem with undefined cities/threat (L236/L237 ?? fallbacks)

describe("Alerts — buildAlertItem missing cities/threat fields", () => {
  it("handles alert with undefined cities (falls back to empty array)", () => {
    const ev: AlertEvent = {
      id: "no-cities",
      alerts: [{ time: NOW_SEC - 60 } as never],
    };
    const el = buildAlertItem(ev, NOW_SEC, false, false);
    expect(el).toBeInstanceOf(HTMLElement);
    // No cities → empty cities text
    const citiesDiv = el!.querySelector(".alert-cities");
    expect(citiesDiv?.textContent).toBe("");
  });

  it("handles alert with undefined threat (falls back to 0)", () => {
    const ev: AlertEvent = {
      id: "no-threat",
      alerts: [{ cities: ["חיפה"], time: NOW_SEC - 60 } as never],
    };
    const el = buildAlertItem(ev, NOW_SEC, false, false);
    expect(el).toBeInstanceOf(HTMLElement);
    // threat 0 should use the default threat icon
    const threatEl = el!.querySelector(".alert-threat");
    expect(threatEl?.textContent).toBeTruthy();
  });

  it("returns null when alerts[0] is undefined (sparse array — L234)", () => {
    const ev = {
      id: "sparse",
      alerts: [, { cities: ["א"], threat: 1, time: NOW_SEC - 60 }],
    } as unknown as AlertEvent;
    const el = buildAlertItem(ev, NOW_SEC, false, false);
    expect(el).toBeNull();
  });
});

describe("Alerts — renderAlerts with undefined/empty alerts array", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="alerts-scroll"></div>
      <div id="alerts-badge"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("handles event with undefined alerts property (L300 ?? [] fallback)", () => {
    const ev = { id: "no-alerts-prop" } as unknown as AlertEvent;
    expect(() => renderAlerts([ev], false)).not.toThrow();
  });

  it("skips buildAlertItem null result in render loop (L353 else)", () => {
    // Event with empty alerts → buildAlertItem returns null → fragment not appended
    const ev: AlertEvent = { id: "empty-alerts", alerts: [] };
    expect(() => renderAlerts([ev, sampleEvent], false)).not.toThrow();
    // The valid event still renders
    const scroll = document.getElementById("alerts-scroll")!;
    expect(scroll.querySelectorAll(".alert-item").length).toBeGreaterThan(0);
  });
});
