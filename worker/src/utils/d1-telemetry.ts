/**
 * D1 Telemetry — FamilyDashBoard Worker (V12-EDGE-2)
 *
 * Thin helpers around the Cloudflare D1 database binding for:
 *   - Counting route invocations per UTC day
 *   - Querying aggregated counters for the /api/metrics endpoint
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
 * See ADR-024 for the rationale behind D1 over KV for telemetry counters.
 */

import type { D1Database } from "../types";

/** ISO date string "YYYY-MM-DD" in UTC. */
function utcDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Ensure the telemetry table exists. */
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
export async function queryRecentHits(
  db: D1Database,
  days = 7,
): Promise<RouteStat[]> {
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
