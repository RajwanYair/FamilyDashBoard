# ADR-089 — AlertsLiveDO: Hibernatable WebSocket DO for real-time alert fan-out

**Status**: Accepted
**Date**: 2026-07-11
**Deciders**: @RajwanYair

---

## Context

The alerts card currently delivers real-time Tzeva Adom notifications via Server-Sent Events
(SSE) through `AlertsOrchestrator`. SSE requires an open TCP connection per subscriber, and
the Durable Object pays CPU cost for the entire duration of that connection — including idle
seconds between alerts.

The ROADMAP §6.2 PLATFORM stream calls for migrating alerts delivery to the
**WebSocket Hibernation API** to eliminate CPU billing at idle, mirroring the
pattern shipped for stocks live updates (ADR-087).

Requirements:

- Single persistent WebSocket connection per browser client.
- Global broadcast: all connected clients receive every alert (no per-socket filtering).
- Zero CPU billing between alerts (hibernation mandate).
- Backward compatibility: SSE endpoint (`/api/alerts/subscribe`) must remain operational
  for older clients during the migration window.
- No new npm dependencies — pure Cloudflare primitives only.

## Decision

Introduce `AlertsLiveDO` (`worker/src/durable-objects/alerts-live-do.ts`), a new Durable
Object that uses the Hibernatable WebSocket API via `this.ctx.acceptWebSocket(ws)`.

The existing `AlertsOrchestrator` (SSE) is kept unchanged and continues to serve
`/api/alerts/subscribe`. New clients can connect to `/api/alerts/live` for the lower-cost
WebSocket path. Both paths call the same DO broadcast endpoint (`POST /broadcast`) from cron,
so alert delivery semantics are identical.

### Architecture

```text
Client                 Worker (Hono)         AlertsLiveDO
  │  GET /api/alerts/live           │               │
  │ ──────────────────────────────► │               │
  │                                 │  idFromName() │
  │                                 │  "global"     │
  │                                 │ ────────────► │
  │◄──────── 101 Switching ─────────│               │
  │ ════════════════ WS ════════════════════════════│
  │                           acceptWebSocket(ws)   │
  │                    [DO hibernates — zero CPU]   │
  │                                                 │
  │         alert fires — cron POST /broadcast      │
  │                  ──────────────────────────────►│
  │                        getWebSockets() → all    │
  │◄── {type:"alert", data:{…}} ────────────────────│
  │                    [DO re-hibernates]           │
```

### Key choices

| Decision                                    | Rationale                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Hibernation API (not SSE)                   | Zero CPU between alerts; CF bills only active broadcast time                   |
| Global broadcast (no per-socket tags)       | Alerts are global events; per-subscriber filtering adds complexity with no gain |
| Single DO shard (`idFromName("global")`)    | Alerts volume is low; a single DO is sufficient, no sharding needed            |
| 30-second alarm for keep-alive              | Prevents idle connections from silently dying through NAT/proxy timeouts       |
| `jurisdiction = "eu"`                       | Consistent with AlertsOrchestrator — CF routes IL traffic to EU PoPs (ADR-025) |
| Backward-compat SSE preserved              | Allows phased client migration without breaking existing deployments           |

### Routes

- `GET /api/alerts/live` — WS upgrade via inline handler in `index.ts`
- Internal `POST /broadcast` — payload fan-out to all hibernating sockets
- Internal `GET /state` — diagnostic: reports live connection count

### Comparison with ADR-087 (StocksLiveDO)

| Dimension         | StocksLiveDO (ADR-087)          | AlertsLiveDO (ADR-089)          |
| ----------------- | ------------------------------- | ------------------------------- |
| Fan-out targeting | Per-symbol tags                 | All sockets (global broadcast)  |
| Sharding          | 4 shards (symbol mod 4)         | Single DO (`idFromName("global")`) |
| Push source       | Price-pusher POST /push         | Cron POST /broadcast            |
| Prior art         | HTTP polling → WS               | SSE → WS (SSE kept for compat)  |

## Consequences

### Positive

- Sub-millisecond alert delivery without SSE connection overhead.
- CPU billing only during active broadcast windows.
- Scales to hundreds of concurrent alert subscribers at near-zero cost.
- No new npm packages — uses only Cloudflare DO primitives.
- SSE path preserved: zero breaking change for deployed clients.

### Negative

- Two active DO classes for alerts during migration window (AlertsOrchestrator + AlertsLiveDO).
- Clients must implement WebSocket reconnect logic (SSE auto-reconnects; WS does not).
- wrangler.toml migration tag v4 required; one-time DO class registration needed.

## Related

- ADR-025 — AlertsOrchestrator SSE design
- ADR-087 — StocksLiveDO Hibernatable WS (pattern reference)
- ROADMAP §6.2 PLATFORM — DO Hibernatable WebSocket migration stream
