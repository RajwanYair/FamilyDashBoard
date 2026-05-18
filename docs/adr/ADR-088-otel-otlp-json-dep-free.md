# ADR-088 — OTel OTLP/JSON dep-free exporter (ADR-079 implementation)

**Status**: Accepted
**Date**: 2026-06-09
**Deciders**: @RajwanYair

---

## Context

ADR-079 (v14.23.0) established OpenTelemetry observability as a goal and defined the
`OtelHandle` / `OtelSpan` public API. However, the actual `initOtel()` implementation
returned a no-op handle with a TODO comment deferring the real exporter to "v15".

The main blocker at the time was avoiding npm dependencies (`@opentelemetry/otlp-*`
packages add significant bundle size and have CF Workers compatibility concerns).

The ROADMAP §5.1 stream OTel now has a clear solution path:

- OTLP/HTTP JSON is a straightforward JSON-over-HTTP protocol.
- Native `fetch` (available in CF Workers) is sufficient.
- No protobuf, no npm packages needed.

## Decision

Replace the no-op stub in `worker/src/telemetry.ts` with a fully dep-free
OTLP/HTTP JSON exporter using native `fetch`.

### Architecture

```text
Request lifecycle              telemetry.ts                 OTLP Collector
     │                              │                              │
     │   initOtel(env)              │                              │
     │ ─────────────────────────►  │                              │
     │   OtelHandle (live)         │                              │
     │◄────────────────────────────│                              │
     │                             │                              │
     │   otel.span("route:…", fn)  │                              │
     │ ─────────────────────────►  │                              │
     │   runs fn, records span     │                              │
     │◄────────────────────────────│                              │
     │                             │                              │
     │   ctx.waitUntil(otel.flush)  │                              │
     │ ─────────────────────────►  │                              │
     │                             │  POST /v1/traces (JSON)      │
     │                             │ ────────────────────────────►│
     │                             │  200 OK                      │
     │                             │◄─────────────────────────────│
```

### OTLP/JSON payload structure

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [{ "key": "service.name", "value": { "stringValue": "fdb-worker" } }]
      },
      "scopeSpans": [
        {
          "scope": { "name": "fdb-worker" },
          "spans": [
            {
              "traceId": "<32-hex-chars>",
              "spanId": "<16-hex-chars>",
              "name": "route:weather",
              "kind": 1,
              "startTimeUnixNano": "<ns-string>",
              "endTimeUnixNano": "<ns-string>",
              "attributes": [{ "key": "lat", "value": { "doubleValue": 32.1 } }],
              "status": { "code": 1 }
            }
          ]
        }
      ]
    }
  ]
}
```

### Feature gate

Enabled only when **both** env vars are set:

```text
OTEL_ENABLED=true
OTEL_ENDPOINT=https://your-collector.example.com
```

When either is absent, `initOtel()` returns the existing zero-cost no-op handle.
`enabled === false` — callers can skip span creation entirely.

### Key choices

| Decision                               | Rationale                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| OTLP/JSON over OTLP/proto              | No protobuf npm dep; JSON is trivially serialisable with `JSON.stringify`                 |
| Native `fetch`                         | Zero bundle impact; available in all CF Workers runtimes                                  |
| Span timestamps as ns strings          | Avoids `BigInt` — `Date.now() * 1_000_000` is within safe integer range for current epoch |
| `flush()` errors swallowed             | Telemetry must never fail a user request; best-effort only                                |
| `span()` uses `try/finally`            | Span always finishes, even if `fn` throws                                                 |
| `_hex(n)` via `crypto.getRandomValues` | Correct OTLP IDs; CF Workers ships `crypto` globally                                      |

## Consequences

### Positive

- Real end-to-end traces in any OTLP-compatible collector (Grafana, Honeycomb, OTLP Collector).
- Zero npm dependencies added.
- `enabled === false` path remains a true zero-cost no-op.
- `flush()` is always safe to call (never throws).

### Negative

- Nanosecond precision is `Date.now()` × 1 million — millisecond granularity, not true ns.
  Acceptable for server-side latency tracing; insufficient for CPU-ns profiling.
- No automatic W3C `traceparent` propagation to upstream origins (can be added in a future sprint).
- `span()` is synchronous — async spans (e.g. wrapping a `Promise`) must call `setStatus`
  before the promise resolves if the span is created around `await`.

## Files Changed

- `worker/src/telemetry.ts` — full replacement of no-op stub with dep-free OTLP/JSON exporter
- `worker/src/types.ts` — `OTEL_ENDPOINT?: string` already added in ADR-079; doc updated
