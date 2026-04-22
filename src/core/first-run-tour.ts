/**
 * FamilyDashBoard — First-run tour overlay.
 *
 * Shows a brief welcome <dialog> on first visit with key shortcuts.
 * Dismissed with the "Got it" button or by clicking the backdrop.
 * Remembers dismissal in localStorage under TOUR_KEY.
 *
 * @module core/first-run-tour
 */

const TOUR_KEY = "dash_tour_seen";

/** Cached reference to the tour <dialog> element. */
let _dialog: HTMLDialogElement | null = null;
/** Guard against calling showModal() more than once per page load. */
let _tourShown = false;

/** Dismiss and record that the tour has been seen. */
function dismissTour(): void {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // localStorage unavailable in some embedded contexts — non-fatal
  }
  _dialog?.close();
}

/**
 * Initialise the first-run tour.
 * Checks localStorage; if the user has not yet seen the tour, shows the
 * `<dialog id="tour-overlay">` via `showModal()`.
 *
 * Safe to call multiple times — only opens once per session.
 */
export function initTour(): void {
  if (_tourShown) return; // already shown this session
  try {
    if (localStorage.getItem(TOUR_KEY)) return; // already seen
  } catch {
    return; // localStorage unavailable
  }

  _dialog = document.getElementById("tour-overlay") as HTMLDialogElement | null;
  if (!_dialog || typeof _dialog.showModal !== "function") return;

  _tourShown = true;

  // Dismiss via the "Got it" button
  const dismissBtn = _dialog.querySelector<HTMLButtonElement>("#tour-dismiss-btn");
  if (dismissBtn) dismissBtn.addEventListener("click", dismissTour, { once: true });

  // Dismiss by clicking the backdrop (click on <dialog> itself, not its content)
  _dialog.addEventListener(
    "click",
    (e: MouseEvent) => {
      if (e.target === _dialog) dismissTour();
    },
    { once: true },
  );

  // Dismiss via native Escape key (browser fires 'cancel' on <dialog>)
  _dialog.addEventListener(
    "cancel",
    (e: Event) => {
      e.preventDefault();
      dismissTour();
    },
    { once: true },
  );

  _dialog.showModal();
}

/**
 * Reset tour state — clears the localStorage flag.
 * Only for use in tests.
 * @internal
 */
export function _resetTour(): void {
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    // ignore
  }
  _dialog = null;
  _tourShown = false;
}
