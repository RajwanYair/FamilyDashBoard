/**
 * Worker unit tests — ERRORS_QUEUE integration (V13-S26, ADR-032)
 *
 * Tests that:
 *  - handleErrors() enqueues a batch message when ERRORS_QUEUE is present
 *  - handleErrors() does not fail when ERRORS_QUEUE.send() throws
 *  - handleErrorsQueue() acks all messages and logs them
 */

import { describe, it, expect, vi } from "vitest";
import { handleErrors, handleErrorsQueue } from "../../../worker/src/routes/errors";
import type { Env, WorkersQueue, ErrorQueueMessage } from "../../../worker/src/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeKV(
  overrides: Partial<{
    get: () => Promise<string | null>;
    put: () => Promise<void>;
    list: () => Promise<unknown>;
  }> = {},
) {
  return {
    get: overrides.get ?? (async () => null),
    put: overrides.put ?? (async () => undefined),
    list: overrides.list ?? (async () => ({ keys: [], list_complete: true, cacheStatus: null })),
  };
}

function makeQueue(overrides: Partial<WorkersQueue> = {}): WorkersQueue {
  return {
    send: overrides.send ?? vi.fn(async () => undefined),
    sendBatch: overrides.sendBatch ?? vi.fn(async () => undefined),
  };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: makeKV(),
    ...overrides,
  } as unknown as Env;
}

function makeErrorRequest(entries: unknown[] = [{ ts: 1000, message: "oops" }]): Request {
  return new Request("https://example.com/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
}

// ── Queue enqueue tests ───────────────────────────────────────────────────────

describe("handleErrors — ERRORS_QUEUE enqueue", () => {
  it("calls queue.send() once when ERRORS_QUEUE is present and entries are valid", async () => {
    const queueSend = vi.fn(async () => undefined);
    const env = makeEnv({ ERRORS_QUEUE: makeQueue({ send: queueSend }) });
    const req = makeErrorRequest([{ ts: Date.now(), message: "test error" }]);

    const res = await handleErrors(req, env);
    expect(res.status).toBe(204);
    expect(queueSend).toHaveBeenCalledTimes(1);
  });

  it("sends a valid ErrorQueueMessage with correct fields", async () => {
    const captured: unknown[] = [];
    const queueSend = vi.fn(async (body: unknown) => {
      captured.push(body);
    });
    const env = makeEnv({ ERRORS_QUEUE: makeQueue({ send: queueSend }) });
    const req = makeErrorRequest([
      { ts: Date.now(), message: "first" },
      { ts: Date.now(), message: "second" },
    ]);

    await handleErrors(req, env);

    expect(captured).toHaveLength(1);
    const msg = captured[0] as ErrorQueueMessage;
    expect(msg.count).toBe(2);
    expect(msg.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(msg.kvPrefix).toBe(`errors:${msg.dateKey}:`);
    expect(typeof msg.enqueuedAt).toBe("string");
  });

  it("still returns 204 when queue.send() throws", async () => {
    const queueSend = vi.fn(async () => {
      throw new Error("queue unavailable");
    });
    const env = makeEnv({ ERRORS_QUEUE: makeQueue({ send: queueSend }) });
    const req = makeErrorRequest([{ ts: Date.now(), message: "err" }]);

    const res = await handleErrors(req, env);
    // Queue failure must not propagate to the client
    expect(res.status).toBe(204);
  });

  it("does NOT call queue.send() when ERRORS_QUEUE is absent", async () => {
    const env = makeEnv({ ERRORS_QUEUE: undefined });
    const req = makeErrorRequest([{ ts: Date.now(), message: "test" }]);

    const res = await handleErrors(req, env);
    expect(res.status).toBe(204);
    // No assertion needed beyond not throwing
  });
});

// ── handleErrorsQueue consumer tests ─────────────────────────────────────────

describe("handleErrorsQueue — consumer", () => {
  it("acks all messages in the batch", async () => {
    const ack1 = vi.fn();
    const ack2 = vi.fn();
    const batch = {
      messages: [
        {
          body: {
            count: 3,
            dateKey: "2026-07-13",
            enqueuedAt: "2026-07-13T00:00:00Z",
            kvPrefix: "errors:2026-07-13:",
          } as ErrorQueueMessage,
          ack: ack1,
        },
        {
          body: {
            count: 1,
            dateKey: "2026-07-13",
            enqueuedAt: "2026-07-13T01:00:00Z",
            kvPrefix: "errors:2026-07-13:",
          } as ErrorQueueMessage,
          ack: ack2,
        },
      ],
    };

    await handleErrorsQueue(batch);

    expect(ack1).toHaveBeenCalledTimes(1);
    expect(ack2).toHaveBeenCalledTimes(1);
  });

  it("handles empty batch without error", async () => {
    await expect(handleErrorsQueue({ messages: [] })).resolves.toBeUndefined();
  });

  it("handles malformed message body without throwing", async () => {
    const ack = vi.fn();
    const batch = { messages: [{ body: null, ack }] };
    await expect(handleErrorsQueue(batch)).resolves.toBeUndefined();
    expect(ack).toHaveBeenCalledTimes(1);
  });
});
