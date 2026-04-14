/**
 * FamilyDashBoard v6 — Main Entry Point
 *
 * Imports all modules, initializes the dashboard.
 */

// ── Styles ──
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/scroll.css";
import "./styles/animations.css";
import "./styles/screen-modes.css";
import "./styles/maximize.css";
import "./styles/a11y.css";
import "./styles/print.css";
import "./styles/sprints.css";

// ── Core ──
import { diagLog } from "./core/diag";
import { cEvict } from "./core/cache";
import { initVisibility } from "./core/idle";
import { registerSW } from "./core/sw-register";
import { loadConfig } from "./core/config";

// ── UI ──
import { initTheme, checkAutoTheme } from "./ui/theme";
import { initKeyboard, registerKey, closeAllOverlays } from "./ui/keyboard";
import { initHeader, toggleClockSeconds } from "./ui/header";
import { initCardMaximize, initCardCollapse } from "./ui/maximize";
import { initStatusBar, stampRefresh } from "./ui/status-bar";
import { initTicker } from "./ui/ticker";
import { initConfigPanel, toggleConfigPanel } from "./ui/config-panel";
import { initScreenMode, stepFontScale } from "./ui/screen-mode";
import { toggleNightDim, initNightDimmer } from "./ui/night-dimmer";
import { initDiagOverlay, toggleDiagOverlay } from "./ui/diag-overlay";
import { initBgImages } from "./ui/bg-images";
import { showToast } from "./ui/toast";

// ── Cards ──
import { initWeatherCard } from "./cards/weather/weather";
import { initMotivationCard } from "./cards/motivation/motivation";
import { initNewsCard, toggleBookmarkMode } from "./cards/news/news";
import { initStocksCard } from "./cards/stocks/stocks";
import { initCurrencyCard } from "./cards/currency/currency";
import {
  initAlertsCard,
  setAlertsEnabled,
  setAlertsRealtime,
} from "./cards/alerts/alerts";
import { initHebrewCalCard } from "./cards/hebrew-cal/hebrew-cal";
import { initCalendarCard } from "./cards/calendar/calendar";

// ── Version ──
export const VERSION = "6.5.0";

/**
 * Apply a seasonal CSS class to <body> based on Northern Hemisphere months.
 * Months (0-based): spring=2–4, summer=5–7, autumn=8–10, winter=11/0/1.
 */
export function applySeasonClass(): void {
  const m = new Date().getMonth();
  const cls =
    m >= 2 && m <= 4
      ? "season-spring"
      : m >= 5 && m <= 7
        ? "season-summer"
        : m >= 8 && m <= 10
          ? "season-autumn"
          : "season-winter";
  document.body.classList.remove(
    "season-spring",
    "season-summer",
    "season-autumn",
    "season-winter",
  );
  document.body.classList.add(cls);
}

/**
 * Application initialization.
 */
function init(): void {
  diagLog(`[init] FamilyDashBoard v${VERSION} starting...`);

  // Core setup
  cEvict();
  applySeasonClass();
  initVisibility();

  // UI modules
  initTheme();
  initScreenMode();
  initKeyboard();
  initHeader();
  initBgImages();
  initCardMaximize();
  initCardCollapse();
  initStatusBar();
  initConfigPanel();
  initDiagOverlay();

  // ── Additional keyboard shortcuts ──
  registerKey("s", "הגדרות", toggleConfigPanel);
  registerKey("n", "דימר לילה", toggleNightDim);
  registerKey("c", "שניות", toggleClockSeconds);
  registerKey("+", "הגדל גופן", () => stepFontScale(1));
  registerKey("=", "הגדל גופן", () => stepFontScale(1)); // + without shift
  registerKey("-", "הקטן גופן", () => stepFontScale(-1));
  registerKey("f", "מסך מלא", () => {
    if (!document.fullscreenElement)
      void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  });
  registerKey("b", "מועדפים", () => toggleBookmarkMode());
  registerKey("r", "רענון נתונים", () => window.location.reload());
  registerKey("h", "עזרה", () => {
    const ov = document.getElementById("help-overlay");
    if (ov) ov.classList.toggle("visible");
  });
  registerKey("?", "עזרה", () => {
    const ov = document.getElementById("help-overlay");
    if (ov) ov.classList.toggle("visible");
  });
  registerKey("d", "אבחון", toggleDiagOverlay);
  registerKey("escape", "סגור כל חלון", closeAllOverlays);

  // Cards — non-blocking, parallel load
  initWeatherCard();
  initNewsCard();
  initStocksCard();
  initCurrencyCard();
  initAlertsCard();
  initMotivationCard();
  initHebrewCalCard();
  initCalendarCard();
  initTicker();

  // ── Night dimmer auto-schedule (reads dim hours from localStorage) ──
  const cfg = loadConfig();
  initNightDimmer(cfg.nightDimLevel);

  // ── Apply alert config state from saved settings ──
  setAlertsEnabled(cfg.alertsEnabled);
  setAlertsRealtime(cfg.realtimeAlerts);

  // ── Auto-theme by time of day (runs every 5 minutes) ──
  const runAutoTheme = (): void => {
    const c = loadConfig();
    checkAutoTheme(c.autoTheme, c.theme);
  };
  runAutoTheme();
  setInterval(runAutoTheme, 5 * 60_000);

  // Wire notification bell (replaces inline onclick="requestNotifPermission()")
  document.getElementById("notif-bell")?.addEventListener("click", () => {
    void Notification.requestPermission();
  });

  // Stamp initial refresh time
  stampRefresh();

  // Service Worker
  void registerSW();

  // ── Network reconnect: auto-refresh after connectivity loss ──
  let _wenOffline = false;
  window.addEventListener("offline", () => {
    _wenOffline = true;
    showToast("❌ אין חיבור לאינטרנט", 5000);
    diagLog("[init] Network offline");
  });
  window.addEventListener("online", () => {
    if (_wenOffline) {
      _wenOffline = false;
      showToast("🌐 החיבור חזר — מרענן נתונים...", 2500);
      setTimeout(() => window.location.reload(), 2500);
    }
    diagLog("[init] Network online");
  });
  // Also listen to SW NETWORK_BACK broadcast
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as { type?: string };
      if (data?.type === "NETWORK_BACK" && !_wenOffline) {
        showToast("🌐 החיבור חזר — מרענן נתונים...", 2500);
        setTimeout(() => window.location.reload(), 2500);
      }
    });
  }

  diagLog(`[init] Dashboard initialized`);
}

// ── Bootstrap ──
// Skip auto-init in Vitest to prevent side effects (intervals, fetch calls)
// from leaking into test environments and causing hangs.
if (!import.meta.env.VITEST) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
