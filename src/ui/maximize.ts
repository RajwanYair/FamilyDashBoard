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
      // Ignore clicks on the collapse button — handled by initCardCollapse
      if ((e.target as HTMLElement).closest(".card-collapse-btn")) return;
      const card = hdr.closest<HTMLElement>(".card");
      if (!card) return;
      e.stopPropagation();
      toggleCardMaximize(card);
    });
  });

  diagLog("[maximize] Card maximize initialized");
}

// ── Card Collapse ──

const LS_COLLAPSED = "dash_v2_collapsed_cards";

function loadCollapsedCards(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_COLLAPSED) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveCollapsedCards(set: Set<string>): void {
  try {
    localStorage.setItem(LS_COLLAPSED, JSON.stringify([...set]));
  } catch { /* quota */ }
}

export function getCollapsedCards(): Set<string> {
  return loadCollapsedCards();
}

/**
 * Wire every `.card-collapse-btn` to toggle the `.collapsed` class
 * on its parent `.card`. State is persisted to localStorage.
 */
export function initCardCollapse(): void {
  const collapsed = loadCollapsedCards();

  // Restore persisted state
  document.querySelectorAll<HTMLElement>(".card").forEach((card) => {
    const id = (card.id || card.querySelector("[id]")?.id) ?? "";
    if (id && collapsed.has(id)) card.classList.add("collapsed");
  });

  document.querySelectorAll<HTMLElement>(".card-collapse-btn").forEach((btn) => {
    btn.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      const card = btn.closest<HTMLElement>(".card");
      if (!card) return;

      const doToggle = (): void => {
        card.classList.toggle("collapsed");
        const isNowCollapsed = card.classList.contains("collapsed");
        btn.textContent = isNowCollapsed ? "▶" : "▼";
        const cardId = (card.id || card.querySelector("[id]")?.id) ?? "";
        if (cardId) {
          const set = loadCollapsedCards();
          if (isNowCollapsed) set.add(cardId);
          else set.delete(cardId);
          saveCollapsedCards(set);
        }
        diagLog(`[maximize] Card ${card.classList.contains("collapsed") ? "collapsed" : "expanded"}: ${cardId}`);
      };

      if ("startViewTransition" in document) {
        void document.startViewTransition(doToggle);
      } else {
        doToggle();
      }
    });
  });

  diagLog("[maximize] Card collapse initialized");
}
