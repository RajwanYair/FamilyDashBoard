/**
 * FamilyDashBoard v13 — Config Panel UI
 *
 * Opens/closes the settings overlay, populates form inputs from config,
 * saves settings, handles export/import JSON, tab switching.
 * v7: Cards tab for card visibility + size; URL hash import/export.
 */

import "./config-panel.css";
import { loadConfig, saveConfig, shareConfigHash, validateImportedConfig } from "../core/config";
import { getPreset } from "../core/config-presets";
import { encryptConfig, decryptConfig } from "../core/config-crypto";
import { saveTextFile, pickTextFile } from "../core/fs-access";
import type { DashboardConfig } from "../types/config";
import type { CardConfigField } from "../types/card";
import { listCards, loadCard } from "../core/card-registry";
import { applyInterfaceLanguage, getLocalizedCardTitle, t } from "../core/i18n";
import { applyTheme } from "./theme";
import { diagLog } from "../core/diag";
import { showToast } from "./toast";
import { setClockSeconds } from "./header";
import { applyFontScale } from "./screen-mode";
import { setDimLevel, updateDimIndicator, setWarmTint } from "./night-dimmer";
import { applyTickerSpeed } from "./ticker";
import { applyConfigAnimLevel } from "../core/anim-level";
import { resetLayout } from "./layout-drag";
import {
  LS_DIM_START,
  LS_DIM_END,
  LS_TICKER_MSG,
  LS_CITY_1,
  LS_CITY_2,
  LS_CITY_3,
  LS_STOCK_ALERTS,
  LS_HOME_LAT,
  LS_HOME_LON,
  LS_HOME_NAME,
  LS_NEWS_FONT,
  LS_CHORES,
  LS_PORTFOLIO,
  LS_NETWORK_MODE,
} from "../core/constants";
// ── Extra localStorage keys now imported from core/constants ──

// ── DOM ref cache for repeatedly-accessed elements ──
const cfgEls: Record<string, HTMLElement | null> = {};
function el(id: string): HTMLElement | null {
  const cached = cfgEls[id];
  if (cached?.isConnected) return cached;
  const next = document.getElementById(id);
  cfgEls[id] = next;
  return next;
}

// ── Unsaved-changes indicator ──
let _formDirty = false;

function markDirty(): void {
  if (_formDirty) return;
  _formDirty = true;
  const gear = el("cfg-gear-btn");
  if (gear) gear.textContent = "⚙️*";
}

function clearDirty(): void {
  _formDirty = false;
  const gear = el("cfg-gear-btn");
  if (gear) gear.textContent = "⚙️";
}

let overlayEl: HTMLElement | null = null;
let cardConfigSchemaDefsPromise: Promise<CardConfigSchemaDef[]> | null = null;
let cardConfigSchemaInjectRun = 0;

interface CardConfigSchemaDef {
  id: string;
  fields: CardConfigField[];
}

function overlay(): HTMLElement | null {
  if (!overlayEl?.isConnected) {
    overlayEl = document.getElementById("config-overlay");
  }
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

async function getCardConfigSchemaDefs(): Promise<CardConfigSchemaDef[]> {
  if (!cardConfigSchemaDefsPromise) {
    cardConfigSchemaDefsPromise = Promise.all(
      listCards().map(async (entry) => {
        try {
          const def = await loadCard(entry.id);
          return def.configSchema?.length ? { id: entry.id, fields: def.configSchema } : null;
        } catch {
          return null;
        }
      }),
    ).then((defs) => defs.filter((def): def is CardConfigSchemaDef => def !== null));
  }

  return cardConfigSchemaDefsPromise;
}

async function applySavedConfigSideEffects(
  config: DashboardConfig,
  refreshTasks: boolean,
  refreshPortfolio: boolean,
): Promise<void> {
  try {
    const [alertsMod, weatherMod, stocksMod, newsMod, countdownMod, motivationMod] =
      await Promise.all([
        import("../cards/alerts/alerts"),
        import("../cards/weather/weather"),
        import("../cards/stocks/stocks"),
        import("../cards/news/news"),
        import("../cards/countdown/countdown"),
        import("../cards/motivation/motivation"),
      ]);

    alertsMod.setAlertsRealtime(config.realtimeAlerts);
    alertsMod.setAlertVolume(config.alertVolume ?? 18);
    weatherMod.initWeatherCities();
    stocksMod.applyHiddenStocks();
    newsMod.applyNewsFontSize();
    countdownMod.initCountdownCard();
    motivationMod.setMotivationInterval(config.motivationInterval ?? 0);

    if (refreshTasks) {
      const tasksMod = await import("../cards/tasks/tasks");
      tasksMod.renderTasksCard();
    }

    if (refreshPortfolio) {
      stocksMod.renderPortfolioRow();
    }
  } catch (error) {
    diagLog(`[config-panel] delayed side effects failed: ${String(error)}`);
  }
}

// ── Populate form from config ──
function populateForm(): void {
  const c = loadConfig();

  // Display tab
  const interfaceLanguageEl = gSel("cfg-interface-language");
  if (interfaceLanguageEl) interfaceLanguageEl.value = c.interfaceLanguage;

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

  // F3 (v7.2): Warm tint toggle
  const dimWarm = g("cfg-dim-warm");
  if (dimWarm) dimWarm.value = c.dimWarmTint ? "on" : "off";

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
    const nfVal = el("cfg-news-fontsize-val");
    if (nfVal) nfVal.textContent = `${newsFont.value}%`;
  }

  // Night dimmer intensity
  const dimLevel = g("cfg-dim-level");
  if (dimLevel) {
    dimLevel.value = String(c.nightDimLevel);
    const dlVal = el("cfg-dim-level-val");
    if (dlVal) dlVal.textContent = `${c.nightDimLevel}%`;
  }

  // Font scale
  const fontScale = g("cfg-font-scale");
  if (fontScale) {
    fontScale.value = String(Math.round(c.fontScale * 100));
    const fsVal = el("cfg-font-scale-val");
    if (fsVal) fsVal.textContent = `${Math.round(c.fontScale * 100)}%`;
  }

  // Ticker speed
  const tickerSpeedEl = g("cfg-ticker-speed");
  if (tickerSpeedEl) {
    tickerSpeedEl.value = String(c.tickerSpeed ?? 3);
    const tsVal = el("cfg-ticker-speed-val");
    if (tsVal) tsVal.textContent = String(c.tickerSpeed ?? 3);
  }

  // Calendar tab
  const bday = gTxt("cfg-birthday");
  if (bday)
    bday.value = c.birthdays.map((b) => `${b.name},${String(b.month)},${String(b.day)}`).join("\n");

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

  // F2 (v7.2): Alert volume slider
  const alertVolSlider = g("cfg-alert-volume");
  const avVal = el("cfg-alert-volume-val");
  if (alertVolSlider) alertVolSlider.value = String(c.alertVolume ?? 18);
  if (avVal) avVal.textContent = `${c.alertVolume ?? 18}%`;

  const alertRealtime = g("cfg-alert-realtime");
  if (alertRealtime) alertRealtime.value = c.realtimeAlerts ? "on" : "off";

  const stockAlerts = gTxt("cfg-stock-alerts");
  if (stockAlerts) stockAlerts.value = localStorage.getItem(LS_STOCK_ALERTS) ?? "";

  // Advanced tab
  const homeLat = g("cfg-home-lat");
  if (homeLat) homeLat.value = localStorage.getItem(LS_HOME_LAT) ?? "";

  const homeLon = g("cfg-home-lon");
  if (homeLon) homeLon.value = localStorage.getItem(LS_HOME_LON) ?? "";

  const homeName = g("cfg-home-name");
  if (homeName) homeName.value = localStorage.getItem(LS_HOME_NAME) ?? c.homeCity;

  const proxy = g("cfg-custom-proxy");
  if (proxy) proxy.value = c.customProxy;

  // Network mode
  const netMode = g("cfg-network-mode") as HTMLSelectElement | null;
  if (netMode) netMode.value = localStorage.getItem(LS_NETWORK_MODE) ?? "auto";

  const cdate = g("cfg-countdown-date");
  if (cdate) cdate.value = c.countdownDate;

  const clabel = g("cfg-countdown-label");
  if (clabel) clabel.value = c.countdownLabel;

  // Countdown card config
  const cdCardTitle = g("cfg-cd-card-title");
  if (cdCardTitle) cdCardTitle.value = c.countdownCardTitle;

  const cdCardDate = g("cfg-cd-card-date");
  if (cdCardDate) cdCardDate.value = c.countdownCardDate;

  const cdCardTime = g("cfg-cd-card-time");
  if (cdCardTime) cdCardTime.value = c.countdownCardTime;

  const cdCardDoneMsg = g("cfg-cd-card-done-msg");
  if (cdCardDoneMsg) cdCardDoneMsg.value = c.countdownCardDoneMsg;
  const cdCardStartDate = g("cfg-cd-card-start-date");
  if (cdCardStartDate) cdCardStartDate.value = c.countdownCardStartDate ?? "";

  // F8 (v7.2): 2nd countdown event
  const cd2Title = g("cfg-cd2-title");
  if (cd2Title) cd2Title.value = c.countdownCard2Title ?? "";
  const cd2Date = g("cfg-cd2-date");
  if (cd2Date) cd2Date.value = c.countdownCard2Date ?? "";
  const cd2Time = g("cfg-cd2-time");
  if (cd2Time) cd2Time.value = c.countdownCard2Time ?? "18:00";
  const cd2DoneMsg = g("cfg-cd2-done-msg");
  if (cd2DoneMsg) cd2DoneMsg.value = c.countdownCard2DoneMsg ?? "🎉 מזל טוב!";

  // 3rd countdown event
  const cd3Title = g("cfg-cd3-title");
  if (cd3Title) cd3Title.value = c.countdownCard3Title ?? "";
  const cd3Date = g("cfg-cd3-date");
  if (cd3Date) cd3Date.value = c.countdownCard3Date ?? "";
  const cd3Time = g("cfg-cd3-time");
  if (cd3Time) cd3Time.value = c.countdownCard3Time ?? "18:00";
  const cd3DoneMsg = g("cfg-cd3-done-msg");
  if (cd3DoneMsg) cd3DoneMsg.value = c.countdownCard3DoneMsg ?? "🎉 מזל טוב!";

  // Chores / tasks (Advanced tab)
  const choresEl = gTxt("cfg-chores");
  if (choresEl) choresEl.value = localStorage.getItem(LS_CHORES) ?? "";

  // Portfolio editor (Advanced tab)
  const portfolioEl = gTxt("cfg-portfolio");
  if (portfolioEl) portfolioEl.value = localStorage.getItem(LS_PORTFOLIO) ?? "";

  // Tasks reset hour (Advanced tab)
  const resetHourEl = g("cfg-tasks-reset-hour");
  if (resetHourEl) resetHourEl.value = String(c.tasksResetHour ?? 6);

  // F7 (v7.3): Motivation auto-advance interval
  const motiInterval = g("cfg-moti-interval");
  if (motiInterval) motiInterval.value = String(c.motivationInterval ?? 0);

  // Animation level
  const animLevelEl = gSel("cfg-anim-level");
  if (animLevelEl) animLevelEl.value = c.animLevel ?? "normal";

  // per-card settings (now in Cards tab accordion)
  const wxHourly = g("cfg-weather-hourly") as HTMLSelectElement | null;
  if (wxHourly) wxHourly.value = (c.weatherShowHourly ?? true) ? "on" : "off";
  const wxWind = g("cfg-weather-wind") as HTMLSelectElement | null;
  if (wxWind) wxWind.value = (c.weatherShowWind ?? true) ? "on" : "off";
  const wxSunrise = g("cfg-weather-sunrise") as HTMLSelectElement | null;
  if (wxSunrise) wxSunrise.value = (c.weatherShowSunrise ?? true) ? "on" : "off";
  const wxDetails = g("cfg-weather-details") as HTMLSelectElement | null;
  if (wxDetails) wxDetails.value = (c.weatherShowDetails ?? true) ? "on" : "off";
  const wxUsTravel = g("cfg-weather-us-travel") as HTMLSelectElement | null;
  if (wxUsTravel) wxUsTravel.value = (c.weatherUsTravelMode ?? false) ? "on" : "off";
  const newsSource = g("cfg-news-show-source") as HTMLSelectElement | null;
  if (newsSource) newsSource.value = (c.newsShowSource ?? true) ? "on" : "off";
  const newsMaxItems = g("cfg-news-max-items");
  if (newsMaxItems) newsMaxItems.value = String(c.newsMaxItems ?? 20);
  const stocksSector = g("cfg-stocks-group-sector") as HTMLSelectElement | null;
  if (stocksSector) stocksSector.value = (c.stocksGroupBySector ?? false) ? "on" : "off";
  const stocksPortfolio = g("cfg-stocks-show-portfolio") as HTMLSelectElement | null;
  if (stocksPortfolio) stocksPortfolio.value = (c.stocksShowPortfolio ?? false) ? "on" : "off";
  const tasksShowDone = g("cfg-tasks-show-done") as HTMLSelectElement | null;
  if (tasksShowDone) tasksShowDone.value = (c.tasksShowDone ?? true) ? "on" : "off";
  const tasksShowCats = g("cfg-tasks-show-categories") as HTMLSelectElement | null;
  if (tasksShowCats) tasksShowCats.value = (c.tasksShowCategories ?? true) ? "on" : "off";
  const sysInfoRtt = g("cfg-sysinfo-show-rtt") as HTMLSelectElement | null;
  if (sysInfoRtt) sysInfoRtt.value = (c.sysInfoShowRtt ?? true) ? "on" : "off";

  // Cards tab — dynamically build per-card rows
  const cardsList = document.getElementById("cfg-cards-list");
  if (cardsList) {
    cardsList.replaceChildren();
    const frag = document.createDocumentFragment();
    const entries = [...listCards()].sort((a, b) =>
      getLocalizedCardTitle(a, c.interfaceLanguage).localeCompare(
        getLocalizedCardTitle(b, c.interfaceLanguage),
        c.interfaceLanguage === "en" ? "en" : "he",
      ),
    );

    // S55: Group by category with headings
    const categoryOrder = ["info", "finance", "lifestyle", "system"] as const;
    const categoryLabels: Record<string, { he: string; en: string }> = {
      info: { he: "מידע", en: "Information" },
      finance: { he: "פיננסים", en: "Finance" },
      lifestyle: { he: "אורח חיים", en: "Lifestyle" },
      system: { he: "מערכת", en: "System" },
    };
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const cat = entry.category ?? "system";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(entry);
    }

    for (const cat of categoryOrder) {
      const group = grouped.get(cat);
      if (!group || group.length === 0) continue;
      const heading = document.createElement("h4");
      heading.className = "cfg-card-category-heading";
      const label = categoryLabels[cat];
      if (!label) continue;
      heading.textContent = c.interfaceLanguage === "en" ? label.en : label.he;
      frag.appendChild(heading);

      for (const entry of group) {
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
        span.textContent = getLocalizedCardTitle(entry, c.interfaceLanguage, true);
        lbl.appendChild(cb);
        lbl.appendChild(span);

        // Size selector
        const sizeDiv = document.createElement("div");
        sizeDiv.className = "cfg-card-size-wrap";
        const sizeLbl = document.createElement("span");
        sizeLbl.className = "cfg-label";
        sizeLbl.textContent = t("cardSizeLabel", undefined, c.interfaceLanguage);
        const sel = document.createElement("select");
        sel.className = "cfg-input cfg-card-size-sel";
        sel.dataset["cardId"] = entry.id;
        sel.style.cssText = "width:70px;font-size:0.75em;padding:1px 3px";
        for (const [val, lText] of [
          ["sm", c.interfaceLanguage === "en" ? "Small" : "קטן"],
          ["md", c.interfaceLanguage === "en" ? "Medium" : "בינוני"],
          ["lg", c.interfaceLanguage === "en" ? "Large" : "גדול"],
          ["xl", c.interfaceLanguage === "en" ? "XL" : "ענק"],
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
    } // end category loop
    cardsList.appendChild(frag);
    // inject per-card configSchema fields
    void injectCardConfigSchemas(cardsList);
  }

  applyInterfaceLanguage(c.interfaceLanguage);
}

// ── Collect form values into config ──
function collectForm(): DashboardConfig {
  const c = loadConfig();

  // Display
  const interfaceLanguageEl = gSel("cfg-interface-language");
  if (
    interfaceLanguageEl &&
    (interfaceLanguageEl.value === "he" || interfaceLanguageEl.value === "en")
  ) {
    c.interfaceLanguage = interfaceLanguageEl.value;
  }

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

  // F3 (v7.2): Warm tint toggle
  const dimWarm = g("cfg-dim-warm");
  if (dimWarm) c.dimWarmTint = dimWarm.value.trim().toLowerCase() === "on";

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

  // Night dimmer intensity
  const dimLevelEl = g("cfg-dim-level");
  if (dimLevelEl) {
    const lvl = parseInt(dimLevelEl.value, 10);
    if (!isNaN(lvl)) c.nightDimLevel = Math.max(10, Math.min(95, lvl));
  }

  // Font scale
  const fontScaleEl = g("cfg-font-scale");
  if (fontScaleEl) {
    const pct = parseInt(fontScaleEl.value, 10);
    if (!isNaN(pct)) c.fontScale = Math.max(0.7, Math.min(1.5, pct / 100));
  }

  // Ticker speed
  const tickerSpeedCollect = g("cfg-ticker-speed");
  if (tickerSpeedCollect) {
    const spd = parseInt(tickerSpeedCollect.value, 10);
    if (!isNaN(spd)) c.tickerSpeed = Math.max(1, Math.min(5, spd));
  }

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
      .filter((b): b is { name: string; month: number; day: number } => b !== null);
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

  // F2 (v7.2): Alert volume
  const alertVolSlider2 = g("cfg-alert-volume");
  if (alertVolSlider2) {
    const vol = parseInt(alertVolSlider2.value, 10);
    if (!isNaN(vol)) c.alertVolume = Math.max(0, Math.min(100, vol));
  }

  const alertRealtime = g("cfg-alert-realtime");
  if (alertRealtime) c.realtimeAlerts = alertRealtime.value.trim().toLowerCase() === "on";

  const stockAlerts = gTxt("cfg-stock-alerts");
  if (stockAlerts) localStorage.setItem(LS_STOCK_ALERTS, stockAlerts.value.trim());

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

  // Network mode
  const netModeEl = g("cfg-network-mode") as HTMLSelectElement | null;
  if (netModeEl) {
    const nm = netModeEl.value;
    if (nm === "auto" || nm === "worker-only" || nm === "no-worker" || nm === "no-proxy") {
      localStorage.setItem(LS_NETWORK_MODE, nm);
    } else {
      localStorage.removeItem(LS_NETWORK_MODE);
    }
  }

  const cdate = g("cfg-countdown-date");
  if (cdate) c.countdownDate = cdate.value;

  const clabel = g("cfg-countdown-label");
  if (clabel) c.countdownLabel = clabel.value.trim();

  // Countdown card config
  const cdCardTitleEl = g("cfg-cd-card-title");
  if (cdCardTitleEl) c.countdownCardTitle = cdCardTitleEl.value.trim();

  const cdCardDateEl = g("cfg-cd-card-date");
  if (cdCardDateEl?.value) c.countdownCardDate = cdCardDateEl.value;

  const cdCardTimeEl = g("cfg-cd-card-time");
  if (cdCardTimeEl?.value) c.countdownCardTime = cdCardTimeEl.value;

  const cdCardDoneMsgEl = g("cfg-cd-card-done-msg");
  if (cdCardDoneMsgEl) c.countdownCardDoneMsg = cdCardDoneMsgEl.value.trim();
  const cdCardStartDateEl = g("cfg-cd-card-start-date");
  if (cdCardStartDateEl) c.countdownCardStartDate = cdCardStartDateEl.value.trim();

  // F8 (v7.2): 2nd countdown event
  const cd2TitleEl = g("cfg-cd2-title");
  if (cd2TitleEl) c.countdownCard2Title = cd2TitleEl.value.trim();
  const cd2DateEl = g("cfg-cd2-date");
  if (cd2DateEl) c.countdownCard2Date = cd2DateEl.value.trim();
  const cd2TimeEl = g("cfg-cd2-time");
  if (cd2TimeEl) c.countdownCard2Time = cd2TimeEl.value.trim();
  const cd2DoneMsgEl = g("cfg-cd2-done-msg");
  if (cd2DoneMsgEl) c.countdownCard2DoneMsg = cd2DoneMsgEl.value.trim();

  // 3rd countdown event
  const cd3TitleEl = g("cfg-cd3-title");
  if (cd3TitleEl) c.countdownCard3Title = cd3TitleEl.value.trim();
  const cd3DateEl = g("cfg-cd3-date");
  if (cd3DateEl) c.countdownCard3Date = cd3DateEl.value.trim();
  const cd3TimeEl = g("cfg-cd3-time");
  if (cd3TimeEl) c.countdownCard3Time = cd3TimeEl.value.trim();
  const cd3DoneMsgEl = g("cfg-cd3-done-msg");
  if (cd3DoneMsgEl) c.countdownCard3DoneMsg = cd3DoneMsgEl.value.trim();

  // Cards tab — hidden cards + sizes
  const hiddenCards: string[] = [];
  document.querySelectorAll<HTMLInputElement>(".cfg-card-cb[data-card-id]").forEach((cb) => {
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

  // Tasks reset hour (Advanced tab)
  const resetHourEl = g("cfg-tasks-reset-hour");
  if (resetHourEl) {
    const h = parseInt(resetHourEl.value, 10);
    if (!isNaN(h)) c.tasksResetHour = Math.max(0, Math.min(23, h));
  }

  // F7 (v7.3): Motivation auto-advance interval
  const motiIntervalEl = g("cfg-moti-interval");
  if (motiIntervalEl) {
    const mi = parseInt(motiIntervalEl.value, 10);
    c.motivationInterval = isNaN(mi) ? 0 : Math.max(0, Math.min(60, mi));
  }

  // Animation level
  const animLevelCollect = gSel("cfg-anim-level");
  if (animLevelCollect) {
    const v = animLevelCollect.value;
    if (v === "none" || v === "minimal" || v === "normal" || v === "full") {
      c.animLevel = v;
    }
  }

  // per-card boolean settings (now in Cards tab)
  c.weatherShowHourly = (g("cfg-weather-hourly") as HTMLSelectElement | null)?.value !== "off";
  c.weatherShowWind = (g("cfg-weather-wind") as HTMLSelectElement | null)?.value !== "off";
  c.weatherShowSunrise = (g("cfg-weather-sunrise") as HTMLSelectElement | null)?.value !== "off";
  c.weatherShowDetails = (g("cfg-weather-details") as HTMLSelectElement | null)?.value !== "off";
  c.weatherUsTravelMode = (g("cfg-weather-us-travel") as HTMLSelectElement | null)?.value === "on";
  c.newsShowSource = (g("cfg-news-show-source") as HTMLSelectElement | null)?.value !== "off";
  const newsMaxEl = g("cfg-news-max-items");
  if (newsMaxEl) {
    const v = parseInt(newsMaxEl.value, 10);
    if (!isNaN(v)) c.newsMaxItems = Math.min(50, Math.max(5, v));
  }
  c.stocksGroupBySector =
    (g("cfg-stocks-group-sector") as HTMLSelectElement | null)?.value === "on";
  c.stocksShowPortfolio =
    (g("cfg-stocks-show-portfolio") as HTMLSelectElement | null)?.value === "on";
  c.tasksShowDone = (g("cfg-tasks-show-done") as HTMLSelectElement | null)?.value !== "off";
  c.tasksShowCategories =
    (g("cfg-tasks-show-categories") as HTMLSelectElement | null)?.value !== "off";
  c.sysInfoShowRtt = (g("cfg-sysinfo-show-rtt") as HTMLSelectElement | null)?.value !== "off";

  return c;
}

// auto-inject card configSchema fields into Cards tab ────────

async function injectCardConfigSchemas(container: HTMLElement): Promise<void> {
  const runId = String(++cardConfigSchemaInjectRun);
  container.dataset["schemaRunId"] = runId;
  const defs = await getCardConfigSchemaDefs();
  if (!container.isConnected || container.dataset["schemaRunId"] !== runId) return;

  for (const def of defs) {
    try {
      const wrapper = document.createElement("div");
      wrapper.className = "cfg-card-schema";
      wrapper.dataset["cardId"] = def.id;
      buildConfigAccordion(def.fields, wrapper);

      // per-card config reset button
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "cfg-card-reset-btn";
      resetBtn.textContent = "↩ איפוס";
      resetBtn.addEventListener("click", () => {
        for (const field of def.fields) {
          const input = wrapper.querySelector<HTMLInputElement>(`[name="${field.key}"]`);
          if (!input) continue;
          if (typeof field.defaultValue === "boolean") {
            input.checked = field.defaultValue;
          } else {
            input.value = String(field.defaultValue);
          }
        }
        markDirty();
      });
      wrapper.appendChild(resetBtn);

      container.appendChild(wrapper);
    } catch {
      // Card not yet loaded — skip silently
    }
  }
}

// ── Config accordion renderer ─────────────────────────────────

/**
 * Build a `<fieldset>` or grouped `<details>` accordion fragment from an
 * array of `CardConfigField` definitions.
 *
 * Fields that share the same `group` string are wrapped in a `<details>`
 * element with a `<summary>` label. Fields without a `group` are rendered
 * flat inside the `container`.
 *
 * No DOM is actually inserted — callers append the returned fragment
 * wherever they need it (e.g., inside a config tab `<section>`).
 *
 * @param fields    - Card config field schema
 * @param container - Parent element to append the fragment into
 */
export function buildConfigAccordion(fields: CardConfigField[], container: HTMLElement): void {
  const groupMap = new Map<string, HTMLDetailsElement>();

  for (const field of fields) {
    if (field.group) {
      if (!groupMap.has(field.group)) {
        const details = document.createElement("details");
        if (field.groupOpenByDefault) details.open = true;
        const summary = document.createElement("summary");
        summary.textContent = field.group;
        details.appendChild(summary);
        groupMap.set(field.group, details);
        container.appendChild(details);
      }
      groupMap.get(field.group)!.appendChild(_buildFieldRow(field));
    } else {
      container.appendChild(_buildFieldRow(field));
    }
  }
}

/** Build a single label+input row for a config field. */
function _buildFieldRow(field: CardConfigField): HTMLElement {
  const row = document.createElement("div");
  row.className = "cfg-row";
  const label = document.createElement("label");
  label.textContent = `${field.labelHe} / ${field.labelEn}`;
  const input = document.createElement("input");
  input.type = field.type === "boolean" ? "checkbox" : field.type;
  input.name = field.key;
  if (typeof field.defaultValue === "boolean") {
    input.checked = field.defaultValue;
  } else {
    input.value = String(field.defaultValue);
  }
  if (field.min !== undefined) input.min = String(field.min);
  if (field.max !== undefined) input.max = String(field.max);
  if (field.step !== undefined) input.step = String(field.step);
  if (field.placeholder !== undefined) input.placeholder = field.placeholder;
  label.appendChild(input);
  row.appendChild(label);
  return row;
}

// ── Public API ──

export function openConfigPanel(): void {
  const ov = overlay();
  if (!ov) return;
  populateForm();
  const doOpen = (): void => {
    ov.classList.add("visible");
  };
  // cross-doc View Transitions for dialog open/close
  if ("startViewTransition" in document) {
    document.startViewTransition(doOpen);
  } else {
    doOpen();
  }
  // Auto-focus first text input for immediate keyboard access
  setTimeout(() => {
    const first = ov.querySelector<HTMLElement>("input[type='text']:not([disabled])");
    first?.focus();
  }, 50);
  // Wire unsaved-changes indicator on first open
  if (!ov.dataset["dirtyWired"]) {
    ov.dataset["dirtyWired"] = "1";
    ov.addEventListener("input", () => markDirty());
    ov.addEventListener("change", () => markDirty());
  }
  diagLog("[config-panel] opened");
}

export function closeConfigPanel(): void {
  if (_formDirty) {
    showToast(t("settingsUnsavedChanges"), 3000);
    _formDirty = false; // allow second close without warning
    return;
  }
  const ov = overlay();
  const doClose = (): void => {
    ov?.classList.remove("visible");
  };
  if ("startViewTransition" in document) {
    document.startViewTransition(doClose);
  } else {
    doClose();
  }
  clearDirty();
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
  // prefer Native File System Access (showSaveFilePicker) when
  // available; fall back to the legacy anchor-download path inside saveTextFile.
  void saveTextFile(json, {
    suggestedName: "dashboard-config.json",
    mimeType: "application/json",
    extensions: [".json"],
    description: "FamilyDashBoard config",
  })
    .then((written) => {
      if (written) diagLog("[config-panel] exported settings");
    })
    .catch((err) => {
      diagLog("[config-panel] export failed: " + String(err));
      showToast(t("settingsImportFailed"), 4000);
    });
}

export function importSettings(): void {
  // prefer Native File System Access (showOpenFilePicker) when
  // available; fall back to a hidden <input type="file"> via pickTextFile.
  void pickTextFile({
    mimeType: "application/json",
    extensions: [".json"],
    description: "FamilyDashBoard config",
  })
    .then((text) => {
      if (text == null) return;
      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== "object" || parsed === null) {
          showToast(t("settingsImportFailed"), 4000);
          diagLog("[config-panel] import failed: not an object");
          return;
        }
        const cfg = parsed as Record<string, unknown>;
        if (
          typeof cfg["configVersion"] !== "number" ||
          !Number.isInteger(cfg["configVersion"]) ||
          cfg["configVersion"] < 1
        ) {
          showToast(t("settingsImportFailed"), 4000);
          diagLog("[config-panel] import failed: missing or invalid configVersion");
          return;
        }
        saveConfig(cfg as unknown as DashboardConfig);
        populateForm();
        clearDirty();
        const fieldCount = Object.keys(cfg).length;
        showToast(t("settingsImported", { count: fieldCount }));
        diagLog("[config-panel] imported settings");
      } catch {
        showToast(t("settingsImportFailed"), 4000);
        diagLog("[config-panel] import failed: invalid JSON");
      }
    })
    .catch((err) => {
      diagLog("[config-panel] import failed: " + String(err));
      showToast(t("settingsImportFailed"), 4000);
    });
}

export function shareSettings(): void {
  const c = loadConfig();
  const hash = shareConfigHash(c);
  const url = window.location.href.split("#")[0] + hash;
  void navigator.clipboard.writeText(url).then(() => {
    showToast(t("settingsLinkCopied"));
  });
  diagLog("[config-panel] share link copied");
}

// ── Encrypted config URL (AES-GCM) ────────────────────────────

/** Resolve/reject for the active dialog promise. */
let _ecfgResolve: ((passphrase: string | null) => void) | null = null;

/** Show the passphrase dialog and return the entered passphrase (or null on cancel). */
function openEcfgDialog(mode: "export" | "import"): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    _ecfgResolve = resolve;
    const dlg = document.getElementById("ecfg-dialog") as HTMLDialogElement | null;
    const desc = document.getElementById("ecfg-dialog-desc");
    const input = document.getElementById("ecfg-passphrase-input") as HTMLInputElement | null;
    const errEl = document.getElementById("ecfg-dialog-error");
    if (!dlg) {
      resolve(null);
      return;
    }
    if (desc)
      desc.textContent = t(mode === "export" ? "ecfgDialogExportDesc" : "ecfgDialogImportDesc");
    if (input) input.value = "";
    if (errEl) {
      errEl.textContent = "";
      errEl.hidden = true;
    }
    dlg.showModal();
    input?.focus();
  });
}

/** Called by confirm button or Enter key inside the dialog. */
export function confirmEcfgDialog(): void {
  const input = document.getElementById("ecfg-passphrase-input") as HTMLInputElement | null;
  const passphrase = input?.value?.trim() ?? "";
  if (!passphrase) {
    const errEl = document.getElementById("ecfg-dialog-error");
    if (errEl) {
      errEl.textContent = "יש להזין סיסמה";
      errEl.hidden = false;
    }
    return;
  }
  const dlg = document.getElementById("ecfg-dialog") as HTMLDialogElement | null;
  dlg?.close();
  _ecfgResolve?.(passphrase);
  _ecfgResolve = null;
}

/** Called by cancel button or Escape key. */
export function cancelEcfgDialog(): void {
  const dlg = document.getElementById("ecfg-dialog") as HTMLDialogElement | null;
  dlg?.close();
  _ecfgResolve?.(null);
  _ecfgResolve = null;
}

/**
 * Encrypt current config and copy URL to clipboard.
 * export flow.
 */
export function encryptedShareSettings(): void {
  void openEcfgDialog("export").then(async (passphrase) => {
    if (!passphrase) return;
    try {
      const config = loadConfig();
      const fragment = await encryptConfig(config, passphrase);
      const url = window.location.href.split("#")[0] + fragment;
      await navigator.clipboard.writeText(url);
      showToast(t("encryptedShareCopied"));
      diagLog("[config-panel] encrypted share link copied");
    } catch {
      showToast(t("encryptedImportFailed"), 4000);
      diagLog("[config-panel] encrypt failed");
    }
  });
}

/**
 * Open the passphrase dialog to import an encrypted config URL.
 * Called from main.ts when a #ecfg= hash is detected at startup,
 * or from the config panel import button (not yet wired to UI import button).
 * @param fragment - The full URL hash including #ecfg= prefix.
 */
export function openEcfgImportDialog(fragment: string): void {
  void openEcfgDialog("import").then(async (passphrase) => {
    if (!passphrase) return;
    try {
      const raw = await decryptConfig(fragment, passphrase);
      const result = validateImportedConfig(raw);
      if (!result.ok || !result.config) {
        showToast(t("encryptedImportFailed"), 4000);
        diagLog("[config-panel] ecfg import validation failed: " + result.message);
        return;
      }
      saveConfig(result.config);
      // Strip the #ecfg= hash so the next reload doesn't re-prompt
      history.replaceState(null, "", window.location.pathname + window.location.search);
      showToast(t("encryptedImportSuccess"));
      diagLog("[config-panel] ecfg import succeeded");
    } catch {
      showToast(t("encryptedImportFailed"), 4000);
      diagLog("[config-panel] ecfg decryption failed — wrong passphrase or corrupt fragment");
    }
  });
}

// ── Tab switching ──
export function switchCfgTab(tab: string): void {
  document.querySelectorAll<HTMLElement>(".cfg-section").forEach((s) => {
    s.classList.toggle("active", s.dataset["tab"] === tab);
  });
  document.querySelectorAll<HTMLElement>(".cfg-tab").forEach((btn) => {
    const isActive = btn.dataset["tab"] === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    // WAI-ARIA roving tabindex: only active tab is in tab order
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  });
}

// ── Tab arrow-key navigation ──
function initTabKeyboard(): void {
  const container = document.querySelector<HTMLElement>(".cfg-tabs");
  if (!container) return;

  container.addEventListener("keydown", (e: KeyboardEvent) => {
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>(".cfg-tab"));
    const current = tabs.indexOf(e.target as HTMLButtonElement);
    if (current === -1) return;

    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (current + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (current - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = tabs.length - 1;
    }

    if (next !== -1) {
      e.preventDefault();
      const nextTab = tabs[next];
      if (!nextTab) return;
      nextTab.focus();
      const tabName = nextTab.dataset["tab"];
      if (tabName) switchCfgTab(tabName);
    }
  });
}

// ── Init ──
export function initConfigPanel(): void {
  // Gear button opens panel
  document.getElementById("cfg-gear-btn")?.addEventListener("click", toggleConfigPanel);

  // Arrow-key navigation for config tabs
  initTabKeyboard();

  // Close on overlay background click
  const ov = overlay();
  if (ov) {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeConfigPanel();
    });
  }

  // Save button
  el("cfg-save-btn")?.addEventListener("click", () => {
    const c = collectForm();
    let refreshTasks = false;
    let refreshPortfolio = false;

    saveConfig(c);
    applyInterfaceLanguage(c.interfaceLanguage);
    applyTheme(c.theme);
    setWarmTint(c.dimWarmTint ?? false);
    setClockSeconds(c.clockSeconds);
    applyFontScale(c.fontScale);
    applyTickerSpeed(c.tickerSpeed ?? 3);
    applyConfigAnimLevel(c);
    setDimLevel(c.nightDimLevel);
    updateDimIndicator();
    // Save chores JSON to localStorage and refresh tasks card
    const choresEl = gTxt("cfg-chores");
    if (choresEl) {
      const raw = choresEl.value.trim();
      try {
        JSON.parse(raw || "[]");
        localStorage.setItem(LS_CHORES, raw || "[]");
        refreshTasks = true;
      } catch {
        showToast(t("settingsChoresInvalid"), 3500);
      }
    }
    // Save portfolio JSON to localStorage
    const portfolioEl = gTxt("cfg-portfolio");
    if (portfolioEl) {
      const raw = portfolioEl.value.trim();
      if (raw === "") {
        localStorage.removeItem(LS_PORTFOLIO);
      } else {
        try {
          JSON.parse(raw);
          localStorage.setItem(LS_PORTFOLIO, raw);
          refreshPortfolio = true;
        } catch {
          showToast(t("settingsPortfolioInvalid"), 3500);
        }
      }
    }
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
    clearDirty();
    closeConfigPanel();
    diagLog("[config-panel] settings saved");
    showToast(t("settingsSaved"));
    void applySavedConfigSideEffects(c, refreshTasks, refreshPortfolio);
  });

  // Close button
  document.getElementById("cfg-close-btn")?.addEventListener("click", closeConfigPanel);

  // Preset selector — applies overrides and repopulates form
  const presetEl = gSel("cfg-preset");
  if (presetEl) {
    presetEl.addEventListener("change", () => {
      const preset = getPreset(presetEl.value);
      if (!preset) return;
      const c = loadConfig();
      const merged: DashboardConfig = { ...c, ...preset.overrides };
      saveConfig(merged);
      applyTheme(merged.theme);
      applyFontScale(merged.fontScale);
      populateForm();
      markDirty();
      presetEl.value = ""; // reset selector to placeholder
      diagLog(`[config-panel] applied preset: ${preset.id}`);
      showToast(`${preset.icon} ${preset.label}`);
    });
  }

  // Tab buttons — replace inline onclick with event listeners
  document.querySelectorAll<HTMLButtonElement>(".cfg-tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset["tab"];
      if (tab) switchCfgTab(tab);
    });
  });

  // Font size slider live preview
  const newsFont = g("cfg-news-fontsize");
  const newsFontVal = el("cfg-news-fontsize-val");
  if (newsFont && newsFontVal) {
    newsFont.addEventListener("input", () => {
      newsFontVal.textContent = `${newsFont.value}%`;
    });
  }

  // Night dimmer level slider live preview
  const dimLevelSlider = g("cfg-dim-level");
  const dimLevelValEl = el("cfg-dim-level-val");
  if (dimLevelSlider && dimLevelValEl) {
    dimLevelSlider.addEventListener("input", () => {
      dimLevelValEl.textContent = `${dimLevelSlider.value}%`;
    });
  }

  // Font scale slider live preview + apply
  const fontScaleSlider = g("cfg-font-scale");
  const fontScaleValEl = el("cfg-font-scale-val");
  if (fontScaleSlider && fontScaleValEl) {
    fontScaleSlider.addEventListener("input", () => {
      fontScaleValEl.textContent = `${fontScaleSlider.value}%`;
    });
  }

  // Ticker speed slider live preview
  const tickerSpeedSlider = g("cfg-ticker-speed");
  const tickerSpeedValEl = el("cfg-ticker-speed-val");
  if (tickerSpeedSlider && tickerSpeedValEl) {
    tickerSpeedSlider.addEventListener("input", () => {
      tickerSpeedValEl.textContent = tickerSpeedSlider.value;
    });
  }

  // F4 (v7.3): Live theme preview on select change
  const themeSelectLive = gSel("theme-select");
  if (themeSelectLive) {
    themeSelectLive.addEventListener("change", () => {
      applyTheme(themeSelectLive.value);
    });
  }

  // Settings export / import / share buttons (replaces inline onclick)
  document.getElementById("cfg-export-btn")?.addEventListener("click", exportSettings);
  document.getElementById("cfg-import-btn")?.addEventListener("click", importSettings);
  document.getElementById("cfg-share-btn")?.addEventListener("click", shareSettings);
  document
    .getElementById("cfg-encrypt-share-btn")
    ?.addEventListener("click", encryptedShareSettings);

  // Encrypted config passphrase dialog buttons
  document.getElementById("ecfg-dialog-confirm")?.addEventListener("click", confirmEcfgDialog);
  document.getElementById("ecfg-dialog-cancel")?.addEventListener("click", cancelEcfgDialog);
  document.getElementById("ecfg-passphrase-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmEcfgDialog();
  });
  // Close on backdrop click (Escape is handled natively by dialog)
  const ecfgDlg = document.getElementById("ecfg-dialog") as HTMLDialogElement | null;
  ecfgDlg?.addEventListener("cancel", cancelEcfgDialog);

  // Reset card layout button
  document.getElementById("cfg-reset-layout-btn")?.addEventListener("click", () => {
    resetLayout();
    showToast(t("settingsLayoutReset"));
    diagLog("[config-panel] layout reset");
  });

  // F2 (v7.2): Alert volume live preview
  const alertVolSliderInit = g("cfg-alert-volume");
  const alertVolValInit = el("cfg-alert-volume-val");
  if (alertVolSliderInit && alertVolValInit) {
    alertVolSliderInit.addEventListener("input", () => {
      alertVolValInit.textContent = `${alertVolSliderInit.value}%`;
    });
  }

  // F4 (v7.2): Reset all defaults
  document.getElementById("cfg-reset-all-btn")?.addEventListener("click", () => {
    if (!confirm("מחיקת כל ההגדרות ואיפוס לברירות המחדל?")) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("dash"))
      .forEach((k) => localStorage.removeItem(k));
    location.reload();
  });

  // JSON live validation for chores + portfolio textareas
  const validateJsonField = (el: HTMLTextAreaElement): void => {
    try {
      JSON.parse(el.value || "[]");
      el.style.outline = "";
    } catch {
      el.style.outline = "2px solid #f87171";
    }
  };
  const choresEl = gTxt("cfg-chores");
  if (choresEl) {
    choresEl.addEventListener("input", () => validateJsonField(choresEl));
  }
  const portfolioEl = gTxt("cfg-portfolio");
  if (portfolioEl) {
    portfolioEl.addEventListener("input", () => validateJsonField(portfolioEl));
  }

  // Ctrl+S saves from within config panel (works even when inputs are focused)
  overlay()?.addEventListener("keydown", (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.ctrlKey && ke.key === "s") {
      ke.preventDefault();
      el("cfg-save-btn")?.click();
    }
  });

  // Config search box
  const cfgSearchBox = document.getElementById("cfg-search-box") as HTMLInputElement | null;
  if (cfgSearchBox) {
    cfgSearchBox.addEventListener("input", () => {
      const q = cfgSearchBox.value.trim().toLowerCase();
      const allRows = overlay()?.querySelectorAll<HTMLElement>(".cfg-row");
      const allSections = overlay()?.querySelectorAll<HTMLElement>(".cfg-section");
      const allSectionHdrs = overlay()?.querySelectorAll<HTMLElement>(".cfg-group-label");

      if (!allRows) return;

      if (!q) {
        // Restore normal tab visibility
        allRows.forEach((r) => r.removeAttribute("hidden"));
        allSectionHdrs?.forEach((h) => h.removeAttribute("hidden"));
        allSections?.forEach((s) => {
          s.removeAttribute("hidden");
          // Restore active state based on tabs
          const isActive = s.classList.contains("active");
          if (!isActive) s.setAttribute("hidden", "");
          else s.removeAttribute("hidden");
        });
        return;
      }

      // Show all sections while searching
      allSections?.forEach((s) => s.removeAttribute("hidden"));
      allSectionHdrs?.forEach((h) => h.removeAttribute("hidden"));

      allRows.forEach((row) => {
        const text = (row.textContent ?? "").toLowerCase();
        const match = text.includes(q);
        if (match) row.removeAttribute("hidden");
        else row.setAttribute("hidden", "");
      });
    });

    // Clear search when panel closes
    overlay()?.addEventListener("click", (e: Event) => {
      const ov = overlay();
      if (e.target === ov && cfgSearchBox.value) {
        cfgSearchBox.value = "";
        cfgSearchBox.dispatchEvent(new Event("input"));
      }
    });
  }

  diagLog("[config-panel] initialized");
}
