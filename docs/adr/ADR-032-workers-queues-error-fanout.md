# ADR-032 — Workers Queues for Error-Reporter Fan-out

| Field       | Value                                            |
| ----------- | ------------------------------------------------ |
| **Date**    | 2026-04-23                                       |
| **Status**  | Accepted                                         |
| **Deciders** | @RajwanYair                                     |
| **Tags**    | worker, queues, errors, observability, resilience |

---

## Context

`POST /api/errors` currently ingests client error payloads synchronously:

1. Parse + validate with Valibot.
2. Write up to 20 errors to KV.
3. Return 204.

Under normal conditions this is fast (< 50 ms). Under bursts (e.g., a JS exception storm after a
bad deploy) the synchronous KV write path adds latency to every request, and KV rate limits
(`1 000 writes/s`) can cause errors to be silently dropped.

Workers Queues (GA 2024, free tier: 1 M messages/month) solve both problems:

- The route handler enqueues the payload in < 5 ms and returns 204 immediately.
- The queue consumer runs asynchronously, retries on failure (max 3 attempts), and batches
  KV writes.
- Backpressure is handled by the queue, not the request handler.

---

## Decision

Adopt Workers Queues for the error-reporter ingestion path:

1. Declare a `ERRORS_QUEUE` binding in `wrangler.toml`.
2. `/api/errors` handler enqueues the validated payload via `env.ERRORS_QUEUE.send(payload)`.
3. Add `queue` export to `worker/src/index.ts` — `handleErrorsQueue(batch, env)` consumes
   batches (up to 20) and writes to KV.
4. Dead-letter: after 3 retries the message is discarded (errors are non-critical telemetry).
5. Existing behaviour (KV write) is preserved as the queue consumer logic — code moves, not changes.

Fallback: when `env.ERRORS_QUEUE` is absent (local dev, non-CF deploys), the handler falls
back to the existing synchronous KV write. Feature flag: `QUEUES_ENABLED === "true"`.

---

## Consequences

### Good

- `/api/errors` p95 latency improves from ~45 ms → ~8 ms.
- No dropped errors under KV write-rate bursts.
- Retries on transient KV failures.

### Neutral

- Messages may arrive out of order (queue does not guarantee ordering).
- Adds one new CF binding (`Queue`); drill target must stub it (ADR-031).

**Related ADRs**: ADR-016 (error reporting), ADR-013 (KV stale cache), ADR-031 (vendor drill).
