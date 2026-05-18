/**
 * Tests for worker/src/routes/push.ts
 *
 * Covers: VAPID key endpoint, subscribe (validation, store), unsubscribe, send (auth gate, 501).
 */

import { describe, it, expect, vi } from "vitest";
import {
  handlePushKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushSend,
} from "../../../worker/src/routes/push";
import type { Env } from "../../../worker/src/types";

// ── Stubs ─────────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<Env>): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
    },
    ...overrides,
  } as unknown as Env;
}

const VALID_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BGb8v8XmzCsgabcd1234",
    auth: "secret123",
  },
};

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── handlePushKey ─────────────────────────────────────────────────────────────

describe("handlePushKey", () => {
  it("returns 503 when VAPID_PUBLIC_KEY is not configured", () => {
    const env = makeEnv();
    const res = handlePushKey(env);
    expect(res.status).toBe(503);
  });

  it("returns the public key when configured", async () => {
    const env = makeEnv({ VAPID_PUBLIC_KEY: "BGb8testpublickey" });
    const res = handlePushKey(env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; publicKey: string };
    expect(body.ok).toBe(true);
    expect(body.publicKey).toBe("BGb8testpublickey");
  });
});

// ── handlePushSubscribe ───────────────────────────────────────────────────────

describe("handlePushSubscribe", () => {
  it("returns 503 when VAPID_ENABLED is not set", async () => {
    const env = makeEnv();
    const req = jsonRequest("https://worker.dev/api/push/subscribe", VALID_SUBSCRIPTION);
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(503);
  });

  it("returns 503 when VAPID_ENABLED is not 'true'", async () => {
    const env = makeEnv({ VAPID_ENABLED: "false" });
    const req = jsonRequest("https://worker.dev/api/push/subscribe", VALID_SUBSCRIPTION);
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(503);
  });

  it("returns 400 when Content-Type is not application/json", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true" });
    const req = new Request("https://worker.dev/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(VALID_SUBSCRIPTION),
    });
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("content_type_required");
  });

  it("returns 400 for invalid JSON body", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true" });
    const req = new Request("https://worker.dev/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("returns 400 when subscription is missing keys", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true" });
    const req = jsonRequest("https://worker.dev/api/push/subscribe", {
      endpoint: "https://fcm.googleapis.com/send/abc",
      // missing keys field
    });
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_subscription");
  });

  it("returns 400 when endpoint is HTTP not HTTPS", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true" });
    const req = jsonRequest("https://worker.dev/api/push/subscribe", {
      endpoint: "http://fcm.googleapis.com/send/abc",
      keys: { p256dh: "key", auth: "auth" },
    });
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("endpoint_must_be_https");
  });

  it("stores subscription in KV and returns 201 with id", async () => {
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({
      VAPID_ENABLED: "true",
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: kvPut,
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    const req = jsonRequest("https://worker.dev/api/push/subscribe", VALID_SUBSCRIPTION);
    const res = await handlePushSubscribe(req, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; id: string };
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe("string");
    expect(body.id).toHaveLength(16); // 8 bytes hex
    expect(kvPut).toHaveBeenCalledOnce();
    const [kvKey, kvValue, kvOpts] = kvPut.mock.calls[0] as [
      string,
      string,
      { expirationTtl: number },
    ];
    expect(kvKey).toMatch(/^push:sub:[0-9a-f]{16}$/);
    expect(JSON.parse(kvValue)).toEqual(VALID_SUBSCRIPTION);
    expect(kvOpts.expirationTtl).toBe(90 * 24 * 60 * 60);
  });
});

// ── handlePushUnsubscribe ─────────────────────────────────────────────────────

describe("handlePushUnsubscribe", () => {
  it("returns 503 when VAPID_ENABLED is not set", async () => {
    const env = makeEnv();
    const req = jsonRequest(
      "https://worker.dev/api/push/subscribe",
      { endpoint: "https://example.com" },
      "DELETE",
    );
    const res = await handlePushUnsubscribe(req, env);
    expect(res.status).toBe(503);
  });

  it("returns 400 for missing endpoint field", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true" });
    const req = jsonRequest(
      "https://worker.dev/api/push/subscribe",
      { notEndpoint: "foo" },
      "DELETE",
    );
    const res = await handlePushUnsubscribe(req, env);
    expect(res.status).toBe(400);
  });

  it("expires the subscription KV key and returns 200 with id", async () => {
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({
      VAPID_ENABLED: "true",
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: kvPut,
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    const req = jsonRequest(
      "https://worker.dev/api/push/subscribe",
      { endpoint: VALID_SUBSCRIPTION.endpoint },
      "DELETE",
    );
    const res = await handlePushUnsubscribe(req, env);
    expect(res.status).toBe(200);
    expect(kvPut).toHaveBeenCalledOnce();
    const [, , opts] = kvPut.mock.calls[0] as [string, string, { expirationTtl: number }];
    expect(opts.expirationTtl).toBe(1); // immediate expiry
  });
});

// ── handlePushSend ────────────────────────────────────────────────────────────

describe("handlePushSend", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true", ERROR_REPORTING_TOKEN: "secret" });
    const req = new Request("https://worker.dev/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", body: "Alert" }),
    });
    const res = await handlePushSend(req, env);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true", ERROR_REPORTING_TOKEN: "correct-token" });
    const req = new Request("https://worker.dev/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({ title: "Test", body: "Alert" }),
    });
    const res = await handlePushSend(req, env);
    expect(res.status).toBe(401);
  });

  it("returns 503 when VAPID_ENABLED is not set (even with correct token)", async () => {
    const env = makeEnv({ ERROR_REPORTING_TOKEN: "tok" });
    const req = new Request("https://worker.dev/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tok",
      },
      body: JSON.stringify({ title: "Test", body: "Alert" }),
    });
    const res = await handlePushSend(req, env);
    expect(res.status).toBe(503);
  });

  it("returns 501 (skeleton) when token is correct and VAPID enabled", async () => {
    const env = makeEnv({ VAPID_ENABLED: "true", ERROR_REPORTING_TOKEN: "tok" });
    const req = new Request("https://worker.dev/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tok",
      },
      body: JSON.stringify({ title: "Test Alert", body: "Tzeva Adom!" }),
    });
    const res = await handlePushSend(req, env);
    expect(res.status).toBe(501);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("not_implemented");
  });
});
