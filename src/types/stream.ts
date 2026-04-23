/**
 * FamilyDashBoard — StreamDescriptor Type
 *
 * Identifies a single live-news channel and all integration parameters
 * required to play it inside the video-news card.
 *
 * Used by: src/cards/video-news/video-news-adapter.ts
 * Documented: docs/adr/ADR-019-video-card-csp.md
 */

/** Known live-news channel identifiers. */
export type VideoChannelId = "c14" | "i24he" | "kan11" | "n12" | "keshet13" | "arutz7";

/** Integration mode — determines how the stream is loaded. */
export type VideoIntegrationMode =
  | "hls"             // Native <video> + HLS manifest (Safari or hls.js on Chromium)
  | "iframe"          // Provider's own embed <iframe> (Mode C)
  | "worker-hls";     // Worker-proxied HLS via /api/video/<id>/manifest.m3u8 (Mode B)

/**
 * CSP host lists contributed by a channel's StreamDescriptor.
 * These are merged into the global CSP allow-list on first render.
 */
export interface StreamCspHosts {
  /** Domains to add to `connect-src` (HLS manifest + API). */
  connect?: string[];
  /** Domains to add to `media-src` (HLS segment hosts). */
  media?: string[];
  /** Domains to add to `frame-src` (iframe providers only). */
  frame?: string[];
}

/**
 * A normalised description of one live-news channel.
 * The adapter for each channel returns a `StreamDescriptor`.
 */
export interface StreamDescriptor {
  /** Unique channel identifier. */
  id: VideoChannelId;
  /** Human-readable title (Hebrew). */
  titleHe: string;
  /** Human-readable title (English). */
  titleEn: string;
  /** Integration mode to use for playback. */
  mode: VideoIntegrationMode;
  /**
   * The primary playback URL.
   * - `hls` mode: `.m3u8` manifest URL
   * - `iframe` mode: embed src URL
   * - `worker-hls` mode: worker route path (relative to worker base URL)
   */
  url: string;
  /**
   * Fallback still image shown when the stream is unavailable.
   * Should be a self-hosted image path (no external CDN).
   */
  poster?: string;
  /**
   * If true, the stream server requires a matching Referer header.
   * Worker proxy (Mode B) automatically sets Referer; direct HLS (Mode A)
   * may be blocked by the player depending on the browser's referrer policy.
   */
  refererRequired?: boolean;
  /**
   * Whether the channel starts muted.
   * YouTube iframes must be muted for autoplay to work in most browsers.
   * Only c14 is allowed to start unmuted (user-facing TV channel, primary display).
   */
  muted: boolean;
  /** CSP hosts contributed by this channel. Used by the card to extend the allow-list. */
  cspHosts: StreamCspHosts;
}
