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
export function getDiagEntries(limit: number = DIAG_DISPLAY_LIMIT): DiagEntry[] {
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
export type ProviderErrorKind = "network" | "parse" | "timeout" | "upstream" | "unknown";

/**
 * Derive a standardized error kind from an arbitrary caught error (Sprint 60).
 *
 * Logs the result at FDB-062 diagnostic level.
 *
 * @param err        - The caught error
 * @param providerId - Provider identifier for log context
 * @returns Normalized error kind
 */
export function classifyProviderError(err: unknown, providerId: string): ProviderErrorKind {
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
    } else if (msg.includes("json") || msg.includes("parse") || msg.includes("syntax")) {
      kind = "parse";
    } else if (msg.includes("http") || msg.includes("status")) {
      kind = "upstream";
    }
  }

  diagLog(`FDB-062: [${providerId}] error kind=${kind} — ${String(err)}`);
  return kind;
}

// ── Structured JSON diagnostics export (V12-OBSERVABILITY) ───────────────────

/** Schema version for the structured diagnostics export. Increment on breaking changes. */
export const DIAG_EXPORT_SCHEMA_VERSION = 1;

/**
 * Structured diagnostics export payload.
 *
 * Use this format when sending diagnostic data to the worker error endpoint
 * or downloading as a support file. The `schemaVersion` field allows consumers
 * to handle multiple export formats without breaking on old payloads.
 */
export interface DiagExport {
  /** Always 1 for this schema. Increment on breaking changes. */
  schemaVersion: typeof DIAG_EXPORT_SCHEMA_VERSION;
  /** App version string from __APP_VERSION__. */
  appVersion: string;
  /** Export generation time (Unix ms). */
  exportedAt: number;
  /** User-agent string at time of export. */
  userAgent: string;
  /** URL of the page at time of export (excludes query params for privacy). */
  pageUrl: string;
  /** All buffered diagnostic entries (newest last). */
  entries: DiagEntry[];
  /** Total entry count since last clearDiag() call. */
  totalCount: number;
}

declare const __APP_VERSION__: string;

/**
 * Build a structured `DiagExport` snapshot of the current diagnostic buffer.
 *
 * This is the canonical format for:
 *   - Downloading diagnostics as a JSON support file
 *   - Sending to the worker `/api/errors` endpoint
 *   - Automated log ingestion / analysis
 *
 * @param limit Maximum entries to include (default: all buffered entries)
 */
export function buildDiagExport(limit?: number): DiagExport {
  const entries = limit !== undefined ? buffer.slice(-limit) : buffer.slice();
  const url = new URL(window.location.href);
  // Strip query params and fragment for privacy
  url.search = "";
  url.hash = "";
  return {
    schemaVersion: DIAG_EXPORT_SCHEMA_VERSION,
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    exportedAt: Date.now(),
    userAgent: navigator.userAgent,
    pageUrl: url.toString(),
    entries,
    totalCount: buffer.length,
  };
}

/**
 * Serialize the current diagnostic buffer to a JSON string using the
 * versioned `DiagExport` schema.
 *
 * Consumers should check `schemaVersion === 1` before parsing.
 */
export function exportDiagJson(limit?: number): string {
  return JSON.stringify(buildDiagExport(limit), null, 2);
}
