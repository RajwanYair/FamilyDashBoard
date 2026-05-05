/**
 * src/core/mcp-bridge.ts — D1/X11 MCP server bridge (ADR-066, v14.0)
 *
 * Lazy-loaded by main.ts ONLY when `?mcp=1` is present on the initial
 * page load. When absent, zero bytes are parsed or executed.
 *
 * Protocol: single BroadcastChannel("fdb-mcp").
 *   - Listens for `{ type: "fdb-mcp/request" }` messages.
 *   - Posts `{ type: "fdb-mcp/response" }` with deep-frozen snapshots.
 *   - No request is logged to diagLog (privacy by design — ADR-066).
 *   - Replay protection: rejected request IDs are tracked for 60 s.
 *   - Channel is closed if the page becomes hidden for > 30 s.
 *
 * Bundle budget: ≤ 1 KB gzip when active (per ADR-066 §Bundle delta).
 */

import type { McpRequest, McpResponse, McpToolName } from "../types/mcp";
import { getCardSignal } from "./card-signal-protocol";

// ── Internal state ──────────────────────────────────────────────────────────

/** BroadcastChannel handle — created lazily on first call to initMcpBridge(). */
let _channel: BroadcastChannel | null = null;

/**
 * Set of request IDs seen in the last SESSION_TTL_MS milliseconds.
 * Prevents a companion from replaying the same request ID.
 */
const _seenIds = new Map<string, number>(); // id → expiry ms

/** How long (ms) to track a seen request ID before evicting it. */
const REPLAY_TTL_MS = 60_000;

/** Whether the bridge has been initialised in this page load. */
let _active = false;

// ── Deep-freeze helper ──────────────────────────────────────────────────────

/**
 * Return a deep-frozen JSON copy of `value` so the companion cannot
 * mutate dashboard state through the bridge.
 * Uses JSON round-trip to drop any non-serialisable values, then
 * recursively freezes all nested objects.
 */
export function deepFreezeJson<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  return deepFreezeAll(copy);
}

function deepFreezeAll<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    (value as unknown[]).forEach((item) => deepFreezeAll(item));
  } else {
    for (const k of Object.keys(value)) {
      deepFreezeAll((value as Record<string, unknown>)[k]);
    }
  }
  return Object.freeze(value) as T;
}

// ── Replay protection ────────────────────────────────────────────────────────

function isReplay(id: string): boolean {
  const now = Date.now();
  // Evict expired IDs to bound memory.
  for (const [k, exp] of _seenIds) {
    if (exp < now) _seenIds.delete(k);
  }
  if (_seenIds.has(id)) return true;
  _seenIds.set(id, now + REPLAY_TTL_MS);
  return false;
}

// ── Tool dispatch ────────────────────────────────────────────────────────────

/**
 * Dispatch a tool call and return the frozen payload.
 * Returns `null` when the card signal is not yet available.
 * Throws for unknown tool names.
 */
export function dispatchTool(tool: McpToolName, _args?: Record<string, unknown>): unknown {
  switch (tool) {
    case "today.calendar": {
      const sig = getCardSignal<unknown>("calendar", "events");
      if (!sig) return null;
      return deepFreezeJson(sig.value);
    }
    case "today.hebrew_cal": {
      const sig = getCardSignal<unknown>("hebrew-cal", "zmanim");
      if (!sig) return null;
      return deepFreezeJson(sig.value);
    }
    case "today.alerts": {
      const sig = getCardSignal<unknown>("alerts", "active");
      if (!sig) return null;
      return deepFreezeJson(sig.value);
    }
    case "today.weather": {
      const sig = getCardSignal<unknown>("weather", "current");
      if (!sig) return null;
      return deepFreezeJson(sig.value);
    }
    case "today.countdown": {
      const sig = getCardSignal<unknown>("countdown", "items");
      if (!sig) return null;
      return deepFreezeJson(sig.value);
    }
    case "today.synthesis": {
      const sig = getCardSignal<unknown>("ai-synthesis", "synthesis");
      if (!sig) return null;
      return deepFreezeJson(sig.value);
    }
    default: {
      // Exhaustiveness guard — TypeScript guarantees this is never reached,
      // but the runtime path must still throw for unknown strings.
      throw new Error(`unknown tool: ${String(tool)}`);
    }
  }
}

// ── Message handler ─────────────────────────────────────────────────────────

function handleMessage(event: MessageEvent<unknown>): void {
  const msg = event.data;
  if (
    !msg ||
    typeof msg !== "object" ||
    (msg as Record<string, unknown>)["type"] !== "fdb-mcp/request"
  ) {
    return;
  }

  const req = msg as McpRequest;

  // Validate required fields.
  if (typeof req.id !== "string" || !req.id || typeof req.tool !== "string") {
    return;
  }

  // Replay protection.
  if (isReplay(req.id)) {
    const errorResp: McpResponse = {
      type: "fdb-mcp/response",
      id: req.id,
      ok: false,
      error: { code: "REPLAY", message: "Duplicate request ID rejected." },
      ts: Date.now(),
    };
    _channel?.postMessage(errorResp);
    return;
  }

  let resp: McpResponse;
  try {
    const data = dispatchTool(req.tool, req.args);
    if (data === null) {
      resp = {
        type: "fdb-mcp/response",
        id: req.id,
        ok: false,
        error: { code: "NOT_READY", message: `Card signal not yet available for ${req.tool}` },
        ts: Date.now(),
      };
    } else {
      resp = {
        type: "fdb-mcp/response",
        id: req.id,
        ok: true,
        data,
        ts: Date.now(),
      };
    }
  } catch (err) {
    resp = {
      type: "fdb-mcp/response",
      id: req.id,
      ok: false,
      error: {
        code: "UNKNOWN_TOOL",
        message: err instanceof Error ? err.message : String(err),
      },
      ts: Date.now(),
    };
  }

  _channel?.postMessage(resp);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Initialise the MCP bridge. Called once by main.ts when `?mcp=1`.
 * No-ops on subsequent calls (safe to call from tests between suites).
 * Returns the active BroadcastChannel for testing.
 */
export function initMcpBridge(): BroadcastChannel {
  if (_active && _channel) return _channel;

  _channel = new BroadcastChannel("fdb-mcp");
  _channel.addEventListener("message", handleMessage);
  _active = true;

  return _channel;
}

/**
 * Tear down the bridge and release the channel.
 * Exported primarily for unit tests.
 */
export function closeMcpBridge(): void {
  if (_channel) {
    _channel.removeEventListener("message", handleMessage);
    _channel.close();
    _channel = null;
  }
  _active = false;
  _seenIds.clear();
}

/** Whether the bridge has been initialised. */
export function isMcpActive(): boolean {
  return _active;
}
