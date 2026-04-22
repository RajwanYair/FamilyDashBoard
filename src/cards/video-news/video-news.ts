/**
 * FamilyDashBoard — Video News Card
 *
 * Renders a live-news video stream inside the dashboard.
 * Supports 4 Israeli news channels via a configurable StreamDescriptor.
 *
 * See: docs/adr/ADR-019-video-card-csp.md
 * See: ROADMAP §4.11 Stream V11-CARD-VIDEO
 *
 * Integration status:
 *   Stream URLs are placeholders pending research sprint v11.1-sprint-1.
 *   The card renders an "awaiting stream" state until URLs are confirmed.
 */

import "./video-news.css";
import { diagLog } from "../../core/diag";
import { getStreamDescriptor, listChannels } from "./video-news-adapter";
import type { VideoChannelId } from "../../types/stream";
import type { StreamDescriptor } from "../../types/stream";

// ── DOM references ─────────────────────────────────────────────────────────

interface VideoNewsEl {
  container: HTMLElement | null;
  video: HTMLVideoElement | null;
  overlay: HTMLElement | null;
  channelLabel: HTMLElement | null;
  muteBtn: HTMLButtonElement | null;
  channelBtn: HTMLButtonElement | null;
  errorState: HTMLElement | null;
}

const el: VideoNewsEl = {
  container: null,
  video: null,
  overlay: null,
  channelLabel: null,
  muteBtn: null,
  channelBtn: null,
  errorState: null,
};

// ── Internal state ─────────────────────────────────────────────────────────

let _activeChannel: VideoChannelId = "c14";
let _muted = true;
let _retryHandle: ReturnType<typeof setTimeout> | null = null;
let _retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000]; // 30s → 2min → 10min

// ── Player lifecycle ───────────────────────────────────────────────────────

/**
 * Load (or reload) a channel into the <video> element.
 * Clears any pending retry timer before loading.
 */
export function loadChannel(channelId: VideoChannelId): void {
  _activeChannel = channelId;
  _retryCount = 0;
  clearRetry();

  const desc = getStreamDescriptor(channelId);
  diagLog(`[video-news] loading channel ${channelId} (mode=${desc.mode})`);

  if (!el.video) {
    diagLog("[video-news] <video> element not found, skipping load");
    return;
  }

  hideError();
  el.video.poster = desc.poster ?? "";
  setChannelLabel(desc);

  if (desc.url === "" || desc.url.startsWith("/api/video/")) {
    // Placeholder URL — stream not yet confirmed; show pending state
    showError("שידור בבנייה · Stream URL pending research");
    diagLog(`[video-news] channel ${channelId} URL not yet configured`);
    return;
  }

  el.video.src = desc.url;
  el.video.muted = _muted;
  el.video.load();

  if (desc.mode !== "iframe") {
    void el.video.play().catch((err: unknown) => {
      // Autoplay blocked — show play-to-start overlay; not an error
      diagLog(`[video-news] autoplay blocked: ${String(err)}`);
      showPlayPrompt();
    });
  }
}

/** Cycle to the next channel in the channel list. */
export function cycleChannel(): void {
  const channels = listChannels();
  const idx = channels.indexOf(_activeChannel);
  const next = channels[(idx + 1) % channels.length] ?? "c14";
  loadChannel(next);
}

/** Toggle audio mute. */
export function toggleMute(): void {
  _muted = !_muted;
  if (el.video) {
    el.video.muted = _muted;
  }
  updateMuteBtn();
  diagLog(`[video-news] mute=${String(_muted)}`);
}

// ── Retry logic ────────────────────────────────────────────────────────────

function scheduleRetry(): void {
  if (_retryCount >= MAX_RETRIES) {
    showError("שידור לא זמין · Stream unavailable");
    diagLog(`[video-news] giving up after ${MAX_RETRIES} retries`);
    return;
  }
  const delay = RETRY_DELAYS_MS[_retryCount] ?? 600_000;
  _retryCount++;
  diagLog(`[video-news] retry ${_retryCount} in ${delay / 1000}s`);
  _retryHandle = setTimeout(() => {
    loadChannel(_activeChannel);
  }, delay);
}

function clearRetry(): void {
  if (_retryHandle !== null) {
    clearTimeout(_retryHandle);
    _retryHandle = null;
  }
}

// ── Event handlers ─────────────────────────────────────────────────────────

function onVideoError(): void {
  const code = el.video?.error?.code ?? -1;
  diagLog(`[video-news] playback error code=${code} channel=${_activeChannel}`);
  showError("שידור לא זמין · נסיון חוזר בקרוב");
  scheduleRetry();
}

function onVideoStalled(): void {
  diagLog(`[video-news] stream stalled channel=${_activeChannel}`);
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function setChannelLabel(desc: StreamDescriptor): void {
  if (el.channelLabel) {
    el.channelLabel.textContent = desc.titleHe;
  }
}

function showError(msg: string): void {
  if (el.errorState) {
    el.errorState.textContent = msg;
    el.errorState.hidden = false;
  }
  if (el.video) {
    el.video.hidden = true;
  }
}

function hideError(): void {
  if (el.errorState) {
    el.errorState.hidden = true;
  }
  if (el.video) {
    el.video.hidden = false;
  }
}

function showPlayPrompt(): void {
  // Surfaces a big ▶ overlay so a single click starts playback
  if (el.container) {
    el.container.classList.add("video-news--play-prompt");
  }
}

function updateMuteBtn(): void {
  if (!el.muteBtn) return;
  el.muteBtn.setAttribute("aria-pressed", String(_muted));
  el.muteBtn.textContent = _muted ? "🔇" : "🔊";
  el.muteBtn.title = _muted ? "הפעל שמע (M)" : "השתק (M)";
}

// ── Reduced-motion support ─────────────────────────────────────────────────

let _reducedMotionMql: MediaQueryList | null = null;

function onReducedMotionChange(e: MediaQueryListEvent): void {
  if (!el.video) return;
  if (e.matches) {
    el.video.pause();
    diagLog("[video-news] paused: prefers-reduced-motion");
  } else {
    void el.video.play().catch(() => undefined);
  }
}

// ── Public init / destroy ──────────────────────────────────────────────────

/**
 * Wire up DOM references and event listeners for the video-news card.
 * Called by the FdbVideoNewsCard custom element on connectedCallback.
 */
export function initVideoNews(root: HTMLElement, initialChannel: VideoChannelId = "c14"): void {
  el.container = root;
  el.video = root.querySelector<HTMLVideoElement>(".video-news__video");
  el.overlay = root.querySelector<HTMLElement>(".video-news__overlay");
  el.channelLabel = root.querySelector<HTMLElement>(".video-news__channel-label");
  el.muteBtn = root.querySelector<HTMLButtonElement>(".video-news__mute-btn");
  el.channelBtn = root.querySelector<HTMLButtonElement>(".video-news__channel-btn");
  el.errorState = root.querySelector<HTMLElement>(".video-news__error");

  if (el.video) {
    el.video.addEventListener("error", onVideoError);
    el.video.addEventListener("stalled", onVideoStalled);
  }

  el.muteBtn?.addEventListener("click", toggleMute);
  el.channelBtn?.addEventListener("click", cycleChannel);

  // Play-prompt click resumes playback
  root.addEventListener("click", () => {
    if (root.classList.contains("video-news--play-prompt")) {
      root.classList.remove("video-news--play-prompt");
      void el.video?.play().catch(() => undefined);
    }
  });

  // Reduced-motion
  _reducedMotionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
  _reducedMotionMql.addEventListener("change", onReducedMotionChange);
  if (_reducedMotionMql.matches && el.video) {
    el.video.pause();
  }

  updateMuteBtn();
  loadChannel(initialChannel);
  diagLog("[video-news] init complete");
}

/** Release all resources. Called on disconnectedCallback. */
export function destroyVideoNews(): void {
  clearRetry();
  if (el.video) {
    el.video.pause();
    el.video.removeAttribute("src");
    el.video.removeEventListener("error", onVideoError);
    el.video.removeEventListener("stalled", onVideoStalled);
  }
  if (_reducedMotionMql) {
    _reducedMotionMql.removeEventListener("change", onReducedMotionChange);
    _reducedMotionMql = null;
  }
  // Reset el refs
  (Object.keys(el) as (keyof VideoNewsEl)[]).forEach((k) => {
    (el as unknown as Record<string, unknown>)[k] = null;
  });
  diagLog("[video-news] destroyed");
}

/** Expose currently active channel id (for tests). */
export function getActiveChannel(): VideoChannelId {
  return _activeChannel;
}

/** Expose mute state (for tests). */
export function isMuted(): boolean {
  return _muted;
}
