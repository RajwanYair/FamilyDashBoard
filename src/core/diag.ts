/**
 * FamilyDashBoard v7 — Diagnostic Logger
 *
 * Ring buffer for diagnostic messages, displayed in the diagnostic overlay (D key).
 */

import { DIAG_BUFFER_SIZE, DIAG_DISPLAY_LIMIT } from "./constants";

export interface DiagEntry {
  ts: number;
  msg: string;
}

const buffer: DiagEntry[] = [];

/**
 * Log a diagnostic message to the ring buffer.
 */
export function diagLog(msg: string): void {
  buffer.push({ ts: Date.now(), msg });
  if (buffer.length > DIAG_BUFFER_SIZE) {
    buffer.shift();
  }
}

/**
 * Get recent diagnostic entries (newest first).
 */
export function getDiagEntries(
  limit: number = DIAG_DISPLAY_LIMIT,
): DiagEntry[] {
  return buffer.slice(-limit).reverse();
}

/**
 * Clear all diagnostic entries.
 */
export function clearDiag(): void {
  buffer.length = 0;
}

/**
 * Format a diagnostic entry for display.
 */
export function formatDiagEntry(entry: DiagEntry): string {
  const d = new Date(entry.ts);
  const time = d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `[${time}] ${entry.msg}`;
}

// ── Sprint 60: Provider error normalization ────────────────────────────────

/**
 * Classify the severity of a provider error (Sprint 60).
 *
 * - `"network"` — fetch/network-level failure (offline, DNS, CORS)
 * - `"parse"`   — response received but JSON/XML parse failed
 * - `"timeout"` — request exceeded the fetch timeout
 * - `"upstream"` — upstream API returned a non-OK HTTP status
 * - `"unknown"`  — unclassified error
 */
export type ProviderErrorKind =
  | "network"
  | "parse"
  | "timeout"
  | "upstream"
  | "unknown";

/**
 * Derive a standardized error kind from an arbitrary caught error (Sprint 60).
 *
 * Logs the result at FDB-062 diagnostic level.
 *
 * @param err        - The caught error
 * @param providerId - Provider identifier for log context
 * @returns Normalized error kind
 */
export function classifyProviderError(
  err: unknown,
  providerId: string,
): ProviderErrorKind {
  let kind: ProviderErrorKind = "unknown";

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("cors")
    ) {
      kind = "network";
    } else if (msg.includes("timeout") || msg.includes("aborted")) {
      kind = "timeout";
    } else if (
      msg.includes("json") ||
      msg.includes("parse") ||
      msg.includes("syntax")
    ) {
      kind = "parse";
    } else if (msg.includes("http") || msg.includes("status")) {
      kind = "upstream";
    }
  }

  diagLog(`FDB-062: [${providerId}] error kind=${kind} — ${String(err)}`);
  return kind;
}
