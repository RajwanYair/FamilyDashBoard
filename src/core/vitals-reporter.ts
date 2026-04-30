/**
 * FamilyDashBoard v13 — Web Vitals Reporter (v11.0-OBS-1)
 *
 * Reads the collected vitals from perf.ts after the page has settled (30 s)
 * and reports them to the worker via the existing error-reporter batcher.
 *
 * Vitals are sent as structured ErrorEntry records with:
 *   source  : "web-vitals"
 *   message : "lcp=1234ms cls=0.05 inp=80ms fcp=900ms ttfb=200ms startup=3500ms"
 *   ts      : Date.now()
 *
 * This lets us piggyback on the existing `/api/errors` ingestion pipeline
 * (ADR-016) without a new worker route.  A dedicated `/api/vitals` route
 * can be introduced in v12 once volume justifies separation.
 *
 * Design constraints:
 *   - Fire-and-forget; no retry; never throws
 *   - Only fires when the worker is enabled (`isWorkerEnabled()`)
 *   - Only fires once per page load
 *   - Does not delay page initialisation — scheduled via `setTimeout` ≥ 30 s
 */

import { isWorkerEnabled } from "./constants";
import { getPerfVitals, formatVital } from "./perf";
import { reportErrors } from "./error-reporter";

const REPORT_DELAY_MS = 30_000; // 30 s after init — page should be fully settled

let _reported = false;

/**
 * Schedule a one-shot Web Vitals report 30 s after calling this function.
 * Safe to call multiple times — only fires once.
 */
export function scheduleVitalsReport(): void {
  if (_reported) return;
  if (!isWorkerEnabled()) return;

  setTimeout(() => {
    if (_reported) return;
    _reported = true;
    _sendVitals();
  }, REPORT_DELAY_MS);
}

/** Flush the vitals report immediately (e.g. on visibility hidden). */
export function flushVitalsReport(): void {
  if (_reported) return;
  _reported = true;
  _sendVitals();
}

function _sendVitals(): void {
  const v = getPerfVitals();
  const parts: string[] = [];

  if (v.lcp !== null) parts.push(`lcp=${formatVital("lcp", v.lcp)}`);
  if (v.cls !== null) parts.push(`cls=${formatVital("cls", v.cls)}`);
  if (v.inp !== null) parts.push(`inp=${formatVital("inp", v.inp)}`);
  if (v.fcp !== null) parts.push(`fcp=${formatVital("fcp", v.fcp)}`);
  if (v.ttfb !== null) parts.push(`ttfb=${formatVital("ttfb", v.ttfb)}`);
  if (v.startup !== null) parts.push(`startup=${formatVital("startup", v.startup)}`);

  if (parts.length === 0) return; // nothing collected yet

  reportErrors([
    {
      ts: Date.now(),
      message: parts.join(" "),
      source: "web-vitals",
      lineno: 0,
    },
  ]);
}

/** Reset for unit tests. */
export function _resetVitalsReporter(): void {
  _reported = false;
}
