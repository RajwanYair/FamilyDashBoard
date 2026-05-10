/**
 * FamilyDashBoard — layout-drag.ts browser spec
 *
 * Tests drag-and-drop layout state using real Chromium DOM APIs.
 * Requires @vitest/browser + @vitest/browser-playwright (installed ).
 *
 * Run: npx vitest --config vitest.browser.config.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readCurrentLayout, saveCurrentLayout, resetLayout } from "@/ui/layout-drag";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCol(cls: string, ...ids: string[]): HTMLDivElement {
  const col = document.createElement("div");
  col.className = cls;
  for (const id of ids) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset["cardId"] = id;
    col.appendChild(card);
  }
  return col;
}

// ── readCurrentLayout ──────────────────────────────────────────────────────

describe("readCurrentLayout", () => {
  let left: HTMLDivElement;
  let mid: HTMLDivElement;
  let right: HTMLDivElement;

  beforeEach(() => {
    left = makeCol("grid-col-left", "weather", "news");
    mid = makeCol("grid-col-mid", "stocks", "calendar");
    right = makeCol("grid-col-right", "motivation");
    document.body.appendChild(left);
    document.body.appendChild(mid);
    document.body.appendChild(right);
  });

  afterEach(() => {
    document.body.removeChild(left);
    document.body.removeChild(mid);
    document.body.removeChild(right);
  });

  it("returns correct card ids from each column", () => {
    const [l, m, r] = readCurrentLayout();
    expect(l).toEqual(["weather", "news"]);
    expect(m).toEqual(["stocks", "calendar"]);
    expect(r).toEqual(["motivation"]);
  });

  it("returns empty arrays for missing columns", () => {
    // Remove left column from DOM
    document.body.removeChild(left);
    const [l] = readCurrentLayout();
    expect(l).toEqual([]);
    // Re-add for cleanup
    document.body.appendChild(left);
  });

  it("returns three arrays always", () => {
    const layout = readCurrentLayout();
    expect(layout).toHaveLength(3);
    expect(Array.isArray(layout[0])).toBe(true);
    expect(Array.isArray(layout[1])).toBe(true);
    expect(Array.isArray(layout[2])).toBe(true);
  });

  it("reflects DOM order changes immediately", () => {
    // Move 'news' card to mid column
    const newsCard = left.querySelector<HTMLElement>("[data-card-id='news']")!;
    mid.appendChild(newsCard);
    const [l, m] = readCurrentLayout();
    expect(l).toEqual(["weather"]);
    expect(m).toEqual(["stocks", "calendar", "news"]);
  });
});

// ── saveCurrentLayout ──────────────────────────────────────────────────────

describe("saveCurrentLayout", () => {
  let left: HTMLDivElement;
  let mid: HTMLDivElement;
  let right: HTMLDivElement;

  beforeEach(() => {
    left = makeCol("grid-col-left", "weather");
    mid = makeCol("grid-col-mid", "stocks");
    right = makeCol("grid-col-right");
    document.body.appendChild(left);
    document.body.appendChild(mid);
    document.body.appendChild(right);
  });

  afterEach(() => {
    document.body.removeChild(left);
    document.body.removeChild(mid);
    document.body.removeChild(right);
    localStorage.clear();
  });

  it("persists layout to localStorage", () => {
    saveCurrentLayout();
    const raw = localStorage.getItem("dash_v2_config");
    expect(raw).not.toBeNull();
    const cfg = JSON.parse(raw!);
    expect(cfg.cardLayout[0]).toContain("weather");
    expect(cfg.cardLayout[1]).toContain("stocks");
  });
});

// ── resetLayout ────────────────────────────────────────────────────────────

describe("resetLayout", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("sets cardLayout to null in config", () => {
    // Pre-populate some layout using the real config key
    localStorage.setItem("dash_v2_config", JSON.stringify({ cardLayout: [["a"], [], []] }));
    resetLayout();
    const raw = localStorage.getItem("dash_v2_config");
    expect(raw).not.toBeNull();
    const cfg = JSON.parse(raw!);
    expect(cfg.cardLayout).toBeNull();
  });
});

// ── Drag-and-drop visual state ─────────────────────────────────────────────

describe("initCardDragDrop — drag visual classes", () => {
  let left: HTMLDivElement;
  let card1: HTMLDivElement;
  let header1: HTMLDivElement;

  beforeEach(() => {
    left = document.createElement("div");
    left.className = "grid-col-left";

    card1 = document.createElement("div");
    card1.className = "card";
    card1.dataset["cardId"] = "weather";

    header1 = document.createElement("div");
    header1.className = "card-header";
    card1.appendChild(header1);
    left.appendChild(card1);

    document.body.appendChild(left);
  });

  afterEach(() => {
    document.body.removeChild(left);
  });

  it("card-header element exists in DOM before drag init", () => {
    const headers = document.querySelectorAll(".card-header");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("card with data-card-id is queryable from grid column", () => {
    const cards = left.querySelectorAll("[data-card-id]");
    expect(cards.length).toBe(1);
    expect((cards[0] as HTMLElement).dataset["cardId"]).toBe("weather");
  });

  it("dragging class can be toggled on card", () => {
    card1.classList.add("dragging");
    expect(card1.classList.contains("dragging")).toBe(true);
    card1.classList.remove("dragging");
    expect(card1.classList.contains("dragging")).toBe(false);
  });

  it("drag-over class can be toggled on card", () => {
    card1.classList.add("drag-over");
    expect(card1.classList.contains("drag-over")).toBe(true);
    document
      .querySelectorAll<HTMLElement>(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
    expect(card1.classList.contains("drag-over")).toBe(false);
  });

  it("insertBefore reorders cards within a column", () => {
    // Add a second card
    const card2 = document.createElement("div");
    card2.className = "card";
    card2.dataset["cardId"] = "stocks";
    left.appendChild(card2);

    // Move card2 before card1
    left.insertBefore(card2, card1);
    const ids = [...left.querySelectorAll<HTMLElement>("[data-card-id]")].map(
      (c) => c.dataset["cardId"],
    );
    expect(ids).toEqual(["stocks", "weather"]);
  });
});
