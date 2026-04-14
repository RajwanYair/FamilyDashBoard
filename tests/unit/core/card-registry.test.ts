/**
 * Tests for src/core/card-registry.ts
 *
 * Covers: registerCard, getCard, listCards, loadCard,
 * built-in registrations, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerCard,
  getCard,
  listCards,
  loadCard,
} from "@/core/card-registry";
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
    const sorted = [...list].sort((a, b) =>
      a.titleHe.localeCompare(b.titleHe, "he"),
    );
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

describe("Card Registry — loadCard built-in (tasks)", () => {
  it("loads the tasks CardDefinition via dynamic import", async () => {
    const def = await loadCard("tasks");
    expect(def.id).toBe("tasks");
    expect(typeof def.render).toBe("function");
    expect(typeof def.init).toBe("function");
  });

  it("tasks render() returns an HTMLElement", async () => {
    const def = await loadCard("tasks");
    const el = def.render();
    expect(el).toBeInstanceOf(HTMLElement);
  });
});

describe("Card Registry — loadCard built-in (system-info)", () => {
  it("loads the system-info CardDefinition via dynamic import", async () => {
    const def = await loadCard("system-info");
    expect(def.id).toBe("system-info");
    expect(typeof def.render).toBe("function");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (news — legacyAdapter)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("loads news card and legacyAdapter render() falls back to createElement", async () => {
    const def = await loadCard("news");
    expect(def.id).toBe("news");
    // No [data-card-id="news"] in DOM → falls back to createElement
    const el = def.render() as HTMLElement;
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe("SECTION");
  });

  it("legacyAdapter render() returns existing DOM element when present", async () => {
    const def = await loadCard("news");
    const section = document.createElement("section");
    section.dataset.cardId = "news";
    document.body.appendChild(section);
    const el = def.render();
    expect(el).toBe(section);
    document.body.removeChild(section);
  });
});

describe("Card Registry — loadCard built-in legacy (weather)", () => {
  it("loads weather card via dynamic import", async () => {
    const def = await loadCard("weather");
    expect(def.id).toBe("weather");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (hebrew-cal)", () => {
  it("loads hebrew-cal card via dynamic import", async () => {
    const def = await loadCard("hebrew-cal");
    expect(def.id).toBe("hebrew-cal");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (calendar)", () => {
  it("loads calendar card via dynamic import", async () => {
    const def = await loadCard("calendar");
    expect(def.id).toBe("calendar");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (currency)", () => {
  it("loads currency card via dynamic import", async () => {
    const def = await loadCard("currency");
    expect(def.id).toBe("currency");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (stocks)", () => {
  it("loads stocks card via dynamic import", async () => {
    const def = await loadCard("stocks");
    expect(def.id).toBe("stocks");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (alerts)", () => {
  it("loads alerts card via dynamic import", async () => {
    const def = await loadCard("alerts");
    expect(def.id).toBe("alerts");
    expect(typeof def.init).toBe("function");
  });
});

describe("Card Registry — loadCard built-in legacy (motivation)", () => {
  it("loads motivation card via dynamic import", async () => {
    const def = await loadCard("motivation");
    expect(def.id).toBe("motivation");
    expect(typeof def.init).toBe("function");
  });
});
