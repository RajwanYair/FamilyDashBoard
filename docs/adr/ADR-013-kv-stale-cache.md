# ADR-013: KV Stale Cache Strategy for Worker Feeds

**Date:** 2026-07-14
**Status:** Accepted
**Deciders:** Project maintainer
**Implements:** ADR-003 (Worker-First API), ADR-010 (IDB-Async Stale Cache)

---

## Context

The Cloudflare Worker proxies several time-sensitive third-party APIs — Yahoo
Finance (stocks), CoinGecko (crypto), and tzevaadom.co.il (rocket alerts).
When an upstream API is unavailable (rate-limiting, maintenance, transient
503/502) the worker previously returned a 502 error, causing cards on every
connected client to show an error state simultaneously.

The client already has an IDB stale-while-revalidate layer (ADR-010), but
that layer only helps if the _client itself_ previously fetched the data. For
new page loads or clients that have cleared their IDB, there is no local stale
data to fall back to, so the error state is unavoidable.

---

## Decision

**Store the last successful upstream response in Cloudflare KV. On upstream
failure, serve the KV copy tagged with `_stale: true` instead of returning an
error.**

### Per-route implementation

| Route                     | KV key pattern                 | TTL  |
| ------------------------- | ------------------------------ | ---- |
| `/api/stocks?sym=X`       | `stocks:SYMBOL`                | 24 h |
| `/api/crypto?ids=bitcoin` | `crypto:bitcoin:vs_currencies` | 24 h |
| `/api/alerts`             | `alerts:tzevaadom`             | 1 h  |

### Response envelope for stale responses

```json
{
  "data": { ...originalPayload },
  "provider": "yahoo-kv-stale",
  "stale": true,
  "ts": 1720000000
}
```

The client already reads the `stale` flag from `WorkerEnvelope` and renders a
stale badge — no client-side changes required.

### KV write contract

```ts
// Non-fatal: KV write failures are caught and logged; they must not
// propagate to the caller.
void kvPut(env.CACHE_KV, key, data, ttlSeconds);
```

---

## Rationale

1. **Resilience** — clients see usable (slightly stale) data instead of an
   empty error card when upstream is down.
2. **Zero client changes** — the stale envelope format was already defined in
   the worker response contract (ADR-011); the client stale-badge UI already
   exists.
3. **Non-fatal writes** — KV write failures must not interrupt the happy path.
   `kvPut` wraps `kv.put` in a try/catch and logs via `console.error`.
4. **TTL hygiene** — alerts use a 1 h TTL (vs 24 h) because stale alert data
   older than an hour is potentially dangerous to display as current.

---

## Consequences

- Requires `CACHE_KV` KV namespace bound to the worker (already present for
  weather/currency routes).
- `handleStocks`, `handleAlerts`, and `handleCrypto` now accept an `Env`
  parameter (see ADR-015 for the Env type isolation strategy).
- KV reads add ~1–5 ms latency to the error path only; the happy path is
  unchanged.

---

## Alternatives Considered

| Option                               | Reason rejected                                          |
| ------------------------------------ | -------------------------------------------------------- |
| Return 502 with `Retry-After` header | Clients still show error state                           |
| Cache in Durable Objects             | Overkill; KV TTL is sufficient                           |
| Cache at CDN layer (Cache API)       | Already used for TTL; KV needed for stale-serve-on-error |
