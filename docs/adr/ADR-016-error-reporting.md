# ADR-016 — Error Reporting Contract & KV Storage Model

**Date:** 2026-04-22
**Status:** Accepted
**Deciders:** Reuven Airhar
**Tags:** observability, worker, error-tracking

---

## Context

`error-reporter.ts` (v7.10) batches client-side runtime errors and POSTs them to `POST /api/errors`
on the Cloudflare Worker. At v10.0.0 the worker handler (`routes/errors.ts`) only logs entries to
`console.error` (visible via CF logpush / live tail). There is no persistence and no way for a user
or developer to retrieve historic errors without access to CF logs.

The gaps:

1. No offline buffering: if the worker is unreachable the batch is silently dropped
2. No persistence: errors rotate out of logpush after 24 h
3. No export: a user reporting a bug cannot include the last 100 errors without a developer
4. No analytics: cannot compute error rates, top-messages, or trends without custom tooling

---

## Decision

### Client (`error-reporter.ts`)

- Keep the debounced batch POST design (5 s debounce, max 20 entries per batch)
- Keep the `keepalive: true` flag to survive page unloads
- Wire to `window.onerror` and `window.onunhandledrejection` in `main.ts` so _all_ runtime
  exceptions are captured, not just those from explicit `reportErrors()` calls
- Add a `flushOnUnload` call in the SW `controllerchange` handler so errors before a reload
  are not lost
- `Ctrl+Shift+E` keyboard shortcut exports the in-memory `diag` log + last-cached error list
  as a downloadable JSON snapshot (see Sprint v11.0-OBS-2)

### Worker (`routes/errors.ts`) — v11 changes

- **KV persistence:** after validation, write each batch to KV key
  `errors:YYYY-MM-DD:<nanoid(8)>` with **7-day TTL** (Cloudflare KV `expirationTtl` = 604800)
- **Aggregate key:** increment daily counter at `errors:count:YYYY-MM-DD` (value = JSON `{n}`)
  so we can get a day's total without listing all keys
- **Max per day:** cap writes at 1000 entries/day to avoid KV abuse; return 204 but log when
  the cap is hit
- **Token-gated export:** `GET /api/errors/export?token=<SECRET>` returns the last 1000 stored
  entries sorted descending by timestamp as `ErrorExportResponse`
- Secret stored as Cloudflare secret `ERROR_REPORTING_TOKEN` — never in source

### Rejected alternatives

| Alternative                        | Why rejected                                               |
| ---------------------------------- | ---------------------------------------------------------- |
| Sentry / Datadog                   | SaaS dependency, PII risk, cost                            |
| Write to Durable Objects           | Overkill for this scale; free-tier DO is charged per-write |
| Direct to external logging service | Breaks zero-external-runtime-dep rule on the worker        |

---

## Consequences

- Errors survive up to 7 days and are retrievable via the export endpoint
- Daily error counts are cheap to query without listing all KV keys
- No PII is stored: messages are truncated to 500 chars, no user identifiers
- The export endpoint is token-gated to prevent unauthenticated data access
- Worker KV write budget: worst-case 1 000 writes/day ≪ free tier 1 M writes/day
