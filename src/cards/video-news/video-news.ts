/**
 * FamilyDashBoard — Video News Card Logic
 *
 * Renders live-news channel iframes inside the dashboard.
 * Supports 6 Israeli news channels via StreamDescriptor.
 *
 * Layout modes:
 *   normal    — one active channel shown, others hidden; channel tabs for switching
 *   maximized — all channels visible simultaneously in a responsive grid
 *
 * See: docs/adr/ADR-019-video-card-csp.md
 */

import "./video-news.css";
import { diagLog } from "../../core/diag";
import { getStreamDescriptor, listChannels } from "./video-news-adapter";
import type { VideoChannelId } from "../../types/stream";

// ── Internal state ─────────────────────────────────────────────────────────

let _activeChannel: VideoChannelId = "c14";
let _root: HTMLElement | null = null;

// ── DOM helpers ────────────────────────────────────────────────────────────

function getTile(id: VideoChannelId): HTMLElement | null {
  return _root?.querySelector<HTMLElement>(`.video-news__tile[data-channel="${id}"]`) ?? null;
}

function getTab(id: VideoChannelId): HTMLElement | null {
  return _root?.querySelector<HTMLElement>(`.video-news__tab[data-channel="${id}"]`) ?? null;
}

/** Update the active channel label in the card header mini-info span. */
function updateMiniInfo(): void {
  const desc = getStreamDescriptor(_activeChannel);
  const mini = document.getElementById("mini-video-news");
  if (mini) mini.textContent = desc.titleHe;
}

// ── Channel switching ──────────────────────────────────────────────────────

/**
 * Switch the visible channel in single-channel (normal) mode.
 * In maximized mode all tiles are visible — this only updates the "active" highlight.
 */
export function switchChannel(channelId: VideoChannelId): void {
  _activeChannel = channelId;

  // Update tile visibility
  listChannels().forEach((id) => {
    const tile = getTile(id);
    if (!tile) return;
    tile.classList.toggle("video-news__tile--active", id === channelId);
  });

  // Update tab highlight
  listChannels().forEach((id) => {
    const tab = getTab(id);
    if (!tab) return;
    tab.classList.toggle("video-news__tab--active", id === channelId);
    tab.setAttribute("aria-current", id === channelId ? "true" : "false");
  });

  updateMiniInfo();
  diagLog(`[video-news] switched to channel: ${channelId}`);
}

/** Cycle to the next channel. */
export function cycleChannel(): void {
  const channels = listChannels();
  const idx = channels.indexOf(_activeChannel);
  const next = channels[(idx + 1) % channels.length] ?? "c14";
  switchChannel(next);
}

// ── Legacy compat (kept for tests and destroyVideoNews) ───────────────────

export function loadChannel(channelId: VideoChannelId): void {
  switchChannel(channelId);
}

export function toggleMute(): void {
  // With iframe embeds, muting is controlled per-iframe via URL params.
  // This is a no-op kept for API compatibility.
  diagLog("[video-news] toggleMute: mute is controlled via iframe URL params");
}

/** Returns whether the active channel starts muted (as declared in its StreamDescriptor). */
export function isMuted(): boolean {
  return getStreamDescriptor(_activeChannel).muted;
}

export function getActiveChannel(): VideoChannelId {
  return _activeChannel;
}

// ── Build DOM ──────────────────────────────────────────────────────────────

/**
 * Build the channel tab strip at the top of the card body.
 * @param onSwitch - callback when a tab is clicked
 */
function buildChannelTabs(onSwitch: (id: VideoChannelId) => void): HTMLElement {
  const tabs = document.createElement("div");
  tabs.className = "video-news__tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "ערוצי חדשות");

  listChannels().forEach((id) => {
    const desc = getStreamDescriptor(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "video-news__tab";
    btn.dataset["channel"] = id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", id === _activeChannel ? "true" : "false");
    btn.setAttribute("aria-current", id === _activeChannel ? "true" : "false");
    btn.textContent = desc.titleHe;
    if (id === _activeChannel) btn.classList.add("video-news__tab--active");

    btn.addEventListener("click", () => {
      onSwitch(id);
    });
    tabs.appendChild(btn);
  });

  return tabs;
}

/**
 * Build a single channel tile containing the iframe embed.
 * All tiles are created at init — CSS controls visibility.
 */
function buildChannelTile(id: VideoChannelId): HTMLElement {
  const desc = getStreamDescriptor(id);

  const tile = document.createElement("div");
  tile.className = "video-news__tile";
  tile.dataset["channel"] = id;
  if (id === _activeChannel) tile.classList.add("video-news__tile--active");

  const label = document.createElement("div");
  label.className = "video-news__tile-label";
  label.textContent = desc.titleHe;
  tile.appendChild(label);

  const iframe = document.createElement("iframe");
  iframe.className = "video-news__iframe";
  iframe.src = desc.url;
  iframe.title = desc.titleHe;
  iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
  tile.appendChild(iframe);

  return tile;
}

// ── Public init / destroy ──────────────────────────────────────────────────

/**
 * Wire up DOM for the video-news card.
 * Called by FdbVideoNewsCard.connect().
 *
 * @param root - The card body element (.card__body)
 * @param initialChannel - Channel to activate first (default: 'c14')
 */
export function initVideoNews(root: HTMLElement, initialChannel: VideoChannelId = "c14"): void {
  _root = root;
  _activeChannel = initialChannel;

  // Channel tabs
  const tabs = buildChannelTabs(switchChannel);
  root.appendChild(tabs);

  // Grid of all channel tiles
  const grid = document.createElement("div");
  grid.className = "video-news__grid";
  grid.setAttribute("role", "region");
  grid.setAttribute("aria-label", "שידורים חיים");

  listChannels().forEach((id) => {
    grid.appendChild(buildChannelTile(id));
  });

  root.appendChild(grid);

  updateMiniInfo();
  diagLog(`[video-news] init complete — ${listChannels().length} channels loaded`);
}

/** Release all resources. Called on disconnectedCallback. */
export function destroyVideoNews(): void {
  if (_root) {
    // Remove all iframes to stop loading/playback
    _root.querySelectorAll<HTMLIFrameElement>(".video-news__iframe").forEach((iframe) => {
      iframe.src = "about:blank";
    });
  }
  _root = null;
  diagLog("[video-news] destroyed");
}
