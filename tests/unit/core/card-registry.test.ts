/**
 * Tests for src/core/card-registry.ts
 *
 * Covers: registerCard, getCard, listCards, loadCard,
 * built-in registrations, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerCard, getCard, listCards, loadCard, createShell, mountRegisteredCards } from "@/core/card-registry";
import { isValidCardSize, assertCardSize } from "@/types/card";
import type { CardDefinition } from "@/types/card";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeEntry(id: string) {
  const def: CardDefinition = {
    id,
    icon: "🧪",
    titleHe: `${id} עברית`,
    titleEn: id,
    defaultSlot: { col: 0, order: 0, flexGrow: 20, hidden: false },
    defaultSize: "md",
    render: () => document.createElement("section"),
    init: vi.fn(),
  };

  return {
    id,
    icon: "🧪",
    titleHe: `${id} עברית`,
    titleEn: id,
    load: vi.fn().mockResolvedValue(def),
  };
}

// ── registerCard + getCard ────────────────────────────────────────────────

describe("Card Registry — registerCard / getCard", () => {
  it("registers and retrieves a card entry by id", () => {
    const entry = makeEntry("test-card-1");
    registerCard(entry);
    expect(getCard("test-card-1")).toBe(entry);
  });

  it("overwrites previous registration with same id", () => {
    const first = makeEntry("test-card-overwrite");
    const second = makeEntry("test-card-overwrite");
    registerCard(first);
    registerCard(second);
    expect(getCard("test-card-overwrite")).toBe(second);
  });

  it("returns undefined for unregistered id", () => {
    expect(getCard("does-not-exist-xyz")).toBeUndefined();
  });
});

// ── listCards ────────────────────────────────────────────────────────────

describe("Card Registry — listCards", () => {
  it("returns an array of all registered entries", () => {
    const list = listCards();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("includes built-in cards (news, weather, stocks)", () => {
    const ids = listCards().map((e) => e.id);
    expect(ids).toContain("news");
    expect(ids).toContain("weather");
    expect(ids).toContain("stocks");
  });

  it("includes new v7 cards (tasks, system-info)", () => {
    const ids = listCards().map((e) => e.id);
    expect(ids).toContain("tasks");
    expect(ids).toContain("system-info");
  });

  it("returns a sorted array (not the internal Map order)", () => {
    const list = listCards();
    const sorted = [...list].sort((a, b) => a.titleHe.localeCompare(b.titleHe, "he"));
    expect(list.map((e) => e.id)).toEqual(sorted.map((e) => e.id));
  });
});

// ── loadCard ────────────────────────────────────────────────────────────

describe("Card Registry — loadCard", () => {
  it("throws for unregistered card id", async () => {
    await expect(loadCard("ghost-card-xyz")).rejects.toThrow(
      'Card not registered: "ghost-card-xyz"',
    );
  });

  it("resolves for a registered card with a working loader", async () => {
    const entry = makeEntry("test-load-card");
    registerCard(entry);
    const def = await loadCard("test-load-card");
    expect(def.id).toBe("test-load-card");
    expect(entry.load).toHaveBeenCalledOnce();
  });
});

// ── Built-in entry shape ───────────────────────────────────────────────────

describe("Card Registry — built-in entry shapes", () => {
  it("every built-in entry has required fields", () => {
    const list = listCards();
    for (const entry of list) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.icon).toBe("string");
      expect(typeof entry.titleHe).toBe("string");
      expect(typeof entry.titleEn).toBe("string");
      expect(typeof entry.load).toBe("function");
    }
  });
});

// ── loadCard with built-in cards (covers load lambdas + legacyAdapter) ──────

// Cards that expose a custom-element tag (tagName + elementClass on def)
const ceCards = [
  ["tasks", "FDB-TASKS"],
  ["system-info", "FDB-SYSTEM-INFO"],
  ["news", "FDB-NEWS"],
  ["weather", "FDB-WEATHER"],
  ["stocks", "FDB-STOCKS"],
] as const;

// Cards that use legacyAdapter without render-tag assertions
const legacyOnlyCards = ["hebrew-cal", "calendar", "currency", "alerts", "motivation", "countdown", "video-news"] as const;

describe("Card Registry — loadCard (parameterized)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each([...ceCards.map(([id]) => id), ...legacyOnlyCards])(
    "loads %s CardDefinition via dynamic import",
    async (cardId) => {
      const def = await loadCard(cardId);
      expect(def.id).toBe(cardId);
      expect(typeof def.init).toBe("function");
      expect(typeof def.render).toBe("function");
    },
  );

  it.each(ceCards)("%s render() returns <%s> custom element host", async (cardId, expectedTag) => {
    const def = await loadCard(cardId);
    expect("tagName" in def).toBe(true);
    expect("elementClass" in def).toBe(true);
    const el = def.render();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe(expectedTag);
  });

  it("legacy card render() returns an HTMLElement (covers legacyAdapter render fn)", async () => {
    // Calls render() for a legacy-only card — covers the inner render function
    // in legacyAdapter (returns querySelector result ?? new section)
    const def = await loadCard("motivation");
    const el = def.render();
    expect(el).toBeInstanceOf(HTMLElement);
  });
});

// ── createShell (Sprint 68, enhanced Sprint 134) ─────────────────────────

describe("createShell", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns root <section> with data-card-id and .card class", () => {
    const { root } = createShell("motivation");
    expect(root.tagName).toBe("SECTION");
    expect(root.dataset["cardId"]).toBe("motivation");
    expect(root.className).toBe("card");
  });

  it("returns a body div.card__body inside root", () => {
    const { root, body } = createShell("motivation");
    expect(body.className).toBe("card__body");
    expect(root.contains(body)).toBe(true);
  });

  it("sets aria-label from registry entry", () => {
    const { root } = createShell("motivation");
    expect(root.getAttribute("aria-label")).toBeTruthy();
  });

  it("throws for unknown card id", () => {
    expect(() => createShell("__no_such_card__")).toThrow(/not registered/);
  });

  it("returns header with title and sync dot (Sprint 134)", () => {
    const { header } = createShell("motivation");
    expect(header).toBeDefined();
    expect(header!.className).toBe("card__header");
    const title = header!.querySelector("[data-card-title]");
    expect(title).toBeTruthy();
    expect(title!.textContent).toContain("💡");
    const syncDot = header!.querySelector(".sync-dot");
    expect(syncDot).toBeTruthy();
    expect(syncDot!.id).toBe("sync-motivation");
  });

  it("returns footer element (Sprint 134)", () => {
    const { footer } = createShell("motivation");
    expect(footer).toBeDefined();
    expect(footer!.className).toBe("card__footer");
  });

  it("localizes shell title in English mode", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ interfaceLanguage: "en" }));
    const { header, root } = createShell("motivation");
    expect(header?.querySelector("[data-card-title]")?.textContent).toContain("Motivation");
    expect(root.getAttribute("aria-label")).toContain("Motivation");
  });

  it("header → body → footer order in DOM (Sprint 134)", () => {
    const { root, header, body, footer } = createShell("motivation");
    const children = Array.from(root.children);
    expect(children[0]).toBe(header);
    expect(children[1]).toBe(body);
    expect(children[2]).toBe(footer);
  });
});

// ── isValidCardSize / assertCardSize (Sprint 69) ───────────────────────────

describe("isValidCardSize", () => {
  it.each(["sm", "md", "lg", "xl"])("returns true for valid size %s", (s) => {
    expect(isValidCardSize(s)).toBe(true);
  });

  it.each(["xs", "xxl", "", "MD", 3, null, undefined])("returns false for %s", (v) => {
    expect(isValidCardSize(v)).toBe(false);
  });
});

describe("assertCardSize", () => {
  it("does not throw for valid sizes", () => {
    expect(() => assertCardSize("sm")).not.toThrow();
    expect(() => assertCardSize("xl")).not.toThrow();
  });

  it("throws TypeError for invalid value", () => {
    expect(() => assertCardSize("huge")).toThrow(TypeError);
    expect(() => assertCardSize(null)).toThrow(TypeError);
  });
});

// ── mountRegisteredCards ─────────────────────────────────────────────────

describe("mountRegisteredCards", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Build a minimal dashboard grid
    container = document.createElement("div");
    const left = document.createElement("div");
    left.className = "grid-col-left";
    const mid = document.createElement("div");
    mid.className = "grid-col-mid";
    const right = document.createElement("div");
    right.className = "grid-col-right";
    container.appendChild(left);
    container.appendChild(mid);
    container.appendChild(right);
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    // Clean up any test card registrations (built-ins remain)
    const existing = document.querySelectorAll("[data-card-id]");
    existing.forEach((el) => el.remove());
  });

  it("does not throw when grid columns are absent", () => {
    document.body.innerHTML = ""; // no columns
    expect(() => mountRegisteredCards()).not.toThrow();
  });

  it("mounts a card with defaultSlot when absent from the DOM", () => {
    const id = `test-mount-${Date.now()}`;
    registerCard({
      id,
      icon: "🔬",
      titleHe: "בדיקה",
      titleEn: "Mount Test",
      defaultSlot: { col: 0, order: 0, flexGrow: 20, hidden: false },
      load: vi.fn().mockResolvedValue({ id, icon: "🔬", titleHe: "בדיקה", titleEn: "Mount Test", defaultSlot: { col: 0, order: 0, flexGrow: 20 }, defaultSize: "md", render: () => document.createElement("section"), init: vi.fn() }),
    });

    mountRegisteredCards();

    const mounted = document.querySelector(`[data-card-id="${id}"]`);
    expect(mounted).not.toBeNull();
    expect(mounted?.closest(".grid-col-left")).not.toBeNull();
  });

  it("starts hidden when defaultSlot.hidden is true", () => {
    const id = `test-hidden-${Date.now()}`;
    registerCard({
      id,
      icon: "🙈",
      titleHe: "מוסתר",
      titleEn: "Hidden Test",
      defaultSlot: { col: 1, order: 0, flexGrow: 25, hidden: true },
      load: vi.fn().mockResolvedValue({ id, icon: "🙈", titleHe: "מוסתר", titleEn: "Hidden Test", defaultSlot: { col: 1, order: 0, flexGrow: 25, hidden: true }, defaultSize: "md", render: () => document.createElement("section"), init: vi.fn() }),
    });

    mountRegisteredCards();

    const mounted = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
    expect(mounted).not.toBeNull();
    expect(mounted!.style.display).toBe("none");
  });

  it("does not mount a card that is already in the DOM", () => {
    const id = `test-skip-${Date.now()}`;
    const existing = document.createElement("section");
    existing.setAttribute("data-card-id", id);
    document.querySelector(".grid-col-right")!.appendChild(existing);

    registerCard({
      id,
      icon: "✅",
      titleHe: "קיים",
      titleEn: "Already There",
      defaultSlot: { col: 0, order: 0, flexGrow: 20, hidden: false },
      load: vi.fn().mockResolvedValue({ id, icon: "✅", titleHe: "קיים", titleEn: "Already There", defaultSlot: { col: 0, order: 0, flexGrow: 20 }, defaultSize: "md", render: () => document.createElement("section"), init: vi.fn() }),
    });

    mountRegisteredCards();

    // Should still be only one element with this id
    expect(document.querySelectorAll(`[data-card-id="${id}"]`).length).toBe(1);
  });

  it("does not mount a card with no defaultSlot", () => {
    const id = `test-noslot-${Date.now()}`;
    registerCard({
      id,
      icon: "❓",
      titleHe: "ללא סלוט",
      titleEn: "No Slot",
      load: vi.fn().mockResolvedValue({ id, icon: "❓", titleHe: "ללא סלוט", titleEn: "No Slot", defaultSlot: { col: 0, order: 0, flexGrow: 20 }, defaultSize: "md", render: () => document.createElement("section"), init: vi.fn() }),
    });

    mountRegisteredCards();

    expect(document.querySelector(`[data-card-id="${id}"]`)).toBeNull();
  });
});
