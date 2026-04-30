/**
 * FamilyDashBoard v13 — Scroll Helpers
 *
 * Seamless vertical scroll loops for news, alerts, and stocks panes.
 * GPU-accelerated with translateZ(0) and will-change.
 */

import { diagLog } from "../core/diag";

/**
 * Inject a @keyframes rule for vertical scroll animation.
 */
export function injectScrollKeyframes(
  styleId: string,
  keyframeName: string,
  distance: number,
): void {
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = `@keyframes ${keyframeName} { from { transform: translateY(0) translateZ(0); } to { transform: translateY(-${distance}px) translateZ(0); } }`;
}

/**
 * Start a seamless scroll loop on a container.
 * Clones children for seamless looping (news/alerts pattern).
 */
export function startCloneScroll(
  container: HTMLElement,
  keyframeName: string,
  durationPerPx: number,
): void {
  // Clean up old clones
  container.querySelectorAll(".clone").forEach((el) => el.remove());

  const realHeight = container.scrollHeight;
  if (realHeight < 10) return;

  // Clone all children
  const clone = container.cloneNode(true) as HTMLElement;
  clone.classList.add("clone");
  clone.setAttribute("aria-hidden", "true");
  container.appendChild(clone);

  const totalHeight = realHeight;
  const duration = totalHeight * durationPerPx;
  const styleId = `${keyframeName}-style`;

  injectScrollKeyframes(styleId, keyframeName, totalHeight);
  container.style.animation = `${keyframeName} ${duration}ms linear infinite`;

  diagLog(`[scroll] ${keyframeName}: ${totalHeight}px @ ${duration}ms`);
}

/**
 * Start a simple scroll (no clones, e.g. stocks).
 * Scrolls the measured distance, then resets.
 */
export function startSimpleScroll(
  container: HTMLElement,
  keyframeName: string,
  durationPerPx: number,
): void {
  const scrollDistance = container.scrollHeight - container.clientHeight;
  if (scrollDistance < 10) return;

  const duration = scrollDistance * durationPerPx;
  const styleId = `${keyframeName}-style`;

  injectScrollKeyframes(styleId, keyframeName, scrollDistance);
  container.style.animation = `${keyframeName} ${duration}ms linear infinite alternate`;

  diagLog(`[scroll] ${keyframeName}: ${scrollDistance}px alternate @ ${duration}ms`);
}

/**
 * Stop scroll animation on a container.
 */
export function stopScroll(container: HTMLElement): void {
  container.style.animation = "none";
  container.querySelectorAll(".clone").forEach((el) => el.remove());
}

// ── Sprint 155: scroll shadow indicator wiring ──────────────────────────────

/**
 * Observe `.card__body` elements and toggle `.scroll-top` / `.scroll-bottom`
 * classes to drive the CSS scroll shadow gradients.
 */
export function initScrollShadows(): void {
  const bodies = document.querySelectorAll<HTMLElement>(".card__body");
  bodies.forEach((body) => {
    const update = (): void => {
      body.classList.toggle("scroll-top", body.scrollTop > 4);
      body.classList.toggle(
        "scroll-bottom",
        body.scrollTop + body.clientHeight < body.scrollHeight - 4,
      );
    };
    body.addEventListener("scroll", update, { passive: true });
    update();
  });
  diagLog(`[scroll] shadow observers on ${String(bodies.length)} card bodies`);
}
