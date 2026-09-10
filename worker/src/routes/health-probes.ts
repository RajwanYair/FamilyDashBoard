/**
 * FamilyDashBoard Worker — GET /api/provider-health (P2)
 *
 * Runs lightweight synthetic HEAD probes against each critical upstream
 * and returns a JSON provider-health snapshot. Results are cached in KV
 * for 5 minutes so that every user request within a window gets the same
 * snapshot without burning upstream rate limits.
 *
 * Used by the client `health-probe.ts` module which feeds results into
 * the in-session `provider.ts` health model so the diag overlay can show
 * root-cause information even before the user card fires its own fetch.
 *
 * Probed upstreams (read-only HEAD or tiny GET — no rate-limit risk):
 *   open-meteo     — https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0
 *   hebcal         — https://www.hebcal.com/shabbat?cfg=json&geonameid=281184
 *   yahoo-finance  — https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD
 *   pikud-haoref   — https://www.oref.org.il/WarningMessages/History/AlertsHistory.json
 *   bank-of-israel — https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS
 *   coingecko      — https://api.coingecko.com/api/v3/ping
 *   ims-meteo      — https://ims.gov.il/sites/default/files/ims_data/md_server_data.json
 *
 * Response shape:
 *   {
 *     probed: number,                // unix epoch ms
 *     ttl: number,                   // seconds until cache expires
 *     providers: ProviderProbeResult[]
 *   }
 *
 * ProviderProbeResult:
 *   { id, status, latencyMs, httpStatus, cachedAt? }
 */

import { CORS_HEADERS } from "../utils/response";
import type { Env } from "../types";

export const PROBE_TIMEOUT_MS = 8_000;
export const PROBE_CACHE_TTL_S = 5 * 60; // 5 minutes
const KV_KEY = "health-probes:v1";

export interface ProviderProbeResult {
  id: string;
  /** "ok" = HTTP 2xx, "degraded" = HTTP 4xx/5xx or slow (>4s), "down" = timeout/network error */
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  httpStatus: number | null;
  probedAt: string;
}

interface HealthProbeResponse {
  probed: number;
  ttl: number;
  providers: ProviderProbeResult[];
}

// ── Probe targets ────────────────────────────────────────────────────────────

interface ProbeTarget {
  id: string;
  url: string;
  /** Use HEAD when the endpoint is safe to call without a body. */
  method?: "GET" | "HEAD";
}

export const PROVIDER_PROBE_TARGETS: readonly ProbeTarget[] = [
  {
    id: "open-meteo",
    url: "https://api.open-meteo.com/v1/forecast?latitude=31.7683&longitude=35.2137&current_weather=true",
    method: "GET",
  },
  {
    id: "hebcal",
    url: "https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&M=on",
    method: "HEAD",
  },
  {
    id: "yahoo-finance",
    url: "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=1d&interval=1h",
    method: "HEAD",
  },
  {
    id: "pikud-haoref",
    url: "https://www.oref.org.il/WarningMessages/History/AlertsHistory.json",
    method: "HEAD",
  },
  {
    id: "bank-of-israel",
    url: "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?format=jsondata",
    method: "HEAD",
  },
  {
    id: "coingecko",
    url: "https://api.coingecko.com/api/v3/ping",
    method: "GET",
  },
  {
    id: "ims-meteo",
    url: "https://ims.gov.il/sites/default/files/ims_data/md_server_data.json",
    method: "HEAD",
  },
];

// ── Probe runner ─────────────────────────────────────────────────────────────

async function probeTarget(target: ProbeTarget): Promise<ProviderProbeResult> {
  const start = Date.now();
  const probedAt = new Date(start).toISOString();
  try {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    let httpStatus: number | null = null;
    try {
      const res = await fetch(target.url, {
        method: target.method ?? "HEAD",
        headers: {
          "User-Agent":
            "FamilyDashBoard/15.7 health-probe https://github.com/RajwanYair/FamilyDashBoard",
        },
        signal: controller.signal,
      });
      httpStatus = res.status;
    } finally {
      clearTimeout(timerId);
    }
    const latencyMs = Date.now() - start;
    const status: ProviderProbeResult["status"] =
      httpStatus >= 200 && httpStatus < 300
        ? latencyMs > 4_000
          ? "degraded"
          : "ok"
        : httpStatus >= 500
          ? "down"
          : "degraded";
    return { id: target.id, status, latencyMs, httpStatus, probedAt };
  } catch {
    const latencyMs = Date.now() - start;
    return { id: target.id, status: "down", latencyMs, httpStatus: null, probedAt };
  }
}

async function runAllProbes(): Promise<ProviderProbeResult[]> {
  const results = await Promise.allSettled(PROVIDER_PROBE_TARGETS.map(probeTarget));
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          id: PROVIDER_PROBE_TARGETS[i]!.id,
          status: "down" as const,
          latencyMs: PROBE_TIMEOUT_MS,
          httpStatus: null,
          probedAt: new Date().toISOString(),
        },
  );
}

let inMemorySnapshot: HealthProbeResponse | null = null;

function isProviderProbeResult(value: unknown): value is ProviderProbeResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.id === "string" &&
    (result.status === "ok" || result.status === "degraded" || result.status === "down") &&
    typeof result.latencyMs === "number" &&
    Number.isFinite(result.latencyMs) &&
    (typeof result.httpStatus === "number" || result.httpStatus === null) &&
    typeof result.probedAt === "string"
  );
}

function parseSnapshot(raw: string): HealthProbeResponse | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const snapshot = value as Record<string, unknown>;
    if (
      typeof snapshot.probed !== "number" ||
      !Number.isFinite(snapshot.probed) ||
      !Array.isArray(snapshot.providers) ||
      !snapshot.providers.every(isProviderProbeResult)
    ) {
      return null;
    }
    return { probed: snapshot.probed, ttl: PROBE_CACHE_TTL_S, providers: snapshot.providers };
  } catch {
    return null;
  }
}

function snapshotResponse(
  snapshot: HealthProbeResponse,
  source: "kv-cache" | "memory-cache" | "live-probe",
): Response {
  const ageS = Math.max(0, Math.floor((Date.now() - snapshot.probed) / 1000));
  const ttlRemaining = Math.max(0, PROBE_CACHE_TTL_S - ageS);
  return new Response(JSON.stringify({ ...snapshot, ttl: ttlRemaining }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttlRemaining}`,
      "X-FDB-Source": source,
      ...CORS_HEADERS,
    },
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handleProviderHealth(env: Env): Promise<Response> {
  // Serve from KV cache if fresh
  if (env.CACHE_KV) {
    const raw = await env.CACHE_KV.get(KV_KEY).catch(() => null);
    const cached = raw ? parseSnapshot(raw) : null;
    if (cached && Date.now() - cached.probed < PROBE_CACHE_TTL_S * 1000) {
      inMemorySnapshot = cached;
      return snapshotResponse(cached, "kv-cache");
    }
  }

  if (inMemorySnapshot && Date.now() - inMemorySnapshot.probed < PROBE_CACHE_TTL_S * 1000) {
    return snapshotResponse(inMemorySnapshot, "memory-cache");
  }

  // Run live probes
  const providers = await runAllProbes();
  const body: HealthProbeResponse = {
    probed: Date.now(),
    ttl: PROBE_CACHE_TTL_S,
    providers,
  };
  inMemorySnapshot = body;

  // Store in KV
  if (env.CACHE_KV) {
    await env.CACHE_KV.put(KV_KEY, JSON.stringify(body), {
      expirationTtl: PROBE_CACHE_TTL_S,
    }).catch(() => null);
  }

  return snapshotResponse(body, "live-probe");
}

/** Clear the isolate-local snapshot between unit tests. */
export function _resetProviderHealthForTest(): void {
  inMemorySnapshot = null;
}
