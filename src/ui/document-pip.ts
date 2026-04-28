/**
 * FamilyDashBoard — Document Picture-in-Picture helper
 *
 * Sprint 137 (Roadmap #22, gated): foundational helper for moving the active
 * video-news iframe into a Document Picture-in-Picture window so the user can
 * keep watching the news feed while the dashboard scrolls or while another
 * card maximises.
 *
 * Browser support (2026-Q2): Chromium 116+, Edge 116+. Firefox/Safari fall
 * through gracefully — the helper returns `false` on unsupported browsers,
 * and the calling UI hides the toggle button accordingly.
 *
 * Design:
 *  - One PiP window at a time. Re-entering closes the existing one first.
 *  - The original DOM container receives the element back when PiP closes.
 *  - No globals leaked: state is module-private.
 *  - Feature-detect via `"documentPictureInPicture" in window`.
 */

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
}

interface DocumentPictureInPictureLike {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  window: Window | null;
}

interface WindowWithDocPip {
  documentPictureInPicture?: DocumentPictureInPictureLike;
}

let _activePipWindow: Window | null = null;
let _restorePlaceholder: { parent: ParentNode; nextSibling: Node | null } | null = null;
let _restoreEl: HTMLElement | null = null;

/**
 * Returns true when the running browser exposes the Document PiP API.
 */
export function isDocumentPipSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as WindowWithDocPip;
  return typeof w.documentPictureInPicture?.requestWindow === "function";
}

/**
 * Returns true when a PiP window is currently open via this helper.
 */
export function isPipActive(): boolean {
  return _activePipWindow !== null && !_activePipWindow.closed;
}

/**
 * Move `el` into a fresh Document PiP window. Resolves to true on success,
 * false on unsupported / error.
 */
export async function enterDocumentPip(
  el: HTMLElement,
  opts: DocumentPictureInPictureOptions = { width: 480, height: 270 },
): Promise<boolean> {
  if (!isDocumentPipSupported()) return false;
  if (isPipActive()) exitDocumentPip();

  const w = window as unknown as WindowWithDocPip;
  const api = w.documentPictureInPicture;
  if (!api) return false;

  try {
    const pipWin = await api.requestWindow(opts);
    _activePipWindow = pipWin;
    _restoreEl = el;
    _restorePlaceholder = el.parentNode
      ? { parent: el.parentNode, nextSibling: el.nextSibling }
      : null;

    pipWin.document.body.append(el);
    pipWin.addEventListener("pagehide", _onPipClose, { once: true });
    return true;
  } catch {
    _activePipWindow = null;
    _restoreEl = null;
    _restorePlaceholder = null;
    return false;
  }
}

/**
 * Close the active PiP window (if any) and restore the element to its
 * original parent.
 */
export function exitDocumentPip(): void {
  if (!_activePipWindow) return;
  try {
    _activePipWindow.close();
  } catch {
    // already closed
  }
  _onPipClose();
}

function _onPipClose(): void {
  if (_restoreEl && _restorePlaceholder) {
    const { parent, nextSibling } = _restorePlaceholder;
    if (nextSibling?.parentNode === parent) {
      parent.insertBefore(_restoreEl, nextSibling);
    } else {
      parent.appendChild(_restoreEl);
    }
  }
  _activePipWindow = null;
  _restoreEl = null;
  _restorePlaceholder = null;
}

/**
 * Reset module state. Test-only.
 * @internal
 */
export function _resetDocumentPip(): void {
  _activePipWindow = null;
  _restoreEl = null;
  _restorePlaceholder = null;
}
