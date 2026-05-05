/**
 * src/types/mcp.ts — D1/X11 MCP bridge public contract (ADR-066)
 *
 * Re-exported by src/core/mcp-bridge.ts. Companion implementations
 * import these types to ensure wire-protocol compatibility.
 */

/** All supported tool names exposed by the MCP bridge. */
export type McpToolName =
  | "today.calendar"
  | "today.hebrew_cal"
  | "today.alerts"
  | "today.weather"
  | "today.countdown"
  | "today.synthesis";

/** Inbound request from the companion process via BroadcastChannel. */
export interface McpRequest {
  type: "fdb-mcp/request";
  /** Companion-generated request ID (UUID). Used for replay protection. */
  id: string;
  tool: McpToolName;
  args?: Record<string, unknown>;
  /** Companion clock (ms since epoch) — informational only. */
  ts: number;
}

/** Outbound response from the dashboard to the companion. */
export interface McpResponse {
  type: "fdb-mcp/response";
  /** Mirrors the request.id. */
  id: string;
  ok: boolean;
  /** Deep-frozen JSON snapshot of the requested card state. */
  data?: unknown;
  error?: { code: string; message: string };
  /** Dashboard clock (ms since epoch). */
  ts: number;
}

/** Discriminated union of all channel messages. */
export type McpMessage = McpRequest | McpResponse;
