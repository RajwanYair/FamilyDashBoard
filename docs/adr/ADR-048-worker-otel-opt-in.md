# ADR-048 — OpenTelemetry Worker Opt-in Plan

| Field        | Value                                    |
| ------------ | ---------------------------------------- |
| **Status**   | Proposed                                 |
| **Sprint**   | 238 (v13.26.0)                           |
| **Deciders** | @RajwanYair                              |
| **Tags**     | observability, worker, telemetry, opt-in |

## Context

FamilyDashBoard's Cloudflare Worker (`worker/`) handles API proxying for weather, stocks,
holidays, news feeds, and AI synthesis. Currently there is no structured observability layer —
errors surface only via `diagLog()` client-side breadcrumbs and Cloudflare's built-in worker
metrics dashboard (request count, CPU time, error rate).

As traffic grows past ~100 K requests/day (the projected threshold for v14), ad-hoc `console.log`
tracing becomes insufficient. This ADR defines an opt-in OpenTelemetry (OTel) integration path
that can be enabled via worker configuration without shipping telemetry overhead to low-traffic
deployments.

## Decision

Adopt OpenTelemetry for the worker under a feature-flag (`otelEnabled`) with the following
architecture:

### 1. Config key

```typescript
// worker/src/config.ts
export interface WorkerEnv {
  // ... existing keys ...
  /** OTel: set to "1" to enable telemetry export */
  OTEL_ENABLED?: string;
  /** OTel: OTLP HTTP endpoint (e.g. http://collector:4318) */
  OTEL_ENDPOINT?: string;
  /** OTel: service name, defaults to "familydashboard-worker" */
  OTEL_SERVICE_NAME?: string;
}
```

`OTEL_ENABLED` is read from Cloudflare Worker Secrets / `wrangler.toml` vars.
When absent or not `"1"`, all OTel code is bypassed with zero overhead.

### 2. `/api/telemetry` route (future, v14)

Add a lightweight OTLP-forwarding endpoint to the worker:

```http
POST /api/telemetry
Content-Type: application/json
Body: OTel LogsData or SpansData JSON (subset)
```

The route:

1. Validates the payload shape (required fields: `resourceSpans` or `resourceLogs`)
2. Forwards to `OTEL_ENDPOINT` via `fetch()` with `Bearer OTEL_API_KEY`
3. Returns `204 No Content` on success, `503` on collector unreachable
4. Is guarded by a CORS origin check (`ALLOWED_ORIGINS` env var)

This keeps all collector credentials server-side (no client-side secret exposure).

### 3. Client-side integration (v14 only, opt-in)

The dashboard client will use the `otelEnabled` config key (boolean, default `false`) to
conditionally post traces to `/api/telemetry`. When disabled, the trace pipeline is a no-op
stub (`() => void`). **No third-party OTel SDK** is bundled — only a minimal hand-rolled
`createSpan(name, attrs)` helper (`< 200 bytes gzipped`).

### 4. Collector target

[Grafana Cloud free tier](https://grafana.com/products/cloud/) — OTLP HTTP ingest.
Free tier quota: 50 GB traces / month. Estimated usage at 100 K req/day: ~0.8 GB/month.

Alternative self-hosted path: Docker Compose with `otel/opentelemetry-collector-contrib` and Jaeger backend (for local dev only, documented in `docs/local-dev.md`).

### 5. Gate condition

OTel integration (client traces + `/api/telemetry`) is released only when:

- Daily request volume exceeds **100 K req/day** (monitored via Cloudflare Analytics)
- OR a performance regression > 200 ms P95 is detected
- OR the team explicitly enables it for debugging a production issue

Before that threshold, `OTEL_ENABLED` defaults to absent (disabled).

## Consequences

### Positive

- Zero overhead when disabled (env-gate, no SDK bundle)
- Structured trace data replaces ad-hoc `console.log` hunting
- Grafana free tier covers estimated traffic until v14 milestone
- Client credentials never leave the server (proxy pattern)

### Negative / Trade-offs

- Adds a conditional fetch path to the worker (minimal latency if collector is co-located)
- Grafana Cloud has free-tier caps; exceeding ~50 GB/month requires a paid plan
- `/api/telemetry` endpoint adds attack surface; mitigated by origin + payload validation

## Implementation Checklist (v14)

- [x] `worker/src/otel.ts` — `createSpan()` helper + OTLP serializer
- [x] `worker/src/routes/telemetry.ts` — `/api/telemetry` route handler
- [x] `worker/openapi.yaml` — document `/api/telemetry` endpoint
- [x] `src/core/telemetry.ts` — client stub (`otelEnabled` guard)
- [x] `docs/local-dev.md` — Docker Compose OTel collector section
- [x] `wrangler.toml` — add `OTEL_ENABLED`, `OTEL_ENDPOINT`, `OTEL_SERVICE_NAME` vars (commented out)
- [x] Unit tests: span serializer round-trip, route 400/503 error paths
