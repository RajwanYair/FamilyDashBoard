/**
 * Tests for src/ui/resizer.ts
 *
 * Covers: initResizers (guard when gridsArea absent), guide element creation,
 * cursor attribute management, column-gap detection, row-gap detection,
 * column resize (applyColResize), row resize (applyRowResize), mouse lifecycle
 * (mousedown → mousemove → mouseup), maximized-card suppression,
 * and edge cases for flex-grow helpers.
 *
 * All DOM interactions use happy-dom. getBoundingClientRect is stubbed via
 * Object.defineProperty to control layout co-ordinates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initResizers } from "@/ui/resizer";

// ── DOM helpers ────────────────────────────────────────────────────────────

function makeGridsArea(numCols = 2, cardsPerCol = 2): void {
  const colsHTML = Array.from({ length: numCols }, (_, ci) => {
    const cards = Array.from(
      { length: cardsPerCol },
      (__, ki) =>
        `<div class="card" data-card-id="c${ci}-${ki}" style="flex-grow:1;flex-shrink:1;flex-basis:0;height:200px;"></div>`,
    ).join("");
    return `<div class="grid-col">${cards}</div>`;
  }).join("");
  document.body.innerHTML = `<div class="grids-area">${colsHTML}</div>`;
}

function fireMouseEvent(
  type: string,
  opts: { clientX?: number; clientY?: number; button?: number } = {},
): void {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    button: opts.button ?? 0,
  });
  window.dispatchEvent(ev);
}

/**
 * Stub getBoundingClientRect on a DOM element for the duration of a test.
 * Returns a DOMRect-like object with the given values.
 */
function stubRect(
  el: Element,
  rect: Partial<DOMRect>,
): void {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 0, right: 100, bottom: 200, left: 0, width: 100, height: 200, x: 0, y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("initResizers — guard: no .grids-area", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns without throwing when .grids-area is absent", () => {
    document.body.innerHTML = "<div id='other'></div>";
    expect(() => initResizers()).not.toThrow();
  });

  it("does not inject guide elements when .grids-area is absent", () => {
    document.body.innerHTML = "<div id='other'></div>";
    initResizers();
    expect(document.body.querySelectorAll("[class*='resize-guide']").length).toBe(0);
  });
});

describe("initResizers — guide element injection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("injects exactly two guide elements (col + row)", () => {
    makeGridsArea();
    initResizers();
    const guides = document.body.querySelectorAll("[class*='resize-guide']");
    expect(guides.length).toBe(2);
  });

  it("guide elements have aria-hidden", () => {
    makeGridsArea();
    initResizers();
    const guides = document.body.querySelectorAll("[class*='resize-guide']");
    guides.forEach((g) => expect(g.getAttribute("aria-hidden")).toBe("true"));
  });

  it("guide col element has class resize-guide--col", () => {
    makeGridsArea();
    initResizers();
    expect(document.querySelector(".resize-guide--col")).not.toBeNull();
  });

  it("guide row element has class resize-guide--row", () => {
    makeGridsArea();
    initResizers();
    expect(document.querySelector(".resize-guide--row")).not.toBeNull();
  });
});

describe("setCursorMode via mousemove — no drag active", () => {
  beforeEach(() => {
    makeGridsArea();
    initResizers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-col");
    document.documentElement.removeAttribute("data-resize-row");
  });

  it("clears cursor mode when mouse is away from any gap", () => {
    // Move far from any gap
    fireMouseEvent("mousemove", { clientX: 9999, clientY: 9999 });
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(false);
    expect(document.documentElement.hasAttribute("data-resize-row")).toBe(false);
  });

  it("sets data-resize-col when cursor is near a column gap", () => {
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    // Make colA right=500, colB left=510 → gap midpoint=505 → within ±14 of 505
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0 });
    stubRect(cols[1]!, { top: 0, right: 1010, bottom: 1080, left: 510 });
    stubRect(gridsArea, { top: 0, right: 1920, bottom: 1080, left: 0 });

    fireMouseEvent("mousemove", { clientX: 505, clientY: 200 });
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(true);
  });

  it("sets data-resize-row when cursor is near a row gap within a column", () => {
    const col = document.querySelector<HTMLElement>(".grid-col")!;
    const cards = col.querySelectorAll<HTMLElement>(":scope > .card");
    // Card 0 bottom=400, Card 1 top=420 → mid=410 → within ±14
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(cards[0]!, { top: 0, right: 960, bottom: 400, left: 0 });
    stubRect(cards[1]!, { top: 420, right: 960, bottom: 1080, left: 0 });

    fireMouseEvent("mousemove", { clientX: 500, clientY: 410 });
    expect(document.documentElement.hasAttribute("data-resize-row")).toBe(true);
  });
});

describe("maximized card suppresses resize cursor", () => {
  beforeEach(() => {
    makeGridsArea();
    initResizers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-col");
    document.documentElement.removeAttribute("data-resize-row");
  });

  it("clears cursor mode when a card is maximized", () => {
    // Add maximized class
    const card = document.querySelector(".card")!;
    card.classList.add("maximized");

    fireMouseEvent("mousemove", { clientX: 505, clientY: 200 });
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(false);
    expect(document.documentElement.hasAttribute("data-resize-row")).toBe(false);
  });

  it("does not start drag on mousedown when a card is maximized", () => {
    const card = document.querySelector(".card")!;
    card.classList.add("maximized");

    fireMouseEvent("mousedown", { clientX: 505, clientY: 200 });
    fireMouseEvent("mousemove", { clientX: 520, clientY: 200 });
    // Cursor mode should remain clear (maximized blocks it)
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(false);
  });
});

describe("column drag lifecycle", () => {
  beforeEach(() => {
    makeGridsArea(2, 2);
    initResizers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-col");
    document.documentElement.removeAttribute("data-resize-row");
  });

  it("starts col drag on mousedown near column gap", () => {
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    stubRect(gridsArea, { top: 0, right: 1920, bottom: 1080, left: 0 });
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 0, right: 1020, bottom: 1080, left: 510, width: 510 });

    fireMouseEvent("mousedown", { clientX: 505, clientY: 200 });
    // Guide should be active now
    const guideCol = document.querySelector(".resize-guide--col");
    expect(guideCol?.classList.contains("active")).toBe(true);
  });

  it("moves guide column line on mousemove during col drag", () => {
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    stubRect(gridsArea, { top: 0, right: 1920, bottom: 1080, left: 0 });
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 0, right: 1020, bottom: 1080, left: 510, width: 510 });

    fireMouseEvent("mousedown", { clientX: 505, clientY: 200 });
    fireMouseEvent("mousemove", { clientX: 540, clientY: 200 });

    const guideCol = document.querySelector<HTMLElement>(".resize-guide--col");
    expect(guideCol?.style.left).toBe("540px");
  });

  it("applies --grid-cols on mousemove during col drag", () => {
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    stubRect(gridsArea, { top: 0, right: 1920, bottom: 1080, left: 0 });
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 0, right: 1010, bottom: 1080, left: 510, width: 500 });

    fireMouseEvent("mousedown", { clientX: 505, clientY: 200 });
    fireMouseEvent("mousemove", { clientX: 550, clientY: 200 });

    const gridCols = gridsArea.style.getPropertyValue("--grid-cols");
    expect(gridCols).toBeTruthy();
    expect(gridCols).toMatch(/fr/);
  });

  it("clears guide and cursor on mouseup after col drag", () => {
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    stubRect(gridsArea, { top: 0, right: 1920, bottom: 1080, left: 0 });
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 0, right: 1010, bottom: 1080, left: 510, width: 500 });

    fireMouseEvent("mousedown", { clientX: 505, clientY: 200 });
    fireMouseEvent("mouseup");

    const guideCol = document.querySelector(".resize-guide--col");
    expect(guideCol?.classList.contains("active")).toBe(false);
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(false);
  });

  it("does not start drag on non-primary mouse button", () => {
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    stubRect(gridsArea, { top: 0, right: 1920, bottom: 1080, left: 0 });
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 0, right: 1010, bottom: 1080, left: 510, width: 500 });

    fireMouseEvent("mousedown", { button: 2, clientX: 505, clientY: 200 });
    const guideCol = document.querySelector(".resize-guide--col");
    expect(guideCol?.classList.contains("active")).toBe(false);
  });
});

describe("row drag lifecycle", () => {
  beforeEach(() => {
    makeGridsArea(1, 2);
    initResizers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-col");
    document.documentElement.removeAttribute("data-resize-row");
  });

  it("starts row drag on mousedown near row gap", () => {
    const col = document.querySelector<HTMLElement>(".grid-col")!;
    const cards = col.querySelectorAll<HTMLElement>(":scope > .card");
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(cards[0]!, { top: 0, right: 960, bottom: 400, left: 0, height: 400 });
    stubRect(cards[1]!, { top: 420, right: 960, bottom: 1080, left: 0, height: 660 });

    fireMouseEvent("mousedown", { clientX: 400, clientY: 410 });
    const guideRow = document.querySelector(".resize-guide--row");
    expect(guideRow?.classList.contains("active")).toBe(true);
  });

  it("applies flex-grow to sibling cards on mousemove during row drag", () => {
    const col = document.querySelector<HTMLElement>(".grid-col")!;
    const cards = col.querySelectorAll<HTMLElement>(":scope > .card");
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(cards[0]!, { top: 0, right: 960, bottom: 400, left: 0, height: 400 });
    stubRect(cards[1]!, { top: 420, right: 960, bottom: 1080, left: 0, height: 660 });

    fireMouseEvent("mousedown", { clientX: 400, clientY: 410 });
    fireMouseEvent("mousemove", { clientX: 400, clientY: 460 });

    // Both cards must receive valid positive flex-grow values after the drag
    const growA = parseFloat((cards[0] as HTMLElement).style.flexGrow);
    const growB = parseFloat((cards[1] as HTMLElement).style.flexGrow);
    expect(growA).toBeGreaterThan(0);
    expect(growB).toBeGreaterThan(0);
    // Combined grow should be conserved (≈2 from initial 1+1)
    expect(growA + growB).toBeCloseTo(2, 0);
  });

  it("clears row guide and cursor on mouseup", () => {
    const col = document.querySelector<HTMLElement>(".grid-col")!;
    const cards = col.querySelectorAll<HTMLElement>(":scope > .card");
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(cards[0]!, { top: 0, right: 960, bottom: 400, left: 0, height: 400 });
    stubRect(cards[1]!, { top: 420, right: 960, bottom: 1080, left: 0, height: 660 });

    fireMouseEvent("mousedown", { clientX: 400, clientY: 410 });
    fireMouseEvent("mouseup");

    const guideRow = document.querySelector(".resize-guide--row");
    expect(guideRow?.classList.contains("active")).toBe(false);
    expect(document.documentElement.hasAttribute("data-resize-row")).toBe(false);
  });

  it("does not apply resize when mouseup happens with no drag active", () => {
    expect(() => fireMouseEvent("mouseup")).not.toThrow();
  });
});

describe("col resize clamping — MIN_COL_PX enforcement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-col");
  });

  it("respects MIN_COL_PX (160 px) and does not shrink a column below it", () => {
    makeGridsArea(2, 1);
    initResizers();
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    // cols: colA=500px, colB=500px; drag colA all the way to left (extreme)
    stubRect(gridsArea, { top: 0, right: 1000, bottom: 1080, left: 0 });
    stubRect(cols[0]!, { top: 0, right: 500, bottom: 1080, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 0, right: 1000, bottom: 1080, left: 510, width: 490 });

    fireMouseEvent("mousedown", { clientX: 505, clientY: 200 });
    // Drag far left — delta = -2000
    fireMouseEvent("mousemove", { clientX: -2000, clientY: 200 });

    const gridCols = gridsArea.style.getPropertyValue("--grid-cols");
    // Parse fr values to confirm colA is not < 160px fraction
    const parts = gridCols.split(" ").map((s) => parseFloat(s));
    // Total fr = sum of parts; colA px ≈ (parts[0] / total) * 1010
    const total = parts.reduce((a, b) => a + b, 0);
    const colAMinFr = (160 / 1010) * total;
    expect(parts[0]).toBeGreaterThanOrEqual(colAMinFr * 0.99); // allow float rounding
  });
});

describe("row resize clamping — MIN_CARD_PX enforcement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-row");
  });

  it("respects MIN_CARD_PX (60 px) and does not collapse a card below it", () => {
    makeGridsArea(1, 2);
    initResizers();
    const col = document.querySelector<HTMLElement>(".grid-col")!;
    const cards = col.querySelectorAll<HTMLElement>(":scope > .card");
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(cards[0]!, { top: 0, right: 960, bottom: 400, left: 0, height: 400 });
    stubRect(cards[1]!, { top: 420, right: 960, bottom: 1080, left: 0, height: 660 });

    fireMouseEvent("mousedown", { clientX: 400, clientY: 410 });
    // Drag down extreme to push card[0] to minimum
    fireMouseEvent("mousemove", { clientX: 400, clientY: 9999 });

    const growA = parseFloat((cards[0] as HTMLElement).style.flexGrow);
    expect(growA).toBeGreaterThan(0); // not zero — clamped to minimum grow
  });
});

describe("card-hidden cards are excluded from row resize", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-row");
  });

  it("ignores card-hidden cards when detecting row gaps", () => {
    // Make a column with 3 cards: first two visible, third hidden
    document.body.innerHTML = `
      <div class="grids-area">
        <div class="grid-col">
          <div class="card" style="flex-grow:1;flex-shrink:1;flex-basis:0;"></div>
          <div class="card" style="flex-grow:1;flex-shrink:1;flex-basis:0;"></div>
          <div class="card card-hidden" style="flex-grow:1;flex-shrink:1;flex-basis:0;"></div>
        </div>
      </div>
    `;
    initResizers();
    const col = document.querySelector<HTMLElement>(".grid-col")!;
    const allCards = col.querySelectorAll<HTMLElement>(":scope > .card");
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(allCards[0]!, { top: 0, right: 960, bottom: 400, left: 0, height: 400 });
    stubRect(allCards[1]!, { top: 420, right: 960, bottom: 800, left: 0, height: 380 });
    stubRect(allCards[2]!, { top: 820, right: 960, bottom: 1080, left: 0, height: 260 });

    fireMouseEvent("mousedown", { clientX: 400, clientY: 410 });
    const guideRow = document.querySelector(".resize-guide--row");
    // Should activate (only 2 visible cards → 1 gap)
    expect(guideRow?.classList.contains("active")).toBe(true);
    // Third card (hidden) should NOT have its flex-grow changed by the resize
    // (it already has inline flex-grow:1 from DOM setup, which stays unchanged)
    const hiddenGrowBefore = (allCards[2] as HTMLElement).style.flexGrow;
    fireMouseEvent("mousemove", { clientX: 400, clientY: 450 });
    expect((allCards[2] as HTMLElement).style.flexGrow).toBe(hiddenGrowBefore);

    fireMouseEvent("mouseup");
  });
});

describe("column gap detection edge cases", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-resize-col");
  });

  it("does not detect gap when cursor Y is outside grids-area bounds", () => {
    makeGridsArea(2, 1);
    initResizers();
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const cols = gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col");
    stubRect(gridsArea, { top: 100, right: 1920, bottom: 900, left: 0 });
    stubRect(cols[0]!, { top: 100, right: 500, bottom: 900, left: 0, width: 500 });
    stubRect(cols[1]!, { top: 100, right: 1020, bottom: 900, left: 510, width: 510 });

    // Y=50 is above grids-area top (100) → no gap
    fireMouseEvent("mousemove", { clientX: 505, clientY: 50 });
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(false);
  });

  it("does not detect gap when only one column exists", () => {
    makeGridsArea(1, 2);
    initResizers();
    const gridsArea = document.querySelector<HTMLElement>(".grids-area")!;
    const col = gridsArea.querySelector<HTMLElement>(".grid-col")!;
    stubRect(gridsArea, { top: 0, right: 960, bottom: 1080, left: 0 });
    stubRect(col, { top: 0, right: 960, bottom: 1080, left: 0, width: 960 });

    fireMouseEvent("mousemove", { clientX: 480, clientY: 400 });
    expect(document.documentElement.hasAttribute("data-resize-col")).toBe(false);
  });
});
