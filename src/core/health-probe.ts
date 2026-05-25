/**
 * FamilyDashBoard — Background Health Probe Consumer (P2/S88)
 *
 * Fetches /api/provider-health from the Cloudflare Worker every 5 minutes
 * and feeds the results into the in-session `provider.ts` health model.
 *
 * This means the diag overlay's provider scorecard shows accurate health
 * state *before* the user's own card fetches have fired — useful for
 * pre-emptively diagnosing a blocked upstream on cold start.
 *
 * Design decisions:
 *   - Only runs when the Worker is reachable (isWorkerEnabled).
 *   - Errors are swallowed — this is purely additive signal.
 *   - The 5-minute poll interval matches the worker-side KV TTL (5 min)
 *     so we never hit a live probe unnecessarily.
 *   - Results are NOT stored persistently — session state only.
 */

import { WORKER_BASE_URL } from "./constants";
import { isWorkerEnabled } from "./constants";
import { diagLog } from "./diag";
import { recordProviderSuccess, recordProviderFailure, recordProviderLatency } from "./provider";

const PROBE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PROBE_URL = `${WORKER_BASE_URL}/api/provider-health`;

export interface WorkerProbeResult {
  id: string;
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  httpStatus: number | null;
  probedAt: string;
}

interface WorkerProbeResponse {
  probed: number;
  ttl: number;
  providers: WorkerProbeResult[];
}

let _probeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch the worker health snapshot and ingest each provider result
 * into the in-session provider health model.
 */
async function fetchAndIngest(): Promise<void> {
  if (!isWorkerEnabled()) return;
  let resp: Response;
  try {
    resp = await fetch(PROBE_URL, { signal: AbortSignal.timeout(10_000) });
  } catch {
    // Network error — silently skip this cycle
    return;
  }
  if (!resp.ok) return;

  let body: WorkerProbeResponse;
  try {
    body = (await resp.json()) as WorkerProbeResponse;
  } catch {
    return;
  }

  if (!Array.isArray(body?.providers)) return;

  for (const p of body.providers) {
    if (typeof p.id !== "string") continue;
    recordProviderLatency(p.id, p.latencyMs);
    if (p.status === "ok") {
      recordProviderSuccess(p.id);
    } else {
      recordProviderFailure(p.id);
    }
  }

  const providerCount = body.providers.length;
  const downCount = body.providers.filter((p) => p.status === "down").length;
  const tag = downCount > 0 ? `⚠️ ${downCount} down` : "✅ all ok";
  diagLog(`[health-probe] Worker probed ${providerCount} providers — ${tag}`);
}

/**
 * Initialise the background health probe polling.
 * Call once during app init (after the worker URL is known to be reachable).
 * Fire one probe immediately, then every PROBE_INTERVAL_MS.
 */
export function initHealthProbe(): void {
  if (_probeTimer !== null) return; // already started
  void fetchAndIngest();
  _probeTimer = setInterval(() => void fetchAndIngest(), PROBE_INTERVAL_MS);
  diagLog("[health-probe] Background probe polling started (5 min interval)");
}

/**
 * Stop background polling. Intended for testing only.
 * @internal
 */
export function _stopHealthProbe(): void {
  // dead-export-ok
  if (_probeTimer !== null) {
    clearInterval(_probeTimer);
    _probeTimer = null;
  }
}
