# ADR-011: Worker Response Envelope Contract

**Date:** 2026-04-20
**Status:** Accepted
**Deciders:** Project maintainer
**Supersedes:** Partial guidance in ADR-006

---

## Context

ADR-006 established the *goal* of worker-normalized responses. As the implementation matured across Streams W, W.2, W.3, and W.4, a concrete response envelope emerged:
`workerEnvelope<T>(data, provider, stale, cacheTtl)` returns a typed JSON body with the fields `{ data, provider, stale, timestamp }`.

Several routes still returned raw `proxyResponse` pass-throughs (alerts, stocks, news, Sefaria) mixing two different response contracts. This ADR formalises which routes must use the envelope and what the contract guarantees.

---

## Decision

**All structured-data routes in the FamilyDashBoard worker MUST return responses in the `WorkerResponse<T>` envelope format.**

The envelope schema is:

```json
{
  "data":      "<T>",
  "provider":  "string  — canonical name of the upstream source",
  "stale":     "boolean — true when served from KV stale cache",
  "timestamp": "number  — Unix ms at time of response construction"
}
```

Routes that return non-JSON bodies (ICS calendar, RSS feeds, plain-text stock quotes)
are exempt and MUST continue using `proxyResponse` to preserve byte-for-byte pass-through.

### In-scope routes (must use envelope)

| Route | Provider name | KV key |
|---|---|---|
| `GET /api/weather` | `open-meteo` | `weather:{lat}:{lon}` |
| `GET /api/currency` | `er-api` | `currency:ILS` |
| `GET /api/hebcal` | `hebcal` | `hebcal:{geonameid}` |
| `GET /api/hebcal/holidays` | `hebcal` | `hebcal-holidays:{year}` |
| `GET /api/alerts` | `tzevaadom` | *(no KV — TTL 60 s)* |

### Exempt routes (pass-through)

| Route | Reason |
|---|---|
| `GET /api/stocks` | Yahoo Finance returns JSON but shape is consumed directly by the client adapter |
| `GET /api/news` | Returns RSS XML |
| `GET /api/calendar` | Returns ICS text |
| `GET /api/sefaria/calendar` | Returns JSON but consumed by a dedicated client adapter |
| `GET /api/sefaria/text` | Returns Sefaria v3 JSON consumed by a dedicated client adapter |

---

## Rationale

1. **Uniform client consumption** — card loaders can use a single `fetchJSONWithWorker<WorkerResponse<T>>` call and destructure `{ data, stale }` without provider-specific field mapping.
2. **Stale transparency** — the `stale` flag lets the UI show a `card-stale` chip without separate mechanisms.
3. **Provider attribution for telemetry** — the `provider` field enables future logging and alerting per data source.
4. **TTL propagation** — `Cache-Control: public, max-age=N` is set by the envelope helper, centralising TTL logic.
5. **KV stale fallback** — envelope routes must attempt KV read-through on upstream failure (Streams W.2, W.3).

---

## Consequences

- New worker routes that return JSON MUST use `workerEnvelope`. Exempt routes added in future must be explicitly listed in this ADR.
- Client card loaders consuming in-scope routes MUST type their fetch as `WorkerResponse<T>` and check `stale`.
- `proxyResponse` usage is restricted to exempt routes and MUST NOT be used for new structured-data endpoints.
- Worker tests MUST assert `provider` and `stale` fields on envelope responses.
- This ADR is considered implemented when all in-scope routes above return the envelope. Current status: ✅ complete as of Stream W.4.
