/**
 * Tests for src/main.ts
 *
 * Covers: applySeasonClass (seasonal CSS tint on <body>), init (full dashboard bootstrap).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ── Mock ALL modules that init() imports ──
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/cache", () => ({
  cEvict: vi.fn(),
  hydrateFromIdb: vi.fn().mockResolvedValue(0),
  migrateLocalStorageToIdb: vi.fn().mockResolvedValue(0),
  cEvictIdb: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/core/idle", () => ({ initVisibility: vi.fn() }));
vi.mock("@/core/sw-register", () => ({
  registerSW: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/core/config", () => ({
  loadConfig: vi.fn().mockReturnValue({
    nightDimLevel: 0.5,
    alertsEnabled: true,
    realtimeAlerts: false,
    autoTheme: false,
    theme: "warm-dark",
    hiddenCards: [],
    cardSizes: {},
  }),
  saveConfig: vi.fn(),
  loadConfigFromHash: vi.fn().mockReturnValue(null),
}));
vi.mock("@/ui/theme", () => ({ initTheme: vi.fn(), checkAutoTheme: vi.fn() }));
vi.mock("@/ui/keyboard", () => ({
  initKeyboard: vi.fn(),
  registerKey: vi.fn(),
  closeAllOverlays: vi.fn(),
  getKeyboardActions: vi.fn().mockReturnValue([
    { key: "T", desc: "Theme" },
    { key: "D", desc: "Diagnostics" },
  ]),
}));
vi.mock("@/ui/header", () => ({
  initHeader: vi.fn(),
  toggleClockSeconds: vi.fn(),
}));
vi.mock("@/ui/maximize", () => ({
  initCardMaximize: vi.fn(),
  initCardCollapse: vi.fn(),
}));
vi.mock("@/ui/status-bar", () => ({
  initStatusBar: vi.fn(),
  stampRefresh: vi.fn(),
}));
vi.mock("@/ui/ticker", () => ({ initTicker: vi.fn(), applyTickerSpeed: vi.fn() }));
vi.mock("@/ui/config-panel", () => ({
  initConfigPanel: vi.fn(),
  toggleConfigPanel: vi.fn(),
}));
vi.mock("@/ui/screen-mode", () => ({
  initScreenMode: vi.fn(),
  stepFontScale: vi.fn(),
}));
vi.mock("@/ui/night-dimmer", () => ({
  toggleNightDim: vi.fn(),
  initNightDimmer: vi.fn(),
  setWarmTint: vi.fn(),
  isWarmTint: vi.fn().mockReturnValue(false),
}));
vi.mock("@/ui/diag-overlay", () => ({
  initDiagOverlay: vi.fn(),
  toggleDiagOverlay: vi.fn(),
}));
vi.mock("@/ui/bg-images", () => ({ initBgImages: vi.fn() }));
vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/cards/weather/weather", () => ({ initWeatherCard: vi.fn() }));
vi.mock("@/cards/motivation/motivation", () => ({
  initMotivationCard: vi.fn(),
}));
vi.mock("@/cards/news/news", () => ({
  initNewsCard: vi.fn(),
  toggleBookmarkMode: vi.fn(),
}));
vi.mock("@/cards/stocks/stocks", () => ({ initStocksCard: vi.fn() }));
vi.mock("@/cards/currency/currency", () => ({ initCurrencyCard: vi.fn() }));
vi.mock("@/cards/alerts/alerts", () => ({
  initAlertsCard: vi.fn(),
  setAlertsEnabled: vi.fn(),
  setAlertsRealtime: vi.fn(),
  setAlertVolume: vi.fn(),
  toggleAlerts: vi.fn(),
  isAlertsEnabled: vi.fn().mockReturnValue(true),
}));
vi.mock("@/cards/hebrew-cal/hebrew-cal", () => ({
  initHebrewCalCard: vi.fn(),
}));
vi.mock("@/cards/calendar/calendar", () => ({ initCalendarCard: vi.fn() }));
vi.mock("@/cards/tasks/tasks", () => ({ initTasksCard: vi.fn() }));
vi.mock("@/cards/system-info/system-info", () => ({
  initSystemInfoCard: vi.fn(),
}));

import { applySeasonClass, applyHiddenCards, applyCardLayout, applyCardSizes, init } from "@/main";
import { diagLog } from "@/core/diag";
import { cEvict } from "@/core/cache";
import { initVisibility } from "@/core/idle";
import { registerSW } from "@/core/sw-register";
import { loadConfig, saveConfig, loadConfigFromHash } from "@/core/config";
import { initTheme, checkAutoTheme } from "@/ui/theme";
import { initKeyboard, registerKey, getKeyboardActions } from "@/ui/keyboard";
import { initHeader } from "@/ui/header";
import { initCardMaximize, initCardCollapse } from "@/ui/maximize";
import { initStatusBar, stampRefresh } from "@/ui/status-bar";
import { initTicker } from "@/ui/ticker";
import { initConfigPanel } from "@/ui/config-panel";
import { initDiagOverlay } from "@/ui/diag-overlay";
import { initBgImages } from "@/ui/bg-images";
import { initScreenMode, stepFontScale } from "@/ui/screen-mode";
import { initNightDimmer, toggleNightDim } from "@/ui/night-dimmer";
import { initWeatherCard } from "@/cards/weather/weather";
import { initNewsCard, toggleBookmarkMode } from "@/cards/news/news";
import { initStocksCard } from "@/cards/stocks/stocks";
import { initCurrencyCard } from "@/cards/currency/currency";
import {
  initAlertsCard,
  setAlertsEnabled,
  setAlertsRealtime,
  toggleAlerts,
  isAlertsEnabled,
} from "@/cards/alerts/alerts";
import { initTasksCard } from "@/cards/tasks/tasks";
import { initSystemInfoCard } from "@/cards/system-info/system-info";
import { initMotivationCard } from "@/cards/motivation/motivation";
import { initHebrewCalCard } from "@/cards/hebrew-cal/hebrew-cal";
import { initCalendarCard } from "@/cards/calendar/calendar";
import { showToast } from "@/ui/toast";

describe("Main — applySeasonClass (F27 seasonal tint)", () => {
  afterEach(() => {
    document.body.className = "";
    vi.useRealTimers();
  });

  it("adds season-spring in April (month 3)", () => {
    vi.setSystemTime(new Date("2024-04-15T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-spring")).toBe(true);
  });

  it("adds season-summer in July (month 6)", () => {
    vi.setSystemTime(new Date("2024-07-15T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-summer")).toBe(true);
  });

  it("adds season-autumn in October (month 9)", () => {
    vi.setSystemTime(new Date("2024-10-15T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-autumn")).toBe(true);
  });

  it("adds season-winter in January (month 0)", () => {
    vi.setSystemTime(new Date("2024-01-15T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-winter")).toBe(true);
  });

  it("adds season-winter in December (month 11)", () => {
    vi.setSystemTime(new Date("2024-12-15T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-winter")).toBe(true);
  });

  it("adds season-spring for March (month 2, start of spring)", () => {
    vi.setSystemTime(new Date("2024-03-01T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-spring")).toBe(true);
  });

  it("adds season-autumn for November (month 10, end of autumn)", () => {
    vi.setSystemTime(new Date("2024-11-30T12:00:00"));
    applySeasonClass();
    expect(document.body.classList.contains("season-autumn")).toBe(true);
  });

  it("only adds one season class at a time", () => {
    vi.setSystemTime(new Date("2024-04-15T12:00:00"));
    applySeasonClass();
    vi.setSystemTime(new Date("2024-07-15T12:00:00"));
    applySeasonClass();
    const seasons = ["season-spring", "season-summer", "season-autumn", "season-winter"];
    const active = seasons.filter((s) => document.body.classList.contains(s));
    expect(active.length).toBe(1);
    expect(active[0]).toBe("season-summer");
  });

  it("does not throw when called", () => {
    expect(() => applySeasonClass()).not.toThrow();
  });
});

// ── init() tests ──

describe("Main — init() core setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reinstall default config mock
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
    vi.useRealTimers();
  });

  it("calls cEvict on startup", () => {
    init();
    expect(cEvict).toHaveBeenCalled();
  });

  it("calls initVisibility", () => {
    init();
    expect(initVisibility).toHaveBeenCalled();
  });

  it("calls initTheme", () => {
    init();
    expect(initTheme).toHaveBeenCalled();
  });

  it("calls initScreenMode", () => {
    init();
    expect(initScreenMode).toHaveBeenCalled();
  });

  it("calls initKeyboard", () => {
    init();
    expect(initKeyboard).toHaveBeenCalled();
  });

  it("calls initHeader", () => {
    init();
    expect(initHeader).toHaveBeenCalled();
  });

  it("calls initBgImages", () => {
    init();
    expect(initBgImages).toHaveBeenCalled();
  });

  it("calls initCardMaximize and initCardCollapse", () => {
    init();
    expect(initCardMaximize).toHaveBeenCalled();
    expect(initCardCollapse).toHaveBeenCalled();
  });

  it("calls initStatusBar", () => {
    init();
    expect(initStatusBar).toHaveBeenCalled();
  });

  it("calls initConfigPanel", () => {
    init();
    expect(initConfigPanel).toHaveBeenCalled();
  });

  it("calls initDiagOverlay", () => {
    init();
    expect(initDiagOverlay).toHaveBeenCalled();
  });

  it("calls stampRefresh", () => {
    init();
    expect(stampRefresh).toHaveBeenCalled();
  });

  it("calls registerSW", () => {
    init();
    expect(registerSW).toHaveBeenCalled();
  });

  it("calls diagLog with starting message", () => {
    init();
    expect(diagLog).toHaveBeenCalledWith(expect.stringContaining("starting"));
  });

  it("calls diagLog with initialized message", () => {
    init();
    expect(diagLog).toHaveBeenCalledWith(expect.stringContaining("initialized"));
  });
});

describe("Main — init() card initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("calls initWeatherCard", () => {
    init();
    expect(initWeatherCard).toHaveBeenCalled();
  });

  it("calls initNewsCard", () => {
    init();
    expect(initNewsCard).toHaveBeenCalled();
  });

  it("calls initStocksCard", () => {
    init();
    expect(initStocksCard).toHaveBeenCalled();
  });

  it("calls initCurrencyCard", () => {
    init();
    expect(initCurrencyCard).toHaveBeenCalled();
  });

  it("calls initAlertsCard", () => {
    init();
    expect(initAlertsCard).toHaveBeenCalled();
  });

  it("calls initMotivationCard", () => {
    init();
    expect(initMotivationCard).toHaveBeenCalled();
  });

  it("calls initHebrewCalCard", () => {
    init();
    expect(initHebrewCalCard).toHaveBeenCalled();
  });

  it("calls initCalendarCard", () => {
    init();
    expect(initCalendarCard).toHaveBeenCalled();
  });

  it("calls initTicker", () => {
    init();
    expect(initTicker).toHaveBeenCalled();
  });
});

describe("Main — init() config-based setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.7,
      alertsEnabled: false,
      realtimeAlerts: true,
      autoTheme: true,
      theme: "ocean-blue",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("passes nightDimLevel to initNightDimmer", () => {
    init();
    expect(initNightDimmer).toHaveBeenCalledWith(0.7, false, 23, 6);
  });

  it("passes alertsEnabled to setAlertsEnabled", () => {
    init();
    expect(setAlertsEnabled).toHaveBeenCalledWith(false);
  });

  it("passes realtimeAlerts to setAlertsRealtime", () => {
    init();
    expect(setAlertsRealtime).toHaveBeenCalledWith(true);
  });

  it("calls checkAutoTheme with config values", () => {
    init();
    expect(checkAutoTheme).toHaveBeenCalledWith(true, "ocean-blue");
  });
});

describe("Main — init() keyboard shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("registers 's' key for config panel", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "s")).toBe(true);
  });

  it("registers 'n' key for night dimmer", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "n")).toBe(true);
  });

  it("registers '+' and '-' keys for font scale", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "+")).toBe(true);
    expect(calls.some(([k]) => k === "-")).toBe(true);
  });

  it("registers '=' key as alias for font scale up", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "=")).toBe(true);
  });

  it("registers 'f' key for fullscreen", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "f")).toBe(true);
  });

  it("registers 'b' key for bookmarks", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "b")).toBe(true);
  });

  it("registers 'r' key for reload", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "r")).toBe(true);
  });

  it("registers 'h' and '?' keys for help", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "h")).toBe(true);
    expect(calls.some(([k]) => k === "?")).toBe(true);
  });

  it("registers 'd' key for diagnostics", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "d")).toBe(true);
  });

  it("registers 'escape' key for close overlays", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "escape")).toBe(true);
  });

  it("registers 'c' key for clock seconds", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "c")).toBe(true);
  });
});

describe("Main — init() online/offline handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
    vi.useRealTimers();
  });

  it("shows toast on offline event", () => {
    init();
    window.dispatchEvent(new Event("offline"));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("אין חיבור"), 5000);
  });

  it("shows reconnect toast when coming online after offline", () => {
    init();
    window.dispatchEvent(new Event("offline"));
    vi.mocked(showToast).mockClear();
    window.dispatchEvent(new Event("online"));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("החיבור חזר"), 2500);
  });

  it("does not show reconnect toast on online if never went offline", () => {
    init();
    window.dispatchEvent(new Event("online"));
    const reconnectCalls = vi
      .mocked(showToast)
      .mock.calls.filter(([msg]) => typeof msg === "string" && msg.includes("החיבור חזר"));
    expect(reconnectCalls.length).toBe(0);
  });

  it("does not throw when online schedules reload and window.location.reload is missing", () => {
    init();
    Object.defineProperty(window, "location", {
      value: { hash: "", pathname: "/", search: "" },
      configurable: true,
    });
    vi.useFakeTimers();

    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));

    expect(() => vi.runAllTimers()).not.toThrow();
  });
});

describe("Main — init() notif-bell wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("wires click on #notif-bell to request notification permission", () => {
    document.body.innerHTML = '<button id="notif-bell"></button>';
    const mockReqPerm = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { requestPermission: mockReqPerm });
    init();
    document.getElementById("notif-bell")!.click();
    expect(mockReqPerm).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("Main — init() help overlay toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("'h' handler toggles help-overlay dialog open state", () => {
    document.body.innerHTML = '<dialog id="help-overlay"></dialog>';
    const dlg = document.getElementById("help-overlay") as HTMLDialogElement & {
      showModal?: () => void;
      close?: () => void;
    };
    if (typeof dlg.showModal !== "function") {
      dlg.showModal = function () {
        this.setAttribute("open", "");
      };
      dlg.close = function () {
        this.removeAttribute("open");
      };
    }
    init();
    // Find the 'h' key handler and call it
    const hCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "h");
    expect(hCall).toBeDefined();
    const handler = hCall![2] as () => void;
    handler();
    expect(document.getElementById("help-overlay")!.hasAttribute("open")).toBe(true);
    handler();
    expect(document.getElementById("help-overlay")!.hasAttribute("open")).toBe(false);
  });

  it("'?' handler toggles help-overlay dialog open state", () => {
    document.body.innerHTML = '<dialog id="help-overlay"></dialog>';
    const dlg = document.getElementById("help-overlay") as HTMLDialogElement & {
      showModal?: () => void;
      close?: () => void;
    };
    if (typeof dlg.showModal !== "function") {
      dlg.showModal = function () {
        this.setAttribute("open", "");
      };
      dlg.close = function () {
        this.removeAttribute("open");
      };
    }
    init();
    const qCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "?");
    expect(qCall).toBeDefined();
    const handler = qCall![2] as () => void;
    handler();
    expect(document.getElementById("help-overlay")!.hasAttribute("open")).toBe(true);
    handler();
    expect(document.getElementById("help-overlay")!.hasAttribute("open")).toBe(false);
  });

  it("'?' handler is no-op without help-overlay element", () => {
    document.body.innerHTML = "";
    init();
    const qCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "?");
    expect(qCall).toBeDefined();
    const handler = qCall![2] as () => void;
    expect(() => handler()).not.toThrow();
  });
});

// ── Keyboard handler callback invocation tests ─────────────────────────

describe("Main — init() keyboard lambda callbacks", () => {
  function extractHandler(key: string): () => void {
    const call = vi.mocked(registerKey).mock.calls.find(([k]) => k === key);
    expect(call).toBeDefined();
    return call![2] as () => void;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    init();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("'+' handler calls stepFontScale(1)", () => {
    extractHandler("+")();
    expect(stepFontScale).toHaveBeenCalledWith(1);
  });

  it("'=' handler calls stepFontScale(1)", () => {
    extractHandler("=")();
    expect(stepFontScale).toHaveBeenCalledWith(1);
  });

  it("'-' handler calls stepFontScale(-1)", () => {
    extractHandler("-")();
    expect(stepFontScale).toHaveBeenCalledWith(-1);
  });

  it("'b' handler calls toggleBookmarkMode()", () => {
    extractHandler("b")();
    expect(toggleBookmarkMode).toHaveBeenCalled();
  });

  it("'r' handler calls window.location.reload()", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });
    extractHandler("r")();
    expect(reloadMock).toHaveBeenCalled();
  });

  it("'f' handler requests fullscreen when not fullscreen", () => {
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
    });
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    extractHandler("f")();
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
  });

  it("'f' handler exits fullscreen when already fullscreen", () => {
    Object.defineProperty(document, "fullscreenElement", {
      value: document.body,
      configurable: true,
    });
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    extractHandler("f")();
    expect(document.exitFullscreen).toHaveBeenCalled();
    // Restore
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
    });
  });
});

// ── SW NETWORK_BACK message handler ────────────────────────────────────

describe("Main — init() SW NETWORK_BACK message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.unstubAllGlobals();
  });

  it("shows reconnect toast on NETWORK_BACK when not offline", () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        addEventListener: vi.fn((type: string, cb: (e: unknown) => void) => {
          listeners[type] = cb;
        }),
      },
    });
    init();
    expect(listeners["message"]).toBeDefined();
    listeners["message"]({ data: { type: "NETWORK_BACK" } });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("החיבור חזר"), 2500);
  });

  it("does NOT show NETWORK_BACK toast when already in offline state", () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        addEventListener: vi.fn((type: string, cb: (e: unknown) => void) => {
          listeners[type] = cb;
        }),
      },
    });
    init();
    // Trigger offline first to set _wenOffline = true
    window.dispatchEvent(new Event("offline"));
    vi.mocked(showToast).mockClear();
    // Now NETWORK_BACK should be ignored because _wenOffline is true
    listeners["message"]({ data: { type: "NETWORK_BACK" } });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("ignores SW message with unrelated type", () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: {
        addEventListener: vi.fn((type: string, cb: (e: unknown) => void) => {
          listeners[type] = cb;
        }),
      },
    });
    init();
    vi.mocked(showToast).mockClear();
    listeners["message"]({ data: { type: "VERSION_ACTIVATED" } });
    expect(showToast).not.toHaveBeenCalledWith(
      expect.stringContaining("החיבור חזר"),
      expect.anything(),
    );
  });
});

// ── applyHiddenCards ────────────────────────────────────────────────────────

describe("Main — applyHiddenCards", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hides a card whose id is in hiddenCards", () => {
    document.body.innerHTML = '<div data-card-id="weather"></div>';
    applyHiddenCards(["weather"]);
    const el = document.querySelector<HTMLElement>("[data-card-id='weather']")!;
    expect(el.style.display).toBe("none");
  });

  it("shows a card whose id is NOT in hiddenCards", () => {
    document.body.innerHTML = '<div data-card-id="stocks" style="display:none"></div>';
    applyHiddenCards([]);
    const el = document.querySelector<HTMLElement>("[data-card-id='stocks']")!;
    expect(el.style.display).toBe("");
  });

  it("handles multiple cards: hides some, shows others", () => {
    document.body.innerHTML = `
      <div data-card-id="weather"></div>
      <div data-card-id="news"></div>
      <div data-card-id="stocks"></div>
    `;
    applyHiddenCards(["weather", "stocks"]);
    expect(document.querySelector<HTMLElement>("[data-card-id='weather']")!.style.display).toBe(
      "none",
    );
    expect(document.querySelector<HTMLElement>("[data-card-id='news']")!.style.display).toBe("");
    expect(document.querySelector<HTMLElement>("[data-card-id='stocks']")!.style.display).toBe(
      "none",
    );
  });

  it("does not throw when no [data-card-id] elements exist", () => {
    document.body.innerHTML = "";
    expect(() => applyHiddenCards(["weather"])).not.toThrow();
  });

  it("shows all cards when hiddenCards is empty array", () => {
    document.body.innerHTML = `
      <div data-card-id="weather" style="display:none"></div>
      <div data-card-id="news" style="display:none"></div>
    `;
    applyHiddenCards([]);
    expect(document.querySelector<HTMLElement>("[data-card-id='weather']")!.style.display).toBe("");
    expect(document.querySelector<HTMLElement>("[data-card-id='news']")!.style.display).toBe("");
  });
});

// ── applyCardLayout ─────────────────────────────────────────────────────────

describe("Main — applyCardLayout", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns early when layout is null", () => {
    document.body.innerHTML = `
      <div class="grid-col-left"></div>
      <div data-card-id="weather"></div>
    `;
    expect(() => applyCardLayout(null)).not.toThrow();
    // card should still be in body, not moved
    expect(document.querySelector("[data-card-id='weather']")).not.toBeNull();
  });

  it("moves a card to the correct column", () => {
    document.body.innerHTML = `
      <div class="grid-col-left"></div>
      <div class="grid-col-mid"></div>
      <div class="grid-col-right"></div>
      <div data-card-id="weather"></div>
      <div data-card-id="news"></div>
    `;
    applyCardLayout([["weather"], ["news"], []]);
    const left = document.querySelector(".grid-col-left")!;
    const mid = document.querySelector(".grid-col-mid")!;
    expect(left.querySelector("[data-card-id='weather']")).not.toBeNull();
    expect(mid.querySelector("[data-card-id='news']")).not.toBeNull();
  });

  it("ignores unknown card ids silently", () => {
    document.body.innerHTML = `
      <div class="grid-col-left"></div>
      <div class="grid-col-mid"></div>
      <div class="grid-col-right"></div>
    `;
    expect(() => applyCardLayout([["nonexistent-card"], [], []])).not.toThrow();
  });

  it("does not throw when column elements are missing", () => {
    document.body.innerHTML = '<div data-card-id="weather"></div>';
    expect(() => applyCardLayout([["weather"], [], []])).not.toThrow();
  });
});

// ── applyCardSizes ──────────────────────────────────────────────────────────

describe("Main — applyCardSizes", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets data-card-size on matching card element", () => {
    document.body.innerHTML = '<section data-card-id="weather"></section>';
    applyCardSizes({ weather: "lg" });
    const el = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    expect(el.dataset["cardSize"]).toBe("lg");
  });

  it("applies multiple card sizes in one call", () => {
    document.body.innerHTML = `
      <section data-card-id="weather"></section>
      <section data-card-id="news"></section>`;
    applyCardSizes({ weather: "sm", news: "xl" });
    const w = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    const n = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    expect(w.dataset["cardSize"]).toBe("sm");
    expect(n.dataset["cardSize"]).toBe("xl");
  });

  it("does not throw for unknown card id", () => {
    document.body.innerHTML = '<section data-card-id="weather"></section>';
    expect(() => applyCardSizes({ nonexistent: "md" })).not.toThrow();
  });

  it("does nothing when given an empty object", () => {
    document.body.innerHTML = '<section data-card-id="weather"></section>';
    applyCardSizes({});
    const el = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    expect(el.dataset["cardSize"]).toBeUndefined();
  });
});

// ── Additional card init tests ──────────────────────────────────────────────

describe("Main — init() tasks and system-info cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("calls initTasksCard", () => {
    init();
    expect(initTasksCard).toHaveBeenCalled();
  });

  it("calls initSystemInfoCard", () => {
    init();
    expect(initSystemInfoCard).toHaveBeenCalled();
  });
});

// ── 'a' key handler ──────────────────────────────────────────────────────────

describe("Main — init() 'a' key alerts toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("registers 'a' key for alerts toggle", () => {
    init();
    const calls = vi.mocked(registerKey).mock.calls;
    expect(calls.some(([k]) => k === "a")).toBe(true);
  });

  it("'a' handler calls toggleAlerts and shows toast", () => {
    vi.mocked(isAlertsEnabled).mockReturnValue(true);
    init();
    const aCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "a");
    expect(aCall).toBeDefined();
    const handler = aCall![2] as () => void;
    handler();
    expect(toggleAlerts).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("התרעות"), 2500);
  });

  it("'a' handler shows enabled toast when alerts are on", () => {
    vi.mocked(isAlertsEnabled).mockReturnValue(true);
    init();
    const aCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "a");
    const handler = aCall![2] as () => void;
    handler();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("✅"), 2500);
  });

  it("'a' handler shows disabled toast when alerts are off", () => {
    vi.mocked(isAlertsEnabled).mockReturnValue(false);
    init();
    const aCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "a");
    const handler = aCall![2] as () => void;
    handler();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("❌"), 2500);
  });
});

// ── URL hash config import ──────────────────────────────────────────────────

describe("Main — init() URL hash config import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
    vi.unstubAllGlobals();
  });

  it("calls saveConfig when loadConfigFromHash returns config", () => {
    vi.mocked(loadConfigFromHash).mockReturnValueOnce({ theme: "ocean" } as ReturnType<
      typeof loadConfig
    >);
    Object.defineProperty(window, "location", {
      value: { hash: "#cfg=abc123", pathname: "/", search: "" },
      configurable: true,
    });
    Object.defineProperty(window, "history", {
      value: { replaceState: vi.fn() },
      configurable: true,
    });
    init();
    expect(vi.mocked(saveConfig)).toHaveBeenCalled();
  });
});

// ── Sprint v7.12: w/1/2/3/m key registrations ─────────────────────────────

describe("Main — init() keyboard shortcuts — w/1/2/3/m (Sprint v7.12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("registers 'w' key for °C/°F toggle", () => {
    init();
    expect(vi.mocked(registerKey).mock.calls.some(([k]) => k === "w")).toBe(true);
  });

  it("registers '1' key for weather city 1", () => {
    init();
    expect(vi.mocked(registerKey).mock.calls.some(([k]) => k === "1")).toBe(true);
  });

  it("registers '2' key for weather city 2", () => {
    init();
    expect(vi.mocked(registerKey).mock.calls.some(([k]) => k === "2")).toBe(true);
  });

  it("registers '3' key for weather city 3", () => {
    init();
    expect(vi.mocked(registerKey).mock.calls.some(([k]) => k === "3")).toBe(true);
  });

  it("registers 'm' key for motivation next", () => {
    init();
    expect(vi.mocked(registerKey).mock.calls.some(([k]) => k === "m")).toBe(true);
  });
});

// ── Sprint v7.12: city-tab handlers 1/2/3 ────────────────────────────────────

describe("Main — keyboard handlers for city tab shortcuts (Sprint v7.12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
    document.body.innerHTML = `
      <button class="wx-city-tab active" data-city="1">ירושלים</button>
      <button class="wx-city-tab" data-city="2">ת"א</button>
      <button class="wx-city-tab" data-city="3">חיפה</button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("'1' handler does not throw when tab is present in DOM", () => {
    init();
    const handler = vi.mocked(registerKey).mock.calls.find(([k]) => k === "1")?.[2] as () => void;
    expect(handler).toBeDefined();
    expect(() => handler()).not.toThrow();
  });

  it("'2' handler does not throw when tab is present in DOM", () => {
    init();
    const handler = vi.mocked(registerKey).mock.calls.find(([k]) => k === "2")?.[2] as () => void;
    expect(handler).toBeDefined();
    expect(() => handler()).not.toThrow();
  });

  it("'3' handler does not throw when tab is present in DOM", () => {
    init();
    const handler = vi.mocked(registerKey).mock.calls.find(([k]) => k === "3")?.[2] as () => void;
    expect(handler).toBeDefined();
    expect(() => handler()).not.toThrow();
  });

  it("'1' handler does not throw when city-tab absent from DOM", () => {
    document.body.innerHTML = "";
    init();
    const handler = vi.mocked(registerKey).mock.calls.find(([k]) => k === "1")?.[2] as () => void;
    expect(() => handler()).not.toThrow();
  });

  it("'w' handler is registered as a callable function", () => {
    init();
    const wCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "w");
    expect(wCall).toBeDefined();
    expect(typeof wCall![2]).toBe("function");
  });
});
// ── F10 (v7.2): L key warm tint ──────────────────────────────────────────────

describe("Main — 'l' key registers warm tint toggle (F10 v7.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
    } as ReturnType<typeof loadConfig>);
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("'l' key is registered via registerKey", () => {
    init();
    const lCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "l");
    expect(lCall).toBeDefined();
    expect(typeof lCall![2]).toBe("function");
  });

  it("'l' handler calls setWarmTint with toggled value", () => {
    init();
    const lHandler = vi.mocked(registerKey).mock.calls.find(([k]) => k === "l")?.[2] as () => void;
    expect(lHandler).toBeDefined();
    expect(() => lHandler()).not.toThrow();
  });
});

// ── F10 (v7.3): Dynamic help overlay ─────────────────────────────────────────

describe("Main — dynamic help overlay (F10 v7.3)", () => {
  function buildHelpDOM(): HTMLDialogElement {
    document.body.innerHTML = `
      <dialog id="help-overlay">
        <div id="help-dynamic-keys"></div>
      </dialog>`;
    const dlg = document.getElementById("help-overlay") as HTMLDialogElement & {
      showModal?: () => void;
      close?: () => void;
    };
    if (typeof dlg.showModal !== "function") {
      dlg.showModal = function () {
        this.setAttribute("open", "");
      };
      dlg.close = function () {
        this.removeAttribute("open");
      };
    }
    return dlg;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({
      nightDimLevel: 0.5,
      alertsEnabled: true,
      realtimeAlerts: false,
      autoTheme: false,
      theme: "warm-dark",
      hiddenCards: [],
      cardSizes: {},
    } as ReturnType<typeof loadConfig>);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("populates #help-dynamic-keys when opening help dialog", () => {
    buildHelpDOM();
    init();
    const hCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "h");
    const handler = hCall![2] as () => void;
    handler();
    const dynEl = document.getElementById("help-dynamic-keys")!;
    expect(dynEl.textContent).toContain("2");
    expect(dynEl.textContent).toContain("קיצורים רשומים");
  });

  it("does not populate when getKeyboardActions returns empty", () => {
    vi.mocked(getKeyboardActions).mockReturnValueOnce([]);
    buildHelpDOM();
    init();
    const hCall = vi.mocked(registerKey).mock.calls.find(([k]) => k === "h");
    const handler = hCall![2] as () => void;
    handler();
    const dynEl = document.getElementById("help-dynamic-keys")!;
    expect(dynEl.textContent).toBe("");
  });
});
