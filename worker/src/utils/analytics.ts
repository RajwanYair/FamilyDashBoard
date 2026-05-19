/**
 * Workers Analytics Engine helpers (V12-EDGE-2b, ADR-029).
 *
 * Writes a single data point per request to the ANALYTICS binding when configured.
 * Fire-and-forget: writeDataPoint() is synchronous and never throws observable errors.
 *
 * Schema — request hit:
 *   blobs[0]  — normalised route path (e.g. "/api/weather")
 *   blobs[1]  — HTTP method (GET, POST, …)
 *   blobs[2]  — ENVIRONMENT label ("production" | "preview" | "development")
 *   doubles[0] — HTTP status code (200, 204, 400, …)
 *   indexes[0] — route path (used as the primary index key in the dataset)
 *
 * Schema — vectorize shadow metrics:
 *   blobs[0]  — event type ("vectorize-shadow")
 *   doubles[0] — agrees
 *   doubles[1] — vectorizeWouldDrop
 *   doubles[2] — vectorizeWouldKeep
 *   doubles[3] — upserted
 *   indexes[0] — "vectorize-shadow"
 */
import type { AnalyticsEngineDataset } from "../types";
import type { ShadowRunMetrics } from "./vectorize-client";

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

/**
 * Write Vectorize shadow-run precision metrics to Analytics Engine.
 *
 * Enables the 30-day precision@10 gate (ADR-090) that gates promotion of
 * Vectorize semantic dedup over SimHash. No-ops when the ANALYTICS binding
 * is not configured.
 *
 * @param dataset - The bound AnalyticsEngineDataset (env.ANALYTICS). No-ops when undefined.
 * @param metrics - ShadowRunMetrics returned by vectorizeShadowRun().
 */
export function writeVectorizeShadowMetrics(
  dataset: AnalyticsEngineDataset | undefined,
  metrics: ShadowRunMetrics,
): void {
  if (!dataset) return;
  try {
    dataset.writeDataPoint({
      blobs: ["vectorize-shadow"],
      doubles: [
        metrics.agrees,
        metrics.vectorizeWouldDrop,
        metrics.vectorizeWouldKeep,
        metrics.upserted,
      ],
      indexes: ["vectorize-shadow"],
    });
  } catch {
    // Never surface Analytics Engine errors to callers.
  }
}
