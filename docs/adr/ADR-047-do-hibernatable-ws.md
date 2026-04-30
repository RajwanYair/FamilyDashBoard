# ADR-047 — DO Hibernatable WebSockets for Stocks Live + Alerts SSE

| Field      | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Date       | 2026-04-30                                                      |
| Status     | Accepted (Plan — gated on A3 and S1 Roadmap items)              |
| Sprint     | 229                                                             |
| Supersedes | n/a                                                             |
| Related    | Roadmap items A3, S1, ADR-003, ADR-006, `docs/ARCHITECTURE.md`  |

## Context

Two FamilyDashBoard features currently poll their data sources on fixed
intervals rather than streaming live updates:

| Card     | Source               | Current pattern         | Target pattern          |
| -------- | -------------------- | ----------------------- | ----------------------- |
| Stocks   | Worker KV cache      | Client polls every 60 s | Worker pushes on change |
| Alerts   | Worker SSE endpoint  | Client poll / reconnect | True SSE / WS push      |

The polling approach works but has two problems:
1. **Latency spike**: a price move is visible up to 60 s late.
2. **CPU waste**: idle Workers are invoked even when no data changed.

Cloudflare Durable Objects gained **Hibernatable WebSockets** (GA 2024-Q1):
a DO can `this.ctx.acceptWebSocket(ws)` and then `hibernate()` — the DO is
evicted from memory between messages, resuming only when a client sends data
or the DO's alarm fires. This reduces costs to near zero at idle.

## Decision

Upgrade the Stocks card's live-price channel and the Alerts card's SSE feed
to use DO Hibernatable WebSockets.

### Architecture: `FdbLiveHub` Durable Object

```
Client              Worker (request router)      FdbLiveHub DO
  |                         |                         |
  | GET /api/live/ws        |                         |
  |------------------------>|                         |
  |                         |  stub.fetch('/connect') |
  |                         |------------------------>|
  |<===============WebSocket tunnel==================>|
  |                         |                         |
  |                (DO hibernates here)               |
  |                         |                         |
  |         (alarm fires every 10 s)                  |
  |                         |     alarm()             |
  |<== {type:"stocks", ...} |<========================|
  |<== {type:"alert",  ...} |                         |
```

### Phase 1 — FdbLiveHub DO skeleton (Sprint ~243)

1. Create `worker/src/durable-objects/live-hub-do.ts`.
2. Implement `webSocketMessage()`, `webSocketClose()`, `alarm()` handlers.
3. Register in `wrangler.toml` as `LIVE_HUB_DO`.
4. Add route `GET /api/live/ws` in `worker/src/index.ts` that upgrades to
   WebSocket and delegates to `FdbLiveHub`.
5. `alarm()` fetches latest stocks + active alerts, diffs against last
   broadcast state stored in DO storage, and sends only changed data.
6. If no clients are connected, `alarm()` does nothing.

### Phase 2 — Client integration (Sprint ~244)

1. `src/cards/stocks/stocks.ts`: replace `setInterval` poll with a
   `WebSocket` connection to `/api/live/ws`. Reconnect with exponential
   backoff on close.
2. `src/cards/alerts/alerts.ts`: same pattern; filter received messages for
   `type === "alert"`.
3. Both cards keep the existing polling path as a fallback (feature-flag via
   `loadConfig().liveWsEnabled`).
4. Update `src/core/event-bus.ts` to re-emit WS messages as internal events
   so other cards can subscribe without opening their own sockets.

### Phase 3 — Retire polling (Sprint ~248)

Remove the 60-second `setInterval` loops from stocks and alerts once the
WebSocket path is stable (30+ days, no reconnect storms observed).

## Consequences

**Positive**
- Stocks updates visible within ~10 s of market move (vs. up to 60 s).
- Alert push latency: < 2 s (vs. poll interval).
- Worker CPU cost reduced: DO hibernates between alarms.
- Single persistent WS connection per browser tab (vs. repeated poll fetches).

**Negative / Risks**
- Durable Objects with WebSocket Hibernation are CF-only → vendor lock-in
  increases for real-time path. Mitigated by ADR-031: fallback to polling
  is always available via feature flag.
- DO cold-start adds ~100 ms on first connection. Acceptable on a kiosk.
- `WebSocket` client reconnect must handle Cloudflare's 100-second idle
  timeout — use a 90-second ping/pong heartbeat.

## Alternatives Considered

| Option                     | Why Not Chosen                                     |
| -------------------------- | -------------------------------------------------- |
| Server-Sent Events (SSE)   | SSE is one-directional; WS enables future commands |
|                            | (e.g., mute-alert, refresh-stocks on demand)        |
| HTTP/2 Push                | Not supported in CF Workers as of 2026             |
| Continue polling            | Chosen as fallback only — too high latency for live |
| DO without Hibernation     | Always-on DO costs \$5+/month at idle; unacceptable |

## Gate Conditions

This ADR is **gated** until both A3 (live stocks) and S1 (DO Hibernatable
alerts) are prioritised in the roadmap backlog. The gate opens when:
- The FdbLiveHub skeleton passes type-check and unit tests with zero errors.
- Stryker mutation score for `live-hub-do.ts` ≥ 80%.
- Manual test: stock card updates within 15 s of a simulated price change.

## References

- [Cloudflare Hibernatable WebSockets docs](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/api/hibernatable-websockets-api/)
- ADR-003: Worker-first API pattern
- ADR-006: Worker normalised data model
