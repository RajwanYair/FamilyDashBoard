/**
 * D1 Telemetry — FamilyDashBoard Worker (V12-EDGE-2)
 *
 * Thin helpers around the Cloudflare D1 database binding for:
 *   - Counting route invocations per UTC day
 *   - Querying aggregated counters for the /api/metrics endpoint
 *   - Recording per-route response latency samples (B5)
 *   - Computing p95 latency per route for Prometheus output
 *   - Bootstrap: lazy schema creation on first write
 *
 * All functions are fire-and-forget safe — callers should `void` them unless
 * they need the result. Failures never propagate to the HTTP response.
 *
 * SQL Schema (auto-created on first write):
 *   CREATE TABLE IF NOT EXISTS route_hits (
 *     route     TEXT    NOT NULL,
 *     day       TEXT    NOT NULL,  -- ISO date "YYYY-MM-DD" UTC
 *     hits      INTEGER NOT NULL DEFAULT 0,
 *     PRIMARY KEY (route, day)
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS route_latency (
 *     id    INTEGER PRIMARY KEY AUTOINCREMENT,
 *     route TEXT    NOT NULL,
 *     day   TEXT    NOT NULL,  -- ISO date "YYYY-MM-DD" UTC
 *     ms    INTEGER NOT NULL   -- response time in milliseconds
 *   );
 *
 * See ADR-024 for the rationale behind D1 over KV for telemetry counters.
 */

import type { D1Database } from "../types";

/** ISO date string "YYYY-MM-DD" in UTC. */
function utcDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Ensure the hit-counter table exists. */
async function ensureSchema(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS route_hits (
      route TEXT NOT NULL,
      day   TEXT NOT NULL,
      hits  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (route, day)
    )
  `);
}

/** Ensure the latency-samples table exists. */
async function ensureLatencySchema(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS route_latency (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT    NOT NULL,
      day   TEXT    NOT NULL,
      ms    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_route_lat ON route_latency (route, day);
  `);
}

/** Number of days to retain latency samples. */
const LATENCY_RETENTION_DAYS = 7;

/**
 * Increment the hit counter for `route` on today's UTC date.
 * Creates the table and row if they don't exist.
 *
 * @param db    D1 binding from the Worker env
 * @param route Route name, e.g. "/api/weather"
 */
export async function recordHit(db: D1Database, route: string): Promise<void> {
  const day = utcDay();
  try {
    await ensureSchema(db);
    await db
      .prepare(
        `INSERT INTO route_hits (route, day, hits) VALUES (?, ?, 1)
         ON CONFLICT (route, day) DO UPDATE SET hits = hits + 1`,
      )
      .bind(route, day)
      .run();
  } catch {
    // Telemetry errors must never surface to callers
  }
}

/**
 * Record a response latency sample for `route` in milliseconds.
 * Automatically prunes samples older than LATENCY_RETENTION_DAYS.
 *
 * @param db    D1 binding from the Worker env
 * @param route Route name, e.g. "/api/weather"
 * @param ms    Response time in milliseconds (rounded to nearest integer)
 */
export async function recordLatency(db: D1Database, route: string, ms: number): Promise<void> {
  const day = utcDay();
  const cutoff = utcDay(Date.now() - LATENCY_RETENTION_DAYS * 86_400_000);
  try {
    await ensureLatencySchema(db);
    await db
      .prepare(`INSERT INTO route_latency (route, day, ms) VALUES (?, ?, ?)`)
      .bind(route, day, Math.round(ms))
      .run();
    // Prune stale samples (fire-and-forget — non-critical)
    void db.prepare(`DELETE FROM route_latency WHERE day < ?`).bind(cutoff).run();
  } catch {
    // Telemetry errors must never surface to callers
  }
}

export interface RouteStat {
  route: string;
  day: string;
  hits: number;
}

/**
 * Return hit counts for all routes in the last `days` calendar days (UTC).
 * Returns an empty array when the table doesn't exist yet.
 *
 * @param db   D1 binding
 * @param days Number of past days to include (default 7)
 */
export async function queryRecentHits(db: D1Database, days = 7): Promise<RouteStat[]> {
  const since = utcDay(Date.now() - days * 86_400_000);
  try {
    await ensureSchema(db);
    const result = await db
      .prepare(
        `SELECT route, day, hits FROM route_hits WHERE day >= ? ORDER BY day DESC, hits DESC`,
      )
      .bind(since)
      .all<RouteStat>();
    return result.results;
  } catch {
    return [];
  }
}

/**
 * Return the total hits per route over the last `days` days, collapsed to a
 * `Record<route, totalHits>` map. Convenient for Prometheus text format.
 *
 * @param db   D1 binding
 * @param days Number of past days (default 7)
 */
export async function queryTotalsByRoute(
  db: D1Database,
  days = 7,
): Promise<Record<string, number>> {
  const rows = await queryRecentHits(db, days);
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.route] = (totals[row.route] ?? 0) + row.hits;
  }
  return totals;
}

// ── p95 latency aggregation ───────────────────────────────────────

export interface RouteP95 {
  /** Route name, e.g. "/api/weather". */
  route: string;
  /** 95th-percentile response time in milliseconds. */
  p95ms: number;
  /** Number of latency samples used to compute the p95. */
  sampleCount: number;
}

/**
 * Pure function: compute p95 latency per route from an array of
 * `{ route, ms }` samples. Input need not be sorted.
 *
 * Exported so callers can unit-test it without a D1 binding.
 */
export function aggregateP95(samples: ReadonlyArray<{ route: string; ms: number }>): RouteP95[] {
  const byRoute = new Map<string, number[]>();
  for (const { route, ms } of samples) {
    const arr = byRoute.get(route) ?? [];
    arr.push(ms);
    byRoute.set(route, arr);
  }
  const result: RouteP95[] = [];
  for (const [route, latencies] of byRoute) {
    latencies.sort((a, b) => a - b);
    const idx = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
    result.push({
      route,
      p95ms: latencies[idx] ?? 0,
      sampleCount: latencies.length,
    });
  }
  return result.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Query latency samples for all routes in the last `days` days from D1
 * and return p95 per route.
 *
 * Returns an empty array when the table doesn't exist yet or on any error.
 *
 * @param db   D1 binding
 * @param days Number of past days to include (default 7)
 */
export async function queryP95ByRoute(db: D1Database, days = 7): Promise<RouteP95[]> {
  const since = utcDay(Date.now() - days * 86_400_000);
  try {
    await ensureLatencySchema(db);
    const result = await db
      .prepare(`SELECT route, ms FROM route_latency WHERE day >= ? ORDER BY route, ms ASC`)
      .bind(since)
      .all<{ route: string; ms: number }>();
    return aggregateP95(result.results);
  } catch {
    return [];
  }
}
