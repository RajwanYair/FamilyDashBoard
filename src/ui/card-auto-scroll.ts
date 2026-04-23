/**
 * FamilyDashBoard — Card Auto-Scroll
 *
 * When a card's content body overflows its visible height, smoothly scroll it
 * in a loop (down → pause at bottom → jump back to top → repeat).
 *
 * Pauses on mouse-wheel interaction; resumes after RESUME_DELAY_MS idle.
 * Skips cards that manage their own scroll animations (news, alerts, stocks).
 * Skips collapsed and maximized cards while they are in that state.
 */
import { diagLog } from "../core/diag";

/** px / second — comfortable reading speed on a 1080p TV at 3 m */
const SCROLL_SPEED = 35;

/** ms to hold at the bottom before jumping back to the top */
const BOTTOM_PAUSE_MS = 1_500;

/** ms to pause after a wheel event before resuming auto-scroll */
const RESUME_DELAY_MS = 3_000;

/** minimum overflow (px) required before auto-scroll activates */
const OVERFLOW_THRESHOLD = 24;

/** ms between periodic re-evaluations (catches cards that loaded new data) */
const RECHECK_INTERVAL_MS = 30_000;

/** Card IDs that already have their own built-in scroll animation — skip them */
const SELF_SCROLL_IDS = new Set(["news", "alerts", "stocks"]);

type Ticker = {
  raf: number;
  paused: boolean;
  atBottom: boolean;
  resumeTimer: ReturnType<typeof setTimeout> | null;
  lastTs: number;
};

/** Per-body scroll state; key = body HTMLElement */
const registry = new Map<HTMLElement, Ticker>();

/** Return the first non-header direct child of a card, or null. */
export function findScrollBody(card: HTMLElement): HTMLElement | null {
  for (const child of card.children) {
    if (child instanceof HTMLElement && !child.classList.contains("card-header")) {
      return child;
    }
  }
  return null;
}

/** Start auto-scroll on a body element. No-op if already wired. */
function wire(card: HTMLElement, body: HTMLElement): void {
  if (registry.has(body)) return;

  body.classList.add("card-body-auto-scroll");
  body.style.overflowY = "auto";

  const ticker: Ticker = {
    raf: 0,
    paused: false,
    atBottom: false,
    resumeTimer: null,
    lastTs: 0,
  };
  registry.set(body, ticker);

  const tick = (ts: number): void => {
    ticker.raf = requestAnimationFrame(tick);

    // Suspend while the card is in a non-normal state
    if (card.classList.contains("collapsed") || card.classList.contains("maximized")) {
      ticker.lastTs = ts;
      return;
    }
    if (ticker.paused || ticker.atBottom) {
      ticker.lastTs = ts;
      return;
    }

    const dt = ticker.lastTs ? (ts - ticker.lastTs) / 1_000 : 0;
    ticker.lastTs = ts;
    if (dt <= 0 || dt > 0.2) return; // skip first frame or large gaps (tab hidden)

    const max = body.scrollHeight - body.clientHeight;
    if (max < OVERFLOW_THRESHOLD) return; // content no longer overflows — wait

    body.scrollTop = Math.min(body.scrollTop + SCROLL_SPEED * dt, max);

    if (body.scrollTop >= max - 1) {
      ticker.atBottom = true;
      setTimeout(() => {
        body.scrollTop = 0;
        ticker.atBottom = false;
        ticker.lastTs = 0;
      }, BOTTOM_PAUSE_MS);
    }
  };

  ticker.raf = requestAnimationFrame(tick);

  // Pause when the user scrolls manually
  body.addEventListener(
    "wheel",
    () => {
      ticker.paused = true;
      ticker.lastTs = 0;
      if (ticker.resumeTimer) clearTimeout(ticker.resumeTimer);
      ticker.resumeTimer = setTimeout(() => {
        ticker.paused = false;
      }, RESUME_DELAY_MS);
    },
    { passive: true },
  );

  diagLog(`[auto-scroll] wired: ${card.dataset["cardId"] ?? card.id}`);
}

/** Stop auto-scroll on a body element and restore defaults. */
function unwire(body: HTMLElement): void {
  const t = registry.get(body);
  if (!t) return;
  cancelAnimationFrame(t.raf);
  if (t.resumeTimer) clearTimeout(t.resumeTimer);
  body.classList.remove("card-body-auto-scroll");
  body.style.removeProperty("overflow-y");
  registry.delete(body);
}

/** Check every card and wire/unwire auto-scroll as needed. */
export function evaluateAll(): void {
  document.querySelectorAll<HTMLElement>(".card").forEach((card) => {
    const id = card.dataset["cardId"] ?? "";
    if (SELF_SCROLL_IDS.has(id)) return;

    const body = findScrollBody(card);
    if (!body) return;

    const overflows = body.scrollHeight > body.clientHeight + OVERFLOW_THRESHOLD;

    if (overflows && !registry.has(body)) {
      wire(card, body);
    } else if (!overflows && registry.has(body)) {
      unwire(body);
    }
  });
}

/**
 * Initialise card auto-scroll.
 * Call once from main.ts after cards are mounted.
 */
export function initCardAutoScroll(): void {
  // Initial check — wait for cards to render their first data payload
  setTimeout(evaluateAll, 2_500);

  // Re-evaluate whenever a card changes size (window resize, collapse, maximise)
  const ro = new ResizeObserver(evaluateAll);
  document.querySelectorAll<HTMLElement>(".card").forEach((c) => ro.observe(c));

  // Periodic re-check: catches cards that received new content after initial load
  setInterval(evaluateAll, RECHECK_INTERVAL_MS);

  diagLog("[auto-scroll] initialized");
}
