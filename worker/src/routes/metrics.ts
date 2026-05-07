/**
 * FamilyDashBoard Worker — GET /api/metrics (V12-EDGE-4)
 *
 * Returns Prometheus text-format metrics for:
 *   - Route hit counts (D1 last 7 days)
 *   - Per-route p95 latency histogram (D1 last 7 days, B10)
 *
 * Security:
 *   Requires `Authorization: Bearer <METRICS_TOKEN>` header where METRICS_TOKEN
 *   is a Worker secret (wrangler secret put METRICS_TOKEN).
 *   Returns 501 when METRICS_TOKEN is not configured.
 *   Returns 401 when the token is missing or wrong.
 *
 * Prometheus output example:
 *   # HELP fdb_route_hits_total Total hits per route in the last 7 days
 *   # TYPE fdb_route_hits_total counter
 *   fdb_route_hits_total{route="/api/weather"} 142
 *
 *   # HELP fdb_provider_health_p95_ms Route p95 response latency in ms (last 7 days)
 *   # TYPE fdb_provider_health_p95_ms gauge
 *   fdb_provider_health_p95_ms{route="/api/weather",samples="14"} 320
 *
 * See ADR-024 for the telemetry storage rationale.
 */

import { queryTotalsByRoute, queryP95ByRoute, type RouteP95 } from "../utils/d1-telemetry";
import { CORS_HEADERS } from "../utils/response";
import type { Env } from "../types";

/**
 * Serialize a route-hits map to Prometheus text format.
 * https://prometheus.io/docs/instrumenting/exposition_formats/
 */
function toPrometheusText(totals: Record<string, number>): string {
  const lines: string[] = [
    "# HELP fdb_route_hits_total Total route hits in the last 7 days",
    "# TYPE fdb_route_hits_total counter",
  ];
  for (const [route, count] of Object.entries(totals).sort(([a], [b]) => a.localeCompare(b))) {
    // Escape label values per Prometheus spec (backslash, newline, double-quote)
    const safe = route.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
    lines.push(`fdb_route_hits_total{route="${safe}"} ${count}`);
  }
  // Final newline required by the Prometheus text format
  lines.push("");
  return lines.join("\n");
}

/**
 * Serialize per-route p95 latency data to Prometheus gauge format (B10).
 * Exported for unit testing.
 */
export function toProviderHealthPrometheus(p95Rows: ReadonlyArray<RouteP95>): string {
  if (p95Rows.length === 0) return "";
  const lines: string[] = [
    "# HELP fdb_provider_health_p95_ms Route p95 response latency in ms (last 7 days)",
    "# TYPE fdb_provider_health_p95_ms gauge",
  ];
  for (const { route, p95ms, sampleCount } of p95Rows) {
    const safe = route.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
    lines.push(`fdb_provider_health_p95_ms{route="${safe}",samples="${sampleCount}"} ${p95ms}`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function handleMetrics(req: Request, env: Env): Promise<Response> {
  // 501 when the feature is not provisioned
  if (!env.METRICS_TOKEN || !env.DB) {
    return new Response("Metrics endpoint not configured\n", {
      status: 501,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    });
  }

  // Token gate
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== env.METRICS_TOKEN) {
    return new Response("Unauthorized\n", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    });
  }

  const [totals, p95Rows] = await Promise.all([
    queryTotalsByRoute(env.DB),
    queryP95ByRoute(env.DB),
  ]);

  const body = toPrometheusText(totals) + toProviderHealthPrometheus(p95Rows);

  return new Response(body, {
    status: 200,
    headers: {
      // Content-Type per Prometheus text format spec
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
