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
import "./styles/transitions.css"; // ADR-022 companion: VT Level 2 named transitions (v12.0)
import "./styles/screen-modes.css";
import "./styles/maximize.css";
import "./styles/a11y.css";
import "./styles/print.css";
import "./styles/sprints.css";
import "./styles/scope.css"; // ADR-022: @scope per-card isolation (v12.0)
import "./cards/tasks/tasks.css";
import "./cards/system-info/system-info.css";
import "./cards/countdown/countdown.css";

// ── Core ──
import { diagLog, getDiagEntries } from "./core/diag";
import { cEvict, hydrateFromIdb, migrateLocalStorageToIdb, cEvictIdb } from "./core/cache";
import { initVisibility } from "./core/idle";
import { registerSW } from "./core/sw-register";
import { loadConfig, saveConfig, loadConfigFromHash } from "./core/config";
import { applyInterfaceLanguage, t } from "./core/i18n";
import { MS_PER_MIN } from "./core/constants";
import { state } from "./core/state";

// ── UI ──
import { initTheme, checkAutoTheme } from "./ui/theme";
import { initKeyboard, registerKey, closeAllOverlays, getKeyboardActions } from "./ui/keyboard";
import { initHeader, toggleClockSeconds } from "./ui/header";
import { initCardMaximize, initCardCollapse } from "./ui/maximize";
import { initStatusBar, stampRefresh } from "./ui/status-bar";
import { initTicker, applyTickerSpeed } from "./ui/ticker";
import {
  initConfigPanel,
  toggleConfigPanel,
  openConfigPanel,
  switchCfgTab,
} from "./ui/config-panel";
import { initScreenMode, stepFontScale } from "./ui/screen-mode";
import {
  toggleNightDim,
  initNightDimmer,
  setWarmTint,
  isWarmTint,
  setIdleAutoDimMinutes,
} from "./ui/night-dimmer";
import { initDiagOverlay, toggleDiagOverlay } from "./ui/diag-overlay";
import { initBgImages } from "./ui/bg-images";
import { initCardDragDrop } from "./ui/layout-drag";
import { showToast } from "./ui/toast";
import { initScrollShadows } from "./ui/scroll";
import { mountRegisteredCards } from "./core/card-registry";
import { initCardSettingsButtons } from "./ui/card-settings-dialog";

// ── Cards ──
import { initWeatherCard, toggleTempUnit } from "./cards/weather/weather";
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
  setAlertVolume,
} from "./cards/alerts/alerts";
import { initHebrewCalCard } from "./cards/hebrew-cal/hebrew-cal";
import { initCalendarCard } from "./cards/calendar/calendar";
import { initTasksCard } from "./cards/tasks/tasks";
import { initSystemInfoCard } from "./cards/system-info/system-info";
import { initCountdownCard } from "./cards/countdown/countdown";

import { installGlobalErrorHandlers } from "./core/error-tracker";
import { withErrorBoundary } from "./core/error-boundary";
import {
  initPerfObserver,
  markDomReady,
  markStartupComplete,
  recordCardInitTime,
} from "./core/perf";
import { applyHardwareTier } from "./core/hardware";
import { scheduleVitalsReport, flushVitalsReport } from "./core/vitals-reporter";
import { initTour } from "./core/first-run-tour";

// ── Version ──
export const VERSION = __APP_VERSION__;

// Install error handlers + perf observer as early as possible (before init)
installGlobalErrorHandlers();
initPerfObserver();
// Record DOMContentLoaded mark for startup waterfall measurement (v8.2)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", markDomReady, { once: true });
} else {
  markDomReady();
}
// Detect hardware tier and apply data-hw-tier to <html> for adaptive CSS
applyHardwareTier();
// Schedule Web Vitals report 30 s after boot (v11.0-OBS-1)
scheduleVitalsReport();
// Flush vitals on page hide so we capture them before unload
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushVitalsReport();
});
// Show first-run tour on first visit (v11.0-PWA-1)
initTour();

/**
 * Apply card size overrides from config to DOM elements.
 * Called on init so sizes persist across page reloads.
 */
export function applyCardSizes(cardSizes: Record<string, string>): void {
  Object.entries(cardSizes).forEach(([id, size]) => {
    const el = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
    if (el) el.dataset["cardSize"] = size;
  });
}

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
export function applyCardLayout(layout: [string[], string[], string[]] | null): void {
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
      const card = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
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

/** Refresh every card individually with 350 ms stagger — never reloads the page. */
function refreshAllCardsStaggered(): void {
  const inits: Array<() => void> = [
    initWeatherCard,
    initNewsCard,
    initAlertsCard,
    initHebrewCalCard,
    initCalendarCard,
    initStocksCard,
    initCurrencyCard,
    initTasksCard,
    initCountdownCard,
    initMotivationCard,
    initSystemInfoCard,
  ];
  inits.forEach((fn, i) => {
    setTimeout(fn, i * 350);
  });
}

/**
 * Application initialization.
 */
export function init(): void {
  diagLog(`[init] FDB-001: FamilyDashBoard v${VERSION} starting...`);

  // Seed reactive state store with current config on startup (v8.0)
  const _initCfg = loadConfig();
  state.seedConfig(_initCfg as unknown as Record<string, unknown>);
  applyInterfaceLanguage(_initCfg.interfaceLanguage);

  // Core setup — evict stale LS entries and hydrate memory cache from IDB
  cEvict();
  void hydrateFromIdb().then((n) => {
    if (n > 0) diagLog(`[cache] FDB-004: hydrated ${n} entries from IDB`);
  });
  // One-time LS→IDB migration; evict stale IDB entries
  void migrateLocalStorageToIdb().then((n) => {
    if (n > 0) diagLog(`[cache] FDB-005: migrated ${n} entries LS→IDB`);
  });
  void cEvictIdb();
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
  initScrollShadows();
  // Sprint 23: auto-mount registry cards not already in index.html (e.g. video-news)
  mountRegisteredCards();
  // Per-card settings gear buttons (lazy async — fires after card shells are in DOM)
  void initCardSettingsButtons();

  // Sprint 45: Add aria-label to icon-only collapse buttons
  document.querySelectorAll<HTMLButtonElement>(".card-collapse-btn").forEach((btn) => {
    if (!btn.getAttribute("aria-label")) {
      btn.setAttribute("aria-label", "מזער/הרחב כרטיסית");
    }
  });

  // ── Additional keyboard shortcuts ──
  registerKey(
    "s",
    document.documentElement.lang === "en" ? "Settings" : "הגדרות",
    toggleConfigPanel,
  );
  registerKey(
    "n",
    document.documentElement.lang === "en" ? "Night dimmer" : "דימר לילה",
    toggleNightDim,
  );
  registerKey(
    "c",
    document.documentElement.lang === "en" ? "Seconds" : "שניות",
    toggleClockSeconds,
  );
  registerKey("+", document.documentElement.lang === "en" ? "Increase font" : "הגדל גופן", () =>
    stepFontScale(1),
  );
  registerKey("=", document.documentElement.lang === "en" ? "Increase font" : "הגדל גופן", () =>
    stepFontScale(1),
  ); // + without shift
  registerKey("-", document.documentElement.lang === "en" ? "Decrease font" : "הקטן גופן", () =>
    stepFontScale(-1),
  );
  registerKey("f", document.documentElement.lang === "en" ? "Fullscreen" : "מסך מלא", () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  });
  registerKey("b", document.documentElement.lang === "en" ? "Bookmarks" : "מועדפים", () =>
    toggleBookmarkMode(),
  );
  registerKey("m", document.documentElement.lang === "en" ? "Next quote" : "ציטוט הבא", () =>
    renderMotivation(),
  );
  registerKey("r", document.documentElement.lang === "en" ? "Refresh data" : "רענון נתונים", () =>
    refreshAllCardsStaggered(),
  );
  registerKey("w", document.documentElement.lang === "en" ? "Toggle °C/°F" : "מעבר °C/°F", () =>
    toggleTempUnit(),
  );
  registerKey("1", "עיר מזג אוויר 1", () =>
    document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']")?.click(),
  );
  registerKey("2", "עיר מזג אוויר 2", () =>
    document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='2']")?.click(),
  );
  registerKey("3", "עיר מזג אוויר 3", () =>
    document.querySelector<HTMLButtonElement>(".wx-city-tab[data-city='3']")?.click(),
  );
  registerKey(
    "a",
    document.documentElement.lang === "en" ? "Red alerts" : "התרעות צבע אדום",
    () => {
      toggleAlerts();
      showToast(isAlertsEnabled() ? t("alertsEnabled") : t("alertsDisabled"), 2500);
    },
  );
  const _toggleHelp = (): void => {
    const dlg = document.getElementById("help-overlay") as HTMLDialogElement | null;
    if (!dlg) return;
    if (dlg.open) {
      dlg.close();
    } else {
      // F10 (v7.3): Populate dynamic shortcuts section from registered keyboard actions
      const dynamicEl = document.getElementById("help-dynamic-keys");
      if (dynamicEl) {
        const actions = getKeyboardActions();
        if (actions.length > 0) {
          const frag = document.createDocumentFragment();
          const hdr = document.createElement("div");
          hdr.style.cssText = "font-weight:700;margin-bottom:4px;color:var(--accent)";
          hdr.textContent =
            document.documentElement.lang === "en"
              ? `⌨ ${String(actions.length)} registered shortcuts`
              : `⌨ ${String(actions.length)} קיצורים רשומים`;
          frag.appendChild(hdr);
          dynamicEl.replaceChildren(frag);
        }
      }
      dlg.showModal();
    }
  };
  registerKey("h", document.documentElement.lang === "en" ? "Help" : "עזרה", _toggleHelp);
  registerKey("?", document.documentElement.lang === "en" ? "Help" : "עזרה", _toggleHelp);
  registerKey(
    "d",
    document.documentElement.lang === "en" ? "Diagnostics" : "אבחון",
    toggleDiagOverlay,
  );
  // Ctrl+Shift+E — export diagnostic log as JSON file
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === "E") {
      e.preventDefault();
      const entries = getDiagEntries(500);
      const json = JSON.stringify({ exported: new Date().toISOString(), entries }, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fdb-diag-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });
  registerKey(
    "v",
    document.documentElement.lang === "en" ? "Card management" : "ניהול כרטיסיות",
    () => {
      openConfigPanel();
      switchCfgTab("cards");
    },
  );
  registerKey(
    "l",
    document.documentElement.lang === "en" ? "Warm night tint" : "גוון חם לדימר לילה",
    () => setWarmTint(!isWarmTint()),
  );
  registerKey(
    "escape",
    document.documentElement.lang === "en" ? "Close overlays" : "סגור כל חלון",
    closeAllOverlays,
  );

  // Cards — priority-based init: high-value visible cards first (v7.10)
  // Sprint 158: wrap each init with timing; error-boundary catches init failures
  const timedInit = (id: string, fn: () => void): void => {
    const t0 = performance.now();
    void withErrorBoundary(id, fn)().then(() => {
      recordCardInitTime(id, performance.now() - t0);
    });
  };
  // HIGH priority: user-visible, time-sensitive data
  timedInit("weather", initWeatherCard);
  timedInit("news", initNewsCard);
  timedInit("alerts", initAlertsCard);
  timedInit("hebrew-cal", initHebrewCalCard);
  timedInit("calendar", initCalendarCard);
  // NORMAL priority: financial data + tasks
  timedInit("stocks", initStocksCard);
  timedInit("currency", initCurrencyCard);
  timedInit("tasks", initTasksCard);
  timedInit("countdown", initCountdownCard);
  // LOW priority: ambient / decorative — deferred to reduce TTI (V11-PERF)
  // Use requestIdleCallback when available so the main thread is free for interaction first.
  const _lowPriorityInit = (): void => {
    timedInit("motivation", initMotivationCard);
    timedInit("system-info", initSystemInfoCard);
    initTicker();
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(_lowPriorityInit, { timeout: 2000 });
  } else {
    setTimeout(_lowPriorityInit, 200);
  }

  // Mark startup waterfall completion (v8.2: all card init calls dispatched)
  markStartupComplete();

  // ── URL hash config import: #cfg=<base64> overrides localStorage config ──
  const _urlHash = window.location.hash ?? "";
  if (_urlHash.startsWith("#cfg=")) {
    const imported = loadConfigFromHash(_urlHash);
    if (imported) {
      saveConfig(imported);
      // Strip hash so the next reload doesn't re-import
      history.replaceState(null, "", window.location.pathname + window.location.search);
      diagLog("[init] FDB-007: config imported from URL hash");
    }
  }

  // ── Night dimmer auto-schedule (uses config v2 schedule fields) ──
  const cfg = _initCfg; // reuse config already loaded at init start — avoid second LS read
  initNightDimmer(
    cfg.nightDimLevel,
    cfg.nightDimScheduleEnabled ?? false,
    cfg.nightDimStartHour ?? 23,
    cfg.nightDimEndHour ?? 6,
  );
  if ((cfg.nightDimIdleMinutes ?? 0) > 0) {
    setIdleAutoDimMinutes(cfg.nightDimIdleMinutes ?? 0);
  }

  // ── Apply ticker scroll speed from config ──
  applyTickerSpeed(cfg.tickerSpeed ?? 3);

  // ── Apply card visibility from config ──
  applyHiddenCards(cfg.hiddenCards ?? []);

  // ── Apply saved card layout column assignment ──
  applyCardLayout(cfg.cardLayout ?? null);

  // ── Apply saved card size overrides (sm/md/lg/xl) ──
  applyCardSizes(cfg.cardSizes ?? {});

  // ── Apply alert config state from saved settings ──
  setAlertsEnabled(cfg.alertsEnabled);
  setAlertsRealtime(cfg.realtimeAlerts);
  setAlertVolume(cfg.alertVolume ?? 18);

  // ── Apply warm tint from config ──
  if (cfg.dimWarmTint) setWarmTint(true);

  // ── Auto-theme by time of day (runs every 5 minutes) — deferred to reduce TTI ──
  const _autoThemeSetup = (): void => {
    const runAutoTheme = (): void => {
      const c = loadConfig();
      checkAutoTheme(c.autoTheme, c.theme);
    };
    runAutoTheme();
    setInterval(runAutoTheme, 5 * MS_PER_MIN);
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(_autoThemeSetup, { timeout: 3000 });
  } else {
    setTimeout(_autoThemeSetup, 300);
  }

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
  const offlineBanner = document.getElementById("offline-banner");
  window.addEventListener("offline", () => {
    _wenOffline = true;
    offlineBanner?.classList.add("visible");
    showToast(t("offlineToast"), 5000);
    diagLog("[init] FDB-008: network offline");
  });
  window.addEventListener("online", () => {
    offlineBanner?.classList.remove("visible");
    if (_wenOffline) {
      _wenOffline = false;
      showToast(t("onlineRefreshing"), 2500);
      setTimeout(refreshAllCardsStaggered, 500);
    }
    diagLog("[init] FDB-009: network reconnected");
  });
  // Also listen to SW NETWORK_BACK broadcast
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as { type?: string };
      if (data?.type === "NETWORK_BACK" && !_wenOffline) {
        showToast(t("onlineRefreshing"), 2500);
        setTimeout(refreshAllCardsStaggered, 500);
      }
    });
  }

  diagLog(`[init] FDB-010: dashboard initialized`);
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
