/**
 * FamilyDashBoard — Runtime Error Tracker
 *
 * Captures unhandled errors and promise rejections into a circular buffer.
 * Buffer is kept in-memory only (not persisted).
 *
 * Exports:
 *   recordError(msg, source?, lineno?) — add an error entry
 *   getErrors()                        — read all buffered entries (newest last)
 *   clearErrors()                      — empty the buffer
 *   getErrorCount()                    — number of entries currently buffered
 *   installGlobalErrorHandlers()       — wire window.onerror + unhandledrejection
 */

export interface ErrorEntry {
  ts: number; // epoch ms
  message: string;
  source?: string; // filename or 'unhandledrejection'
  lineno?: number;
}

const MAX_ERRORS = 20;
const _buffer: ErrorEntry[] = [];

/**
 * Append an error entry, evicting the oldest if buffer is full.
 */
export function recordError(message: string, source?: string, lineno?: number): void {
  if (_buffer.length >= MAX_ERRORS) _buffer.shift();
  _buffer.push({ ts: Date.now(), message: String(message), source, lineno });
}

/**
 * Return a shallow copy of all buffered error entries.
 */
export function getErrors(): ErrorEntry[] {
  return [..._buffer];
}

/**
 * Clear the error buffer.
 */
export function clearErrors(): void {
  _buffer.length = 0;
}

/**
 * Return the number of errors currently buffered.
 */
export function getErrorCount(): number {
  return _buffer.length;
}

/**
 * Format a single error entry into a display string.
 */
export function formatErrorEntry(e: ErrorEntry): string {
  const t = new Date(e.ts).toISOString().slice(11, 23); // HH:MM:SS.mmm
  const src = e.source ? ` @ ${e.source.split("/").pop() ?? e.source}` : "";
  const line = e.lineno ? `:${e.lineno}` : "";
  return `[${t}]${src}${line} ${e.message}`;
}

/**
 * Install window-level error handlers so uncaught exceptions and rejected
 * promises are captured automatically. Safe to call multiple times (idempotent).
 */
let _installed = false;
export function installGlobalErrorHandlers(): void {
  if (_installed) return;
  _installed = true;

  window.addEventListener("error", (ev: ErrorEvent) => {
    recordError(ev.message ?? "Unknown error", ev.filename, ev.lineno);
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const msg =
      ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? "Unhandled rejection");
    recordError(msg, "unhandledrejection");
  });
}

/** Reset installed flag (test helper). */
export function _resetInstalledFlag(): void {
  _installed = false;
}

// ── Sprint 125: Error rate calculation ───────────────────────────────────────

/**
 * Calculate the error rate: errors per minute since the first recorded error.
 * Returns 0 if no errors exist.
 */
export function errorRate(): number {
  if (_buffer.length === 0) return 0;
  const first = _buffer[0];
  if (!first) return 0;
  const oldest = first.ts;
  const spanMs = Date.now() - oldest;
  if (spanMs <= 0) return _buffer.length; // all errors in same instant
  return _buffer.length / (spanMs / 60_000);
}

// ── Sprint 161: Error rate trend tracking ────────────────────────────────────

const ERROR_TREND_MAX = 10;
const _errorTrend: number[] = [];

/**
 * Sample the current error rate and add to the trend buffer.
 * Called periodically (e.g., every 60s from a timer).
 */
export function sampleErrorTrend(): void {
  _errorTrend.push(Math.round(errorRate() * 100) / 100);
  if (_errorTrend.length > ERROR_TREND_MAX) _errorTrend.shift();
}

/**
 * Return the last N error rate samples.
 */
export function getErrorTrend(): readonly number[] {
  return [..._errorTrend];
}

/** @internal Test helper — reset trend buffer between tests. */
export function _resetTrend(): void {
  _errorTrend.length = 0;
}
