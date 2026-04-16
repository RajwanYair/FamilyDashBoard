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
  ts: number;        // epoch ms
  message: string;
  source?: string;   // filename or 'unhandledrejection'
  lineno?: number;
}

const MAX_ERRORS = 20;
const _buffer: ErrorEntry[] = [];

/**
 * Append an error entry, evicting the oldest if buffer is full.
 */
export function recordError(
  message: string,
  source?: string,
  lineno?: number,
): void {
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
    recordError(
      ev.message ?? "Unknown error",
      ev.filename,
      ev.lineno,
    );
  });

  window.addEventListener(
    "unhandledrejection",
    (ev: PromiseRejectionEvent) => {
      const msg =
        ev.reason instanceof Error
          ? ev.reason.message
          : String(ev.reason ?? "Unhandled rejection");
      recordError(msg, "unhandledrejection");
    },
  );
}

/** Reset installed flag (test helper). */
export function _resetInstalledFlag(): void {
  _installed = false;
}
