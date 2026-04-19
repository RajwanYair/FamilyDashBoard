import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyInterfaceLanguage, getLocalizedCardTitle, t } from "@/core/i18n";

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <button id="pwa-install-btn"></button>
      <div id="refresh-toast"></div>
      <div id="offline-banner"></div>
      <div id="config-panel"><h2></h2></div>
      <button id="cfg-save-btn"></button>
      <button id="cfg-close-btn"></button>
      <span id="card-title-news"></span>
      <span id="card-title-stocks"></span>
      <div id="clock"></div>
      <span id="header-birthday-chip"></span>
      <span id="header-countdown"></span>
      <select id="cfg-interface-language"><option value="he"></option><option value="en"></option></select>
      <select id="screen-mode-select"><option value="tv"></option><option value="tablet"></option><option value="phone"></option></select>
      <select id="theme-select"><option value="black"></option><option value="blue"></option><option value="matrix"></option><option value="amber"></option><option value="purple"></option><option value="rose"></option></select>
      <select id="alerts-toggle"><option value="on"></option><option value="off"></option></select>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("applies English language and direction to the document", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ interfaceLanguage: "en" }),
    );

    applyInterfaceLanguage("en");

    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.getElementById("cfg-save-btn")?.textContent).toBe("Save");
    expect(document.getElementById("card-title-news")?.textContent).toBe("News");
  });

  it("returns localized card titles", () => {
    const item = { icon: "✨", titleHe: "מוטיבציה", titleEn: "Motivation" };
    expect(getLocalizedCardTitle(item, "he", true)).toBe("✨ מוטיבציה");
    expect(getLocalizedCardTitle(item, "en", true)).toBe("✨ Motivation");
  });

  it("formats translated strings with placeholders", () => {
    expect(t("settingsImported", { count: 3 }, "en")).toContain("3");
    expect(t("settingsImported", { count: 3 }, "he")).toContain("3");
  });
});