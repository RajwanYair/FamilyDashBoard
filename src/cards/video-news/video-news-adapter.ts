/**
 * FamilyDashBoard — Video News Adapter
 *
 * Returns a normalised StreamDescriptor for each supported live-news channel.
 * Actual stream URLs must be verified by inspecting each provider's embed/player
 * network traffic (see ROADMAP §4.11 Research Phase for the discovery checklist).
 *
 * Status:
 *   c14     — URL TBD (research sprint v11.1-sprint-1 in progress)
 *   i24     — URL TBD
 *   now14   — URL TBD
 *   arutz7  — URL TBD
 *
 * When a URL is discovered: update the `url` field, set `mode` to 'hls' or
 * 'worker-hls', and fill in `cspHosts` with the actual manifest/segment domains.
 * Remove this comment once all channels are verified.
 */

import type { StreamDescriptor, VideoChannelId } from "../../types/stream";

// ── Channel definitions ────────────────────────────────────────────────────

const CHANNELS: Record<VideoChannelId, StreamDescriptor> = {
  c14: {
    id: "c14",
    titleHe: "ערוץ 14",
    titleEn: "Channel 14",
    mode: "worker-hls", // Default to worker proxy until CORS is confirmed
    url: "/api/video/c14/manifest.m3u8", // Relative to worker base URL (Mode B)
    poster: "/FamilyDashBoard/posters/c14.jpg", // Fallback still (to be added to src/public/)
    refererRequired: true,
    cspHosts: {
      connect: [
        // Populated after research sprint — add manifest host here
        // e.g. "https://cdn.c14.co.il"
      ],
      media: [
        // Populated after research sprint — add segment host here
      ],
    },
  },
  i24: {
    id: "i24",
    titleHe: "i24NEWS",
    titleEn: "i24NEWS",
    mode: "worker-hls",
    url: "/api/video/i24/manifest.m3u8",
    poster: "/FamilyDashBoard/posters/i24.jpg",
    refererRequired: false,
    cspHosts: {
      connect: [],
      media: [],
    },
  },
  now14: {
    id: "now14",
    titleHe: "NOW14",
    titleEn: "NOW14",
    mode: "worker-hls",
    url: "/api/video/now14/manifest.m3u8",
    poster: "/FamilyDashBoard/posters/now14.jpg",
    refererRequired: false,
    cspHosts: {
      connect: [],
      media: [],
    },
  },
  arutz7: {
    id: "arutz7",
    titleHe: "ערוץ 7",
    titleEn: "Arutz Sheva",
    mode: "worker-hls",
    url: "/api/video/arutz7/manifest.m3u8",
    poster: "/FamilyDashBoard/posters/arutz7.jpg",
    refererRequired: true,
    cspHosts: {
      connect: [],
      media: [],
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
