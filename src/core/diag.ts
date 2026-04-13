/**
 * FamilyDashBoard v6 — Diagnostic Logger
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
