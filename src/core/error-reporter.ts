/**
 * FamilyDashBoard v13 — Error Reporter
 *
 * Lightweight client-side telemetry: batches runtime errors and POSTs them
 * to the Cloudflare Worker `POST /api/errors` endpoint.
 *
 * Design:
 *   - Fire-and-forget (best-effort, non-blocking)
 *   - Debounced: waits 5 seconds before sending, groups bursts into one request
 *   - Only fires when the Worker is reachable (isWorkerEnabled())
 *   - Max 20 errors per batch (matches server limit)
 *   - Silently ignores all network/response errors
 */

import { WORKER_BASE_URL, isWorkerEnabled } from "./constants";
import type { ErrorEntry } from "./error-tracker";

const REPORT_DEBOUNCE_MS = 5_000;
const ERRORS_ROUTE = "/api/errors";

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pending: ErrorEntry[] = [];

/**
 * Queue errors for reporting. The actual POST is debounced so rapid bursts
 * are grouped into a single request.
 *
 * @param errors - Error entries to report (e.g. from getErrors())
 */
export function reportErrors(errors: ErrorEntry[]): void {
  if (!isWorkerEnabled()) return;
  if (errors.length === 0) return;

  // Merge new errors into pending, deduplicate by ts+message
  for (const e of errors) {
    const dup = _pending.some((p) => p.ts === e.ts && p.message === e.message);
    if (!dup) _pending.push(e);
  }

  // Debounce: reset timer on each call
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    void _flush();
  }, REPORT_DEBOUNCE_MS);
}

/** Flush pending errors to the Worker (called after debounce). */
async function _flush(): Promise<void> {
  const batch = _pending.splice(0, 20);
  if (batch.length === 0) return;

  try {
    await fetch(`${WORKER_BASE_URL}${ERRORS_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      // Keep beacon from blocking page unload
      keepalive: true,
    });
  } catch {
    // Best-effort — silently discard on network failure
  }
}

/** Flush immediately without waiting for debounce (e.g. on page unload). */
export function flushErrorReport(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  void _flush();
}

/** @internal Reset state for tests. */
export function _resetReporter(): void {
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);
  _debounceTimer = null;
  _pending = [];
}

/** @internal Expose pending queue for tests. */
export function _getPending(): ErrorEntry[] {
  return [..._pending];
}
