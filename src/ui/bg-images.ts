/**
 * FamilyDashBoard v13 — Background Image Rotation
 *
 * Crossfades between user-configured HTTPS image URLs every 30 minutes.
 * Config: `bgImages: string[]` — array of HTTPS image URLs.
 */

import { loadConfig } from "../core/config";
import { diagLog } from "../core/diag";
import { MS_PER_MIN } from "../core/constants";

export const BG_INTERVAL_MS = 30 * MS_PER_MIN; // 30 minutes

let _layerA: HTMLDivElement | null = null;
let _layerB: HTMLDivElement | null = null;
let _currentIdx = 0;
let _intervalId: ReturnType<typeof setInterval> | null = null;

export function isValidBgUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function setLayer(layer: HTMLDivElement, url: string): void {
  layer.style.backgroundImage = `url(${JSON.stringify(url)})`;
}

/** Advance to the next image with a crossfade. Called by interval. */
export function rotateBgImage(): void {
  const { bgImages } = loadConfig();
  const validImages = bgImages.filter(isValidBgUrl);
  if (!validImages.length || !_layerA || !_layerB) return;

  _currentIdx = (_currentIdx + 1) % validImages.length;
  const nextUrl = validImages[_currentIdx] ?? validImages[0];
  if (!nextUrl) return;

  // Preload image then crossfade layers
  const img = new Image();
  img.onload = () => {
    if (!_layerA || !_layerB) return;
    setLayer(_layerB, nextUrl);
    _layerB.style.opacity = "0.35";
    _layerA.style.opacity = "0";
    // Swap references so A is always the visible layer
    const tmp = _layerA;
    _layerA = _layerB;
    _layerB = tmp;
  };
  img.src = nextUrl;
}

/** Initialize background image rotation. No-op when bgImages is empty. */
export function initBgImages(): void {
  const { bgImages } = loadConfig();
  const validImages = bgImages.filter(isValidBgUrl);

  if (!validImages.length) {
    diagLog("[bg-images] No HTTPS images configured — skipping");
    return;
  }

  const baseStyle = [
    "position:fixed",
    "inset:0",
    "z-index:0",
    "background-size:cover",
    "background-position:center",
    "background-repeat:no-repeat",
    "transition:opacity 2s ease",
    "pointer-events:none",
  ].join(";");

  _layerA = document.createElement("div");
  _layerA.id = "bg-layer-a";
  _layerA.style.cssText = baseStyle + ";opacity:0.35";

  _layerB = document.createElement("div");
  _layerB.id = "bg-layer-b";
  _layerB.style.cssText = baseStyle + ";opacity:0";

  const body = document.body;
  body.insertBefore(_layerB, body.firstChild);
  body.insertBefore(_layerA, body.firstChild);

  _currentIdx = 0;
  const firstUrl = validImages[0];
  if (firstUrl) setLayer(_layerA, firstUrl);

  if (_intervalId !== null) clearInterval(_intervalId);
  _intervalId = setInterval(rotateBgImage, BG_INTERVAL_MS);

  diagLog(`[bg-images] Initialized with ${validImages.length} image(s)`);
}

/**
 * Reset all module-level state to its initial values.
 * **For tests only** — call in `afterEach` instead of `vi.resetModules()`.
 *
 * @internal
 */
export function _resetForTest(): void {
  if (_intervalId !== null) clearInterval(_intervalId);
  _intervalId = null;
  _layerA = null;
  _layerB = null;
  _currentIdx = 0;
}
