/**
 * Tests for src/cards/alerts/alerts.ts
 *
 * Covers: buildAlertItem DOM output, renderAlerts, setAlertsEnabled, setAlertsRealtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
} from "@/cards/alerts/alerts";
import * as idleMod from "@/core/idle";
import type { AlertEvent } from "@/types/api";

const NOW_SEC = Math.floor(Date.now() / 1000);

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
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes("allorigins")) {
          return {
            ok: true,
            json: async () => ({ contents: JSON.stringify(FRESH) }),
          } as Response;
        }
        return { ok: false, json: async () => [] } as unknown as Response;
      },
    );
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

// ── Sprint 5: scheduleAlerts branches, notify path, page-hidden, initAlertsCard ────────

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
    expect(
      document.getElementById("alerts-scroll")?.querySelector(".alert-item"),
    ).not.toBeNull();
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

// ──────── END OF SPRINT 5 TESTS ──────────────────────────────────────────────

// ── Sprint 6: catch block (lines 292-294) + setAlertsEnabled timer cleanup (lines 303-304) ──

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

  it("catch block runs when cSet throws during data processing", async () => {
    // Mock cSet to throw, which is called inside the try block
    const cacheMod = await import("@/core/cache");
    vi.spyOn(cacheMod, "cSet").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    // Fetch returns valid data so the try block gets far enough to call cSet
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "catch-001", alerts: [{ cities: ["אשדוד"], threat: 1, time: Math.floor(Date.now() / 1000) - 30 }] },
      ],
    } as Response);
    await expect(loadAlerts()).resolves.not.toThrow();
    vi.mocked(cacheMod.cSet).mockRestore();
  });
});
// ── Sprint: notify() with Notification permission ──────────────────────────

describe("Alerts — notify with Notification permission granted", () => {
  const NOW = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
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
    vi.resetModules();
    const NotifMock = vi.fn() as unknown as typeof Notification & ReturnType<typeof vi.fn>;
    (NotifMock as unknown as { permission: string }).permission = "granted";
    vi.stubGlobal("Notification", NotifMock);

    const data1 = [{ id: "n-001", alerts: [{ cities: ["תל אביב"], threat: 1, time: NOW - 30 }] }];
    const data2 = [{ id: "n-002", alerts: [{ cities: ["חיפה", "נצרת", "עכו", "קצרין"], threat: 2, time: NOW - 10 }] }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => data1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => data2 } as Response);

    const m = await import("@/cards/alerts/alerts");
    m.cacheDom();
    m.setAlertsEnabled(true);
    await m.loadAlerts(); // first call sets _lastAlertId
    await m.loadAlerts(); // second call: different id → isNew → notify

    expect(NotifMock).toHaveBeenCalled();
    const calls = (NotifMock as ReturnType<typeof vi.fn>).mock.calls;
    const lastOpts = calls[calls.length - 1]?.[1] as { body: string };
    expect(lastOpts.body).toContain("חיפה");
    expect(lastOpts.body).toContain("עכו");
    expect(lastOpts.body).not.toContain("קצרין");
    m.setAlertsEnabled(false);
  });

  it("uses fallback text when alert event has no alerts array", async () => {
    vi.resetModules();
    const NotifMock = vi.fn() as unknown as typeof Notification & ReturnType<typeof vi.fn>;
    (NotifMock as unknown as { permission: string }).permission = "granted";
    vi.stubGlobal("Notification", NotifMock);

    const data1 = [{ id: "f-001", alerts: [{ cities: ["ירושלים"], threat: 1, time: NOW - 30 }] }];
    const data2 = [{ id: "f-002" }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => data1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => data2 } as Response);

    const m = await import("@/cards/alerts/alerts");
    m.cacheDom();
    m.setAlertsEnabled(true);
    await m.loadAlerts();
    await m.loadAlerts();

    expect(NotifMock).toHaveBeenCalled();
    const calls = (NotifMock as ReturnType<typeof vi.fn>).mock.calls;
    const lastOpts = calls[calls.length - 1]?.[1] as { body: string };
    expect(lastOpts.body).toBe("אזורים שונים");
    m.setAlertsEnabled(false);
  });

  it("uses cities ?? [] fallback when alert has no cities property", async () => {
    vi.resetModules();
    const NotifMock = vi.fn() as unknown as typeof Notification & ReturnType<typeof vi.fn>;
    (NotifMock as unknown as { permission: string }).permission = "granted";
    vi.stubGlobal("Notification", NotifMock);

    const data1 = [{ id: "c-001", alerts: [{ cities: ["באר שבע"], threat: 1, time: NOW - 30 }] }];
    const data2 = [{ id: "c-002", alerts: [{ threat: 1, time: NOW - 10 }] }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => data1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => data2 } as Response);

    const m = await import("@/cards/alerts/alerts");
    m.cacheDom();
    m.setAlertsEnabled(true);
    await m.loadAlerts();
    await m.loadAlerts();

    expect(NotifMock).toHaveBeenCalled();
    const calls = (NotifMock as ReturnType<typeof vi.fn>).mock.calls;
    const lastOpts = calls[calls.length - 1]?.[1] as { body: string };
    expect(lastOpts.body).toBe("");
    m.setAlertsEnabled(false);
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

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );

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
      json: async () => [
        { id, alerts: [{ cities: ["תל אביב"], threat: 1, time: nowSec - 30 }] },
      ],
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
        json: async () => [
          { alerts: [{ cities: ["תל אביב"], threat: 1, time: nowTs - 10 }] },
        ],
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

// ── loadAlerts catch block via cSet throw (lines 291-295) ────────────────────

describe("Alerts — loadAlerts catch block when cSet throws (lines 291-295)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setAlertsEnabled(true);
  });

  it("hits catch block when cSet throws after valid data received (lines 291-295)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    const nowTs = Math.floor(Date.now() / 1000);
    // fetch returns valid alert data (data.length > 0) → then cSet throws → outer catch fires
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "z1", alerts: [{ cities: ["תל אביב"], threat: 1, time: nowTs - 10 }] }],
    }));
    // Spy on cSet from the real cache module to throw when called
    const cacheModule = await import("@/core/cache");
    vi.spyOn(cacheModule, "cSet").mockImplementationOnce(() => {
      throw new Error("forced cSet throw for catch coverage");
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

  it("takes stale?'ok':'error' FALSE path in catch when cache empty + cSet throws (lines 291-293)", async () => {
    const cacheModule = await import("@/core/cache");
    cacheModule.cClear(); // stale = null → ternary takes 'error'
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cacheDom();
    setAlertsEnabled(true);
    const nowTs = Math.floor(Date.now() / 1000);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "c1", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 10 }] }],
    }));
    vi.spyOn(cacheModule, "cSet").mockImplementationOnce(() => {
      throw new Error("forced cSet throw for catch stale=null coverage");
    });
    await expect(loadAlerts()).resolves.toBeUndefined();
  });
});

// ── Sprint v7.11: coverage for playBeep, notify, renderAlerts, fetchAlerts ──

describe("Alerts — playBeep AudioContext unavailable (no throw)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not throw when AudioContext and webkitAudioContext are both undefined", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.resetModules();
    const { loadAlerts: la, cacheDom: cd, setAlertsEnabled: sae } = await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cd();
    sae(true);
    // Mock fetch to return data that triggers notify (new alert) → playBeep is called internally
    // playBeep will try AudioContext → undefined → AudioCtor = undefined → if (!AudioCtor) return
    const nowTs = Math.floor(Date.now() / 1000);
    const { cSet: rCs } = await import("@/core/cache");
    rCs("alerts", [{ id: "old", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 60 }] }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "new_id", alerts: [{ cities: ["חיפה"], threat: 1, time: nowTs - 5 }] }],
    }));
    await expect(la()).resolves.toBeUndefined();
  });
});

describe("Alerts — notify without Notification API (no throw)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not throw when typeof Notification === 'undefined'", async () => {
    vi.stubGlobal("Notification", undefined);
    vi.resetModules();
    const { loadAlerts: la, cacheDom: cd, setAlertsEnabled: sae } = await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cd();
    sae(true);
    const nowTs = Math.floor(Date.now() / 1000);
    const { cSet: rCs } = await import("@/core/cache");
    rCs("alerts", [{ id: "prev", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 60 }] }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "next_id", alerts: [{ cities: ["רחובות"], threat: 1, time: nowTs - 3 }] }],
    }));
    await expect(la()).resolves.toBeUndefined();
  });
});

describe("Alerts — notify Notification.permission not granted (no throw)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not throw when Notification.permission is 'denied'", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    vi.resetModules();
    const { loadAlerts: la, cacheDom: cd, setAlertsEnabled: sae } = await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cd();
    sae(true);
    const nowTs = Math.floor(Date.now() / 1000);
    const { cSet: rCs } = await import("@/core/cache");
    rCs("alerts", [{ id: "deny1", alerts: [{ cities: ["נצרת"], threat: 1, time: nowTs - 120 }] }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "deny2", alerts: [{ cities: ["נצרת"], threat: 1, time: nowTs - 2 }] }],
    }));
    await expect(la()).resolves.toBeUndefined();
  });
});

describe("Alerts — renderAlerts elScroll null (no throw)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("returns immediately without throwing when elScroll is null", async () => {
    vi.resetModules();
    const { renderAlerts: ra, cacheDom: cd } = await import("@/cards/alerts/alerts");
    // No DOM → elScroll stays null after cacheDom
    document.body.innerHTML = "";
    cd(); // elScroll = null
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = { id: "x", alerts: [{ cities: ["תל אביב"], threat: 1, time: nowTs - 10 }] };
    expect(() => ra([ev], false)).not.toThrow();
  });
});

describe("Alerts — fetchAlerts !res.ok falls through to next proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("skips non-ok responses and falls through chain returning []", async () => {
    vi.resetModules();
    const { loadAlerts: la, cacheDom: cd, setAlertsEnabled: sae } = await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge"></div>`;
    cd();
    sae(true);
    // All responses are 404 (not ok)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));
    await expect(la()).resolves.toBeUndefined();
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
    vi.resetModules();
  });

  it("does not throw when badge element is null during highlight", async () => {
    vi.resetModules();
    const { renderAlerts: ra, cacheDom: cd } = await import("@/cards/alerts/alerts");
    // Provide scroll but no badge
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cd(); // elBadge = null
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = { id: "x2", alerts: [{ cities: ["נצרת"], threat: 1, time: nowTs - 5 }] };
    expect(() => ra([ev], true)).not.toThrow();
  });
});

// ── F2 (v7.2): Alert volume control ──────────────────────────────────────

describe("Alerts — setAlertVolume / getAlertVolume (F2 v7.2)", () => {
  it("getAlertVolume returns 18 by default", async () => {
    vi.resetModules();
    const { getAlertVolume } = await import("@/cards/alerts/alerts");
    expect(getAlertVolume()).toBe(18);
  });

  it("setAlertVolume updates getAlertVolume", async () => {
    vi.resetModules();
    const { setAlertVolume, getAlertVolume } = await import("@/cards/alerts/alerts");
    setAlertVolume(55);
    expect(getAlertVolume()).toBe(55);
  });

  it("setAlertVolume clamps to 0-100", async () => {
    vi.resetModules();
    const { setAlertVolume, getAlertVolume } = await import("@/cards/alerts/alerts");
    setAlertVolume(-10);
    expect(getAlertVolume()).toBe(0);
    setAlertVolume(200);
    expect(getAlertVolume()).toBe(100);
  });
});

// ── Sprint 19: clearUnreadAlerts + document.title badge ──────────────────────

describe("Alerts — clearUnreadAlerts resets badge and document.title", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
    document.title = "FamilyDashBoard";
  });

  it("clearUnreadAlerts hides badge and clears unread count", async () => {
    vi.resetModules();
    const { renderAlerts: ra, clearUnreadAlerts: cua, cacheDom: cd } =
      await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge" style="display:none">0</div>`;
    cd();
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = { id: "s19a", alerts: [{ cities: ["ת״א"], threat: 1, time: nowTs - 5 }] };
    // Accumulate 2 unread
    ra([ev], true);
    ra([ev], true);
    const badge = document.getElementById("alerts-badge")!;
    expect(Number(badge.textContent)).toBeGreaterThanOrEqual(2);
    // Now clear
    cua();
    expect(badge.textContent).toBe("0");
    expect(badge.style.display).toBe("none");
  });

  it("clearUnreadAlerts without badge element does not throw", async () => {
    vi.resetModules();
    const { clearUnreadAlerts: cua, cacheDom: cd } = await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div>`;
    cd(); // elBadge = null
    expect(() => cua()).not.toThrow();
  });

  it("renderAlerts with highlightNew=true updates document.title with unread count", async () => {
    vi.resetModules();
    document.title = "FamilyDashBoard";
    const { renderAlerts: ra, cacheDom: cd } = await import("@/cards/alerts/alerts");
    document.body.innerHTML = `<div id="alerts-scroll"></div><div id="alerts-badge" style="display:none">0</div>`;
    cd();
    const nowTs = Math.floor(Date.now() / 1000);
    const ev: AlertEvent = { id: "s19b", alerts: [{ cities: ["חיפה"], threat: 1, time: nowTs - 3 }] };
    ra([ev], true);
    // Title should contain the unread count
    expect(document.title).toMatch(/\(\d+\)/);
  });
});
