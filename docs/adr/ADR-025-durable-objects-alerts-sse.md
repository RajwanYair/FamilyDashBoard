# ADR-025 — Durable Objects for Alerts SSE Fan-out

**Status:** Proposed (stub implemented; full SSE deferred to v12.2)
**Date:** 2025-01
**Deciders:** Dashboard maintainer
**Tags:** edge · real-time · durable-objects · sse

---

## Context

The Alerts (Tzeva Adom) card currently polls `/api/alerts` every 60 seconds.
This creates unnecessary upstream load on the Tzeva Adom API and adds a full
minute of latency between a real alarm event and the dashboard notification.

**Goal:** Push new alert events to all connected dashboard tabs as soon as
they are detected — ideally within a few seconds — without changing the
client-side rendering code.

## Options Considered

| Option | Latency | Complexity | Cost |
|---|---|---|---|
| **Status quo — polling** | ~60s | Low | Minimal |
| **Server-Sent Events via DO** | <5s | Medium | CF Paid plan |
| **WebSocket via DO** | <1s | High | CF Paid plan |
| **Cloudflare Queues** | ~1s | Medium | CF Paid plan |

## Decision

Use a **Durable Object** (`AlertsOrchestrator`) as a single coordination point:

1. A Cloudflare cron alarm fires every 30 s, hits the Tzeva Adom upstream,
   and delivers any new alerts to the DO via `POST /alarm`.
2. The DO maintains an in-memory list of connected SSE clients.
3. New alerts are fanned out to all open `ReadableStream` connections held by
   the DO instance.
4. The dashboard client upgrades from `setInterval` polling to
   `EventSource('/api/alerts/stream')` with an automatic reconnect.

## Current Status (v12.1 — stub only)

- `worker/src/durable-objects/alerts-orchestrator.ts`: minimal DO class
  satisfying the CF type contract — persists alarm count to DO storage.
- DO is bound in `wrangler.toml` as `ALERTS_DO` and exported from `index.ts`.
- No live SSE endpoint is wired yet — that requires a CF paid plan and is
  deferred to **v12.2**.

## Consequences

- **+** Architecture is ready for SSE; adding the fan-out path in v12.2 is a
  small incremental diff.
- **+** Type stubs for `DurableObjectNamespace`, `DurableObjectStub` are in
  `worker/src/types.ts` and tested structurally.
- **-** Requires Cloudflare Workers Paid plan to deploy the DO class.
- **-** DO class must be exported from the top-level module for `wrangler`
  to discover it (done via `export { AlertsOrchestrator }` in `index.ts`).

## Migration Path to v12.2

1. Implement `GET /api/alerts/stream` → `ReadableStream` SSE response.
2. Add alarm scheduling in `AlertsOrchestrator.alarm()`.
3. Replace `setInterval(loadAlerts, 60_000)` in `src/cards/alerts/alerts.ts`
   with `new EventSource(...)` + fallback to polling on EventSource error.
4. Update DO storage to hold latest alert snapshot for new connections
   (so they get immediate data without waiting for the next alarm).
