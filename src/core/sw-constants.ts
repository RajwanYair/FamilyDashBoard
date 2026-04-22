/**
 * FamilyDashBoard v10.0.0 — Service Worker ↔ Client Message Types (Sprint 44)
 *
 * Typed union for all messages sent between the page and the SW.
 * Shared constants ensure string literals are never duplicated.
 */

// ── Cache name constants (Stream SW, v7.21) ───────────────────────────────────

/**
 * Base SW cache name — matches the `CACHE_NAME` prefix in `sw.js`.
 * Used by the client to communicate which cache to expect or purge.
 */
export const CACHE_NAME = "familydashboard-v" as const;

/**
 * localStorage key used to persist the last-activated SW version.
 * Written by the SW after activation; read by the diagnostics overlay.
 */
export const SW_VERSION_KEY = "__fdb_sw_version__" as const;

// ── Per-origin API cache TTL config (Stream SW) ───────────────────────────────

/**
 * Maximum cache age in seconds for each API origin.
 * The SW compares `Date.now() - cachedDate` against this value; if the
 * cached response is older, it forces a network refresh even when offline
 * mode has otherwise been requested.
 *
 * Defaults (used by sw.js when an origin is not listed): 3600 s (1 hour).
 *
 * Design notes:
 *  - Real-time feeds (stocks, crypto) → short TTL (5 min)
 *  - Weather / exchange rates → medium TTL (30 min)
 *  - Hebcal / Sefaria / Tzeva Adom → long TTL (6 h)
 *  - CORS proxies share the TTL of their upstream payloads; the shorter
 *    per-card in-memory TTL (cGet/cSet) still governs the actual refresh rate.
 */
export const CACHE_TTL_BY_ORIGIN: Readonly<Record<string, number>> = {
  // Real-time: 5 minutes
  "query1.finance.yahoo.com": 300,
  "api.coingecko.com": 300,
  // Weather + exchange rates: 30 minutes
  "api.open-meteo.com": 1800,
  "open.er-api.com": 1800,
  "exchangerate-api.com": 1800,
  // Calendars + civic alerts: 6 hours
  "www.hebcal.com": 21600,
  "sefaria.org": 21600,
  "tzevaadom.co.il": 21600,
  // CORS proxies — inherit a conservative 10-minute TTL
  "api.allorigins.win": 600,
  "api.codetabs.com": 600,
  "corsproxy.io": 600,
} as const;

/** Default API cache TTL in seconds (1 hour) when the origin is not listed. */
export const CACHE_TTL_DEFAULT_S = 3600 as const;

// ── Message type constants ────────────────────────────────────────────────────

/** Tell the waiting SW to activate immediately. */
export const SW_MSG_SKIP_WAITING = "SKIP_WAITING" as const;

/** SW broadcasts this after it takes control. */
export const SW_MSG_VERSION_ACTIVATED = "VERSION_ACTIVATED" as const;

// ── Outbound: page → SW messages ─────────────────────────────────────────────

export interface SwMsgSkipWaiting {
  type: typeof SW_MSG_SKIP_WAITING;
}

// ── Inbound: SW → page messages ──────────────────────────────────────────────

export interface SwMsgVersionActivated {
  type: typeof SW_MSG_VERSION_ACTIVATED;
  version: string;
}

/** Union of all messages the SW can broadcast to the page. */
export type SwInboundMessage = SwMsgVersionActivated;

/** Union of all messages the page can send to the SW. */
export type SwOutboundMessage = SwMsgSkipWaiting;

// ── Type guards ───────────────────────────────────────────────────────────────

/** Returns true if `data` is a `SwMsgVersionActivated` payload. */
export function isVersionActivatedMsg(data: unknown): data is SwMsgVersionActivated {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === SW_MSG_VERSION_ACTIVATED
  );
}

/** Returns true if `data` is a `SwMsgSkipWaiting` payload. */
export function isSkipWaitingMsg(data: unknown): data is SwMsgSkipWaiting {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === SW_MSG_SKIP_WAITING
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Send a typed message to the active service worker.
 * No-op if no controller is present.
 */
export function postMessageToSW(msg: SwOutboundMessage): void {
  navigator.serviceWorker?.controller?.postMessage(msg);
}
