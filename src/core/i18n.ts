import { loadConfig } from "./config";
import type { InterfaceLanguage } from "./constants";

type TranslationKey =
  | "dashboardTitle"
  | "documentDescription"
  | "pwaInstall"
  | "pwaInstallTitle"
  | "refreshing"
  | "offlineBanner"
  | "swUpdateBanner"
  | "swUpdateNow"
  | "settingsTitle"
  | "settingsTabDisplay"
  | "settingsTabCalendar"
  | "settingsTabFeeds"
  | "settingsTabAlerts"
  | "settingsTabCards"
  | "settingsTabAdvanced"
  | "interfaceLanguageLabel"
  | "screenModeLabel"
  | "themeLabel"
  | "familyNameLabel"
  | "membersLabel"
  | "clockSecondsLabel"
  | "tempUnitLabel"
  | "save"
  | "close"
  | "exportSettings"
  | "importSettings"
  | "shareLink"
  | "resetAll"
  | "resetLayout"
  | "settingsCloseHint"
  | "settingsUnsavedChanges"
  | "settingsImported"
  | "settingsImportFailed"
  | "settingsLinkCopied"
  | "settingsSaved"
  | "settingsChoresInvalid"
  | "settingsPortfolioInvalid"
  | "settingsLayoutReset"
  | "quoteCopied"
  | "alertsEnabled"
  | "alertsDisabled"
  | "offlineToast"
  | "onlineRefreshing"
  | "marketOpen"
  | "marketPre"
  | "marketAfter"
  | "marketClosed"
  | "birthdayToday"
  | "birthdayInDays"
  | "countdownToday"
  | "countdownInDays"
  | "goodMorning"
  | "goodNoon"
  | "goodEvening"
  | "goodNight"
  | "birthdayChipTitle"
  | "countdownChipTitle"
  | "notificationsBell"
  | "clockAriaLabel"
  | "clockTitle"
  | "languageHebrew"
  | "languageEnglish"
  | "screenModeTv"
  | "screenModeTablet"
  | "screenModePhone"
  | "themeBlack"
  | "themeBlue"
  | "themeMatrix"
  | "themeAmber"
  | "themePurple"
  | "themeRose"
  | "alertsToggleOn"
  | "alertsToggleOff"
  | "helpTitle"
  | "cardSizeLabel";

const UI_TEXT: Record<InterfaceLanguage, Record<TranslationKey, string>> = {
  he: {
    dashboardTitle: "רגואן Family Dashboard",
    documentDescription: "לוח מחוונים משפחתי לטלוויזיה — עברית RTL, 6 ערכות נושא, נתונים חיים.",
    pwaInstall: "📲 התקן",
    pwaInstallTitle: "התקן כאפליקציה עצמאית — עובד גם בלי אינטרנט",
    refreshing: "🔄 מרענן...",
    offlineBanner: "⚠️ אין חיבור לאינטרנט — מציג נתונים מהמטמון",
    swUpdateBanner: "🆕 גרסה חדשה זמינה — ",
    swUpdateNow: "↻ עדכן עכשיו",
    settingsTitle: "⚙️ הגדרות",
    settingsTabDisplay: "🖥️ תצוגה",
    settingsTabCalendar: "📅 לוח",
    settingsTabFeeds: "📰 עדכונים",
    settingsTabAlerts: "🚨 התראות",
    settingsTabCards: "🃏 כרטיסיות",
    settingsTabAdvanced: "⚙️ מתקדם",
    interfaceLanguageLabel: "🌐 שפת ממשק",
    screenModeLabel: "🖥️ מצב מסך",
    themeLabel: "🎨 ערכת נושא",
    familyNameLabel: "👨‍👩‍👧‍👦 שם משפחה (לברכה)",
    membersLabel: "👨‍👩‍👧 שמות בני המשפחה",
    clockSecondsLabel: "⏱️ שניות בשעון",
    tempUnitLabel: "🌡️ יחידת טמפרטורה",
    save: "שמור",
    close: "סגור",
    exportSettings: "📥 ייצוא הגדרות",
    importSettings: "📤 ייבוא הגדרות",
    shareLink: "🔗 שתף קישור",
    resetAll: "⚠️ אפס הכל",
    resetLayout: "↩ איפוס סידור כרטיסיות",
    settingsCloseHint: "לחץ S או Escape לסגירה",
    settingsUnsavedChanges: "⚠️ יש שינויים שלא נשמרו — לחץ שמור או סגור שוב",
    settingsImported: "✅ ייבאו {count} שדות הגדרה",
    settingsImportFailed: "⚠️ ייבוא נכשל — קובץ JSON לא תקין",
    settingsLinkCopied: "🔗 קישור ההגדרות הועתק ללוח",
    settingsSaved: "✅ הגדרות נשמרו בהצלחה",
    settingsChoresInvalid: "⚠️ JSON משימות לא תקין — לא נשמר",
    settingsPortfolioInvalid: "⚠️ JSON תיק השקעות לא תקין — לא נשמר",
    settingsLayoutReset: "↩ סידור הכרטיסיות אופס — טען מחדש להחלה",
    quoteCopied: "📋 הציטוט הועתק ללוח",
    alertsEnabled: "✅ התרעות פעילות",
    alertsDisabled: "❌ התרעות הושבתו",
    offlineToast: "❌ אין חיבור לאינטרנט",
    onlineRefreshing: "🌐 החיבור חזר — מרענן נתונים...",
    marketOpen: "🟢 פתוח{countdown}",
    marketPre: "🟡 פרה{countdown}",
    marketAfter: "🟠 אח\"מ{countdown}",
    marketClosed: "🔴 סגור",
    birthdayToday: "🎂 יום הולדת — {name}!",
    birthdayInDays: "🎂 {name} בעוד {days} ימים",
    countdownToday: "🎉 {label} — היום!",
    countdownInDays: "⏳ {label}: {days} ימים",
    goodMorning: "🌅 בוקר טוב {suffix}",
    goodNoon: "☀️ צהריים טובים!",
    goodEvening: "🌆 ערב טוב {suffix}",
    goodNight: "🌙 לילה טוב!",
    birthdayChipTitle: "יום הולדת קרוב",
    countdownChipTitle: "ספירה אישית",
    notificationsBell: "🔔 הפעל התראות",
    clockAriaLabel: "שעה",
    clockTitle: "לחץ ? או H לתפריט קיצורי מקלדת",
    languageHebrew: "עברית",
    languageEnglish: "English",
    screenModeTv: "📺 טלוויזיה",
    screenModeTablet: "📱 טאבלט",
    screenModePhone: "📱 נייד",
    themeBlack: "■ שחור OLED",
    themeBlue: "🟦 כחול לילה",
    themeMatrix: "🟩 מטריקס",
    themeAmber: "🟧 ענבר",
    themePurple: "🟥 סגול",
    themeRose: "🌹 ורד לילה",
    alertsToggleOn: "פעיל",
    alertsToggleOff: "כבוי",
    helpTitle: "⌨️ קיצורי מקלדת",
    cardSizeLabel: "גודל:",
  },
  en: {
    dashboardTitle: "Rajwan Family Dashboard",
    documentDescription: "Family TV dashboard — English/Hebrew interface, 6 themes, live data.",
    pwaInstall: "📲 Install",
    pwaInstallTitle: "Install as a standalone app — works offline too",
    refreshing: "🔄 Refreshing...",
    offlineBanner: "⚠️ No internet connection — showing cached data",
    swUpdateBanner: "🆕 A new version is available — ",
    swUpdateNow: "↻ Update now",
    settingsTitle: "⚙️ Settings",
    settingsTabDisplay: "🖥️ Display",
    settingsTabCalendar: "📅 Calendar",
    settingsTabFeeds: "📰 Feeds",
    settingsTabAlerts: "🚨 Alerts",
    settingsTabCards: "🃏 Cards",
    settingsTabAdvanced: "⚙️ Advanced",
    interfaceLanguageLabel: "🌐 Interface language",
    screenModeLabel: "🖥️ Screen mode",
    themeLabel: "🎨 Theme",
    familyNameLabel: "👨‍👩‍👧‍👦 Family name",
    membersLabel: "👨‍👩‍👧 Family members",
    clockSecondsLabel: "⏱️ Show clock seconds",
    tempUnitLabel: "🌡️ Temperature unit",
    save: "Save",
    close: "Close",
    exportSettings: "📥 Export settings",
    importSettings: "📤 Import settings",
    shareLink: "🔗 Share link",
    resetAll: "⚠️ Reset all",
    resetLayout: "↩ Reset card layout",
    settingsCloseHint: "Press S or Escape to close",
    settingsUnsavedChanges: "⚠️ You have unsaved changes — save or close again",
    settingsImported: "✅ Imported {count} setting fields",
    settingsImportFailed: "⚠️ Import failed — invalid JSON file",
    settingsLinkCopied: "🔗 Settings link copied to clipboard",
    settingsSaved: "✅ Settings saved successfully",
    settingsChoresInvalid: "⚠️ Tasks JSON is invalid — not saved",
    settingsPortfolioInvalid: "⚠️ Portfolio JSON is invalid — not saved",
    settingsLayoutReset: "↩ Card layout reset — reload to apply",
    quoteCopied: "📋 Quote copied to clipboard",
    alertsEnabled: "✅ Alerts enabled",
    alertsDisabled: "❌ Alerts disabled",
    offlineToast: "❌ No internet connection",
    onlineRefreshing: "🌐 Connection restored — refreshing data...",
    marketOpen: "🟢 Open{countdown}",
    marketPre: "🟡 Pre-market{countdown}",
    marketAfter: "🟠 After-hours{countdown}",
    marketClosed: "🔴 Closed",
    birthdayToday: "🎂 Birthday today — {name}!",
    birthdayInDays: "🎂 {name} in {days} days",
    countdownToday: "🎉 {label} — today!",
    countdownInDays: "⏳ {label}: {days} days",
    goodMorning: "🌅 Good morning {suffix}",
    goodNoon: "☀️ Good afternoon!",
    goodEvening: "🌆 Good evening {suffix}",
    goodNight: "🌙 Good night!",
    birthdayChipTitle: "Upcoming birthday",
    countdownChipTitle: "Personal countdown",
    notificationsBell: "🔔 Enable notifications",
    clockAriaLabel: "Time",
    clockTitle: "Press ? or H for keyboard shortcuts",
    languageHebrew: "Hebrew",
    languageEnglish: "English",
    screenModeTv: "📺 TV",
    screenModeTablet: "📱 Tablet",
    screenModePhone: "📱 Phone",
    themeBlack: "■ OLED Black",
    themeBlue: "🟦 Night Blue",
    themeMatrix: "🟩 Matrix",
    themeAmber: "🟧 Amber",
    themePurple: "🟥 Purple",
    themeRose: "🌹 Rose",
    alertsToggleOn: "On",
    alertsToggleOff: "Off",
    helpTitle: "⌨️ Keyboard Shortcuts",
    cardSizeLabel: "Size:",
  },
};

function formatTemplate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? "" : String(value);
  });
}

export function getInterfaceLanguage(): InterfaceLanguage {
  const language = loadConfig().interfaceLanguage;
  return language === "en" ? "en" : "he";
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  language = getInterfaceLanguage(),
): string {
  return formatTemplate(UI_TEXT[language][key], params);
}

export function getLocalizedCardTitle(
  item: { titleHe: string; titleEn: string; icon?: string },
  language = getInterfaceLanguage(),
  includeIcon = false,
): string {
  const title = language === "en" ? item.titleEn : item.titleHe;
  return includeIcon && item.icon ? `${item.icon} ${title}` : title;
}

export function getInterfaceDirection(
  language = getInterfaceLanguage(),
): "rtl" | "ltr" {
  return language === "en" ? "ltr" : "rtl";
}

function setText(selector: string, value: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.textContent = value;
}

function setAttr(selector: string, attr: string, value: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.setAttribute(attr, value);
}

function setCfgLabel(id: string, value: string): void {
  const input = document.getElementById(id);
  const label = input?.closest(".cfg-row")?.querySelector<HTMLElement>(".cfg-label");
  if (label) label.textContent = value;
}

function setSelectOptions(
  id: string,
  options: Record<string, string>,
): void {
  const select = document.getElementById(id) as HTMLSelectElement | null;
  if (!select) return;
  Array.from(select.options).forEach((option) => {
    const value = options[option.value];
    if (value) option.textContent = value;
  });
}

export function applyInterfaceLanguage(
  language = getInterfaceLanguage(),
): void {
  const dir = getInterfaceDirection(language);
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
  document.body.dataset["interfaceLanguage"] = language;
  document.title = t("dashboardTitle", undefined, language);

  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );
  if (description) {
    description.content = t("documentDescription", undefined, language);
  }

  setText("#pwa-install-btn", t("pwaInstall", undefined, language));
  setAttr("#pwa-install-btn", "title", t("pwaInstallTitle", undefined, language));
  setAttr("#pwa-install-btn", "aria-label", t("pwaInstall", undefined, language));
  setText("#refresh-toast", t("refreshing", undefined, language));
  setText("#offline-banner", t("offlineBanner", undefined, language));
  setText("#cfg-save-btn", t("save", undefined, language));
  setText("#cfg-close-btn", t("close", undefined, language));
  setText("#cfg-export-btn", t("exportSettings", undefined, language));
  setText("#cfg-import-btn", t("importSettings", undefined, language));
  setText("#cfg-share-btn", t("shareLink", undefined, language));
  setText("#cfg-reset-all-btn", t("resetAll", undefined, language));
  setText("#cfg-reset-layout-btn", t("resetLayout", undefined, language));
  setText("#notif-bell", t("notificationsBell", undefined, language));
  setText("#help-overlay h2", t("helpTitle", undefined, language));
  setText("#config-panel h2", t("settingsTitle", undefined, language));
  setText("#card-title-news", language === "en" ? "News" : "חדשות");
  setText("#card-title-hebrew-cal", language === "en" ? "Hebrew Calendar" : "לוח עברי");
  setText("#card-title-calendar", language === "en" ? "Family Calendar" : "לוח שנה משפחתי");
  setText("#card-title-currency", language === "en" ? "Exchange Rates" : "שערי מטבע");
  setText("#card-title-stocks", language === "en" ? "Stocks" : "מניות");
  setText("#card-title-alerts", language === "en" ? "Red Alerts" : "צבע אדום");
  setText("#card-title-motivation", language === "en" ? "Motivation" : "מוטיבציה");
  setText("#card-title-countdown", language === "en" ? "Countdown" : "ספירה לאחור");
  setText("#card-title-tasks", language === "en" ? "Tasks" : "משימות");
  setText("#card-title-system-info", language === "en" ? "System Info" : "מצב מערכת");
  setText("#clock", document.getElementById("clock")?.textContent ?? "00:00");
  setAttr("#clock", "aria-label", t("clockAriaLabel", undefined, language));
  setAttr("#clock", "title", t("clockTitle", undefined, language));
  setAttr("#header-birthday-chip", "title", t("birthdayChipTitle", undefined, language));
  setAttr("#header-countdown", "title", t("countdownChipTitle", undefined, language));

  const swBanner = document.getElementById("sw-update-banner");
  if (swBanner?.firstChild) {
    swBanner.firstChild.textContent = t("swUpdateBanner", undefined, language);
  }
  setText("#sw-update-reload-btn", t("swUpdateNow", undefined, language));

  const tabLabels: Record<string, TranslationKey> = {
    display: "settingsTabDisplay",
    calendar: "settingsTabCalendar",
    feeds: "settingsTabFeeds",
    "alerts-tab": "settingsTabAlerts",
    cards: "settingsTabCards",
    advanced: "settingsTabAdvanced",
  };
  document
    .querySelectorAll<HTMLButtonElement>(".cfg-tab[data-tab]")
    .forEach((button) => {
      const tab = button.dataset["tab"];
      if (!tab) return;
      const key = tabLabels[tab];
      if (key) button.textContent = t(key, undefined, language);
    });

  setCfgLabel("cfg-interface-language", t("interfaceLanguageLabel", undefined, language));
  setCfgLabel("screen-mode-select", t("screenModeLabel", undefined, language));
  setCfgLabel("theme-select", t("themeLabel", undefined, language));
  setCfgLabel("cfg-family-name", t("familyNameLabel", undefined, language));
  setCfgLabel("cfg-members", t("membersLabel", undefined, language));
  setCfgLabel("cfg-clock-seconds", t("clockSecondsLabel", undefined, language));
  setCfgLabel("cfg-temp-unit", t("tempUnitLabel", undefined, language));

  setSelectOptions("cfg-interface-language", {
    he: t("languageHebrew", undefined, language),
    en: t("languageEnglish", undefined, language),
  });
  setSelectOptions("screen-mode-select", {
    tv: t("screenModeTv", undefined, language),
    tablet: t("screenModeTablet", undefined, language),
    phone: t("screenModePhone", undefined, language),
  });
  setSelectOptions("theme-select", {
    black: t("themeBlack", undefined, language),
    blue: t("themeBlue", undefined, language),
    matrix: t("themeMatrix", undefined, language),
    amber: t("themeAmber", undefined, language),
    purple: t("themePurple", undefined, language),
    rose: t("themeRose", undefined, language),
  });
  setSelectOptions("alerts-toggle", {
    on: t("alertsToggleOn", undefined, language),
    off: t("alertsToggleOff", undefined, language),
  });

  document
    .querySelectorAll<HTMLElement>(".cfg-card-size-wrap .cfg-label")
    .forEach((label) => {
      label.textContent = t("cardSizeLabel", undefined, language);
    });
}
