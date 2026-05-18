# ADR-087 — StocksLiveDO: Hibernatable WebSocket DO for live stock price fan-out

**Status**: Accepted
**Date**: 2026-06-09
**Deciders**: @RajwanYair

---

## Context

The stocks card refreshes prices via polling (`GET /api/stocks?sym=…`) every 60 seconds.
This creates N×M HTTP round-trips (N clients × M symbols × polling interval) and prevents
sub-second price updates without increasing CPU cost.

The ROADMAP §5.1 S-DO stream calls for a Durable Object backed by Cloudflare's
**WebSocket Hibernation API** to replace polling with a persistent fan-out channel.

Requirements:

- Single persistent WebSocket connection per client (not per symbol).
- Server-side per-symbol fan-out: push price batches to tagged sockets only.
- Zero CPU billing between messages (hibernation mandate).
- Max 4 shards to spread load across CF PoPs without shard explosion.
- No new npm dependencies — pure Cloudflare primitives only.

## Decision

Introduce `StocksLiveDO` (`worker/src/durable-objects/stocks-live-do.ts`), a Durable
Object that uses the Hibernatable WebSocket API via `this.ctx.acceptWebSocket(ws, tags)`.

### Architecture

```text
Client                 Worker (Hono)         StocksLiveDO
  │  GET /api/stocks/live?sym=AAPL  │               │
  │ ──────────────────────────────► │               │
  │                                 │  idFromName() │
  │                                 │  shardKey=mod4│
  │                                 │ ────────────► │
  │◄──────── 101 Switching ─────────│               │
  │ ════════════════ WS ════════════════════════════│
  │  {type:"subscribe",symbols:[…]} │               │
  │ ───────────────────────────────────────────────►│
  │                           acceptWebSocket(ws,   │
  │                           ["sym:AAPL"])         │
  │                                                 │
  │    price pusher sends POST /push to DO          │
  │                             {AAPL: 185.42, …}  │
  │                  ──────────────────────────────►│
  │                        getWebSockets("sym:AAPL")│
  │◄── {type:"prices", data:{AAPL:185.42}} ─────────│
```

### Key choices

| Decision                                    | Rationale                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Hibernation API (not `new WebSocketPair()`) | Zero CPU between messages; CF bills only active time                           |
| Tag per symbol (`sym:<TICKER>`)             | Selective fan-out — a TSLA update only wakes TSLA subscribers                  |
| Sharding by `firstCharCode % 4`             | Balances load without shard explosion; 4 DOs cover all 26 letters              |
| 30-second alarm for keep-alive              | Prevents idle connections from silently dying through NAT/proxy timeouts       |
| `jurisdiction = "eu"`                       | Consistent with AlertsOrchestrator — CF routes IL traffic to EU PoPs (ADR-025) |

### Routes

- `GET /api/stocks/live?sym=A,B,C` — WS upgrade via `handleStocksLive()` in `feeds.ts`
- Internal `POST /push` — price batch fan-out (called by price-pusher script, not public)
- Internal `GET /state` — diagnostic endpoint (circuit-breaker monitoring)

## Consequences

### Positive

- Sub-second price updates without polling overhead.
- CPU billing only during active message processing.
- Scales to hundreds of concurrent clients per shard.
- No new npm packages — uses only Cloudflare DO primitives.

### Negative

- Requires `StocksLiveDO` migration tag `v3` in `wrangler.toml`.
- `/push` endpoint must be called by a privileged internal actor (not exposed publicly).
- The client must reconnect after `subscribe` message changes tags (by design — single
  connection model; UI subscribes once at load time).

## Files Changed

- `worker/src/durable-objects/stocks-live-do.ts` — new DO implementation
- `worker/src/routes/feeds.ts` — `handleStocksLive()` function
- `worker/src/types.ts` — `STOCKS_DO?: DurableObjectNamespace` in `Env`
- `worker/src/index.ts` — export + route registration
- `worker/wrangler.toml` — binding + migration tag `v3`
