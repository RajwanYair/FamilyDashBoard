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

const PROBE_TIMEOUT_MS = 8_000;
const CACHE_TTL_S = 5 * 60; // 5 minutes
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

const PROBE_TARGETS: readonly ProbeTarget[] = [
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
          "User-Agent": "FamilyDashBoard/15.7 health-probe https://github.com/RajwanYair/FamilyDashBoard",
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
  const results = await Promise.allSettled(PROBE_TARGETS.map(probeTarget));
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          id: PROBE_TARGETS[i]!.id,
          status: "down" as const,
          latencyMs: PROBE_TIMEOUT_MS,
          httpStatus: null,
          probedAt: new Date().toISOString(),
        },
  );
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handleProviderHealth(env: Env): Promise<Response> {
  // Serve from KV cache if fresh
  if (env.CACHE_KV) {
    const cached = await env.CACHE_KV.get(KV_KEY).catch(() => null);
    if (cached) {
      const parsed = JSON.parse(cached) as HealthProbeResponse;
      const ageS = Math.floor((Date.now() - parsed.probed) / 1000);
      const ttlRemaining = Math.max(0, CACHE_TTL_S - ageS);
      return new Response(
        JSON.stringify({ ...parsed, ttl: ttlRemaining }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${ttlRemaining}`,
            "X-FDB-Source": "kv-cache",
            ...CORS_HEADERS,
          },
        },
      );
    }
  }

  // Run live probes
  const providers = await runAllProbes();
  const body: HealthProbeResponse = {
    probed: Date.now(),
    ttl: CACHE_TTL_S,
    providers,
  };

  // Store in KV
  if (env.CACHE_KV) {
    await env.CACHE_KV.put(KV_KEY, JSON.stringify(body), {
      expirationTtl: CACHE_TTL_S,
    }).catch(() => null);
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL_S}`,
      "X-FDB-Source": "live-probe",
      ...CORS_HEADERS,
    },
  });
}
