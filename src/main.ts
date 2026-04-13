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

// ── UI ──
import { initTheme } from "./ui/theme";
import { initKeyboard } from "./ui/keyboard";
import { initHeader } from "./ui/header";
import { initCardMaximize } from "./ui/maximize";

// ── Cards ──
import { initWeatherCard } from "./cards/weather/weather";
import { initMotivationCard } from "./cards/motivation/motivation";
import { initNewsCard } from "./cards/news/news";
import { initStocksCard } from "./cards/stocks/stocks";
import { initCurrencyCard } from "./cards/currency/currency";
import { initAlertsCard } from "./cards/alerts/alerts";

// ── Version ──
export const VERSION = "6.0.0-alpha.2";

/**
 * Application initialization.
 */
function init(): void {
  diagLog(`[init] FamilyDashBoard v${VERSION} starting...`);

  // Core setup
  cEvict();
  initVisibility();

  // UI modules
  initTheme();
  initKeyboard();
  initHeader();
  initCardMaximize();

  // Cards — non-blocking, parallel load
  initWeatherCard();
  initNewsCard();
  initStocksCard();
  initCurrencyCard();
  initAlertsCard();
  initMotivationCard();

  // Service Worker
  void registerSW();

  diagLog(`[init] Dashboard initialized`);
}

// ── Bootstrap ──
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
