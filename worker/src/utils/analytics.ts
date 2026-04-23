/**
 * Workers Analytics Engine helpers (V12-EDGE-2b, ADR-029).
 *
 * Writes a single data point per request to the ANALYTICS binding when configured.
 * Fire-and-forget: writeDataPoint() is synchronous and never throws observable errors.
 *
 * Schema:
 *   blobs[0]  — normalised route path (e.g. "/api/weather")
 *   blobs[1]  — HTTP method (GET, POST, …)
 *   blobs[2]  — ENVIRONMENT label ("production" | "preview" | "development")
 *   doubles[0] — HTTP status code (200, 204, 400, …)
 *   indexes[0] — route path (used as the primary index key in the dataset)
 */
import type { AnalyticsEngineDataset } from "../types";

/**
 * Record a single request hit in the Analytics Engine dataset.
 *
 * @param dataset - The bound AnalyticsEngineDataset (env.ANALYTICS). No-ops when undefined.
 * @param method  - HTTP method string (e.g. "GET").
 * @param route   - Normalised route path without query string (e.g. "/api/weather").
 * @param status  - HTTP response status code written after the handler resolves.
 * @param env     - Environment label for segmentation.
 */
export function writeAnalyticsHit(
  dataset: AnalyticsEngineDataset | undefined,
  method: string,
  route: string,
  status: number,
  env: string,
): void {
  if (!dataset) return;
  try {
    dataset.writeDataPoint({
      blobs: [route, method, env],
      doubles: [status],
      indexes: [route],
    });
  } catch {
    // Never surface Analytics Engine errors to callers.
  }
}

/**
 * Derive a normalised route string from a Request URL.
 * Strips query string and hash; returns only the pathname.
 *
 * @param urlOrString - The full request URL string.
 * @returns Pathname component, e.g. "/api/weather".
 */
export function normaliseRoute(urlOrString: string): string {
  try {
    return new URL(urlOrString).pathname;
  } catch {
    return urlOrString.split("?")[0] ?? urlOrString;
  }
}
