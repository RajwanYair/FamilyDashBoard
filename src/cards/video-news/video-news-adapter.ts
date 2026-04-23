/**
 * FamilyDashBoard — Video News Adapter
 *
 * Returns a normalised StreamDescriptor for each supported live-news channel.
 * All channels use mode:"iframe" — iframes are the only approach that works
 * cross-origin in a static PWA without a proxy worker.
 *
 * YouTube live-stream embeds use youtube-nocookie.com for better autoplay
 * compatibility in sandboxed iframes:
 *   https://www.youtube-nocookie.com/embed/live_streaming?channel=UCxxxxxxx
 *   If the channel is not currently live, YouTube shows a graceful "not live" page.
 *
 * i24 News uses its own Brightcove-based embed player (confirmed working).
 * ?muted=1 is appended as a best-effort mute signal to the Brightcove page.
 *
 * Mute policy:
 *   - c14 (Channel 14) is the primary display channel — starts UNMUTED.
 *   - All other channels start muted (browser autoplay policy requires mute=1
 *     for autoplay to function; c14 is an explicit exception).
 *
 * Common iframe query params:
 *   autoplay=1       — start immediately
 *   mute=1 / mute=0  — muted / unmuted (mute=1 required for autoplay in Chrome)
 *   controls=1       — show native controls
 *   rel=0            — suppress related video suggestions
 *   modestbranding=1 — minimal YouTube branding
 *   playsinline=1    — prevent fullscreen takeover on iOS / TV browsers
 */

import type { StreamDescriptor, VideoChannelId } from "../../types/stream";

// ── YouTube iframe URL builders ───────────────────────────────────────────

const YT_BASE = "https://www.youtube-nocookie.com/embed/live_streaming";
const YT_COMMON = "controls=1&rel=0&modestbranding=1&playsinline=1";

const YT_CSP = ["https://www.youtube.com", "https://www.youtube-nocookie.com"];

/** YouTube live-stream embed — channel starts muted (required for autoplay). */
function ytMuted(channelId: string): string {
  return `${YT_BASE}?channel=${channelId}&autoplay=1&mute=1&${YT_COMMON}`;
}

/** YouTube live-stream embed — channel starts unmuted (c14 only, primary display). */
function ytUnmuted(channelId: string): string {
  return `${YT_BASE}?channel=${channelId}&autoplay=1&mute=0&${YT_COMMON}`;
}

// ── Channel definitions ────────────────────────────────────────────────────

const CHANNELS: Record<VideoChannelId, StreamDescriptor> = {
  c14: {
    id: "c14",
    titleHe: "ערוץ 14",
    titleEn: "Channel 14",
    mode: "iframe",
    // Channel 14 (ערוץ 14) — Israeli right-leaning news; PRIMARY channel, unmuted.
    url: ytUnmuted("UCPdEWAYBFEDMopvR3xGSP1g"),
    refererRequired: false,
    muted: false,
    cspHosts: { frame: YT_CSP },
  },
  i24he: {
    id: "i24he",
    titleHe: "i24NEWS עברית",
    titleEn: "i24NEWS Hebrew",
    mode: "iframe",
    // i24 News — Brightcove embed (Hebrew feed). ?muted=1 is a best-effort signal.
    url: "https://video.i24news.tv/live/brightcove/he?muted=1",
    refererRequired: false,
    muted: true,
    cspHosts: {
      frame: ["https://video.i24news.tv", "https://players.brightcove.net"],
    },
  },
  kan11: {
    id: "kan11",
    titleHe: "כאן 11",
    titleEn: "Kan 11",
    mode: "iframe",
    // KAN (Israel's public broadcaster) — ערוץ 11 on YouTube, muted.
    url: ytMuted("UCEZkCOQMRmBXJfVFEK5gU0A"),
    refererRequired: false,
    muted: true,
    cspHosts: { frame: YT_CSP },
  },
  n12: {
    id: "n12",
    titleHe: "ערוץ 12",
    titleEn: "Channel 12",
    mode: "iframe",
    // Channel 12 / N12 Mako — ערוץ 12 on YouTube, muted.
    url: ytMuted("UCk_TT_6Qjlx2eEUX-5OIlrA"),
    refererRequired: false,
    muted: true,
    cspHosts: { frame: YT_CSP },
  },
  keshet13: {
    id: "keshet13",
    titleHe: "ערוץ 13",
    titleEn: "Keshet 13",
    mode: "iframe",
    // Keshet 13 — ערוץ 13 on YouTube, muted.
    url: ytMuted("UCxVXANqLAEHRi5yAFdJ_YwA"),
    refererRequired: false,
    muted: true,
    cspHosts: { frame: YT_CSP },
  },
  arutz7: {
    id: "arutz7",
    titleHe: "ערוץ 7",
    titleEn: "Arutz Sheva",
    mode: "iframe",
    // Arutz Sheva / Arutz 7 — Israeli right-wing news on YouTube, muted.
    url: ytMuted("UCG8MBflV3CJ3LQ1SAtLqogg"),
    refererRequired: false,
    muted: true,
    cspHosts: { frame: YT_CSP },
  },
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Return the StreamDescriptor for a given channel id.
 * Falls back to 'c14' if the id is unknown.
 */
export function getStreamDescriptor(id: VideoChannelId): StreamDescriptor {
  return CHANNELS[id] ?? CHANNELS["c14"];
}

/**
 * Return all available channel ids.
 */
export function listChannels(): VideoChannelId[] {
  return Object.keys(CHANNELS) as VideoChannelId[];
}
