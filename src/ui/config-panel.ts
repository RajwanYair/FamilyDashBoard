/**
 * FamilyDashBoard v7 — Config Panel UI
 *
 * Opens/closes the settings overlay, populates form inputs from config,
 * saves settings, handles export/import JSON, tab switching.
 * v7: Cards tab for card visibility + size; URL hash import/export.
 */

import { loadConfig, saveConfig, shareConfigHash } from "../core/config";
import type { DashboardConfig } from "../types/config";
import { listCards } from "../core/card-registry";
import { applyTheme } from "./theme";
import { diagLog } from "../core/diag";
import { showToast } from "./toast";
import { setAlertsRealtime } from "../cards/alerts/alerts";
import { setClockSeconds } from "./header";
import { initWeatherCities } from "../cards/weather/weather";
import { applyHiddenStocks } from "../cards/stocks/stocks";
import { applyNewsFontSize } from "../cards/news/news";
// ── Extra localStorage keys (fields not stored in DashboardConfig) ──
const LS_DIM_START = "dash_v2_dim_start";
const LS_DIM_END = "dash_v2_dim_end";
const LS_TICKER_MSG = "dash_v2_ticker_msg";
const LS_CITY_1 = "dash_v2_city_1";
const LS_CITY_2 = "dash_v2_city_2";
const LS_CITY_3 = "dash_v2_city_3";
const LS_STOCK_ALERTS = "dash_v2_stock_alerts";
const LS_HOME_LAT = "dash_v2_home_lat";
const LS_HOME_LON = "dash_v2_home_lon";
const LS_HOME_NAME = "dash_v2_home_name";
const LS_NEWS_FONT = "dash_v2_news_fontsize";

let overlayEl: HTMLElement | null = null;

function overlay(): HTMLElement | null {
  if (!overlayEl) overlayEl = document.getElementById("config-overlay");
  return overlayEl;
}

function g(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

function gSel(id: string): HTMLSelectElement | null {
  return document.getElementById(id) as HTMLSelectElement | null;
}

function gTxt(id: string): HTMLTextAreaElement | null {
  return document.getElementById(id) as HTMLTextAreaElement | null;
}

// ── Populate form from config ──
function populateForm(): void {
  const c = loadConfig();

  // Display tab
  const modeEl = gSel("screen-mode-select");
  if (modeEl) modeEl.value = c.screenMode;

  const themeEl = gSel("theme-select");
  if (themeEl) themeEl.value = c.theme;

  const bgUrl = gTxt("cfg-bg-url");
  if (bgUrl) bgUrl.value = c.bgImages.join("\n");

  const famName = g("cfg-family-name");
  if (famName) famName.value = c.familyName;

  const members = g("cfg-members");
  if (members) members.value = c.members.join(", ");

  const autoTheme = g("cfg-auto-theme");
  if (autoTheme) autoTheme.value = c.autoTheme ? "on" : "off";

  const clockSec = g("cfg-clock-seconds");
  if (clockSec) clockSec.value = c.clockSeconds ? "on" : "off";

  const dimStart = g("cfg-dim-start");
  if (dimStart) dimStart.value = localStorage.getItem(LS_DIM_START) ?? "23";

  const dimEnd = g("cfg-dim-end");
  if (dimEnd) dimEnd.value = localStorage.getItem(LS_DIM_END) ?? "6";

  const tempUnit = g("cfg-temp-unit");
  if (tempUnit) tempUnit.value = c.tempUnit;

  const newsFont = g("cfg-news-fontsize");
  if (newsFont) {
    newsFont.value = localStorage.getItem(LS_NEWS_FONT) ?? "100";
    const val = document.getElementById("cfg-news-fontsize-val");
    if (val) val.textContent = `${newsFont.value}%`;
  }

  // Calendar tab
  const bday = gTxt("cfg-birthday");
  if (bday)
    bday.value = c.birthdays
      .map((b) => `${b.name},${String(b.month)},${String(b.day)}`)
      .join("\n");

  const ics1 = g("cfg-ics-url");
  const ics2 = g("cfg-ics-url-2");
  const ics3 = g("cfg-ics-url-3");
  if (ics1) ics1.value = c.calendarUrls[0] ?? "";
  if (ics2) ics2.value = c.calendarUrls[1] ?? "";
  if (ics3) ics3.value = c.calendarUrls[2] ?? "";

  const geo = g("cfg-heb-geonameid");
  if (geo) geo.value = c.geonameid;

  // Feeds tab
  const ticker = g("cfg-ticker-msg");
  if (ticker) ticker.value = localStorage.getItem(LS_TICKER_MSG) ?? "";

  const feedsDisabled = g("cfg-feeds-disabled");
  if (feedsDisabled) feedsDisabled.value = c.disabledFeeds.join(", ");

  const stocksHidden = g("cfg-stocks-hidden");
  if (stocksHidden) stocksHidden.value = c.hiddenStocks.join(", ");

  const city1 = g("cfg-city-1");
  if (city1) city1.value = localStorage.getItem(LS_CITY_1) ?? "";

  const city2 = g("cfg-city-2");
  if (city2) city2.value = localStorage.getItem(LS_CITY_2) ?? "";

  const city3 = g("cfg-city-3");
  if (city3) city3.value = localStorage.getItem(LS_CITY_3) ?? "";

  // Alerts tab
  const alertsToggle = gSel("alerts-toggle");
  if (alertsToggle) alertsToggle.value = c.alertsEnabled ? "on" : "off";

  const alertZone = g("cfg-alert-zone");
  if (alertZone) alertZone.value = c.alertZone;

  const alertSound = g("cfg-alert-sound");
  if (alertSound) alertSound.value = c.alertSound ? "on" : "off";

  const alertRealtime = g("cfg-alert-realtime");
  if (alertRealtime) alertRealtime.value = c.realtimeAlerts ? "on" : "off";

  const stockAlerts = gTxt("cfg-stock-alerts");
  if (stockAlerts)
    stockAlerts.value = localStorage.getItem(LS_STOCK_ALERTS) ?? "";

  // Advanced tab
  const homeLat = g("cfg-home-lat");
  if (homeLat) homeLat.value = localStorage.getItem(LS_HOME_LAT) ?? "";

  const homeLon = g("cfg-home-lon");
  if (homeLon) homeLon.value = localStorage.getItem(LS_HOME_LON) ?? "";

  const homeName = g("cfg-home-name");
  if (homeName)
    homeName.value = localStorage.getItem(LS_HOME_NAME) ?? c.homeCity;

  const proxy = g("cfg-custom-proxy");
  if (proxy) proxy.value = c.customProxy;

  const cdate = g("cfg-countdown-date");
  if (cdate) cdate.value = c.countdownDate;

  const clabel = g("cfg-countdown-label");
  if (clabel) clabel.value = c.countdownLabel;

  // Cards tab — dynamically build per-card rows
  const cardsList = document.getElementById("cfg-cards-list");
  if (cardsList) {
    cardsList.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const entry of listCards()) {
      const row = document.createElement("div");
      row.className = "cfg-row cfg-card-row";

      // Visibility checkbox
      const lbl = document.createElement("label");
      lbl.className = "cfg-card-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "cfg-card-cb";
      cb.dataset["cardId"] = entry.id;
      cb.checked = !c.hiddenCards.includes(entry.id);
      const span = document.createElement("span");
      span.textContent = `${entry.icon} ${entry.titleHe}`;
      lbl.appendChild(cb);
      lbl.appendChild(span);

      // Size selector
      const sizeDiv = document.createElement("div");
      sizeDiv.className = "cfg-card-size-wrap";
      const sizeLbl = document.createElement("span");
      sizeLbl.className = "cfg-label";
      sizeLbl.textContent = "גודל:";
      const sel = document.createElement("select");
      sel.className = "cfg-input cfg-card-size-sel";
      sel.dataset["cardId"] = entry.id;
      sel.style.cssText = "width:70px;font-size:0.75em;padding:1px 3px";
      for (const [val, lText] of [
        ["sm", "קטן"],
        ["md", "בינוני"],
        ["lg", "גדול"],
        ["xl", "ענק"],
      ] as const) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = lText;
        if ((c.cardSizes[entry.id] ?? "md") === val) opt.selected = true;
        sel.appendChild(opt);
      }
      sizeDiv.appendChild(sizeLbl);
      sizeDiv.appendChild(sel);

      row.appendChild(lbl);
      row.appendChild(sizeDiv);
      frag.appendChild(row);
    }
    cardsList.appendChild(frag);
  }
}

// ── Collect form values into config ──
function collectForm(): DashboardConfig {
  const c = loadConfig();

  // Display
  const modeEl = gSel("screen-mode-select");
  if (modeEl) c.screenMode = modeEl.value as DashboardConfig["screenMode"];

  const themeEl = gSel("theme-select");
  if (themeEl) c.theme = themeEl.value as DashboardConfig["theme"];

  const bgUrl = gTxt("cfg-bg-url");
  if (bgUrl)
    c.bgImages = bgUrl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const famName = g("cfg-family-name");
  if (famName) c.familyName = famName.value.trim();

  const members = g("cfg-members");
  if (members)
    c.members = members.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const autoTheme = g("cfg-auto-theme");
  if (autoTheme) c.autoTheme = autoTheme.value.trim().toLowerCase() === "on";

  const clockSec = g("cfg-clock-seconds");
  if (clockSec) c.clockSeconds = clockSec.value.trim().toLowerCase() === "on";

  const tempUnitEl = g("cfg-temp-unit");
  if (tempUnitEl) {
    const v = tempUnitEl.value.trim().toUpperCase();
    if (v === "C" || v === "F") c.tempUnit = v;
  }

  // Extra display (stored in localStorage)
  const dimStart = g("cfg-dim-start");
  if (dimStart) localStorage.setItem(LS_DIM_START, dimStart.value);

  const dimEnd = g("cfg-dim-end");
  if (dimEnd) localStorage.setItem(LS_DIM_END, dimEnd.value);

  const newsFont = g("cfg-news-fontsize");
  if (newsFont) localStorage.setItem(LS_NEWS_FONT, newsFont.value);

  // Calendar
  const bday = gTxt("cfg-birthday");
  if (bday) {
    c.birthdays = bday.value
      .split("\n")
      .map((line) => {
        const parts = line.trim().split(",");
        const name = parts[0]?.trim() ?? "";
        const month = parseInt(parts[1] ?? "0", 10);
        const day = parseInt(parts[2] ?? "0", 10);
        return name && month > 0 && day > 0 ? { name, month, day } : null;
      })
      .filter(
        (b): b is { name: string; month: number; day: number } => b !== null,
      );
  }

  const ics1 = g("cfg-ics-url")?.value.trim() ?? "";
  const ics2 = g("cfg-ics-url-2")?.value.trim() ?? "";
  const ics3 = g("cfg-ics-url-3")?.value.trim() ?? "";
  c.calendarUrls = [ics1, ics2, ics3].filter(Boolean);

  const geo = g("cfg-heb-geonameid");
  if (geo) c.geonameid = geo.value.trim();

  // Feeds
  const ticker = g("cfg-ticker-msg");
  if (ticker) localStorage.setItem(LS_TICKER_MSG, ticker.value.trim());

  const feedsDisabled = g("cfg-feeds-disabled");
  if (feedsDisabled)
    c.disabledFeeds = feedsDisabled.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const stocksHidden = g("cfg-stocks-hidden");
  if (stocksHidden)
    c.hiddenStocks = stocksHidden.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const city1 = g("cfg-city-1");
  if (city1) localStorage.setItem(LS_CITY_1, city1.value.trim());

  const city2 = g("cfg-city-2");
  if (city2) localStorage.setItem(LS_CITY_2, city2.value.trim());

  const city3 = g("cfg-city-3");
  if (city3) localStorage.setItem(LS_CITY_3, city3.value.trim());

  // Alerts
  const alertsToggle = gSel("alerts-toggle");
  if (alertsToggle) c.alertsEnabled = alertsToggle.value === "on";

  const alertZone = g("cfg-alert-zone");
  if (alertZone) c.alertZone = alertZone.value.trim();

  const alertSound = g("cfg-alert-sound");
  if (alertSound) c.alertSound = alertSound.value.trim().toLowerCase() === "on";

  const alertRealtime = g("cfg-alert-realtime");
  if (alertRealtime)
    c.realtimeAlerts = alertRealtime.value.trim().toLowerCase() === "on";

  const stockAlerts = gTxt("cfg-stock-alerts");
  if (stockAlerts)
    localStorage.setItem(LS_STOCK_ALERTS, stockAlerts.value.trim());

  // Advanced
  const homeLat = g("cfg-home-lat");
  if (homeLat) localStorage.setItem(LS_HOME_LAT, homeLat.value);

  const homeLon = g("cfg-home-lon");
  if (homeLon) localStorage.setItem(LS_HOME_LON, homeLon.value);

  const homeName = g("cfg-home-name");
  if (homeName) {
    const name = homeName.value.trim();
    localStorage.setItem(LS_HOME_NAME, name);
    if (name) c.homeCity = name;
  }

  const proxy = g("cfg-custom-proxy");
  if (proxy) c.customProxy = proxy.value.trim();

  const cdate = g("cfg-countdown-date");
  if (cdate) c.countdownDate = cdate.value;

  const clabel = g("cfg-countdown-label");
  if (clabel) c.countdownLabel = clabel.value.trim();

  // Cards tab — hidden cards + sizes
  const hiddenCards: string[] = [];
  document
    .querySelectorAll<HTMLInputElement>(".cfg-card-cb[data-card-id]")
    .forEach((cb) => {
      const id = cb.dataset["cardId"] ?? "";
      if (!cb.checked && id) hiddenCards.push(id);
    });
  c.hiddenCards = hiddenCards;

  const cardSizes: Record<string, string> = {};
  document
    .querySelectorAll<HTMLSelectElement>(".cfg-card-size-sel[data-card-id]")
    .forEach((sel) => {
      const id = sel.dataset["cardId"] ?? "";
      if (id && sel.value) cardSizes[id] = sel.value;
    });
  c.cardSizes = cardSizes;

  return c;
}

// ── Public API ──

export function openConfigPanel(): void {
  const ov = overlay();
  if (!ov) return;
  populateForm();
  ov.classList.add("visible");
  diagLog("[config-panel] opened");
}

export function closeConfigPanel(): void {
  overlay()?.classList.remove("visible");
}

export function toggleConfigPanel(): void {
  const ov = overlay();
  if (!ov) return;
  if (ov.classList.contains("visible")) closeConfigPanel();
  else openConfigPanel();
}

export function isConfigPanelOpen(): boolean {
  return overlay()?.classList.contains("visible") ?? false;
}

// ── Export/Import ──

export function exportSettings(): void {
  const c = loadConfig();
  const json = JSON.stringify(c, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dashboard-config.json";
  a.click();
  URL.revokeObjectURL(url);
  diagLog("[config-panel] exported settings");
}

export function importSettings(): void {
  const input = document.getElementById(
    "cfg-import-file",
  ) as HTMLInputElement | null;
  if (!input) return;
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
          saveConfig(parsed as DashboardConfig);
          populateForm();
          diagLog("[config-panel] imported settings");
        }
      } catch {
        diagLog("[config-panel] import failed: invalid JSON");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function shareSettings(): void {
  const c = loadConfig();
  const hash = shareConfigHash(c);
  const url = window.location.href.split("#")[0] + hash;
  void navigator.clipboard.writeText(url).then(() => {
    showToast("🔗 קישור ההגדרות הועתק ללוח");
  });
  diagLog("[config-panel] share link copied");
}

// ── Tab switching ──
export function switchCfgTab(tab: string): void {
  document.querySelectorAll<HTMLElement>(".cfg-section").forEach((s) => {
    s.classList.toggle("active", s.dataset["tab"] === tab);
  });
  document.querySelectorAll<HTMLElement>(".cfg-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset["tab"] === tab);
  });
}

// ── Init ──
export function initConfigPanel(): void {
  // Gear button opens panel
  document
    .getElementById("cfg-gear-btn")
    ?.addEventListener("click", toggleConfigPanel);

  // Close on overlay background click
  const ov = overlay();
  if (ov) {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeConfigPanel();
    });
  }

  // Save button
  document.getElementById("cfg-save-btn")?.addEventListener("click", () => {
    const c = collectForm();
    saveConfig(c);
    applyTheme(c.theme);
    setAlertsRealtime(c.realtimeAlerts);
    setClockSeconds(c.clockSeconds);
    initWeatherCities();
    applyHiddenStocks();
    applyNewsFontSize();
    // Apply card visibility immediately without reload
    document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
      const id = el.dataset["cardId"] ?? "";
      el.style.display = c.hiddenCards.includes(id) ? "none" : "";
    });
    // Apply card sizes immediately
    Object.entries(c.cardSizes).forEach(([id, size]) => {
      const el = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
      if (el) el.dataset["cardSize"] = size;
    });
    closeConfigPanel();
    diagLog("[config-panel] settings saved");
  });

  // Close button
  document
    .getElementById("cfg-close-btn")
    ?.addEventListener("click", closeConfigPanel);

  // Tab buttons — replace inline onclick with event listeners
  document
    .querySelectorAll<HTMLButtonElement>(".cfg-tab[data-tab]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset["tab"];
        if (tab) switchCfgTab(tab);
      });
    });

  // Font size slider live preview
  const newsFont = g("cfg-news-fontsize");
  const newsFontVal = document.getElementById("cfg-news-fontsize-val");
  if (newsFont && newsFontVal) {
    newsFont.addEventListener("input", () => {
      newsFontVal.textContent = `${newsFont.value}%`;
    });
  }

  // Settings export / import / share buttons (replaces inline onclick)
  document
    .getElementById("cfg-export-btn")
    ?.addEventListener("click", exportSettings);
  document
    .getElementById("cfg-import-btn")
    ?.addEventListener("click", importSettings);
  document
    .getElementById("cfg-share-btn")
    ?.addEventListener("click", shareSettings);

  diagLog("[config-panel] initialized");
}
