# ADR-079 — OpenTelemetry Worker Opt-In Scaffold

| Field     | Value                                               |
| --------- | --------------------------------------------------- |
| Status    | **Draft**                                           |
| Date      | 2026-05-21                                          |
| Author    | @RajwanYair                                         |
| Milestone | v15.0.0 (V15-OPEN §0.0 Pillar 2 — observability)   |
| Related   | ADR-029 (Analytics Engine), ADR-031 (Vendor drill)  |

## Context

ROADMAP §0.0 Pillar 2 calls for "opt-in OpenTelemetry from Worker" shipped in v15. The
intent is a self-hosted OTLP ingestor on Cloudflare R2 + Workers, disabled by default,
zero-impact when the binding is absent.

As of v14.23.0, the Worker emits:
- **Request logs** via `worker/src/middleware/log.ts` (stdout JSON, Cloudflare Logpush)
- **D1 telemetry** via `worker/src/utils/d1-telemetry.ts` (per-request row in `fdb-telemetry`)
- **Analytics Engine** via `worker/src/utils/analytics.ts` (ADR-029 Analytics Engine dataset)
- **Error reports** via `worker/src/routes/errors.ts` (browser CSP + runtime errors)

None of these produce OTel spans, traces, or OTLP-formatted payloads.

## Decision

Introduce `worker/src/telemetry.ts` as a **no-op scaffold** behind a feature-flag binding
(`OTEL_ENABLED`). This file ships in v14.23.0 as dead-but-type-safe infrastructure;
the v15 sprint wires the real `@opentelemetry/otlp-exporter-*` implementation.

### API surface (v14.23.0 scaffold)

```ts
initOtel(env: Env): OtelHandle;
interface OtelHandle {
  span<T>(name: string, fn: (span: OtelSpan) => T): T;
  flush(): Promise<void>;
  readonly enabled: boolean;
}
interface OtelSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: "ok" | "error", message?: string): void;
}
```

All methods are no-ops when `env.OTEL_ENABLED !== "true"`. The `enabled` flag is
observable so callers can skip expensive attribute collection when telemetry is off.

### Feature-flag binding

```toml
# wrangler.toml — add when deploying v15 build
[vars]
OTEL_ENABLED = "false"   # set "true" to activate OTel spans
```

The `Env` type in `worker/src/types.ts` adds `OTEL_ENABLED?: string` (optional,
backward-compatible — existing deployments without the var get a no-op handle).

### Future v15 steps (out of scope for this ADR)

1. Add `@opentelemetry/otlp-exporter-proto` to `worker/package.json`.
2. Implement `initOtel` to create a real `TracerProvider` + `OTLPTraceExporter`.
3. Wire `initOtel` in `worker/src/index.ts` request handler.
4. Instrument the four hot paths: `/api/weather`, `/api/stocks`, `/api/news`, `/api/cal`.
5. Cloudflare R2 bucket `fdb-otel-traces` as OTLP ingestor sink.
6. Grafana dashboard reading from R2 via Cloudflare Workers ingestor.

## Consequences

**Positive**:
- Zero runtime overhead when `OTEL_ENABLED` is absent or `"false"` — no-op path.
- Type-safe API surface is locked before the implementation sprint.
- CI gate remains green (`worker/src/telemetry.ts` is in stryker scope via Sprint 6 entry).

**Negative**:
- One extra source file ships before it does anything useful.
- The `Env` type grows by one optional property.

## Acceptance criteria (v15 implementation sprint)

- [ ] `initOtel(env).enabled === true` when `OTEL_ENABLED === "true"`
- [ ] `span()` creates an OTLP span, `flush()` exports it to the configured endpoint
- [ ] Worker gzip budget does not exceed 80 KB with OTel active (`@opentelemetry/` tree-shaken)
- [ ] `check-vendor-neutrality.mjs` pattern list updated with OTLP endpoint check
