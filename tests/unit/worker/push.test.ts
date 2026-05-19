/**
 * Tests for worker/src/routes/push.ts
 *
 * Covers: VAPID key endpoint, subscribe (validation, store), unsubscribe, send (auth gate, 501).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handlePushKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushSend,
  buildVapidJwt,
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

  it("returns 501 (vapid_keys_not_provisioned) when token is correct, VAPID enabled, but keys absent", async () => {
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
    expect(body.error).toBe("vapid_keys_not_provisioned");
  });

  it("returns { ok:true, sent:0, expired:0 } when no subscribers exist", async () => {
    const env = makeEnv({
      VAPID_ENABLED: "true",
      ERROR_REPORTING_TOKEN: "tok",
      VAPID_PUBLIC_KEY: "BGb8v8XmzCsgabcd1234",
      VAPID_PRIVATE_KEY: "dGVzdHByaXZhdGVrZXkzMmJ5dGVzYWJjZA",
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    const req = new Request("https://worker.dev/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await handlePushSend(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; sent: number; expired: number };
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(0);
    expect(body.expired).toBe(0);
  });
});

// ── buildVapidJwt ─────────────────────────────────────────────────────────────

describe("buildVapidJwt (S27 VAPID JWT signing)", () => {
  // Generate a real P-256 key pair for testing
  let privateKeyB64url: string;

  beforeEach(async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    // Export private key as PKCS#8, then extract just the raw scalar (last 32 bytes)
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const pkcs8Bytes = new Uint8Array(pkcs8);
    // The raw 32-byte scalar is the last 32 bytes of the PKCS#8 DER
    const rawScalar = pkcs8Bytes.slice(pkcs8Bytes.length - 32);
    privateKeyB64url = btoa(String.fromCharCode(...rawScalar))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a three-part JWT string (header.payload.signature)", async () => {
    const jwt = await buildVapidJwt(privateKeyB64url, "https://fcm.googleapis.com/fcm/send/abc");
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
    expect(parts[2]).toBeTruthy();
  });

  it("JWT header decodes to { typ: 'JWT', alg: 'ES256' }", async () => {
    const jwt = await buildVapidJwt(privateKeyB64url, "https://fcm.googleapis.com/fcm/send/abc");
    const [headerB64] = jwt.split(".");
    const header = JSON.parse(atob((headerB64 ?? "").replace(/-/g, "+").replace(/_/g, "/"))) as unknown;
    expect(header).toEqual({ typ: "JWT", alg: "ES256" });
  });

  it("JWT payload aud matches the endpoint origin", async () => {
    const endpoint = "https://updates.push.services.mozilla.com/push/v1/abc";
    const jwt = await buildVapidJwt(privateKeyB64url, endpoint);
    const parts = jwt.split(".");
    const payload = JSON.parse(
      atob((parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")),
    ) as { aud: string; exp: number; sub: string };
    expect(payload.aud).toBe("https://updates.push.services.mozilla.com");
  });

  it("JWT payload exp is ~12 hours in the future", async () => {
    const before = Math.floor(Date.now() / 1000);
    const jwt = await buildVapidJwt(privateKeyB64url, "https://fcm.googleapis.com/abc");
    const after = Math.floor(Date.now() / 1000);
    const parts = jwt.split(".");
    const payload = JSON.parse(
      atob((parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp: number };
    expect(payload.exp).toBeGreaterThanOrEqual(before + 43200);
    expect(payload.exp).toBeLessThanOrEqual(after + 43200);
  });

  it("produces a URL-safe base64 signature (no +, /, or = chars)", async () => {
    const jwt = await buildVapidJwt(privateKeyB64url, "https://fcm.googleapis.com/abc");
    const parts = jwt.split(".");
    const sig = parts[2] ?? "";
    expect(sig).not.toMatch(/[+/=]/);
  });
});
