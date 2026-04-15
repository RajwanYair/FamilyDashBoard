/**
 * FamilyDashBoard v7.1 — Card Drag-and-Drop Layout
 *
 * Allows users to reorder cards between the three grid columns by dragging
 * card headers. Layout is persisted to config.cardLayout via saveConfig().
 *
 * Design decisions:
 * - HTML5 Drag & Drop API (no libraries, zero runtime dependencies)
 * - draggable="true" set on .card-header elements at init time
 * - Visual feedback via CSS classes already defined in sprints.css:
 *     .card.dragging    — the card being moved (semi-transparent + accent outline)
 *     .card.drag-over   — the card over which the dragged card will insert
 * - Inserts before/after a target card based on pointer Y position
 * - Appends to column bottom when dropped on empty column space
 * - Saves layout after every successful drop
 */

import { loadConfig, saveConfig } from "../core/config";
import { diagLog } from "../core/diag";

let _dragCard: HTMLElement | null = null;

// ── Layout helpers ──────────────────────────────────────────────────────────

/** Collect data-card-id values from a column, in DOM order. */
function getColIds(colEl: HTMLElement): string[] {
  return [...colEl.querySelectorAll<HTMLElement>(":scope > [data-card-id]")]
    .map((c) => c.dataset["cardId"] ?? "")
    .filter(Boolean);
}

/** Read the live layout from the three grid columns. */
export function readCurrentLayout(): [string[], string[], string[]] {
  const q = <T extends HTMLElement>(sel: string): T | null =>
    document.querySelector<T>(sel);
  return [
    getColIds(q<HTMLElement>(".grid-col-left") ?? document.createElement("div")),
    getColIds(q<HTMLElement>(".grid-col-mid") ?? document.createElement("div")),
    getColIds(q<HTMLElement>(".grid-col-right") ?? document.createElement("div")),
  ];
}

/** Write the live layout to config and persist. */
export function saveCurrentLayout(): void {
  const cfg = loadConfig();
  cfg.cardLayout = readCurrentLayout();
  saveConfig(cfg);
  diagLog("[layout-drag] Layout saved");
}

/** Clear persisted layout — cards revert to HTML source order on next reload. */
export function resetLayout(): void {
  const cfg = loadConfig();
  cfg.cardLayout = null;
  saveConfig(cfg);
  diagLog("[layout-drag] Layout reset to default");
}

// ── Drag event handlers ─────────────────────────────────────────────────────

function onDragStart(e: DragEvent, card: HTMLElement): void {
  _dragCard = card;
  card.classList.add("dragging");
  e.dataTransfer?.setData("text/plain", card.dataset["cardId"] ?? "");
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onDragEnd(): void {
  _dragCard?.classList.remove("dragging");
  _dragCard = null;
  clearDragOver();
}

function clearDragOver(): void {
  document.querySelectorAll<HTMLElement>(".drag-over").forEach((el) =>
    el.classList.remove("drag-over"),
  );
}

function onColDragOver(e: DragEvent, col: HTMLElement): void {
  e.preventDefault();
  if (!_dragCard) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

  clearDragOver();
  const target = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-card-id]",
  );
  if (target && target !== _dragCard && col.contains(target)) {
    target.classList.add("drag-over");
  }
}

function onColDragLeave(e: DragEvent, col: HTMLElement): void {
  const related = e.relatedTarget as HTMLElement | null;
  if (!col.contains(related)) {
    clearDragOver();
  }
}

function onColDrop(e: DragEvent, col: HTMLElement): void {
  e.preventDefault();
  clearDragOver();
  if (!_dragCard) return;

  const target = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-card-id]",
  );

  if (target && target !== _dragCard) {
    // Insert before or after the target based on pointer position
    const rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      col.insertBefore(_dragCard, target);
    } else {
      col.insertBefore(_dragCard, target.nextSibling);
    }
  } else if (!target || target === _dragCard) {
    // Dropped on column background (no card target) → append
    col.appendChild(_dragCard);
  }

  saveCurrentLayout();
}

// ── Init ────────────────────────────────────────────────────────────────────

/**
 * Enable drag-and-drop reordering for all `.card` elements.
 *
 * - Sets `draggable="true"` on every `.card-header`
 * - Registers dragover/dragleave/drop handlers on the three grid columns
 * - Each successful drop persists the new layout via saveCurrentLayout()
 */
export function initCardDragDrop(): void {
  // Enable dragging on every card header
  document.querySelectorAll<HTMLElement>(".card-header").forEach((header) => {
    header.setAttribute("draggable", "true");
    header.addEventListener("dragstart", (e) => {
      const card = header.closest<HTMLElement>(".card");
      if (!card) return;
      onDragStart(e, card);
    });
    header.addEventListener("dragend", () => onDragEnd());
  });

  // Wire drop zones on the three grid columns
  const colSelectors = [".grid-col-left", ".grid-col-mid", ".grid-col-right"] as const;
  for (const sel of colSelectors) {
    const col = document.querySelector<HTMLElement>(sel);
    if (!col) continue;
    col.addEventListener("dragover", (e) => onColDragOver(e, col));
    col.addEventListener("dragleave", (e) => onColDragLeave(e, col));
    col.addEventListener("drop", (e) => onColDrop(e, col));
  }

  diagLog("[layout-drag] Drag-and-drop layout initialized");
}
