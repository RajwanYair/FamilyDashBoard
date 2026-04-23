/**
 * FamilyDashBoard — Card Resize Handles
 *
 * Invisible drag zones sit in the gutters between cards (row resize) and
 * between the three grid columns (column resize).
 *
 * Row resize:    mouse over the gap between two cards in the same column
 *               → drag up/down → adjusts each card's flex-grow
 *
 * Column resize: mouse over the gap between two grid columns
 *               → drag left/right → adjusts --grid-cols on .grids-area
 *
 * Design notes:
 * - No DOM mutation for detection; uses mousemove + getBoundingClientRect.
 * - Cursor change is applied via html[data-resize-col/row] attribute so it
 *   overrides any child cursor declarations without touching each element.
 * - Guide lines (fixed position divs injected into <body>) give visual
 *   feedback during the drag — lightweight, no reflow.
 * - Column sizes are stored as fr values in --grid-cols (CSS custom property).
 * - Row sizes are stored as inline flex-grow on each card element.
 * - Minimum column width: 160 px; minimum card height: 60 px.
 * - Suppressed while a card is maximized (document.body.classList check).
 */

import "./resizer.css";
import { diagLog } from "../core/diag";

// ── Constants ──────────────────────────────────────────────────────────────

/** px either side of the gap centre-line that triggers the resize cursor */
const HIT_PX = 14;

/** Minimum rendered width for any column (px) */
const MIN_COL_PX = 160;

/** Minimum rendered height for any card during row resize (px) */
const MIN_CARD_PX = 60;

// ── State ──────────────────────────────────────────────────────────────────

interface DragState {
  type: "col" | "row";
  startCoord: number;        // clientX (col) or clientY (row) at mousedown
  gapIndex: number;          // index of the left/top sibling in the pair
  gridsArea: HTMLElement;    // for col resize
  colEl: HTMLElement;        // for row resize
  siblings: HTMLElement[];   // grid-col elements (col) or card elements (row)
  startSizePx: number[];     // pixel widths/heights at drag start for all siblings
  startGrow: number[];       // flex-grow values at drag start (row only)
}

let _state: DragState | null = null;

// Guide line overlay elements (created once, appended to body)
let _guideCol: HTMLElement | null = null;
let _guideRow: HTMLElement | null = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Attach resize handle behaviour to the dashboard grid.
 * Call once after the DOM is ready (from main.ts init).
 */
export function initResizers(): void {
  const gridsArea = document.querySelector<HTMLElement>(".grids-area");
  if (!gridsArea) return;

  _guideCol = createGuide("col");
  _guideRow = createGuide("row");

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);

  diagLog("[resizer] initialized");
}

// ── Guide line helpers ─────────────────────────────────────────────────────

function createGuide(dir: "col" | "row"): HTMLElement {
  const el = document.createElement("div");
  el.className = `resize-guide--${dir}`;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

function showGuide(type: "col" | "row", coord: number): void {
  if (type === "col" && _guideCol) {
    _guideCol.style.left = `${coord}px`;
    _guideCol.classList.add("active");
  } else if (type === "row" && _guideRow) {
    _guideRow.style.top = `${coord}px`;
    _guideRow.classList.add("active");
  }
}

function moveGuide(type: "col" | "row", coord: number): void {
  if (type === "col" && _guideCol) _guideCol.style.left = `${coord}px`;
  if (type === "row" && _guideRow) _guideRow.style.top = `${coord}px`;
}

function hideGuides(): void {
  _guideCol?.classList.remove("active");
  _guideRow?.classList.remove("active");
}

// ── Cursor helpers ─────────────────────────────────────────────────────────

function setCursorMode(mode: "col" | "row" | null): void {
  const html = document.documentElement;
  html.removeAttribute("data-resize-col");
  html.removeAttribute("data-resize-row");
  if (mode === "col") html.setAttribute("data-resize-col", "");
  if (mode === "row") html.setAttribute("data-resize-row", "");
}

// ── Gap detection ──────────────────────────────────────────────────────────

/**
 * Returns the 0-based index of the column gap the cursor is over,
 * or -1 if the cursor is not near any column gap.
 */
function detectColumnGap(
  gridsArea: HTMLElement,
  cx: number,
  cy: number
): number {
  const areaBounds = gridsArea.getBoundingClientRect();
  if (cy < areaBounds.top || cy > areaBounds.bottom) return -1;

  const cols = Array.from(
    gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col")
  );

  for (let i = 0; i < cols.length - 1; i++) {
    const colA = cols[i];
    const colB = cols[i + 1];
    if (!colA || !colB) continue;
    const right = colA.getBoundingClientRect().right;
    const left = colB.getBoundingClientRect().left;
    const mid = (right + left) / 2;
    if (Math.abs(cx - mid) <= HIT_PX) return i;
  }
  return -1;
}

/**
 * Returns the 0-based index of the row gap the cursor is over
 * within a given grid column, or -1 if not near any gap.
 */
function detectRowGap(col: HTMLElement, cx: number, cy: number): number {
  const colBounds = col.getBoundingClientRect();
  if (cx < colBounds.left || cx > colBounds.right) return -1;

  const cards = getCards(col);
  for (let i = 0; i < cards.length - 1; i++) {
    const cardA = cards[i];
    const cardB = cards[i + 1];
    if (!cardA || !cardB) continue;
    const bottom = cardA.getBoundingClientRect().bottom;
    const top = cardB.getBoundingClientRect().top;
    const mid = (bottom + top) / 2;
    if (Math.abs(cy - mid) <= HIT_PX) return i;
  }
  return -1;
}

// ── Card helpers ───────────────────────────────────────────────────────────

/** Direct card/split children of a column that are currently visible. */
function getCards(col: HTMLElement): HTMLElement[] {
  return Array.from(
    col.querySelectorAll<HTMLElement>(":scope > .card, :scope > .col-split")
  ).filter((el) => !el.classList.contains("card-hidden"));
}

/** Read a card's current flex-grow (inline or computed). */
function flexGrowOf(el: HTMLElement): number {
  const inline = parseFloat(el.style.flexGrow);
  if (!isNaN(inline) && inline >= 0) return inline;
  const computed = parseFloat(getComputedStyle(el).flexGrow);
  return isNaN(computed) ? 1 : computed;
}

// ── Mouse event handlers ───────────────────────────────────────────────────

function isMaximized(): boolean {
  return document.querySelector(".card.maximized") !== null;
}

function onMouseMove(e: MouseEvent): void {
  if (_state) {
    performResize(e);
    return;
  }

  if (isMaximized()) {
    setCursorMode(null);
    return;
  }

  const gridsArea = document.querySelector<HTMLElement>(".grids-area");
  if (gridsArea) {
    const colGap = detectColumnGap(gridsArea, e.clientX, e.clientY);
    if (colGap >= 0) {
      setCursorMode("col");
      return;
    }
  }

  const cols = Array.from(
    document.querySelectorAll<HTMLElement>(".grid-col")
  );
  for (const col of cols) {
    const rowGap = detectRowGap(col, e.clientX, e.clientY);
    if (rowGap >= 0) {
      setCursorMode("row");
      return;
    }
  }

  setCursorMode(null);
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0 || isMaximized()) return;

  const gridsArea = document.querySelector<HTMLElement>(".grids-area");

  // ── Column gap ──
  if (gridsArea) {
    const colGap = detectColumnGap(gridsArea, e.clientX, e.clientY);
    if (colGap >= 0) {
      e.preventDefault();
      const cols = Array.from(
        gridsArea.querySelectorAll<HTMLElement>(":scope > .grid-col")
      );
      const startSizePx = cols.map(
        (c) => c.getBoundingClientRect().width
      );

      _state = {
        type: "col",
        startCoord: e.clientX,
        gapIndex: colGap,
        gridsArea,
        colEl: gridsArea, // unused for col type
        siblings: cols,
        startSizePx,
        startGrow: [],
      };

      setCursorMode("col");
      showGuide("col", e.clientX);
      return;
    }
  }

  // ── Row gap ──
  const cols = Array.from(
    document.querySelectorAll<HTMLElement>(".grid-col")
  );
  for (const col of cols) {
    const rowGap = detectRowGap(col, e.clientX, e.clientY);
    if (rowGap >= 0) {
      e.preventDefault();
      const cards = getCards(col);
      const startSizePx = cards.map(
        (c) => c.getBoundingClientRect().height
      );
      const startGrow = cards.map(flexGrowOf);

      _state = {
        type: "row",
        startCoord: e.clientY,
        gapIndex: rowGap,
        gridsArea: gridsArea ?? col,
        colEl: col,
        siblings: cards,
        startSizePx,
        startGrow,
      };

      setCursorMode("row");
      showGuide("row", e.clientY);
      return;
    }
  }
}

function onMouseUp(): void {
  if (!_state) return;
  hideGuides();
  setCursorMode(null);
  _state = null;
}

// ── Resize application ─────────────────────────────────────────────────────

function performResize(e: MouseEvent): void {
  if (!_state) return;

  if (_state.type === "col") {
    applyColResize(e.clientX);
    moveGuide("col", e.clientX);
  } else {
    applyRowResize(e.clientY);
    moveGuide("row", e.clientY);
  }
}

function applyColResize(clientX: number): void {
  if (!_state) return;
  const { gridsArea, gapIndex, startSizePx, startCoord } = _state;

  const a = gapIndex;
  const b = gapIndex + 1;
  const sizeA = startSizePx[a] ?? 0;
  const sizeB = startSizePx[b] ?? 0;
  const delta = clientX - startCoord;
  const combined = sizeA + sizeB;
  const newA = Math.max(MIN_COL_PX, Math.min(combined - MIN_COL_PX, sizeA + delta));
  const newB = combined - newA;

  // Build new fr values using pixel widths as proportional weights
  const newSizes = [...startSizePx];
  newSizes[a] = newA;
  newSizes[b] = newB;

  const frVals = newSizes.map((s) => `${s.toFixed(1)}fr`).join(" ");
  gridsArea.style.setProperty("--grid-cols", frVals);
}

function applyRowResize(clientY: number): void {
  if (!_state) return;
  const { gapIndex, siblings, startSizePx, startGrow, startCoord } = _state;

  const a = gapIndex;
  const b = gapIndex + 1;
  const sizeA = startSizePx[a] ?? 0;
  const sizeB = startSizePx[b] ?? 0;
  const growA = startGrow[a] ?? 1;
  const growB = startGrow[b] ?? 1;
  const cardA = siblings[a];
  const cardB = siblings[b];
  if (!cardA || !cardB) return;

  const delta = clientY - startCoord;
  const combined = sizeA + sizeB;
  const newA = Math.max(MIN_CARD_PX, Math.min(combined - MIN_CARD_PX, sizeA + delta));
  const newB = combined - newA;

  // Convert new pixel heights back to flex-grow.
  // We preserve the combined grow of the pair so all other cards are unaffected.
  const combinedGrow = growA + growB;
  const newGrowA = Math.max(0.05, (newA / combined) * combinedGrow);
  const newGrowB = Math.max(0.05, (newB / combined) * combinedGrow);

  cardA.style.flexGrow = newGrowA.toFixed(4);
  cardA.style.flexShrink = "1";
  cardA.style.flexBasis = "0";

  cardB.style.flexGrow = newGrowB.toFixed(4);
  cardB.style.flexShrink = "1";
  cardB.style.flexBasis = "0";
}
