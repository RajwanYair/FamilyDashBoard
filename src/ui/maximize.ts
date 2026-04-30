/**
 * FamilyDashBoard v13 — Card Maximize (FLIP + View Transitions)
 *
 * Click a card header to expand it fullscreen. Click again or Escape to collapse.
 * v7.1: Adaptive font scaling via --max-font-scale CSS custom property.
 * F12: View Transitions API used when available; FLIP animation as fallback.
 */

import { diagLog } from "../core/diag";
import { LS_COLLAPSED } from "../core/constants";
import { updateCardMiniInfo } from "../core/sync";

let maximizedCard: HTMLElement | null = null;

// ── View Transitions L2 helper (Roadmap #10, Sprint 123) ─────────────────────

type VtL2Doc = Document & {
  startViewTransition(
    opts: { update: () => void | Promise<void>; types?: string[] },
  ): ViewTransition;
};

/**
 * Start a View Transition with an optional `types` array (L2 API).
 * Prefers the L2 options form `{ update, types }` when available.
 * Always makes exactly ONE call to `document.startViewTransition`.
 *
 * L1 implementations (and legacy test stubs) only accept a function argument.
 * If calling with an options object throws (TypeError from trying to invoke the
 * object as a function), we fall back to the L1 callback form.
 * The fallback is only reached when the L2 call itself throws — so the
 * total call count is always 1.
 */
function startVtWithTypes(
  update: () => void | Promise<void>,
  types: string[],
): ViewTransition {
  try {
    return (document as VtL2Doc).startViewTransition({ update, types });
  } catch (err) {
    if (err instanceof TypeError) {
      return document.startViewTransition(update);
    }
    throw err;
  }
}

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

/**
 * Compute the adaptive font scale: ratio of expanded area to collapsed area,
 * clamped to [1, 4] so fonts are never smaller than normal and never absurdly large.
 */
export function computeFontScale(first: DOMRect, last: DOMRect): number {
  const scaleW = last.width / (first.width || 1);
  const scaleH = last.height / (first.height || 1);
  // Use the smaller axis so content is never clipped horizontally or vertically
  const raw = Math.min(scaleW, scaleH);
  return Math.max(1, Math.min(4, parseFloat(raw.toFixed(3))));
}

/**
 * F12: Derive a unique CSS `view-transition-name` for a card.
 * Must be a valid CSS ident: letters, digits, and hyphens only.
 */
export function cardVtName(card: HTMLElement): string {
  const id = (card.dataset["cardId"] || card.id || "card").replace(/[^a-zA-Z0-9]/g, "-");
  return `card-max-${id}`;
}

function expandCard(card: HTMLElement): void {
  // Collapse any other maximized card first
  if (maximizedCard && maximizedCard !== card) {
    collapseCard(maximizedCard);
  }

  // If the card is collapsed (minimized), un-collapse it so content is visible when maximized.
  // The collapsed state is restored after the maximize→collapse animation completes.
  card.classList.remove("collapsed");

  // Measure the header so the maximized card starts below it (not covering the clock)
  const headerEl = document.querySelector<HTMLElement>("header.time-section");
  const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 0;
  const availableHeight = Math.round(window.innerHeight - headerBottom);
  card.style.setProperty("--maximize-top", `${headerBottom}px`);
  card.style.setProperty("--maximize-height", `${availableHeight}px`);

  if ("startViewTransition" in document) {
    // F12/Sprint-123: View Transitions L2 — browser morphs card from grid position to fullscreen.
    card.style.setProperty("view-transition-name", cardVtName(card));
    void startVtWithTypes(() => {
        const first = card.getBoundingClientRect();
        card.classList.add("maximized");
        const last = card.getBoundingClientRect();
        card.style.setProperty("--max-font-scale", String(computeFontScale(first, last)));
      }, ["card-maximize"])
      .finished.then(() => {
        card.style.removeProperty("view-transition-name");
      });
  } else {
    // FLIP fallback for browsers without View Transitions
    const first = card.getBoundingClientRect();
    card.classList.add("maximized");
    const last = card.getBoundingClientRect();

    // v7.1: Inject adaptive font scale
    const fontScale = computeFontScale(first, last);
    card.style.setProperty("--max-font-scale", String(fontScale));

    // Animate from first → last
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    card.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }],
      { duration: 300, easing: "ease-out" },
    );
  }

  card.setAttribute("aria-expanded", "true");
  maximizedCard = card;
  diagLog(
    `[maximize] Expanded card via ${"startViewTransition" in document ? "ViewTransition" : "FLIP"}`,
  );
}

function collapseCard(card: HTMLElement): void {
  // Check whether this card was persisted as collapsed, so we can restore the
  // minimized state after the animation (it was removed by expandCard).
  const collapseId = card.dataset["cardId"] ?? card.id ?? card.querySelector("[id]")?.id ?? "";
  const wasCollapsed = collapseId ? loadCollapsedCards().has(collapseId) : false;

  const afterCollapse = (): void => {
    card.style.removeProperty("--max-font-scale");
    card.style.removeProperty("--maximize-top");
    card.style.removeProperty("--maximize-height");
    if (wasCollapsed) {
      card.classList.add("collapsed");
      const btn = card.querySelector<HTMLElement>(".card-collapse-btn");
      if (btn) {
        btn.textContent = "▶";
        btn.setAttribute("aria-expanded", "false");
      }
    }
  };

  if ("startViewTransition" in document) {
    // F12/Sprint-123: View Transitions L2 — morphs card from fullscreen back to grid position.
    card.style.setProperty("view-transition-name", cardVtName(card));
    void startVtWithTypes(() => {
        card.classList.remove("maximized");
      }, ["card-maximize"])
      .finished.then(() => {
        card.style.removeProperty("view-transition-name");
        afterCollapse();
      });
  } else {
    // FLIP fallback for browsers without View Transitions
    const first = card.getBoundingClientRect();
    card.classList.remove("maximized");
    const last = card.getBoundingClientRect();

    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    const anim = card.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }],
      { duration: 300, easing: "ease-out" },
    );

    // Remove the scale variable only after the collapse animation, so font
    // does not snap before the card reaches its original size.
    // Also restore .collapsed if the card was minimized before maximize.
    void anim.finished.then(afterCollapse);
  }

  card.setAttribute("aria-expanded", "false");
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

// LS_COLLAPSED imported from constants

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
  } catch {
    /* quota */
  }
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

  // Restore persisted state and set initial aria-expanded
  document.querySelectorAll<HTMLElement>(".card").forEach((card) => {
    const id = card.dataset["cardId"] || card.id || (card.querySelector("[id]")?.id ?? "");
    const btn = card.querySelector<HTMLElement>(".card-collapse-btn");
    if (id && collapsed.has(id)) {
      card.classList.add("collapsed");
      if (btn) btn.setAttribute("aria-expanded", "false");
      // Populate mini-info for cards that start already collapsed
      const dataCardId = card.dataset["cardId"] ?? "";
      if (dataCardId) updateCardMiniInfo(dataCardId);
    } else if (btn) {
      btn.setAttribute("aria-expanded", "true");
    }
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
        btn.setAttribute("aria-expanded", String(!isNowCollapsed));
        const cardId = card.dataset["cardId"] || card.id || (card.querySelector("[id]")?.id ?? "");
        if (cardId) {
          const set = loadCollapsedCards();
          if (isNowCollapsed) set.add(cardId);
          else set.delete(cardId);
          saveCollapsedCards(set);
        }
        diagLog(
          `[maximize] Card ${card.classList.contains("collapsed") ? "collapsed" : "expanded"}: ${cardId}`,
        );
        // Update mini-info to reflect latest rendered data when collapsing
        if (isNowCollapsed) {
          const dataCardId = card.dataset["cardId"] ?? "";
          if (dataCardId) updateCardMiniInfo(dataCardId);
        }
      };

      if ("startViewTransition" in document) {
        void startVtWithTypes(doToggle, ["card-maximize"]);
      } else {
        doToggle();
      }
    });
  });

  diagLog("[maximize] Card collapse initialized");
}
