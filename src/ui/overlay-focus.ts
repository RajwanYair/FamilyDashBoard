/**
 * Small focus-management helpers for overlays that are not native modal dialogs.
 */

const returnFocusTargets = new Map<string, HTMLElement>();

/**
 * Remember the element that opened an overlay.
 *
 * Re-opening an already visible overlay must not replace the original return
 * target with an element inside the overlay.
 */
export function captureOverlayFocus(id: string, overlay: Element): void {
  if (returnFocusTargets.has(id)) return;
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.isConnected &&
    !overlay.contains(active) &&
    !active.hasAttribute("disabled")
  ) {
    returnFocusTargets.set(id, active);
  }
}

/** Restore focus to the element that opened an overlay, when it still exists. */
export function restoreOverlayFocus(id: string): void {
  const target = returnFocusTargets.get(id);
  returnFocusTargets.delete(id);
  if (!target?.isConnected || target.hasAttribute("disabled")) return;
  target.focus({ preventScroll: true });
}

function isHiddenFromKeyboard(element: HTMLElement): boolean {
  const section = element.closest(".cfg-section");
  const closedDetails = element.closest("details:not([open])");
  return Boolean(
    element.hidden ||
    element.closest("[hidden]") !== null ||
    element.getAttribute("aria-hidden") === "true" ||
    element.closest('[aria-hidden="true"]') !== null ||
    (closedDetails !== null && !element.matches("summary")) ||
    (section !== null && !section.classList.contains("active")),
  );
}

/**
 * Return the currently usable keyboard targets inside an overlay.
 *
 * The `.cfg-section` check keeps inactive settings tabs out of the focus
 * cycle even when a test DOM does not load the panel stylesheet.
 */
export function getOverlayFocusableElements(overlay: Element): HTMLElement[] {
  const selector = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(overlay.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !isHiddenFromKeyboard(element),
  );
}

/** Keep Tab focus within a non-native overlay. */
export function trapOverlayTab(event: KeyboardEvent, overlay: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = getOverlayFocusableElements(overlay);
  if (focusable.length === 0) {
    event.preventDefault();
    overlay.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  const active = document.activeElement;
  if (!overlay.contains(active)) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
