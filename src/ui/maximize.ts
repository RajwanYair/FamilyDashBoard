/**
 * FamilyDashBoard v6 — Card Maximize (FLIP Animation)
 *
 * Click a card header to expand it fullscreen. Click again or Escape to collapse.
 */

import { diagLog } from "../core/diag";

let maximizedCard: HTMLElement | null = null;

/**
 * Get the currently maximized card (or null).
 */
export function getMaximizedCard(): HTMLElement | null {
  return maximizedCard;
}

/**
 * Toggle a card between normal and maximized state.
 */
export function toggleCardMaximize(card: HTMLElement): void {
  if (card.classList.contains("maximized")) {
    collapseCard(card);
  } else {
    expandCard(card);
  }
}

function expandCard(card: HTMLElement): void {
  // Collapse any other maximized card first
  if (maximizedCard && maximizedCard !== card) {
    collapseCard(maximizedCard);
  }

  // FLIP: Record initial position
  const first = card.getBoundingClientRect();
  card.classList.add("maximized");
  const last = card.getBoundingClientRect();

  // Animate from first → last
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;

  card.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: "none" },
    ],
    { duration: 300, easing: "ease-out" },
  );

  maximizedCard = card;
  diagLog("[maximize] Expanded card");
}

function collapseCard(card: HTMLElement): void {
  // FLIP: Record maximized position
  const first = card.getBoundingClientRect();
  card.classList.remove("maximized");
  const last = card.getBoundingClientRect();

  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;

  card.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: "none" },
    ],
    { duration: 300, easing: "ease-out" },
  );

  maximizedCard = null;
  diagLog("[maximize] Collapsed card");
}

/**
 * Attach click listeners to all card headers.
 */
export function initCardMaximize(): void {
  document.querySelectorAll<HTMLElement>(".card-header").forEach((hdr) => {
    hdr.addEventListener("click", (e: Event) => {
      const card = hdr.closest<HTMLElement>(".card");
      if (!card) return;
      e.stopPropagation();
      toggleCardMaximize(card);
    });
  });

  diagLog("[maximize] Card maximize initialized");
}
