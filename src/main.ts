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
import {
  cEvict,
  hydrateFromIdb,
  migrateLocalStorageToIdb,
  cEvictIdb,
} from "./core/cache";
import { initVisibility } from "./core/idle";
import { registerSW } from "./core/sw-register";
import { loadConfig, saveConfig, loadConfigFromHash } from "./core/config";

// ── UI ──
import { initTheme, checkAutoTheme } from "./ui/theme";
import {
  initKeyboard,
  registerKey,
  closeAllOverlays,
  getKeyboardActions,
} from "./ui/keyboard";
import { initHeader, toggleClockSeconds } from "./ui/header";
import { initCardMaximize, initCardCollapse } from "./ui/maximize";
import { initStatusBar, stampRefresh } from "./ui/status-bar";
import { initTicker, applyTickerSpeed } from "./ui/ticker";
import { initConfigPanel, toggleConfigPanel, openConfigPanel, switchCfgTab } from "./ui/config-panel";
import { initScreenMode, stepFontScale } from "./ui/screen-mode";
import { toggleNightDim, initNightDimmer, setWarmTint, isWarmTint } from "./ui/night-dimmer";
import { initDiagOverlay, toggleDiagOverlay } from "./ui/diag-overlay";
import { initBgImages } from "./ui/bg-images";
import { initCardDragDrop } from "./ui/layout-drag";
import { showToast } from "./ui/toast";

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
import { initPerfObserver } from "./core/perf";
import { applyHardwareTier } from "./core/hardware";

// ── Version ──
export const VERSION = __APP_VERSION__;

// Install error handlers + perf observer as early as possible (before init)
installGlobalErrorHandlers();
initPerfObserver();
// Detect hardware tier and apply data-hw-tier to <html> for adaptive CSS
applyHardwareTier();

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
  diagLog(`[init] FDB-001: FamilyDashBoard v${VERSION} starting...`);

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

  // Sprint 45: Add aria-label to icon-only collapse buttons
  document
    .querySelectorAll<HTMLButtonElement>(".card-collapse-btn")
    .forEach((btn) => {
      if (!btn.getAttribute("aria-label")) {
        btn.setAttribute("aria-label", "מזער/הרחב כרטיסית");
      }
    });

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
  registerKey("w", "מעבר °C/°F", () => toggleTempUnit());
  registerKey("1", "עיר מזג אוויר 1", () =>
    document
      .querySelector<HTMLButtonElement>(".wx-city-tab[data-city='1']")
      ?.click(),
  );
  registerKey("2", "עיר מזג אוויר 2", () =>
    document
      .querySelector<HTMLButtonElement>(".wx-city-tab[data-city='2']")
      ?.click(),
  );
  registerKey("3", "עיר מזג אוויר 3", () =>
    document
      .querySelector<HTMLButtonElement>(".wx-city-tab[data-city='3']")
      ?.click(),
  );
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
      // F10 (v7.3): Populate dynamic shortcuts section from registered keyboard actions
      const dynamicEl = document.getElementById("help-dynamic-keys");
      if (dynamicEl) {
        const actions = getKeyboardActions();
        if (actions.length > 0) {
          const frag = document.createDocumentFragment();
          const hdr = document.createElement("div");
          hdr.style.cssText =
            "font-weight:700;margin-bottom:4px;color:var(--accent)";
          hdr.textContent = `⌨ ${String(actions.length)} קיצורים רשומים`;
          frag.appendChild(hdr);
          dynamicEl.replaceChildren(frag);
        }
      }
      dlg.showModal();
    }
  };
  registerKey("h", "עזרה", _toggleHelp);
  registerKey("?", "עזרה", _toggleHelp);
  registerKey("d", "אבחון", toggleDiagOverlay);
  registerKey("v", "ניהול כרטיסיות", () => {
    openConfigPanel();
    switchCfgTab("cards");
  });
  registerKey("l", "גוון חם לדימר לילה", () => setWarmTint(!isWarmTint()));
  registerKey("escape", "סגור כל חלון", closeAllOverlays);

  // Cards — priority-based init: high-value visible cards first (v7.10)
  // HIGH priority: user-visible, time-sensitive data
  initWeatherCard();
  initNewsCard();
  initAlertsCard();
  initHebrewCalCard();
  initCalendarCard();
  // NORMAL priority: financial data + tasks
  initStocksCard();
  initCurrencyCard();
  initTasksCard();
  initCountdownCard();
  // LOW priority: ambient / decorative content
  initMotivationCard();
  initSystemInfoCard();
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
      diagLog("[init] FDB-007: config imported from URL hash");
    }
  }

  // ── Night dimmer auto-schedule (uses config v2 schedule fields) ──
  const cfg = loadConfig();
  initNightDimmer(
    cfg.nightDimLevel,
    cfg.nightDimScheduleEnabled ?? false,
    cfg.nightDimStartHour ?? 23,
    cfg.nightDimEndHour ?? 6,
  );

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
    diagLog("[init] FDB-008: network offline");
  });
  window.addEventListener("online", () => {
    if (_wenOffline) {
      _wenOffline = false;
      showToast("🌐 החיבור חזר — מרענן נתונים...", 2500);
      setTimeout(() => window.location.reload(), 2500);
    }
    diagLog("[init] FDB-009: network reconnected");
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
