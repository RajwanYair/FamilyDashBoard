# ADR-029 — Workers Analytics Engine Request Tracking

| Field   | Value      |
| ------- | ---------- |
| Status  | Accepted   |
| Date    | 2025-07-13 |
| Sprint  | 29         |
| Roadmap | b          |

## Context

As the Worker handles production traffic, operators need lightweight per-route request telemetry
to understand usage patterns, detect anomalies, and measure rollout health. The existing D1-backed
telemetry (`POST /api/errors`, `GET /api/metrics`) is optimised for error and latency data; it is
not well-suited for high-frequency per-request hit counting.

Cloudflare's [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
(AE) is designed for exactly this use case: it accepts `writeDataPoint()` calls from the Worker's
request handler path, buffers them efficiently, and makes them queryable via the GraphQL-based
Workers Analytics Engine API. Unlike D1, AE has no observable per-write latency cost.

## Decision

Add a Hono middleware in `worker/src/index.ts` that calls `writeAnalyticsHit()` after every request
is handled. The call is fire-and-forget — it never delays the response.

The data point schema is:

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| `blobs[0]`   | Normalised pathname (e.g. `/api/weather`) |
| `blobs[1]`   | HTTP method (`GET`, `POST`, …)            |
| `blobs[2]`   | `ENVIRONMENT` label                       |
| `doubles[0]` | HTTP response status code                 |
| `indexes[0]` | Same as `blobs[0]` (primary index key)    |

The `ANALYTICS` binding is optional — the middleware is a no-op when not configured. This allows
development and preview deployments to operate without provisioning the dataset.

Helper functions are isolated in `worker/src/utils/analytics.ts`:

- `normaliseRoute(url)` — strips query string and hash, returns pathname only.
- `writeAnalyticsHit(dataset, method, route, status, env)` — calls `dataset.writeDataPoint()` inside
  a try/catch so it never surfaces AE errors to callers.

The binding is configured in `wrangler.toml` via:

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "fdb_requests"
```

## Consequences

**Positive:**

- Per-route request counts are available in near-real-time via the AE GraphQL API.
- No observable latency cost — `writeDataPoint()` is synchronous and non-blocking.
- Canary traffic is automatically distinguishable (via `blobs[2]` ENVIRONMENT or future `X-Canary`
  correlation).
- Feature is optional — fully degrades when `ANALYTICS` is unbound.

**Negative / Trade-offs:**

- AE data is only queryable via the Cloudflare GraphQL Workers Analytics API — not via SQL.
- AE dataset must be provisioned in the Cloudflare Dashboard before hits appear.
- No backfill — data from before the binding is added is not retroactively captured.

## Alternatives Considered

| Option                          | Reason Rejected                                                       |
| ------------------------------- | --------------------------------------------------------------------- |
| D1 for hit counting             | High write volume; D1 write latency adds to response time             |
| KV for counters                 | KV has no atomic increment in Workers; race conditions on busy routes |
| Logpush + external analytics    | Adds external dependency; violates zero-runtime-deps constraint       |
| Client-side analytics (GA, etc) | Requires CDN dependency; violates rule 1 of copilot-instructions      |

## Related

- `worker/src/utils/analytics.ts` — Helper implementation
- `worker/src/index.ts` — Middleware wiring
- `tests/unit/worker/analytics.test.ts` — 11 tests
- ADR-026 — Hono Router (middleware chain design)
- [Workers Analytics Engine docs](https://developers.cloudflare.com/analytics/analytics-engine/)
