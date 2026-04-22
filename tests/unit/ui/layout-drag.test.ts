/**
 * Tests for src/ui/layout-drag.ts
 *
 * Covers: readCurrentLayout, saveCurrentLayout, resetLayout, initCardDragDrop,
 * drag event flow (dragstart → dragover → drop → save).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readCurrentLayout,
  saveCurrentLayout,
  resetLayout,
  initCardDragDrop,
} from "@/ui/layout-drag";

// ── Helpers ─────────────────────────────────────────────────────────────────

function setupColumns(left: string[] = [], mid: string[] = [], right: string[] = []): void {
  document.body.innerHTML = `
    <div class="grid-col grid-col-left">
      ${left.map((id) => `<section class="card" data-card-id="${id}"><div class="card-header">H ${id}</div></section>`).join("")}
    </div>
    <div class="grid-col grid-col-mid">
      ${mid.map((id) => `<section class="card" data-card-id="${id}"><div class="card-header">H ${id}</div></section>`).join("")}
    </div>
    <div class="grid-col grid-col-right">
      ${right.map((id) => `<section class="card" data-card-id="${id}"><div class="card-header">H ${id}</div></section>`).join("")}
    </div>
  `;
}

// ── readCurrentLayout ────────────────────────────────────────────────────────

describe("Layout Drag — readCurrentLayout()", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns three arrays matching the live DOM column order", () => {
    setupColumns(["news", "weather"], ["hebrew-cal", "calendar"], ["stocks", "alerts"]);
    const [left, mid, right] = readCurrentLayout();
    expect(left).toEqual(["news", "weather"]);
    expect(mid).toEqual(["hebrew-cal", "calendar"]);
    expect(right).toEqual(["stocks", "alerts"]);
  });

  it("returns empty arrays for empty columns", () => {
    setupColumns([], [], []);
    const layout = readCurrentLayout();
    expect(layout).toEqual([[], [], []]);
  });

  it("skips elements without data-card-id", () => {
    document.body.innerHTML = `
      <div class="grid-col grid-col-left">
        <section class="card" data-card-id="news"></section>
        <div>no-id element</div>
      </div>
      <div class="grid-col grid-col-mid"></div>
      <div class="grid-col grid-col-right"></div>
    `;
    const [left] = readCurrentLayout();
    expect(left).toEqual(["news"]);
  });
});

// ── saveCurrentLayout ────────────────────────────────────────────────────────

describe("Layout Drag — saveCurrentLayout()", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("persists the live layout to localStorage config.cardLayout", () => {
    setupColumns(["news"], ["hebrew-cal"], ["stocks"]);
    saveCurrentLayout();
    const raw = localStorage.getItem("dash_v2_config");
    const cfg = JSON.parse(raw ?? "{}") as { cardLayout?: unknown };
    expect(cfg.cardLayout).toEqual([["news"], ["hebrew-cal"], ["stocks"]]);
  });
});

// ── resetLayout ──────────────────────────────────────────────────────────────

describe("Layout Drag — resetLayout()", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("sets config.cardLayout to null in localStorage", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ cardLayout: [["news"], [], []] }));
    resetLayout();
    const raw = localStorage.getItem("dash_v2_config");
    const cfg = JSON.parse(raw ?? "{}") as { cardLayout?: unknown };
    expect(cfg.cardLayout).toBeNull();
  });
});

// ── initCardDragDrop ─────────────────────────────────────────────────────────

describe("Layout Drag — initCardDragDrop() sets draggable on headers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets draggable=true on all .card-header elements", () => {
    setupColumns(["news", "weather"], ["hebrew-cal"], []);
    initCardDragDrop();
    const headers = document.querySelectorAll<HTMLElement>(".card-header");
    headers.forEach((h) => {
      expect(h.getAttribute("draggable")).toBe("true");
    });
  });

  it("dragstart adds dragging class to parent card", () => {
    setupColumns(["news"], [], []);
    initCardDragDrop();
    const header = document.querySelector<HTMLElement>(".card-header")!;
    const card = document.querySelector<HTMLElement>(".card")!;

    const dt = { setData: vi.fn(), effectAllowed: "" };
    header.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: dt,
      }),
    );
    expect(card.classList.contains("dragging")).toBe(true);
  });
});

// ── Drag-over and drop flow ───────────────────────────────────────────────────

describe("Layout Drag — dragover → drop moves card and saves layout", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("drop appends dragged card to target column and persists layout", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;
    const midCol = document.querySelector<HTMLElement>(".grid-col-mid")!;

    // Simulate dragstart on news card header
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Simulate drop on the mid column by dispatching directly on the column element
    // (event.target will be midCol automatically)
    const dropEvt = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvt, "preventDefault", { value: vi.fn() });
    Object.defineProperty(dropEvt, "clientY", { value: 100 });
    Object.defineProperty(dropEvt, "dataTransfer", { value: { dropEffect: "" } });
    midCol.dispatchEvent(dropEvt);

    // news card should now be in mid column
    expect(midCol.contains(newsCard)).toBe(true);

    // Layout should be saved
    const raw = localStorage.getItem("dash_v2_config");
    const cfg = JSON.parse(raw ?? "{}") as { cardLayout?: [string[], string[], string[]] };
    expect(cfg.cardLayout?.[1]).toContain("news");
  });
});

// ── dragend cleanup ───────────────────────────────────────────────────────────

describe("Layout Drag — dragend removes dragging class", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("removes dragging class from card on dragend", () => {
    setupColumns(["stocks"], [], []);
    initCardDragDrop();
    const header = document.querySelector<HTMLElement>(".card-header")!;
    const card = document.querySelector<HTMLElement>(".card")!;

    // Start drag
    header.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );
    expect(card.classList.contains("dragging")).toBe(true);

    // End drag
    header.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(card.classList.contains("dragging")).toBe(false);
  });
});

// ── onColDragOver and clearDragOver ──────────────────────────────────────────

describe("Layout Drag — dragover event adds drag-over class to target card", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("adds drag-over class to target card on dragover when _dragCard is set", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const weatherCard = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;

    // Set _dragCard = newsCard via dragstart
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Dispatch dragover on weatherCard (bubbles up to col, e.target = weatherCard)
    const overEvt = Object.assign(new Event("dragover", { bubbles: true }), {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: "" },
    });
    weatherCard.dispatchEvent(overEvt);

    expect(weatherCard.classList.contains("drag-over")).toBe(true);
  });

  it("clearDragOver removes drag-over class from marked elements on dragend", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const weatherCard = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;

    // Set _dragCard and add drag-over to weather
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );
    weatherCard.classList.add("drag-over");

    // dragend clears _dragCard and calls clearDragOver (covers forEach body)
    newsHeader.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(weatherCard.classList.contains("drag-over")).toBe(false);
  });

  it("dragover without _dragCard set returns early (no drag-over class added)", () => {
    setupColumns(["news"], [], []);
    initCardDragDrop();
    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;

    // No dragstart → _dragCard = null → onColDragOver returns early
    const overEvt = Object.assign(new Event("dragover", { bubbles: true }), {
      preventDefault: vi.fn(),
    });
    leftCol.dispatchEvent(overEvt);
    expect(newsCard.classList.contains("drag-over")).toBe(false);
  });
});

// ── onColDragLeave ───────────────────────────────────────────────────────────

describe("Layout Drag — dragleave clears drag-over when related is outside column", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("clears drag-over class when relatedTarget is outside the column", () => {
    setupColumns(["news"], [], []);
    initCardDragDrop();
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;
    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    newsCard.classList.add("drag-over");

    // relatedTarget = document.body (outside col) → !col.contains(body) = TRUE → clearDragOver
    const leaveEvt = Object.assign(new Event("dragleave", { bubbles: true }), {
      relatedTarget: document.body,
    });
    leftCol.dispatchEvent(leaveEvt);
    expect(newsCard.classList.contains("drag-over")).toBe(false);
  });

  it("does not clear drag-over when relatedTarget is still inside the column", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;
    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const weatherCard = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    newsCard.classList.add("drag-over");

    // relatedTarget = weatherCard (inside col) → !col.contains(weatherCard) = FALSE → NO clear
    const leaveEvt = Object.assign(new Event("dragleave", { bubbles: true }), {
      relatedTarget: weatherCard,
    });
    leftCol.dispatchEvent(leaveEvt);
    expect(newsCard.classList.contains("drag-over")).toBe(true);
  });
});

// ── edge cases: drop without _dragCard; dragover on card dragging itself ──────

describe("Layout Drag — onColDrop without _dragCard (early return, line 104)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("drop on column without prior dragstart does not throw (line 104 TRUE branch)", () => {
    setupColumns(["news"], [], []);
    initCardDragDrop();
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;

    // No dragstart → _dragCard = null → onColDrop returns at line 104
    const dropEvt = Object.assign(new Event("drop", { bubbles: true }), {
      preventDefault: vi.fn(),
      clientY: 0,
      dataTransfer: { dropEffect: "" },
    });
    expect(() => leftCol.dispatchEvent(dropEvt)).not.toThrow();
  });
});

describe("Layout Drag — dragover on dragged card itself (target === _dragCard)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("dragover without dataTransfer does not throw (if(e.dataTransfer) FALSE branch, line 83)", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;

    // Set _dragCard = newsCard
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Dispatch dragover WITHOUT dataTransfer → if(e.dataTransfer) = FALSE
    const overEvt = Object.assign(new Event("dragover", { bubbles: true }), {
      preventDefault: vi.fn(),
      // intentionally no dataTransfer
    });
    expect(() => newsCard.dispatchEvent(overEvt)).not.toThrow();
  });
});

// ── onColDrop with target card (insert-before) ───────────────────────────────

describe("Layout Drag — drop on target card uses insertBefore (lines 112-116)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("inserts dragged card BEFORE target when clientY < card midpoint (line 114)", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const weatherCard = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;

    // Mock getBoundingClientRect so midpoint is 50+100/2 = 100
    vi.spyOn(weatherCard, "getBoundingClientRect").mockReturnValue({
      top: 50,
      height: 100,
      bottom: 150,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);

    // Set _dragCard = newsCard
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Drop ON weatherCard with clientY=30 (< 50+50=100) → insertBefore(weatherCard)
    const dropEvt = Object.assign(new Event("drop", { bubbles: true }), {
      preventDefault: vi.fn(),
      clientY: 30,
      dataTransfer: { dropEffect: "" },
    });
    weatherCard.dispatchEvent(dropEvt);

    // newsCard should be before weatherCard in the column
    const cards = [...leftCol.querySelectorAll("[data-card-id]")];
    expect(cards[0]?.getAttribute("data-card-id")).toBe("news");
    expect(cards[1]?.getAttribute("data-card-id")).toBe("weather");
  });

  it("inserts dragged card AFTER target when clientY >= card midpoint (line 116)", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const weatherCard = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;

    // Mock getBoundingClientRect so midpoint is 50+100/2 = 100
    vi.spyOn(weatherCard, "getBoundingClientRect").mockReturnValue({
      top: 50,
      height: 100,
      bottom: 150,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);

    // Set _dragCard = newsCard (currently first)
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Drop ON weatherCard with clientY=120 (>= midpoint 100) → insertBefore(nextSibling) = append after
    const dropEvt = Object.assign(new Event("drop", { bubbles: true }), {
      preventDefault: vi.fn(),
      clientY: 120,
      dataTransfer: { dropEffect: "" },
    });
    weatherCard.dispatchEvent(dropEvt);

    // After drop, newsCard should be after weatherCard
    const cards = [...leftCol.querySelectorAll("[data-card-id]")];
    expect(cards[0]?.getAttribute("data-card-id")).toBe("weather");
    expect(cards[1]?.getAttribute("data-card-id")).toBe("news");
  });
});
// ── dragstart with no .card parent (line 141 guard) ──────────────────────────

describe("Layout Drag — dragstart with orphan header (no .card parent, line 141)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns early without throwing when header has no .card ancestor (line 141 TRUE branch)", () => {
    document.body.innerHTML = `
      <div class="grid-col grid-col-left"></div>
      <div class="grid-col grid-col-mid"></div>
      <div class="grid-col grid-col-right"></div>
      <div class="card-header orphan-header">Orphan</div>
    `;
    initCardDragDrop();
    const orphan = document.querySelector<HTMLElement>(".orphan-header")!;
    expect(() =>
      orphan.dispatchEvent(
        Object.assign(new Event("dragstart", { bubbles: true }), {
          dataTransfer: { setData: vi.fn(), effectAllowed: "" },
        }),
      ),
    ).not.toThrow();
  });
});

// ── onColDrop when target === _dragCard (drop on same card) ──────────────────

describe("Layout Drag — drop on same card as dragged (target === _dragCard, else-if branch)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("appends dragged card to column when dropped on itself (target === _dragCard)", () => {
    setupColumns(["news"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;

    // Set _dragCard = newsCard
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Drop on newsCard ITSELF → target === _dragCard → else-if TRUE → col.appendChild
    const dropEvt = Object.assign(new Event("drop", { bubbles: true }), {
      preventDefault: vi.fn(),
      clientY: 0,
      dataTransfer: { dropEffect: "" },
    });
    newsCard.dispatchEvent(dropEvt);

    expect(leftCol.contains(newsCard)).toBe(true);
  });
});

// ── readCurrentLayout with missing columns (null-safety ?? fallback) ──────────

describe("Layout Drag — readCurrentLayout with missing columns (lines 38-40 ?? fallback)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns empty arrays when all grid columns are missing from DOM", () => {
    document.body.innerHTML = "";
    const layout = readCurrentLayout();
    expect(layout).toEqual([[], [], []]);
  });
});

// ── getColIds with child missing data-card-id (line 28 ?? "" right branch) ────

describe("Layout Drag — getColIds skips children without data-card-id (line 28 ?? empty string)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("filters out children with no data-card-id from readCurrentLayout result (line 28 ?? branch)", () => {
    // Add a child WITHOUT data-card-id — dataset.cardId = undefined → ?? "" → "" filtered by Boolean
    document.body.innerHTML = `
      <div class="grid-col grid-col-left">
        <section class="card" data-card-id="news"></section>
        <div class="no-id-child"></div>
      </div>
      <div class="grid-col grid-col-mid"></div>
      <div class="grid-col grid-col-right"></div>
    `;
    const [left] = readCurrentLayout();
    // Only "news" should appear — "" (from no-id child) was filtered out
    expect(left).toEqual(["news"]);
  });
});

// ── onDragStart with non-null dataTransfer (lines 64-65 TRUE branch) ──────────

describe("Layout Drag — dragstart with non-null dataTransfer via defineProperty (lines 64-65)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls setData and sets effectAllowed when dataTransfer is non-null (lines 64-65 TRUE)", () => {
    setupColumns(["news"], [], []);
    initCardDragDrop();
    const header = document.querySelector<HTMLElement>(".card-header")!;

    const dt = { setData: vi.fn(), effectAllowed: "" as string };
    const dragEvt = new Event("dragstart", { bubbles: true });
    // Use defineProperty so dataTransfer is actually readable as non-null
    Object.defineProperty(dragEvt, "dataTransfer", {
      value: dt,
      writable: true,
      configurable: true,
    });
    header.dispatchEvent(dragEvt);

    // Lines 64-65: setData was called AND effectAllowed was set to "move"
    expect(dt.setData).toHaveBeenCalledWith("text/plain", "news");
    expect(dt.effectAllowed).toBe("move");
  });
});

// ── Sprint v7.13: uncovered branches ─────────────────────────────────────────

describe("Layout Drag — readCurrentLayout() when columns are absent from DOM (line 28)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns empty arrays when .grid-col-left/mid/right are absent", () => {
    // No setupColumns() call → columns not in DOM → ?? fallback creates empty div
    document.body.innerHTML = "<div>no columns here</div>";
    const [left, mid, right] = readCurrentLayout();
    expect(left).toEqual([]);
    expect(mid).toEqual([]);
    expect(right).toEqual([]);
  });
});

describe("Layout Drag — drop AFTER target uses insertBefore(card, target.nextSibling) (line 118)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("inserts dragged card AFTER target when clientY > card midpoint (line 118)", () => {
    setupColumns(["news", "weather"], [], []);
    initCardDragDrop();

    const newsCard = document.querySelector<HTMLElement>('[data-card-id="news"]')!;
    const weatherCard = document.querySelector<HTMLElement>('[data-card-id="weather"]')!;
    const newsHeader = newsCard.querySelector<HTMLElement>(".card-header")!;
    const leftCol = document.querySelector<HTMLElement>(".grid-col-left")!;

    // Mock getBoundingClientRect so midpoint is 50+100/2 = 100; clientY = 150 > 100 → insert AFTER
    vi.spyOn(weatherCard, "getBoundingClientRect").mockReturnValue({
      top: 50,
      height: 100,
      bottom: 150,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);

    // Start drag
    newsHeader.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: "" },
      }),
    );

    // Drop on the weather card, clientY = 150 > midpoint 100
    const dropEvt = Object.assign(new Event("drop", { bubbles: true }), {
      preventDefault: vi.fn(),
      clientY: 150,
      dataTransfer: { dropEffect: "" },
    });
    Object.defineProperty(dropEvt, "target", { value: weatherCard });
    leftCol.dispatchEvent(dropEvt);

    // news card should now be AFTER weather card (nextSibling of weather)
    const children = Array.from(leftCol.children);
    const newsIdx = children.indexOf(newsCard);
    const weatherIdx = children.indexOf(weatherCard);
    expect(newsIdx).toBeGreaterThan(weatherIdx);
  });
});
