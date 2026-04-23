/**
 * Auto-loop scroll — seamless infinite vertical scroll for TV dashboard cards.
 *
 * Works the same way as the news / alerts cards:
 *   1. Detect content overflow (scrollHeight > parent clientHeight)
 *   2. Clone all original children and append them (seamless loop)
 *   3. Inject a CSS @keyframes animation that translates from 0 → -(50% of doubled height)
 *   4. When animation loops, the first copy is back — seamless repeat
 *   5. Hover pauses the animation (CSS animation-play-state)
 *   6. prefers-reduced-motion: skip animation entirely
 *
 * Requirements for the target container:
 *   - display: flex; flex-direction: column (vertical item stacking)
 *   - Parent element must clip overflow (overflow: hidden)
 *   - Container must have a bounded height (flex: 1 1 0 + min-height: 0 works)
 */

const CLONE_ATTR = "data-als-clone";

export interface AutoLoopScrollOptions {
  /** Unique ID for the injected <style> element. Must be unique per container. */
  styleId: string;
  /** Scroll speed in pixels per second. Default: 40 */
  pxPerSec?: number;
  /** Minimum animation duration in seconds. Default: 20 */
  minDurSec?: number;
}

/**
 * Initialize (or re-initialize) seamless loop scroll on a container.
 * Safe to call multiple times — cleans up previous state on each call.
 */
export function initAutoLoopScroll(
  container: HTMLElement,
  opts: AutoLoopScrollOptions,
): void {
  // Always clean up first (handles re-render case)
  destroyAutoLoopScroll(container, opts.styleId);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  requestAnimationFrame(() => {
    if (!container.isConnected) return;

    const parentH = container.parentElement?.clientHeight ?? 0;
    const contentH = container.scrollHeight;

    // Only start loop if content actually overflows the visible area
    if (parentH === 0 || contentH <= parentH) return;

    // Clone original children for seamless loop; mark clones non-interactive
    Array.from(container.children).forEach((child) => {
      const clone = child.cloneNode(true) as HTMLElement;
      clone.setAttribute(CLONE_ATTR, "true");
      clone.setAttribute("aria-hidden", "true");
      // inert disables all interaction (focus, clicks) on the clone subtree
      clone.setAttribute("inert", "");
      container.appendChild(clone);
    });

    // Measure full doubled height after clone insertion, then animate
    requestAnimationFrame(() => {
      if (!container.isConnected) return;

      const halfH = container.scrollHeight / 2; // height of one copy
      const pxPerSec = opts.pxPerSec ?? 40;
      const minDur = opts.minDurSec ?? 20;
      const dur = Math.max(minDur, halfH / pxPerSec);
      const animName = `als_${opts.styleId}`;

      const style =
        document.getElementById(opts.styleId) ??
        (() => {
          const s = document.createElement("style");
          s.id = opts.styleId;
          document.head.appendChild(s);
          return s;
        })();

      style.textContent = `@keyframes ${animName}{from{transform:translateY(0) translateZ(0)}to{transform:translateY(-${halfH}px) translateZ(0)}}`;
      container.style.animation = `${animName} ${dur}s linear infinite`;
    });
  });
}

/**
 * Remove loop scroll animation and cloned elements from a container.
 * Call on card disconnect or when content is cleared.
 */
export function destroyAutoLoopScroll(container: HTMLElement, styleId: string): void {
  container.style.animation = "";
  container
    .querySelectorAll(`[${CLONE_ATTR}="true"]`)
    .forEach((el) => el.remove());
  document.getElementById(styleId)?.remove();
}
