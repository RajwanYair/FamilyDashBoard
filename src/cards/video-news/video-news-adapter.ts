/**
 * FamilyDashBoard — Video News Adapter
 *
 * Returns a normalised StreamDescriptor for each supported live-news channel.
 * All channels use mode:"iframe" — iframes are the only approach that works
 * cross-origin in a static PWA without a proxy worker.
 *
 * YouTube live-stream embeds:
 *   https://www.youtube.com/embed/live_streaming?channel=UCxxxxxxx
 *   If the channel is not currently live, YouTube shows a graceful "not live" page.
 *
 * i24 News uses its own Brightcove-based embed player (confirmed working).
 *
 * Common iframe query params:
 *   autoplay=1  — start immediately (requires muted=1 on most browsers)
 *   mute=1      — muted by default (required for autoplay in Chrome)
 *   controls=1  — show native controls
 *   rel=0       — suppress related video suggestions
 *   modestbranding=1 — minimal YouTube branding
 */

import type { StreamDescriptor, VideoChannelId } from "../../types/stream";

// ── Shared YouTube iframe query params ────────────────────────────────────

const YT_PARAMS = "autoplay=1&mute=1&controls=1&rel=0&modestbranding=1";

function ytLive(channelId: string): string {
  return `https://www.youtube.com/embed/live_streaming?channel=${channelId}&${YT_PARAMS}`;
}

// ── Channel definitions ────────────────────────────────────────────────────

const CHANNELS: Record<VideoChannelId, StreamDescriptor> = {
  c14: {
    id: "c14",
    titleHe: "ערוץ 14",
    titleEn: "Channel 14",
    mode: "iframe",
    // Channel 14 (ערוץ 14) — Israeli right-leaning news channel on YouTube
    url: ytLive("UCPdEWAYBFEDMopvR3xGSP1g"),
    refererRequired: false,
    cspHosts: {
      frame: ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
    },
  },
  i24he: {
    id: "i24he",
    titleHe: "i24NEWS עברית",
    titleEn: "i24NEWS Hebrew",
    mode: "iframe",
    // i24 News — confirmed working Brightcove embed (Hebrew feed)
    url: "https://video.i24news.tv/live/brightcove/he",
    refererRequired: false,
    cspHosts: {
      frame: ["https://video.i24news.tv", "https://players.brightcove.net"],
    },
  },
  i24en: {
    id: "i24en",
    titleHe: "i24NEWS English",
    titleEn: "i24NEWS English",
    mode: "iframe",
    // i24 News — confirmed working Brightcove embed (English feed)
    url: "https://video.i24news.tv/live/brightcove/en",
    refererRequired: false,
    cspHosts: {
      frame: ["https://video.i24news.tv", "https://players.brightcove.net"],
    },
  },
  kan11: {
    id: "kan11",
    titleHe: "כאן 11",
    titleEn: "Kan 11",
    mode: "iframe",
    // KAN (Israel's public broadcaster) — ערוץ 11 on YouTube
    url: ytLive("UCEZkCOQMRmBXJfVFEK5gU0A"),
    refererRequired: false,
    cspHosts: {
      frame: ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
    },
  },
  n12: {
    id: "n12",
    titleHe: "ערוץ 12",
    titleEn: "Channel 12",
    mode: "iframe",
    // Channel 12 / N12 Mako — ערוץ 12 on YouTube
    url: ytLive("UCk_TT_6Qjlx2eEUX-5OIlrA"),
    refererRequired: false,
    cspHosts: {
      frame: ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
    },
  },
  keshet13: {
    id: "keshet13",
    titleHe: "ערוץ 13",
    titleEn: "Keshet 13",
    mode: "iframe",
    // Keshet 13 — ערוץ 13 on YouTube
    url: ytLive("UCxVXANqLAEHRi5yAFdJ_YwA"),
    refererRequired: false,
    cspHosts: {
      frame: ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
    },
  },
  arutz7: {
    id: "arutz7",
    titleHe: "ערוץ 7",
    titleEn: "Arutz Sheva",
    mode: "iframe",
    // Arutz Sheva / Arutz 7 — Israeli right-wing news on YouTube
    url: ytLive("UCG8MBflV3CJ3LQ1SAtLqogg"),
    refererRequired: false,
    cspHosts: {
      frame: ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
    },
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
