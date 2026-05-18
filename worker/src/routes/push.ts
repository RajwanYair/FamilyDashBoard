/**
 * FamilyDashBoard Worker — Web Push VAPID skeleton (ADR-091)
 *
 * Infrastructure skeleton for opt-in browser push notifications.
 * Gated behind VAPID_ENABLED environment variable and user opt-in (3+ requests gate).
 *
 * Current state (skeleton):
 *   POST /api/push/subscribe → stores subscription endpoint (stub, KV-backed)
 *   POST /api/push/send      → triggers a push broadcast (returns 501 until VAPID keys provisioned)
 *   GET  /api/push/key       → returns the VAPID public key for the browser to use
 *
 * To activate:
 *   1. Generate VAPID key pair: wrangler secret put VAPID_PRIVATE_KEY
 *                               wrangler secret put VAPID_PUBLIC_KEY
 *   2. Set VAPID_ENABLED=true  in wrangler.toml [vars]
 *   3. Implement actual VAPID JWT signing in handlePushSend()
 *
 * Security: POST endpoints validate Content-Type; subscription endpoint is unauthenticated
 * (any client can subscribe). Send endpoint is token-gated to prevent abuse.
 *
 * ADR reference: ADR-091.
 */

import { jsonResponse } from "../utils/response";
import type { Env } from "../types";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * KV key prefix for stored push subscriptions.
 * Full key: `push:sub:<sha256(endpoint)[:16]>`
 */
const KV_PREFIX = "push:sub:";

/**
 * Derive a short stable ID from a subscription endpoint URL.
 * Uses the first 16 hex characters of SHA-256 (8 bytes — collision-resistant enough for KV keys).
 */
async function endpointId(endpoint: string): Promise<string> {
  const encoded = new TextEncoder().encode(endpoint);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(hashBuf);
  return Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Push subscription type ────────────────────────────────────────────────────

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function isPushSubscription(value: unknown): value is PushSubscription {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.endpoint !== "string" || obj.endpoint.length === 0) return false;
  if (typeof obj.keys !== "object" || obj.keys === null) return false;
  const keys = obj.keys as Record<string, unknown>;
  return typeof keys.p256dh === "string" && typeof keys.auth === "string";
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/push/key
 *
 * Returns the VAPID public key for the browser to use when creating a push subscription.
 * Returns 503 when VAPID is not yet configured.
 */
export function handlePushKey(env: Env): Response {
  if (!env.VAPID_PUBLIC_KEY) {
    return jsonResponse({ ok: false, error: "vapid_not_configured" }, 503);
  }
  return jsonResponse({ ok: true, publicKey: env.VAPID_PUBLIC_KEY });
}

/**
 * POST /api/push/subscribe
 *
 * Stores a browser PushSubscription object in KV.
 * Endpoint is unauthenticated — any client with a valid subscription can register.
 *
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 * Returns 201 on success, 400 on validation error, 503 when VAPID not enabled.
 */
export async function handlePushSubscribe(request: Request, env: Env): Promise<Response> {
  if (!env.VAPID_ENABLED || env.VAPID_ENABLED !== "true") {
    return jsonResponse({ ok: false, error: "vapid_not_enabled" }, 503);
  }

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "content_type_required" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  if (!isPushSubscription(body)) {
    return jsonResponse({ ok: false, error: "invalid_subscription" }, 400);
  }

  // Validate endpoint is HTTPS
  try {
    const endpointUrl = new URL(body.endpoint);
    if (endpointUrl.protocol !== "https:") {
      return jsonResponse({ ok: false, error: "endpoint_must_be_https" }, 400);
    }
  } catch {
    return jsonResponse({ ok: false, error: "invalid_endpoint_url" }, 400);
  }

  // Store subscription in KV (TTL: 90 days — subscriptions expire if not renewed)
  const id = await endpointId(body.endpoint);
  const kvKey = `${KV_PREFIX}${id}`;
  const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
  await env.CACHE_KV.put(kvKey, JSON.stringify(body), { expirationTtl: TTL_SECONDS });

  return jsonResponse({ ok: true, id }, 201);
}

/**
 * DELETE /api/push/subscribe
 *
 * Removes a stored push subscription from KV.
 * Body: { endpoint: string }
 */
export async function handlePushUnsubscribe(request: Request, env: Env): Promise<Response> {
  if (!env.VAPID_ENABLED || env.VAPID_ENABLED !== "true") {
    return jsonResponse({ ok: false, error: "vapid_not_enabled" }, 503);
  }

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "content_type_required" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { endpoint?: unknown }).endpoint !== "string"
  ) {
    return jsonResponse({ ok: false, error: "invalid_body" }, 400);
  }

  const endpoint = (body as { endpoint: string }).endpoint;
  const id = await endpointId(endpoint);
  const kvKey = `${KV_PREFIX}${id}`;
  await env.CACHE_KV.put(kvKey, "", { expirationTtl: 1 }); // immediate expiry

  return jsonResponse({ ok: true, id });
}

/**
 * POST /api/push/send
 *
 * Triggers a push notification broadcast to all stored subscriptions.
 * Currently returns 501 — VAPID signing not yet implemented.
 * Requires ERROR_REPORTING_TOKEN for authorization (reused as an admin gate).
 *
 * Body: { title: string, body: string, severity?: string }
 */
export async function handlePushSend(request: Request, env: Env): Promise<Response> {
  // Authorization gate: require token to prevent push spam
  const auth = request.headers.get("Authorization");
  const token = env.ERROR_REPORTING_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  if (!env.VAPID_ENABLED || env.VAPID_ENABLED !== "true") {
    return jsonResponse({ ok: false, error: "vapid_not_enabled" }, 503);
  }

  // Skeleton: return 501 until full VAPID signing is implemented
  // Full implementation will:
  //   1. List all push:sub:* keys from KV
  //   2. Sign a VAPID JWT with VAPID_PRIVATE_KEY (using crypto.subtle ECDSA P-256)
  //   3. Encrypt the payload with the subscription's p256dh key (RFC 8291)
  //   4. POST to each subscription.endpoint with the encrypted payload
  //   5. Remove expired subscriptions (HTTP 410 from push service)
  return jsonResponse({ ok: false, error: "not_implemented" }, 501);
}
