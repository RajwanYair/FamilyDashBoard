/**
 * FamilyDashBoard v7 — Main Entry Point
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
import "./cards/tasks/tasks.css";
import "./cards/system-info/system-info.css";
import "./cards/countdown/countdown.css";

// ── Core ──
import { diagLog } from "./core/diag";
import { cEvict } from "./core/cache";
import { initVisibility } from "./core/idle";
import { registerSW } from "./core/sw-register";
import { loadConfig, saveConfig, loadConfigFromHash } from "./core/config";

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
import { initCardDragDrop } from "./ui/layout-drag";
import { showToast } from "./ui/toast";

// ── Cards ──
import { initWeatherCard } from "./cards/weather/weather";
import { initMotivationCard, renderMotivation } from "./cards/motivation/motivation";
import { initNewsCard, toggleBookmarkMode } from "./cards/news/news";
import { initStocksCard } from "./cards/stocks/stocks";
import { initCurrencyCard } from "./cards/currency/currency";
import {
  initAlertsCard,
  setAlertsEnabled,
  setAlertsRealtime,
  toggleAlerts,
  isAlertsEnabled,
} from "./cards/alerts/alerts";
import { initHebrewCalCard } from "./cards/hebrew-cal/hebrew-cal";
import { initCalendarCard } from "./cards/calendar/calendar";
import { initTasksCard } from "./cards/tasks/tasks";
import { initSystemInfoCard } from "./cards/system-info/system-info";
import { initCountdownCard } from "./cards/countdown/countdown";

// ── Version ──
export const VERSION = "7.0.0";

/**
 * Hide/show cards based on the `hiddenCards` array in config.
 * Matches `[data-card-id]` elements in the DOM and toggles `display:none`.
 */
export function applyHiddenCards(hiddenCards: string[]): void {
  document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
    const id = el.dataset["cardId"] ?? "";
    el.style.display = hiddenCards.includes(id) ? "none" : "";
  });
}

/**
 * Re-parent cards to the correct DOM column per the saved layout.
 * `layout[0]` = col-left ids, `layout[1]` = col-mid ids, `layout[2]` = col-right ids.
 * Each id is matched against `[data-card-id]` and appended to the target column.
 * Missing ids (unregistered) are silently ignored.
 */
export function applyCardLayout(
  layout: [string[], string[], string[]] | null,
): void {
  if (!layout) return;
  const cols = [
    document.querySelector<HTMLElement>(".grid-col-left"),
    document.querySelector<HTMLElement>(".grid-col-mid"),
    document.querySelector<HTMLElement>(".grid-col-right"),
  ];
  layout.forEach((ids, colIdx) => {
    const col = cols[colIdx];
    if (!col) return;
    for (const id of ids) {
      const card = document.querySelector<HTMLElement>(
        `[data-card-id="${id}"]`,
      );
      if (card) col.appendChild(card);
    }
  });
}

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
export function init(): void {
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
  initCardDragDrop();
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
  registerKey("m", "ציטוט הבא", () => renderMotivation());
  registerKey("r", "רענון נתונים", () => window.location.reload());
  registerKey("a", "התרעות צבע אדום", () => {
    toggleAlerts();
    showToast(
      isAlertsEnabled() ? "✅ התרעות פעילות" : "❌ התרעות הושבתו",
      2500,
    );
  });
  const _toggleHelp = (): void => {
    const dlg = document.getElementById(
      "help-overlay",
    ) as HTMLDialogElement | null;
    if (!dlg) return;
    if (dlg.open) {
      dlg.close();
    } else {
      dlg.showModal();
    }
  };
  registerKey("h", "עזרה", _toggleHelp);
  registerKey("?", "עזרה", _toggleHelp);
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
  initTasksCard();
  initSystemInfoCard();
  initCountdownCard();
  initTicker();

  // ── URL hash config import: #cfg=<base64> overrides localStorage config ──
  const _urlHash = window.location.hash ?? "";
  if (_urlHash.startsWith("#cfg=")) {
    const imported = loadConfigFromHash(_urlHash);
    if (imported) {
      saveConfig(imported);
      // Strip hash so the next reload doesn't re-import
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      diagLog("[init] Config imported from URL hash");
    }
  }

  // ── Night dimmer auto-schedule (reads dim hours from localStorage) ──
  const cfg = loadConfig();
  initNightDimmer(cfg.nightDimLevel);

  // ── Apply card visibility from config ──
  applyHiddenCards(cfg.hiddenCards ?? []);

  // ── Apply saved card layout column assignment ──
  applyCardLayout(cfg.cardLayout ?? null);

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
