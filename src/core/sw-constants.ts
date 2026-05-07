/**
 * FamilyDashBoard v13 — Service Worker ↔ Client Message Types
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
