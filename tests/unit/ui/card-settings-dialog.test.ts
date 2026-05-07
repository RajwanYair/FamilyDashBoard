/**
 * Tests for src/ui/card-settings-dialog.ts
 *
 * Covers: initCardSettingsButtons (adds gear button to cards with configSchema),
 *         openCardSettings (loads schema, renders dialog),
 *         save button (writes config, closes dialog),
 *         cancel button (closes dialog without saving).
 *
 * Module-level state (_dialog, _currentCardId) requires vi.resetModules()
 * between tests that create the dialog.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CardDefinition } from "@/types/card";

// ── Mock deps ───────────────────────────────────────────────────────────────

vi.mock("@/core/card-registry", () => ({
  loadCard: vi.fn(),
  getCard: vi.fn(),
}));

vi.mock("@/core/config", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

vi.mock("@/ui/config-auto-render", () => ({
  renderConfigFields: vi.fn(),
  readConfigValues: vi.fn(),
}));

vi.mock("@/ui/toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("@/core/i18n", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

// CSS import is handled automatically by Vitest (treated as empty module)

// ── Imports (after mocks are hoisted) ──────────────────────────────────────

import { loadCard, getCard } from "@/core/card-registry";
import { loadConfig, saveConfig } from "@/core/config";
import { renderConfigFields, readConfigValues } from "@/ui/config-auto-render";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Shim HTMLDialogElement.showModal/close for happy-dom. */
function shimDialog(dlg: HTMLDialogElement): void {
  if (typeof dlg.showModal !== "function") {
    (dlg as HTMLDialogElement & { showModal: () => void }).showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (typeof dlg.close !== "function") {
    (dlg as HTMLDialogElement & { close: () => void }).close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}

/** Override createElement for <dialog> to shim methods. */
function setupDialogShim(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      const el = origCreate(tag, options);
      if (tag === "dialog") shimDialog(el as HTMLDialogElement);
      return el;
    },
  );
}

/** Make a minimal card DOM element with a .card__header. */
function makeCardEl(id: string): HTMLElement {
  const section = document.createElement("section");
  section.dataset["cardId"] = id;
  const header = document.createElement("header");
  header.className = "card__header";
  section.appendChild(header);
  document.body.appendChild(section);
  return section;
}

/** Minimal DashboardConfig stub. */
function fakeCfg(): Record<string, unknown> {
  return { cards: {} };
}

/** Minimal CardDefinition with a configSchema. */
function makeCardDef(id: string, hasSchema = true): CardDefinition {
  return {
    id,
    icon: "🧪",
    titleHe: id,
    titleEn: id,
    defaultSlot: { col: 0, order: 0, flexGrow: 20, hidden: false },
    defaultSize: "md",
    render: () => document.createElement("section"),
    init: vi.fn(),
    configSchema: hasSchema
      ? [
          {
            key: `${id}Setting`,
            labelHe: "הגדרה",
            labelEn: "Setting",
            type: "boolean" as const,
            defaultValue: true,
          },
        ]
      : undefined,
  };
}

// ── initCardSettingsButtons ──────────────────────────────────────────────────

describe("Card Settings Dialog — initCardSettingsButtons", () => {
  beforeEach(() => {
    vi.resetModules();
    setupDialogShim();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("adds a gear button to cards with configSchema", async () => {
    const cardEl = makeCardEl("weather");
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("weather", true));
    vi.mocked(getCard).mockReturnValue({
      id: "weather",
      icon: "🌤",
      titleHe: "מזג אוויר",
      titleEn: "Weather",
      load: vi.fn(),
    });

    const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
    await initCardSettingsButtons();

    const header = cardEl.querySelector(".card__header");
    expect(header?.querySelector(".card__settings-btn")).not.toBeNull();
  });

  it("does NOT add a gear button to cards without configSchema", async () => {
    const cardEl = makeCardEl("no-schema-card");
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("no-schema-card", false));

    const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
    await initCardSettingsButtons();

    const header = cardEl.querySelector(".card__header");
    expect(header?.querySelector(".card__settings-btn")).toBeNull();
  });

  it("is idempotent — does not add duplicate buttons", async () => {
    makeCardEl("stocks");
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("stocks", true));
    vi.mocked(getCard).mockReturnValue({
      id: "stocks",
      icon: "📈",
      titleHe: "מניות",
      titleEn: "Stocks",
      load: vi.fn(),
    });

    const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
    await initCardSettingsButtons();
    await initCardSettingsButtons(); // second call

    const header = document.querySelector("[data-card-id='stocks'] .card__header");
    expect(header?.querySelectorAll(".card__settings-btn").length).toBe(1);
  });

  it("skips cards that fail to load", async () => {
    makeCardEl("broken-card");
    vi.mocked(loadCard).mockRejectedValue(new Error("load failed"));

    const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
    await expect(initCardSettingsButtons()).resolves.toBeUndefined();
  });

  it("skips card elements without a header", async () => {
    const section = document.createElement("section");
    section.dataset["cardId"] = "headerless";
    document.body.appendChild(section);
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("headerless", true));

    const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
    await expect(initCardSettingsButtons()).resolves.toBeUndefined();
  });
});

// ── openCardSettings ─────────────────────────────────────────────────────────

describe("Card Settings Dialog — openCardSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupDialogShim();
    vi.mocked(loadConfig).mockReturnValue(fakeCfg() as ReturnType<typeof loadConfig>);
    vi.mocked(renderConfigFields).mockImplementation(() => {});
    vi.mocked(readConfigValues).mockReturnValue({});
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("creates and appends a dialog to the body", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("weather", true));
    vi.mocked(getCard).mockReturnValue({
      id: "weather",
      icon: "🌤",
      titleHe: "מזג אוויר",
      titleEn: "Weather",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("weather");

    expect(document.getElementById("card-settings-dialog")).not.toBeNull();
  });

  it("opens the dialog (adds open attribute)", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("news", true));
    vi.mocked(getCard).mockReturnValue({
      id: "news",
      icon: "📰",
      titleHe: "חדשות",
      titleEn: "News",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("news");

    const dlg = document.getElementById("card-settings-dialog");
    expect(dlg?.hasAttribute("open")).toBe(true);
  });

  it("sets dialog title to card icon + titleHe", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("hebrew-cal", true));
    vi.mocked(getCard).mockReturnValue({
      id: "hebrew-cal",
      icon: "✡️",
      titleHe: "לוח עברי",
      titleEn: "Hebrew Calendar",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("hebrew-cal");

    const title = document.getElementById("csd-title");
    expect(title?.textContent).toContain("✡️");
    expect(title?.textContent).toContain("לוח עברי");
  });

  it("calls renderConfigFields with schema fields and current values", async () => {
    const def = makeCardDef("alerts", true);
    vi.mocked(loadCard).mockResolvedValue(def);
    vi.mocked(getCard).mockReturnValue({
      id: "alerts",
      icon: "🚨",
      titleHe: "התרעות",
      titleEn: "Alerts",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("alerts");

    expect(vi.mocked(renderConfigFields)).toHaveBeenCalledWith(
      def.configSchema,
      expect.any(Object),
      expect.any(HTMLElement),
    );
  });

  it("does nothing when card has no configSchema", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("motivation", false));

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("motivation");

    expect(document.getElementById("card-settings-dialog")).toBeNull();
  });

  it("does nothing when loadCard throws", async () => {
    vi.mocked(loadCard).mockRejectedValue(new Error("not found"));

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await expect(openCardSettings("bad-card")).resolves.toBeUndefined();
    expect(document.getElementById("card-settings-dialog")).toBeNull();
  });
});

// ── Save button ──────────────────────────────────────────────────────────────

describe("Card Settings Dialog — save button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupDialogShim();
    vi.mocked(loadConfig).mockReturnValue(fakeCfg() as ReturnType<typeof loadConfig>);
    vi.mocked(renderConfigFields).mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("calls saveConfig when save is clicked", async () => {
    const def = makeCardDef("stocks", true);
    vi.mocked(loadCard).mockResolvedValue(def);
    vi.mocked(getCard).mockReturnValue({
      id: "stocks",
      icon: "📈",
      titleHe: "מניות",
      titleEn: "Stocks",
      load: vi.fn(),
    });
    vi.mocked(readConfigValues).mockReturnValue({ stocksSetting: true });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("stocks");

    const saveBtn = document.querySelector<HTMLButtonElement>(".csd__save-btn");
    saveBtn?.click();

    expect(vi.mocked(saveConfig)).toHaveBeenCalled();
  });

  it("closes dialog after save", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("tasks", true));
    vi.mocked(getCard).mockReturnValue({
      id: "tasks",
      icon: "✅",
      titleHe: "משימות",
      titleEn: "Tasks",
      load: vi.fn(),
    });
    vi.mocked(readConfigValues).mockReturnValue({});

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("tasks");

    const dlg = document.getElementById("card-settings-dialog") as HTMLDialogElement;
    expect(dlg.hasAttribute("open")).toBe(true);

    document.querySelector<HTMLButtonElement>(".csd__save-btn")?.click();
    expect(dlg.hasAttribute("open")).toBe(false);
  });
});

// ── Cancel button ────────────────────────────────────────────────────────────

describe("Card Settings Dialog — cancel button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupDialogShim();
    vi.mocked(loadConfig).mockReturnValue(fakeCfg() as ReturnType<typeof loadConfig>);
    vi.mocked(renderConfigFields).mockImplementation(() => {});
    vi.mocked(readConfigValues).mockReturnValue({});
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("closes dialog without saving when cancel is clicked", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("calendar", true));
    vi.mocked(getCard).mockReturnValue({
      id: "calendar",
      icon: "📅",
      titleHe: "יומן",
      titleEn: "Calendar",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("calendar");

    const dlg = document.getElementById("card-settings-dialog") as HTMLDialogElement;
    expect(dlg.hasAttribute("open")).toBe(true);

    document.querySelector<HTMLButtonElement>(".csd__cancel-btn")?.click();
    expect(dlg.hasAttribute("open")).toBe(false);
    expect(vi.mocked(saveConfig)).not.toHaveBeenCalled();
  });

  it("close-× button closes dialog without saving", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("currency", true));
    vi.mocked(getCard).mockReturnValue({
      id: "currency",
      icon: "💱",
      titleHe: "מטבעות",
      titleEn: "Currency",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("currency");

    const dlg = document.getElementById("card-settings-dialog") as HTMLDialogElement;
    document.querySelector<HTMLButtonElement>(".csd__close-btn")?.click();
    expect(dlg.hasAttribute("open")).toBe(false);
    expect(vi.mocked(saveConfig)).not.toHaveBeenCalled();
  });
});

// ── missed branches ──────────────────────────────────────────────

describe("Card Settings Dialog — backdrop click closes dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupDialogShim();
    vi.mocked(loadConfig).mockReturnValue(fakeCfg() as ReturnType<typeof loadConfig>);
    vi.mocked(renderConfigFields).mockImplementation(() => {});
    vi.mocked(readConfigValues).mockReturnValue({});
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("clicking dialog backdrop (e.target === dlg) closes dialog", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("weather", true));
    vi.mocked(getCard).mockReturnValue({
      id: "weather",
      icon: "🌤",
      titleHe: "מזג אוויר",
      titleEn: "Weather",
      load: vi.fn(),
    });

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("weather");

    const dlg = document.getElementById("card-settings-dialog") as HTMLDialogElement;
    expect(dlg.hasAttribute("open")).toBe(true);

    // Simulate backdrop click — target must be the dialog itself
    dlg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // In happy-dom the event target will be the dialog → triggers dlg.close()
    expect(dlg.hasAttribute("open")).toBe(false);
  });
});

describe("Card Settings Dialog — openCardSettings icon fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupDialogShim();
    vi.mocked(loadConfig).mockReturnValue(fakeCfg() as ReturnType<typeof loadConfig>);
    vi.mocked(renderConfigFields).mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("uses ⚙ fallback when getCard returns undefined", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("news", true));
    vi.mocked(getCard).mockReturnValue(undefined);

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("news");

    const title = document.getElementById("csd-title");
    expect(title?.textContent).toContain("⚙");
  });

  it("uses cardId as title when getCard returns undefined", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("tasks", true));
    vi.mocked(getCard).mockReturnValue(undefined);

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("tasks");

    const title = document.getElementById("csd-title");
    expect(title?.textContent).toContain("tasks");
  });

  it("skips values with non-string/number/boolean types from flatCfg", async () => {
    vi.mocked(loadCard).mockResolvedValue(makeCardDef("stocks", true));
    vi.mocked(getCard).mockReturnValue({
      id: "stocks",
      icon: "📈",
      titleHe: "מניות",
      titleEn: "Stocks",
      load: vi.fn(),
    });
    // Put an object value in flatCfg under the schema key → should not be included
    vi.mocked(loadConfig).mockReturnValue({
      stocksSetting: { nested: true },
      cards: {},
    } as unknown as ReturnType<typeof loadConfig>);

    const { openCardSettings } = await import("@/ui/card-settings-dialog");
    await openCardSettings("stocks");

    // renderConfigFields should still be called, just with an empty values map
    expect(vi.mocked(renderConfigFields)).toHaveBeenCalledWith(
      expect.any(Array),
      {}, // empty because object value was skipped
      expect.any(HTMLElement),
    );
  });
});
