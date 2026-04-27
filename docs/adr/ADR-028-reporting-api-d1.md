# ADR-028 — Browser Reporting API + D1 Storage

| Field   | Value      |
| ------- | ---------- |
| Status  | Accepted   |
| Date    | 2025-07-13 |
| Sprint  | 28         |
| Roadmap | V12-OPS    |

## Context

Browsers implement the [Reporting API](https://www.w3.org/TR/reporting/) (Level 1 and Level 2) to deliver
Content-Security-Policy violation reports, deprecation warnings, and network error logs to a designated
`report-to` endpoint without requiring any page-level JavaScript.

Prior to Sprint 28, FamilyDashBoard had no endpoint to receive these browser-generated reports. CSP
violations were silently discarded. There was no visibility into which CSP directives were being violated,
what deprecated APIs were being used by third-party scripts, or what network interventions the browser
was applying.

## Decision

Add a `POST /api/reports` endpoint to the Cloudflare Worker that:

1. Accepts the [Reporting API JSON body format](https://www.w3.org/TR/reporting/#serialize-reports) —
   an array of report objects (`type`, `url`, `body`).
2. Validates the payload with Valibot (`ReportsPayloadSchema`) to enforce input shape.
3. Strips PII before storage: `userAgent` is discarded; query strings are removed from URLs (`stripUrl()`).
4. Stores up to `MAX_REPORTS_PER_REQUEST = 50` reports per request into the D1 `browser_reports` table
   via `storeReport()` in `worker/src/utils/d1-reports.ts`.
5. Returns HTTP 204 (no content) to the browser unconditionally — the Reporting API ignores non-2xx.
6. Gracefully degrades when `env.DB` is not configured — returns 204 and skips storage (feature optional).

A companion `GET /api/reports/digest` endpoint (token-gated via `REPORTS_TOKEN` bearer auth) returns a
summary of reports grouped by `{type, day, count}` for the past 30 days. This powers a future operator
dashboard.

A daily cron job calls `pruneOldReports(db, 30)` to remove rows older than 30 days, keeping the D1
table bounded.

The `browser_reports` table schema is auto-created on first write via `ensureSchema()`, avoiding the
need for a separate migration step.

## Consequences

**Positive:**

- CSP violation reports are now captured and queryable — enables security posture improvements.
- Deprecation warnings from the browser are logged without any client-side JavaScript overhead.
- Storage is bounded (30-day TTL, 50/request cap).
- No PII leaks — `userAgent` stripped, URL query parameters stripped.
- Feature is opt-in (degrades gracefully when D1 not configured).

**Negative / Trade-offs:**

- D1 adds a small write latency on the POST path (typically < 5ms on Cloudflare's edge).
- The `browser_reports` table must be provisioned in D1 (`wrangler d1 create fdb-telemetry`) before
  the digest endpoint becomes functional.
- The 50-reports-per-request cap means a browser that batches more than 50 reports will have them
  silently truncated.

## Alternatives Considered

| Option                        | Reason Rejected                                                   |
| ----------------------------- | ----------------------------------------------------------------- |
| KV-backed storage             | KV is not queryable by range/type — can't produce a useful digest |
| Workers Analytics Engine only | AE has no SQL query interface for structured digest               |
| Discard all reports           | Provides no security/deprecation visibility                       |
| Third-party SIEM              | Adds external dependency; this project is zero-runtime-deps       |

## Related

- `worker/src/routes/reports.ts` — Route handlers
- `worker/src/utils/d1-reports.ts` — D1 storage helpers
- `tests/unit/worker/reports.test.ts` — 21 tests
- ADR-024 — D1 Telemetry (parent D1 decision)
- [Reporting API W3C Spec](https://www.w3.org/TR/reporting/)
