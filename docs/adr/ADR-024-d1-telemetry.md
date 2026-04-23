# ADR-024 — D1 Telemetry for Route Hit Counting

**Status:** Accepted  
**Date:** 2025-01  
**Deciders:** Dashboard maintainer  
**Tags:** edge · observability · worker

---

## Context

The FamilyDashBoard Worker handles ~14 API routes that proxy upstream data
sources. Operators have no visibility into which routes are most used, which
upstreams are failing most often, or how traffic changes over time.

Two options were considered for lightweight telemetry storage:

| Option | Pros | Cons |
|---|---|---|
| **KV** | Already provisioned | String-only, no aggregation, TTL overwrite loses history |
| **D1 (SQLite)** | SQL aggregates, persistent, cheap | New binding to provision |

Workers Analytics Engine (WAE) was also considered but requires a paid plan
and a separate dashboard; D1 delivers the same data for free within CF's
hobby tier when DB size stays small.

## Decision

Use **Cloudflare D1** (`fdb-telemetry`) for route hit counting.

- Single table `route_hits (route TEXT, day TEXT, hits INTEGER)` with a
  composite primary key `(route, day)`.
- Increment via SQL `ON CONFLICT DO UPDATE` (atomic upsert).
- Schema is auto-created on first write (`CREATE TABLE IF NOT EXISTS`).
- Accessed only from `worker/src/utils/d1-telemetry.ts`; no route handler
  imports D1 directly.
- The D1 binding (`DB`) is optional in `Env` — telemetry is silently skipped
  if `DB` is not provisioned (e.g. local development).

## Consequences

- **+** Route hit counts are queryable via `/api/metrics` (Sprint 17).
- **+** No new runtime cost for requests where telemetry insertion fails.
- **+** Zero schema migrations needed for v1 — single table, append-only.
- **-** D1 binding requires `wrangler d1 create fdb-telemetry` before first deploy.
- **-** `database_id` placeholder in `wrangler.toml` must be replaced before production.
- **-** Hits are eventually consistent (D1 writes are async `void`).

## Implementation

- `worker/src/types.ts`: Added `D1Database`, `D1PreparedStatement`, `D1Result`,
  `D1ExecResult` minimal interfaces (structural — no `@cloudflare/workers-types` dep).
- `worker/src/utils/d1-telemetry.ts`: `recordHit()`, `queryRecentHits()`,
  `queryTotalsByRoute()`.
- `worker/wrangler.toml`: Added `[[d1_databases]]` block.
