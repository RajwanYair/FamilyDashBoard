/**
 * FamilyDashBoard Worker — D1 Reporting API storage helpers (V12-OPS)
 *
 * Stores CSP + deprecation + intervention reports forwarded by the browser's
 * Reporting API (https://www.w3.org/TR/reporting-1/) into Cloudflare D1.
 *
 * Privacy: Only the report type, stripped document URL (no query string), and
 * the sanitised body (free of any user-identifying fields) are persisted.
 * No IP addresses, no User-Agent strings, no cookies, no PII.
 *
 * Retention: rows older than 30 days are pruned by the daily cron trigger.
 *
 * SQL Schema (auto-created on first write):
 *   CREATE TABLE IF NOT EXISTS browser_reports (
 *     id      INTEGER PRIMARY KEY AUTOINCREMENT,
 *     ts      INTEGER NOT NULL,   -- Unix timestamp ms
 *     type    TEXT    NOT NULL,   -- "csp-violation" | "deprecation" | "intervention"
 *     url     TEXT    NOT NULL,   -- document base URL (no query string)
 *     detail  TEXT    NOT NULL,   -- JSON body blob (sanitised, no PII)
 *     day     TEXT    NOT NULL    -- ISO date "YYYY-MM-DD" UTC
 *   );
 *
 * See ADR-028 for the rationale behind Reporting API + D1 storage.
 */

import type { D1Database } from "../types";

/** ISO date string "YYYY-MM-DD" in UTC. */
function utcDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Strip query string and fragment from a URL string. Returns "" on parse error. */
function stripUrl(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "";
  }
}

/** Ensure the browser_reports table exists. */
async function ensureSchema(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS browser_reports (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ts      INTEGER NOT NULL,
      type    TEXT    NOT NULL,
      url     TEXT    NOT NULL,
      detail  TEXT    NOT NULL,
      day     TEXT    NOT NULL
    )
  `);
}

export interface ReportRow {
  id?: number;
  ts: number;
  type: string;
  url: string;
  detail: string;
  day: string;
}

export interface ReportSummaryItem {
  type: string;
  day: string;
  count: number;
}

/**
 * Store a single browser report in D1.
 * Fire-and-forget safe — callers should `void` this unless they need the result.
 *
 * @param db     D1 binding from Worker env
 * @param type   Report type string, e.g. "csp-violation"
 * @param url    Document URL (will be stripped to origin+path)
 * @param body   Report body object (sanitised before storage)
 */
export async function storeReport(
  db: D1Database,
  type: string,
  url: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureSchema(db);
    const ts = Date.now();
    const safeUrl = stripUrl(url);
    // Remove any fields that could contain PII before persisting
    const { userAgent: _ua, ...safeBody } = body as Record<string, unknown> & { userAgent?: unknown };
    const detail = JSON.stringify(safeBody);
    await db
      .prepare(
        `INSERT INTO browser_reports (ts, type, url, detail, day) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(ts, type, safeUrl, detail, utcDay(ts))
      .run();
  } catch {
    // Storage errors must never surface to HTTP callers
  }
}

/**
 * Query the count of reports grouped by type and day for the last `days` days.
 * Returns an empty array when the table doesn't exist yet or D1 is unavailable.
 *
 * @param db   D1 binding
 * @param days Number of past days to include (default 30)
 */
export async function queryReportSummary(
  db: D1Database,
  days = 30,
): Promise<ReportSummaryItem[]> {
  const since = utcDay(Date.now() - days * 86_400_000);
  try {
    await ensureSchema(db);
    const result = await db
      .prepare(
        `SELECT type, day, COUNT(*) AS count
         FROM browser_reports
         WHERE day >= ?
         GROUP BY type, day
         ORDER BY day DESC, count DESC`,
      )
      .bind(since)
      .all<ReportSummaryItem>();
    return result.results;
  } catch {
    return [];
  }
}

/**
 * Delete browser_reports rows older than `days` days.
 * Called by the daily cron trigger to enforce retention.
 *
 * @param db   D1 binding
 * @param days Retention window in days (default 30)
 */
export async function pruneOldReports(db: D1Database, days = 30): Promise<void> {
  const cutoff = utcDay(Date.now() - days * 86_400_000);
  try {
    await ensureSchema(db);
    await db.prepare(`DELETE FROM browser_reports WHERE day < ?`).bind(cutoff).run();
  } catch {
    // Prune errors must not fail the cron job
  }
}
