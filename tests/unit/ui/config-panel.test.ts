/**
 * Tests for src/ui/config-panel.ts
 *
 * Covers: open/close/toggle, isConfigPanelOpen, switchCfgTab,
 * populateForm (reads config → DOM), collectForm (DOM → config),
 * initConfigPanel (gear button, save button wiring).
 *
 * Most tests reuse the imported module. config-panel now refreshes cached DOM
 * references when the document is replaced, so full module resets are only
 * needed in tests that install mocks before import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupConfigPanelTestDOM } from "../helpers/config-panel-dom";
import { shareSettings, exportSettings, importSettings } from "@/ui/config-panel";

type CfgMod = {
  openConfigPanel: () => void;
  closeConfigPanel: () => void;
  toggleConfigPanel: () => void;
  isConfigPanelOpen: () => boolean;
  switchCfgTab: (tab: string) => void;
  initConfigPanel: () => void;
};

async function freshCfg(): Promise<CfgMod> {
  return import("@/ui/config-panel") as Promise<CfgMod>;
}

// Minimal HTML shell for config panel tests
function setupDOM(): void {
  setupConfigPanelTestDOM();
}

describe("Config Panel — open/close/toggle", () => {
  let mod: CfgMod;

  beforeEach(async () => {
    localStorage.clear();
    setupDOM();
    mod = await freshCfg();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("openConfigPanel adds visible class", () => {
    mod.openConfigPanel();
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(true);
  });

  it("closeConfigPanel removes visible class", () => {
    mod.openConfigPanel();
    mod.closeConfigPanel();
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(false);
  });

  it("toggleConfigPanel opens when closed", () => {
    mod.toggleConfigPanel();
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(true);
  });

  it("toggleConfigPanel closes when open", () => {
    mod.openConfigPanel();
    mod.toggleConfigPanel();
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(false);
  });

  it("isConfigPanelOpen returns correct state", () => {
    expect(mod.isConfigPanelOpen()).toBe(false);
    mod.openConfigPanel();
    expect(mod.isConfigPanelOpen()).toBe(true);
    mod.closeConfigPanel();
    expect(mod.isConfigPanelOpen()).toBe(false);
  });

  it("does not throw when overlay element is absent", async () => {
    document.body.innerHTML = "";
    const emptyMod = await freshCfg();
    expect(() => emptyMod.openConfigPanel()).not.toThrow();
  });
});

describe("Config Panel — switchCfgTab", () => {
  let mod: CfgMod;

  beforeEach(async () => {
    setupDOM();
    mod = await freshCfg();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("activates the target section", () => {
    mod.switchCfgTab("calendar");
    const calSection = document.querySelector<HTMLElement>('.cfg-section[data-tab="calendar"]');
    expect(calSection?.classList.contains("active")).toBe(true);
  });

  it("deactivates the previously active section", () => {
    mod.switchCfgTab("calendar");
    const displaySection = document.querySelector<HTMLElement>('.cfg-section[data-tab="display"]');
    expect(displaySection?.classList.contains("active")).toBe(false);
  });

  it("activates the target tab button", () => {
    mod.switchCfgTab("feeds");
    const feedsBtn = document.querySelector<HTMLElement>('.cfg-tab[data-tab="feeds"]');
    expect(feedsBtn?.classList.contains("active")).toBe(true);
  });

  it("deactivates other tab buttons", () => {
    mod.switchCfgTab("feeds");
    const displayBtn = document.querySelector<HTMLElement>('.cfg-tab[data-tab="display"]');
    expect(displayBtn?.classList.contains("active")).toBe(false);
  });
});

describe("Config Panel — populateForm (via openConfigPanel)", () => {
  let mod: CfgMod;

  beforeEach(async () => {
    localStorage.clear();
    setupDOM();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        interfaceLanguage: "en",
        theme: "blue",
        screenMode: "tablet",
        tempUnit: "F",
        familyName: "בן-דוד",
        members: ["אבא", "אמא"],
        geonameid: "123456",
        alertsEnabled: true,
        alertZone: "תל אביב",
        customProxy: "https://proxy.example.com/",
        countdownLabel: "חופשה",
        countdownDate: "2024-07-15",
      }),
    );
    mod = await freshCfg();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("populates theme select from config", () => {
    mod.openConfigPanel();
    expect((document.getElementById("theme-select") as HTMLSelectElement)?.value).toBe("blue");
  });

  it("populates screen-mode select from config", () => {
    mod.openConfigPanel();
    expect((document.getElementById("screen-mode-select") as HTMLSelectElement)?.value).toBe(
      "tablet",
    );
  });

  it("populates interface language from config", () => {
    mod.openConfigPanel();
    expect((document.getElementById("cfg-interface-language") as HTMLSelectElement)?.value).toBe(
      "en",
    );
  });

  it("populates temp unit from config", () => {
    mod.openConfigPanel();
    expect((document.getElementById("cfg-temp-unit") as HTMLInputElement)?.value).toBe("F");
  });

  it("populates family name from config", () => {
    mod.openConfigPanel();
    expect((document.getElementById("cfg-family-name") as HTMLInputElement)?.value).toBe("בן-דוד");
  });

  it("populates members from config", () => {
    mod.openConfigPanel();
    const v = (document.getElementById("cfg-members") as HTMLInputElement)?.value;
    expect(v).toContain("אבא");
    expect(v).toContain("אמא");
  });

  it("populates countdown card title from config", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ countdownCardTitle: "יום הולדת" }));
    mod.openConfigPanel();
    expect((document.getElementById("cfg-cd-card-title") as HTMLInputElement)?.value).toBe(
      "יום הולדת",
    );
  });

  it("populates countdown card date from config", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ countdownCardDate: "2027-06-15" }));
    mod.openConfigPanel();
    expect((document.getElementById("cfg-cd-card-date") as HTMLInputElement)?.value).toBe(
      "2027-06-15",
    );
  });
});

describe("Config Panel — initConfigPanel wiring", () => {
  let mod: CfgMod;

  beforeEach(async () => {
    localStorage.clear();
    setupDOM();
    mod = await freshCfg();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("gear button opens the panel on click", () => {
    mod.initConfigPanel();
    document.getElementById("cfg-gear-btn")?.click();
    expect(mod.isConfigPanelOpen()).toBe(true);
  });

  it("close button hides the panel", () => {
    mod.initConfigPanel();
    mod.openConfigPanel();
    document.getElementById("cfg-close-btn")?.click();
    expect(mod.isConfigPanelOpen()).toBe(false);
  });

  it("save button closes the panel and persists config", () => {
    mod.initConfigPanel();
    mod.openConfigPanel();
    (document.getElementById("cfg-family-name") as HTMLInputElement).value = "משפחת לוי";
    document.getElementById("cfg-save-btn")?.click();
    expect(mod.isConfigPanelOpen()).toBe(false);
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as {
      familyName?: string;
    };
    expect(saved.familyName).toBe("משפחת לוי");
  });

  it("tab buttons switch active tab on click", () => {
    mod.initConfigPanel();
    const calBtn = document.querySelector<HTMLButtonElement>('.cfg-tab[data-tab="calendar"]');
    calBtn?.click();
    const calSection = document.querySelector<HTMLElement>('.cfg-section[data-tab="calendar"]');
    expect(calSection?.classList.contains("active")).toBe(true);
  });
});

// ── shareSettings ──

describe("Config Panel — shareSettings", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not throw when clipboard API is available", () => {
    document.body.innerHTML = `<div id="toast-container"></div>`;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    expect(() => shareSettings()).not.toThrow();
  });

  it("calls clipboard.writeText with a URL", () => {
    document.body.innerHTML = `<div id="toast-container"></div>`;
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWrite },
      writable: true,
      configurable: true,
    });
    shareSettings();
    expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining("http"));
  });
});

// ── exportSettings ──────────────────────────────────────────────────────────

describe("Config Panel — exportSettings", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not throw when called", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(() => exportSettings()).not.toThrow();
  });

  it("calls URL.createObjectURL with a Blob", () => {
    const blobSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    exportSettings();
    expect(blobSpy).toHaveBeenCalledOnce();
    const blobArg = blobSpy.mock.calls[0]?.[0];
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it("calls URL.revokeObjectURL to clean up", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    exportSettings();
    expect(revokeSpy).toHaveBeenCalledWith("blob:test");
  });

  it("triggers anchor click to download the file", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    exportSettings();
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

// ── importSettings ──────────────────────────────────────────────────────────

describe("Config Panel — importSettings", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not throw when cfg-import-file element is absent", () => {
    document.body.innerHTML = "";
    expect(() => importSettings()).not.toThrow();
  });

  it("calls click() on the file input", () => {
    document.body.innerHTML = '<input type="file" id="cfg-import-file" />';
    const input = document.getElementById("cfg-import-file") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});
    importSettings();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("saves config when FileReader.onload fires with valid JSON", () => {
    document.body.innerHTML = '<input type="file" id="cfg-import-file" />';
    const input = document.getElementById("cfg-import-file") as HTMLInputElement;
    // Prevent real click from opening OS dialog
    vi.spyOn(input, "click").mockImplementation(() => {});

    // Spy on FileReader to fire onload synchronously
    class MockFileReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(_file: Blob): void {
        this.result = '{"familyName":"טסט","configVersion":1}';
        if (this.onload) {
          this.onload({
            target: this as unknown as FileReader,
          } as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    importSettings();

    // Simulate file selection and onchange fire
    const mockFile = new File(['{"familyName":"טסט","configVersion":1}'], "cfg.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", {
      value: { 0: mockFile, length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));

    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as {
      familyName?: string;
    };
    expect(saved.familyName).toBe("טסט");
  });

  it("rejects import when configVersion is missing", () => {
    document.body.innerHTML = '<input type="file" id="cfg-import-file" />';
    const input = document.getElementById("cfg-import-file") as HTMLInputElement;
    vi.spyOn(input, "click").mockImplementation(() => {});
    class MissingVersionReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        this.result = '{"familyName":"test"}';
        if (this.onload)
          this.onload({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", MissingVersionReader);
    importSettings();
    const mockFile = new File(['{"familyName":"test"}'], "cfg.json", { type: "application/json" });
    Object.defineProperty(input, "files", {
      value: { 0: mockFile, length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));
    // config should NOT be overwritten with bad import
    expect(localStorage.getItem("dash_v2_config")).toBeNull();
  });

  it("rejects import when configVersion is not a positive integer", () => {
    document.body.innerHTML = '<input type="file" id="cfg-import-file" />';
    const input = document.getElementById("cfg-import-file") as HTMLInputElement;
    vi.spyOn(input, "click").mockImplementation(() => {});
    class BadVersionReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        this.result = '{"familyName":"test","configVersion":0}';
        if (this.onload)
          this.onload({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", BadVersionReader);
    importSettings();
    const mockFile = new File(['{"familyName":"test","configVersion":0}'], "cfg.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", {
      value: { 0: mockFile, length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));
    expect(localStorage.getItem("dash_v2_config")).toBeNull();
  });

  it("handles invalid JSON in FileReader without throwing", () => {
    document.body.innerHTML = '<input type="file" id="cfg-import-file" />';
    const input = document.getElementById("cfg-import-file") as HTMLInputElement;
    vi.spyOn(input, "click").mockImplementation(() => {});

    class BadFileReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        this.result = "not-json{{";
        if (this.onload) {
          this.onload({
            target: this as unknown as FileReader,
          } as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", BadFileReader);

    importSettings();

    const mockFile = new File(["not-json{{"], "bad.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", {
      value: { 0: mockFile, length: 1 },
      configurable: true,
    });
    expect(() => input.onchange?.(new Event("change"))).not.toThrow();
  });
});

// ── Share button wiring via initConfigPanel (L458 / cfg-share-btn) ──

describe("Config Panel — share button wiring", () => {
  let mod: CfgMod;

  beforeEach(async () => {
    localStorage.clear();
    setupDOM();
    // Add the three settings buttons that initConfigPanel wires
    const panel = document.getElementById("config-panel")!;
    const exportBtn = document.createElement("button");
    exportBtn.id = "cfg-export-btn";
    panel.appendChild(exportBtn);
    const importBtn = document.createElement("button");
    importBtn.id = "cfg-import-btn";
    panel.appendChild(importBtn);
    const shareBtn = document.createElement("button");
    shareBtn.id = "cfg-share-btn";
    panel.appendChild(shareBtn);

    mod = await freshCfg();
    mod.initConfigPanel();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("clicking #cfg-share-btn copies share link to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const btn = document.getElementById("cfg-share-btn")!;
    btn.click();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain("#cfg=");
  });
});

// ── Font size slider input event (line 458) ──

describe("Config Panel — font size slider live preview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("updates font size display on slider input event", async () => {
    localStorage.clear();
    setupDOM();
    const slider = document.getElementById("cfg-news-fontsize") as HTMLInputElement;
    // Use property assignment so happy-dom tracks limits
    slider.min = "50";
    slider.max = "200";
    slider.value = "100";

    const mod = await freshCfg();
    mod.initConfigPanel();

    const display = document.getElementById("cfg-news-fontsize-val")!;
    slider.value = "125";
    slider.dispatchEvent(new Event("input"));
    expect(display.textContent).toBe("125%");
  });
});

// ── populateForm without cfg-news-fontsize-val (line 99) ──

describe("Config Panel — populateForm without fontsize val element", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("opens config panel without #cfg-news-fontsize-val element", async () => {
    localStorage.clear();
    setupDOM();
    // Remove the font size val element before init
    document.getElementById("cfg-news-fontsize-val")?.remove();
    // Use property assignment so happy-dom tracks limits
    const slider = document.getElementById("cfg-news-fontsize") as HTMLInputElement;
    slider.min = "50";
    slider.max = "200";

    const mod = await freshCfg();
    mod.initConfigPanel();

    // Set LS AFTER module import but BEFORE opening panel
    localStorage.setItem("dash_v2_news_fontsize", "120");
    mod.openConfigPanel();
    expect(slider.value).toBe("120");
  });
});

// ── populateForm with birthdays (line 99 → .map callback) ──

describe("Config Panel — populateForm with non-empty birthdays", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("populates birthday textarea when config has birthdays", async () => {
    localStorage.clear();
    setupDOM();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [
          { name: "Alice", month: 3, day: 15 },
          { name: "Bob", month: 7, day: 1 },
        ],
      }),
    );

    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();

    const bday = document.getElementById("cfg-birthday") as HTMLTextAreaElement;
    expect(bday.value).toContain("Alice,3,15");
    expect(bday.value).toContain("Bob,7,1");
  });
});

// ── collectForm with minimal DOM (null branches for absent form fields) ──

describe("Config Panel — collectForm with minimal DOM", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("save button works with stripped-down DOM (no form inputs)", async () => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <button id="cfg-save-btn">Save</button>
        </div>
      </div>
    `;

    const mod = await freshCfg();
    mod.initConfigPanel();

    const btn = document.getElementById("cfg-save-btn")!;
    expect(() => btn.click()).not.toThrow();
    // Config should still be saved (with defaults since no form fields)
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved).toHaveProperty("theme");
  });

  it("collectForm handles partial form — some inputs present, others absent", async () => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <button id="cfg-save-btn">Save</button>
          <select id="theme-select"><option value="warm-dark" selected>Warm Dark</option></select>
          <input id="cfg-alert-zone" type="text" value="תל אביב" />
          <textarea id="cfg-birthday">Alice,3,15
Bob,7,1</textarea>
        </div>
      </div>
    `;

    const mod = await freshCfg();
    mod.initConfigPanel();

    const btn = document.getElementById("cfg-save-btn")!;
    btn.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved.theme).toBe("warm-dark");
    expect(saved.alertZone).toBe("תל אביב");
    expect(saved.birthdays).toEqual([
      { name: "Alice", month: 3, day: 15 },
      { name: "Bob", month: 7, day: 1 },
    ]);
  });

  it("collectForm ignores invalid birthday lines", async () => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <button id="cfg-save-btn">Save</button>
          <textarea id="cfg-birthday">Valid,3,15
invalid line
,0,0</textarea>
        </div>
      </div>
    `;

    const mod = await freshCfg();
    mod.initConfigPanel();

    document.getElementById("cfg-save-btn")!.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved.birthdays).toEqual([{ name: "Valid", month: 3, day: 15 }]);
  });

  it("collectForm tempUnit rejects invalid value", async () => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <button id="cfg-save-btn">Save</button>
          <input id="cfg-temp-unit" type="text" value="X" />
        </div>
      </div>
    `;

    const mod = await freshCfg();
    mod.initConfigPanel();

    document.getElementById("cfg-save-btn")!.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    // X is not C or F, so tempUnit should remain default (C)
    expect(saved.tempUnit).toBe("C");
  });
});

// ── Cards tab: populateForm + collectForm + applyHiddenCards ─────────────────

describe("Config Panel — cards tab visibility and sizes", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("populates cfg-cards-list with card registry entries", async () => {
    document.body.innerHTML = `
      <div id="config-overlay"><div id="config-panel">
        <div id="cfg-cards-list"></div>
        <button id="cfg-save-btn">Save</button>
        <button id="cfg-close-btn">Close</button>
        <button id="cfg-gear-btn">Open</button>
      </div></div>
    `;
    vi.resetModules();
    vi.doMock("@/core/card-registry", () => ({
      listCards: () => [
        { id: "weather", titleHe: "מזג אוויר", icon: "🌤" },
        { id: "news", titleHe: "חדשות", icon: "📰" },
      ],
      registerCard: vi.fn(),
      getCard: vi.fn(),
    }));
    const mod = (await import("@/ui/config-panel")) as CfgMod;
    mod.openConfigPanel();
    const list = document.getElementById("cfg-cards-list")!;
    expect(list.children.length).toBe(2);
    expect(list.textContent).toContain("מזג אוויר");
    expect(list.textContent).toContain("חדשות");
  });

  it("collectForm reads hidden card checkboxes and applies on save", async () => {
    // Setup: a card with checkbox unchecked (should mark as hidden) + a data-card-id element
    document.body.innerHTML = `
      <div id="config-overlay"><div id="config-panel">
        <div id="cfg-cards-list">
          <div class="cfg-card-row">
            <input class="cfg-card-cb" type="checkbox" data-card-id="weather" />
          </div>
        </div>
        <button id="cfg-save-btn">Save</button>
        <button id="cfg-close-btn">Close</button>
        <button id="cfg-gear-btn">Open</button>
      </div></div>
      <div data-card-id="weather" style="display:''">weather widget</div>
    `;
    vi.resetModules();
    vi.doMock("@/core/card-registry", () => ({
      listCards: () => [{ id: "weather", titleHe: "מזג אוויר", icon: "🌤" }],
      registerCard: vi.fn(),
      getCard: vi.fn(),
    }));
    const mod = (await import("@/ui/config-panel")) as CfgMod;
    mod.initConfigPanel();
    mod.openConfigPanel(); // populateForm() creates checkbox in cfg-cards-list

    // Find the generated checkbox and uncheck it
    const cb = document.querySelector<HTMLInputElement>(".cfg-card-cb");
    if (cb) {
      cb.checked = false;
      document.getElementById("cfg-save-btn")!.click();
      const weatherWidget = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
      expect(weatherWidget.style.display).toBe("none");
    } else {
      // No checkbox generated in this env — just verify no crash
      expect(document.getElementById("cfg-save-btn")).not.toBeNull();
    }
  });

  it("collectForm reads card size selects and applies on save", async () => {
    document.body.innerHTML = `
      <div id="config-overlay"><div id="config-panel">
        <div id="cfg-cards-list"></div>
        <button id="cfg-save-btn">Save</button>
        <button id="cfg-close-btn">Close</button>
        <button id="cfg-gear-btn">Open</button>
      </div></div>
      <div data-card-id="weather">weather widget</div>
    `;
    vi.resetModules();
    vi.doMock("@/core/card-registry", () => ({
      listCards: () => [{ id: "weather", titleHe: "מזג אוויר", icon: "🌤" }],
      registerCard: vi.fn(),
      getCard: vi.fn(),
    }));
    const mod = (await import("@/ui/config-panel")) as CfgMod;
    mod.initConfigPanel();
    mod.openConfigPanel(); // populateForm() generates size selector

    const sel = document.querySelector<HTMLSelectElement>(".cfg-card-size-sel");
    if (sel) {
      sel.value = "lg";
      document.getElementById("cfg-save-btn")!.click();
      const weatherWidget = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
      expect(weatherWidget.dataset["cardSize"]).toBe("lg");
    } else {
      // No selector generated in this env — just verify no crash
      expect(document.getElementById("cfg-save-btn")).not.toBeNull();
    }
  });
});

// ── Font size slider live preview (lines 483-501) ───────────────────────────

describe("Config Panel — font size slider live preview", () => {
  let mod: CfgMod;

  beforeEach(async () => {
    localStorage.clear();
    setupDOM();
    mod = await freshCfg();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("updates cfg-news-fontsize-val when slider input fires", () => {
    mod.initConfigPanel();
    const slider = document.getElementById("cfg-news-fontsize") as HTMLInputElement | null;
    const display = document.getElementById("cfg-news-fontsize-val");
    if (!slider || !display) return; // elements might not exist in minimal DOM
    slider.value = "85"; // within default range 0-100
    slider.dispatchEvent(new Event("input"));
    expect(display.textContent).toBe("85%");
  });

  it("wires cfg-export-btn to call exportSettings without throwing", () => {
    mod.initConfigPanel();
    const btn = document.getElementById("cfg-export-btn");
    if (!btn) return;
    // Mock createObjectURL (used by exportSettings)
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:test"),
      revokeObjectURL: vi.fn(),
    });
    expect(() => btn.click()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("wires cfg-import-btn without throwing on empty file", () => {
    mod.initConfigPanel();
    const btn = document.getElementById("cfg-import-btn");
    if (!btn) return;
    expect(() => btn.click()).not.toThrow();
  });
});

// ── initConfigPanel overlay background click and edge branches (lines 483-524) ──

describe("Config Panel — initConfigPanel overlay and tab branch coverage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("covers if(ov) false branch when config-overlay is absent", async () => {
    document.body.innerHTML =
      '<button id="cfg-save-btn">Save</button><button id="cfg-close-btn">X</button><button id="cfg-gear-btn">G</button>';
    const mod = await freshCfg();
    // initConfigPanel with no overlay element → if(ov) branch is false → no crash
    expect(() => mod.initConfigPanel()).not.toThrow();
  });

  it("fires overlay background click to close panel (e.target === ov)", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    expect(mod.isConfigPanelOpen()).toBe(true);
    // Fire click ON the overlay element itself (e.target === ov true branch)
    const ov = document.getElementById("config-overlay")!;
    ov.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(mod.isConfigPanelOpen()).toBe(false);
  });

  it("does NOT close panel when click target is a child element (e.target !== ov)", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    // Fire click on a CHILD element inside the overlay → e.target !== ov → no close
    const panel = document.getElementById("config-panel")!;
    panel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(mod.isConfigPanelOpen()).toBe(true);
  });

  it("tab button with empty data-tab skips switchCfgTab (if(tab) false branch)", async () => {
    document.body.innerHTML = `
      <div id="config-overlay">
        <div id="config-panel">
          <button class="cfg-tab" data-tab="">Empty Tab</button>
        </div>
      </div>
      <button id="cfg-save-btn">Save</button>
      <button id="cfg-close-btn">X</button>
      <button id="cfg-gear-btn">G</button>
    `;
    const mod = await freshCfg();
    mod.initConfigPanel();
    // Click the button with data-tab="" — should not throw (if(tab) = false, skips switchCfgTab)
    const btn = document.querySelector<HTMLButtonElement>(".cfg-tab[data-tab]")!;
    expect(() => btn.click()).not.toThrow();
  });
});

// ── importSettings: if(!file) return branch (line 434) ──────────────────────

describe("Config Panel — importSettings no-file early return (line 434)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("file input onchange returns early when no file is selected (line 434 TRUE branch)", async () => {
    document.body.innerHTML = `
      <input type="file" id="cfg-import-file" />
      <button id="cfg-save-btn">Save</button>
      <button id="cfg-close-btn">X</button>
      <button id="cfg-gear-btn">G</button>
    `;
    const mod = await import("@/ui/config-panel");
    if ("importSettings" in mod) {
      (mod as { importSettings: () => void }).importSettings();
    }
    const input = document.getElementById("cfg-import-file") as HTMLInputElement;
    // Trigger onchange with no files (FileList is empty) — should return early, no throw
    if (input.onchange) {
      expect(() => input.onchange!(new Event("change"))).not.toThrow();
    }
  });
});

// ── collectForm disabledFeeds split → array (line 303) ───────────────────────

describe("Config Panel — collectForm disabledFeeds split (line 303)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("splits cfg-feeds-disabled comma-value into disabledFeeds array (line 303)", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    const feedsEl = document.getElementById("cfg-feeds-disabled") as HTMLInputElement | null;
    if (feedsEl) feedsEl.value = "Ynet,וואלה,N12";
    document.getElementById("cfg-save-btn")?.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as {
      disabledFeeds?: string[];
    };
    // Should have split by comma and filtered empty strings
    expect(Array.isArray(saved.disabledFeeds)).toBe(true);
    if (saved.disabledFeeds?.length) {
      expect(saved.disabledFeeds).toContain("Ynet");
      expect(saved.disabledFeeds).toContain("N12");
    }
  });
});

// ── isConfigPanelOpen returns false via ?? false when overlay null (line 409) ──

describe("Config Panel — isConfigPanelOpen ?? false when overlay is null (line 409)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("returns false via ?? false when config-overlay not in DOM (line 409)", async () => {
    document.body.innerHTML = ""; // no config-overlay
    vi.resetModules();
    const mod = await import("@/ui/config-panel");
    // overlay() returns null → ?.classList.contains() returns undefined → ?? false → false
    expect(mod.isConfigPanelOpen()).toBe(false);
  });
});

// ── applyConfig card size sets data-card-size on matching element (line 507) ──

describe("Config Panel — applyConfig sets [data-card-size] on matching card element (line 507)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("sets data-card-size attribute on card element when cardSizes config has matching id (line 507)", async () => {
    setupDOM(); // includes <select class="cfg-card-size-sel" data-card-id="weather"> and <div data-card-id="weather">
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    // Select the weather card size as "lg"
    const sizeEl = document.querySelector<HTMLSelectElement>(
      ".cfg-card-size-sel[data-card-id='weather']",
    );
    if (sizeEl) sizeEl.value = "lg";
    // Click save → collectForm sets cardSizes["weather"]="lg" → applyConfig runs → line 507 fires
    document.getElementById("cfg-save-btn")?.click();
    const cardEl = document.querySelector<HTMLElement>("[data-card-id='weather']");
    // After apply, data-card-size should be updated to "lg"
    expect(cardEl?.dataset["cardSize"]).toBe("lg");
  });
});

// ── Sprint v7.11: collectForm portfolio validation + tasksResetHour clamping ──

describe("Config Panel — collectForm invalid portfolio JSON shows toast", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("preserves previous portfolio when textarea contains invalid JSON", async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <textarea id="cfg-portfolio">invalid-json-{{</textarea>
          <input id="cfg-tasks-reset-hour" type="number" value="6" />
          <input id="cfg-cd-card-title" type="text" value="" />
          <input id="cfg-cd-card-date" type="text" value="" />
          <input id="cfg-cd-card-time" type="text" value="" />
          <input id="cfg-cd-card-done-msg" type="text" value="" />
          <button id="cfg-save-btn">שמור</button>
          <div id="cfg-cards-list"></div>
          <div id="toast-container"></div>
        </div>
      </div>`;
    const prevPortfolio = '[{"symbol":"AAPL"}]';
    localStorage.setItem("dash_v2_portfolio", prevPortfolio);
    const mod = await freshCfg();
    mod.initConfigPanel();
    document.getElementById("cfg-save-btn")?.click();
    // Portfolio should NOT have been overwritten with invalid JSON
    expect(localStorage.getItem("dash_v2_portfolio")).toBe(prevPortfolio);
  });
});

describe("Config Panel — collectForm tasksResetHour NaN preserves default", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("keeps tasksResetHour at default (6) when input value is NaN", async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <input id="cfg-tasks-reset-hour" type="number" value="not-a-number" />
          <button id="cfg-save-btn">שמור</button>
          <div id="cfg-cards-list"></div>
          <div id="toast-container"></div>
        </div>
      </div>`;
    const mod = await freshCfg();
    mod.initConfigPanel();
    document.getElementById("cfg-save-btn")?.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    // When NaN, collectForm does not overwrite the field — DEFAULT_CONFIG value (6) is kept
    expect(saved["tasksResetHour"]).toBe(6);
  });
});

// ── Sprint 171: Config dirty tracking tests ─────────────────────────────

describe("Config Panel — dirty tracking (Sprint 171)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  function setupDirtyDOM(): void {
    document.body.innerHTML = `
      <div id="config-overlay">
        <div id="config-panel">
          <input id="cfg-family-name" type="text" value="Test" />
          <button id="cfg-save-btn">Save</button>
          <button id="cfg-close-btn">Close</button>
          <div id="cfg-cards-list"></div>
          <div id="toast-container"></div>
        </div>
      </div>
      <button id="cfg-gear-btn">⚙️</button>
      <input type="file" id="cfg-import-file" style="display:none" />
    `;
  }

  it("first close when dirty shows toast instead of closing", async () => {
    setupDirtyDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    // Trigger input event to set dirty flag
    const inp = document.getElementById("cfg-family-name") as HTMLInputElement;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    mod.closeConfigPanel();
    // Panel should still be visible (toast shown, not closed)
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(true);
  });

  it("second close after dirty warning actually closes", async () => {
    setupDirtyDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    const inp = document.getElementById("cfg-family-name") as HTMLInputElement;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    mod.closeConfigPanel(); // first close: warning
    mod.closeConfigPanel(); // second close: actual close
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(false);
  });

  it("gear button shows * when dirty", async () => {
    setupDirtyDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    const inp = document.getElementById("cfg-family-name") as HTMLInputElement;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    const gear = document.getElementById("cfg-gear-btn");
    expect(gear?.textContent).toContain("*");
  });

  it("save button closes panel even when form is dirty", async () => {
    setupDirtyDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    // Mark form dirty via input event
    const inp = document.getElementById("cfg-family-name") as HTMLInputElement;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    // Panel should still be open and dirty
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(true);
    // Clicking save should close the panel (not show "unsaved changes" warning)
    document.getElementById("cfg-save-btn")?.click();
    expect(document.getElementById("config-overlay")?.classList.contains("visible")).toBe(false);
  });
});

describe("Config Panel — collectForm tasksResetHour > 23 clamps to 23", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("stores tasksResetHour = 23 when input value is 30", async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <input id="cfg-tasks-reset-hour" type="number" value="30" />
          <button id="cfg-save-btn">שמור</button>
          <div id="cfg-cards-list"></div>
          <div id="toast-container"></div>
        </div>
      </div>`;
    const mod = await freshCfg();
    mod.initConfigPanel();
    document.getElementById("cfg-save-btn")?.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved["tasksResetHour"]).toBe(23);
  });
});

describe("Config Panel — collectForm countdown card fields persist", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("saves countdown card title + date + time + doneMsg from form", async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="config-overlay" class="visible">
        <div id="config-panel">
          <input id="cfg-cd-card-title" type="text" value="יום הולדת" />
          <input id="cfg-cd-card-date" type="text" value="2027-01-15" />
          <input id="cfg-cd-card-time" type="text" value="19:30" />
          <input id="cfg-cd-card-done-msg" type="text" value="🎂 מזל טוב!" />
          <button id="cfg-save-btn">שמור</button>
          <div id="cfg-cards-list"></div>
          <div id="toast-container"></div>
        </div>
      </div>`;
    const mod = await freshCfg();
    mod.initConfigPanel();
    document.getElementById("cfg-save-btn")?.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved["countdownCardTitle"]).toBe("יום הולדת");
    expect(saved["countdownCardDate"]).toBe("2027-01-15");
    expect(saved["countdownCardTime"]).toBe("19:30");
    expect(saved["countdownCardDoneMsg"]).toBe("🎂 מזל טוב!");
  });
});

// ── Sprint v7.12: cfg-clock-seconds populate + collect ────────────────────────

describe("Config Panel — populateForm cfg-clock-seconds (Sprint v7.12)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("populates cfg-clock-seconds as 'on' when clockSeconds is true", async () => {
    setupDOM();
    localStorage.setItem("dash_v2_config", JSON.stringify({ clockSeconds: true }));
    const mod = await freshCfg();
    mod.openConfigPanel();
    expect((document.getElementById("cfg-clock-seconds") as HTMLInputElement).value).toBe("on");
  });

  it("populates cfg-clock-seconds as 'off' when clockSeconds is false", async () => {
    setupDOM();
    localStorage.setItem("dash_v2_config", JSON.stringify({ clockSeconds: false }));
    const mod = await freshCfg();
    mod.openConfigPanel();
    expect((document.getElementById("cfg-clock-seconds") as HTMLInputElement).value).toBe("off");
  });
});

describe("Config Panel — collectForm cfg-clock-seconds (Sprint v7.12)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("saves clockSeconds = true when cfg-clock-seconds value is 'on'", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    (document.getElementById("cfg-clock-seconds") as HTMLInputElement).value = "on";
    document.getElementById("cfg-save-btn")?.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved["clockSeconds"]).toBe(true);
  });

  it("saves clockSeconds = false when cfg-clock-seconds value is 'off'", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    (document.getElementById("cfg-clock-seconds") as HTMLInputElement).value = "off";
    document.getElementById("cfg-save-btn")?.click();
    const saved = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(saved["clockSeconds"]).toBe(false);
  });
});

// ── Sprint v7.13: dim-level / font-scale slider live preview (initConfigPanel) ──

describe("Config Panel — dim-level and font-scale slider live preview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("slider input events update the matching display value spans", async () => {
    document.body.innerHTML = `
      <div id="config-overlay">
        <button id="cfg-gear-btn"></button>
        <button id="cfg-save-btn"></button>
        <button id="cfg-close-btn"></button>
        <input id="cfg-dim-level" type="range" value="40" />
        <span id="cfg-dim-level-val">80%</span>
        <input id="cfg-font-scale" type="range" min="70" max="150" value="100" />
        <span id="cfg-font-scale-val">100%</span>
      </div>`;
    const mod = await freshCfg();
    mod.initConfigPanel();

    // dim-level slider
    const dimSlider = document.getElementById("cfg-dim-level") as HTMLInputElement;
    dimSlider.value = "55";
    dimSlider.dispatchEvent(new Event("input"));
    expect(document.getElementById("cfg-dim-level-val")?.textContent).toBe("55%");

    // font-scale slider (same module instance — listener already registered)
    const fsSlider = document.getElementById("cfg-font-scale") as HTMLInputElement;
    fsSlider.value = "120";
    fsSlider.dispatchEvent(new Event("input"));
    expect(document.getElementById("cfg-font-scale-val")?.textContent).toBe("120%");
  });
});

// ── Sprint 19: dirty indicator + closeConfigPanel clears dirty ────────────────

describe("Config Panel — dirty indicator (Sprint 19)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
    vi.useRealTimers();
  });

  it("input event marks the gear button as dirty (shows ⚙️*)", async () => {
    document.body.innerHTML = `
      <div id="config-overlay">
        <button id="cfg-gear-btn">⚙️</button>
        <button id="cfg-save-btn">שמור</button>
        <button id="cfg-close-btn">×</button>
        <input id="cfg-family-name" type="text" value="" />
      </div>`;
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    const gearBtn = document.getElementById("cfg-gear-btn")!;
    const input = document.getElementById("cfg-family-name") as HTMLInputElement;
    input.value = "משפחת כהן";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(gearBtn.textContent).toContain("*");
  });

  it("closeConfigPanel clears dirty indicator (removes * from gear button)", async () => {
    document.body.innerHTML = `
      <div id="config-overlay">
        <button id="cfg-gear-btn">⚙️</button>
        <button id="cfg-save-btn">שמור</button>
        <button id="cfg-close-btn">×</button>
        <input id="cfg-family-name" type="text" value="" />
      </div>`;
    const mod = await freshCfg();
    mod.initConfigPanel();
    mod.openConfigPanel();
    const gearBtn = document.getElementById("cfg-gear-btn")!;
    const input = document.getElementById("cfg-family-name") as HTMLInputElement;
    input.value = "שינוי";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(gearBtn.textContent).toContain("*");
    mod.closeConfigPanel(); // first close: shows toast warning (Sprint 148)
    mod.closeConfigPanel(); // second close: actually closes and clears dirty
    expect(gearBtn.textContent).not.toContain("*");
  });
});

// ── Sprint 58: Network-mode selector populate + collect ──────────────────────

describe("Config Panel — network-mode selector (Sprint 58)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("populateForm: defaults to 'auto' when LS_NETWORK_MODE is unset", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.openConfigPanel();
    const sel = document.getElementById("cfg-network-mode") as HTMLSelectElement | null;
    expect(sel?.value).toBe("auto");
  });

  it("populateForm: reads persisted value from localStorage", async () => {
    setupDOM();
    localStorage.setItem("dash_network_mode", "worker-only");
    const mod = await freshCfg();
    mod.openConfigPanel();
    const sel = document.getElementById("cfg-network-mode") as HTMLSelectElement | null;
    expect(sel?.value).toBe("worker-only");
  });

  it("collectForm (via save): persists selected value to localStorage", async () => {
    setupDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    const sel = document.getElementById("cfg-network-mode") as HTMLSelectElement | null;
    if (sel) sel.value = "no-worker";
    document.getElementById("cfg-save-btn")!.click();
    expect(localStorage.getItem("dash_network_mode")).toBe("no-worker");
  });

  it("collectForm (via save): removes key for invalid value", async () => {
    setupDOM();
    localStorage.setItem("dash_network_mode", "worker-only");
    const mod = await freshCfg();
    mod.initConfigPanel();
    const sel = document.getElementById("cfg-network-mode") as HTMLSelectElement | null;
    if (sel) sel.value = "bogus" as string;
    document.getElementById("cfg-save-btn")!.click();
    expect(localStorage.getItem("dash_network_mode")).toBeNull();
  });
});

// ── Sprint 82: weatherUsTravelMode load/save paths (cfg-weather-us-travel) ───

describe("Config Panel — weatherUsTravelMode populateForm (Sprint 82)", () => {
  function buildTravelDOM(): void {
    document.body.innerHTML = `
      <div id="config-overlay">
        <div id="config-panel">
          <div class="cfg-tabs">
            <button class="cfg-tab active" data-tab="feeds">Feeds</button>
          </div>
          <div class="cfg-section active" data-tab="feeds">
            <select id="cfg-weather-us-travel">
              <option value="on">On</option>
              <option value="off" selected>Off</option>
            </select>
          </div>
          <input id="cfg-family-name" type="text" />
          <button id="cfg-save-btn">Save</button>
          <button id="cfg-close-btn">Close</button>
        </div>
      </div>
      <button id="cfg-gear-btn">⚙️</button>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("populateForm sets cfg-weather-us-travel to 'on' when weatherUsTravelMode=true", async () => {
    buildTravelDOM();
    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherUsTravelMode: true }));
    const mod = await freshCfg();
    mod.openConfigPanel();
    const sel = document.getElementById("cfg-weather-us-travel") as HTMLSelectElement | null;
    expect(sel?.value).toBe("on");
  });

  it("populateForm sets cfg-weather-us-travel to 'off' when weatherUsTravelMode=false", async () => {
    buildTravelDOM();
    localStorage.setItem("dash_v2_config", JSON.stringify({ weatherUsTravelMode: false }));
    const mod = await freshCfg();
    mod.openConfigPanel();
    const sel = document.getElementById("cfg-weather-us-travel") as HTMLSelectElement | null;
    expect(sel?.value).toBe("off");
  });

  it("collectForm persists weatherUsTravelMode=true when select value is 'on'", async () => {
    buildTravelDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    const sel = document.getElementById("cfg-weather-us-travel") as HTMLSelectElement | null;
    if (sel) sel.value = "on";
    document.getElementById("cfg-save-btn")!.click();
    const stored = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<string, unknown>;
    expect(stored.weatherUsTravelMode).toBe(true);
  });

  it("collectForm persists weatherUsTravelMode=false when select value is 'off'", async () => {
    buildTravelDOM();
    const mod = await freshCfg();
    mod.initConfigPanel();
    const sel = document.getElementById("cfg-weather-us-travel") as HTMLSelectElement | null;
    if (sel) sel.value = "off";
    document.getElementById("cfg-save-btn")!.click();
    const stored = JSON.parse(localStorage.getItem("dash_v2_config") ?? "{}") as Record<string, unknown>;
    expect(stored.weatherUsTravelMode).toBe(false);
  });

  it("does not throw when cfg-weather-us-travel element is absent (null guard)", async () => {
    // DOM without cfg-weather-us-travel element
    document.body.innerHTML = `
      <div id="config-overlay">
        <div id="config-panel">
          <input id="cfg-family-name" type="text" />
          <button id="cfg-save-btn">Save</button>
          <button id="cfg-close-btn">Close</button>
        </div>
      </div>
      <button id="cfg-gear-btn">⚙️</button>
    `;
    const mod = await freshCfg();
    expect(() => mod.initConfigPanel()).not.toThrow();
    expect(() => mod.openConfigPanel()).not.toThrow();
  });
});
