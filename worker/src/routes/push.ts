/**
 * FamilyDashBoard Worker — Web Push VAPID (ADR-091)
 *
 * Full VAPID JWT implementation for opt-in browser push notifications.
 * Gated behind VAPID_ENABLED environment variable and user opt-in (3+ requests gate).
 *
 * Routes:
 *   GET  /api/push/key       → returns the VAPID public key for browser PushManager.subscribe()
 *   POST /api/push/subscribe → stores a PushSubscription in KV (TTL: 90 days)
 *   DELETE /api/push/subscribe → removes a PushSubscription
 *   POST /api/push/send     → token-gated; signs VAPID JWT, sends push to all subscriptions
 *
 * VAPID JWT signing (RFC 8292):
 *   1. Decode the raw 32-byte P-256 private scalar from URL-safe base64.
 *   2. Wrap in PKCS#8 DER format for WebCrypto import.
 *   3. Build JWT { typ:"JWT", alg:"ES256" } / { aud, exp, sub }.
 *   4. Sign with crypto.subtle ECDSA/P-256/SHA-256 (IEEE P1363 — two 32-byte ints).
 *   5. Authorization header: `vapid t=<jwt>,k=<vapid-public-key>`
 *
 * Message payload: empty (bare ping push) — the service worker shows a generic alert.
 * Expired subscriptions (HTTP 410) are removed automatically on send.
 *
 * Security: POST /api/push/send requires Bearer ERROR_REPORTING_TOKEN.
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

// ── VAPID JWT helpers (RFC 8292) ──────────────────────────────────────────────

/** Decode URL-safe base64 to Uint8Array. */
function decodeBase64url(b64url: string): Uint8Array {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encode Uint8Array or UTF-8 string to URL-safe base64 (no padding). */
function encodeBase64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Wrap a raw 32-byte P-256 private scalar in PKCS#8 DER for WebCrypto `importKey("pkcs8", ...)`.
 *
 * The structure is: SEQUENCE { INTEGER(0), SEQUENCE { OID ecPublicKey, OID P-256 },
 *   OCTET STRING { SEQUENCE { INTEGER(1), OCTET STRING privateKey } } }
 */
function rawP256ToPkcs8(rawKey: Uint8Array): Uint8Array {
  // PKCS#8 header for P-256 raw private key (35 bytes total preceding the 32-byte key)
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04,
    0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(header.length + rawKey.length);
  pkcs8.set(header);
  pkcs8.set(rawKey, header.length);
  return pkcs8;
}

/**
 * Build and sign a VAPID JWT for the given push endpoint.
 *
 * @param privateKeyB64url - URL-safe base64 raw P-256 private scalar (from VAPID_PRIVATE_KEY).
 * @param endpoint         - Full push endpoint URL (audience derived from its origin).
 * @returns Signed JWT string `<header>.<payload>.<signature>`.
 */
export async function buildVapidJwt(privateKeyB64url: string, endpoint: string): Promise<string> {
  const rawPriv = decodeBase64url(privateKeyB64url);
  const pkcs8Bytes = rawP256ToPkcs8(rawPriv);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Bytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const aud = new URL(endpoint).origin;
  const header = encodeBase64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encodeBase64url(
    JSON.stringify({
      aud,
      exp: Math.floor(Date.now() / 1000) + 43200, // 12 hours
      sub: "mailto:admin@familydashboard.local",
    }),
  );

  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${encodeBase64url(new Uint8Array(sig))}`;
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
 * Broadcasts an alert push notification to all stored subscriptions using VAPID JWT signing.
 * Requires Bearer ERROR_REPORTING_TOKEN for authorization (admin gate).
 *
 * VAPID must be enabled and both VAPID_PRIVATE_KEY + VAPID_PUBLIC_KEY must be provisioned.
 * Sends a bare push (no encrypted body payload) — the service worker shows a generic alert.
 * Expired subscriptions (HTTP 410 from push service) are automatically removed.
 *
 * Returns { ok: true, sent: N, expired: M } on success.
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

  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
    return jsonResponse({ ok: false, error: "vapid_keys_not_provisioned" }, 501);
  }

  // List all stored subscriptions from KV
  const listResult = await env.CACHE_KV.list({ prefix: KV_PREFIX });
  const subscriptionKeys = listResult.keys.map((k) => k.name);

  if (subscriptionKeys.length === 0) {
    return jsonResponse({ ok: true, sent: 0, expired: 0, message: "no_subscribers" });
  }

  // Fetch subscription objects from KV
  const subscriptions: Array<{ sub: PushSubscription; kvKey: string }> = [];
  await Promise.all(
    subscriptionKeys.map(async (kvKey) => {
      const raw = await env.CACHE_KV.get(kvKey);
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isPushSubscription(parsed)) subscriptions.push({ sub: parsed, kvKey });
      } catch {
        // Skip malformed entries
      }
    }),
  );

  // Send push notifications with VAPID JWT authorization
  let sent = 0;
  const expiredKeys: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async ({ sub, kvKey }) => {
      try {
        const jwt = await buildVapidJwt(env.VAPID_PRIVATE_KEY!, sub.endpoint);
        const vapidHeader = `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY!}`;

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            Authorization: vapidHeader,
            TTL: "3600",
            Urgency: "high",
            "Content-Length": "0",
          },
        });

        if (res.status === 410) {
          // Push service reports subscription expired — schedule removal
          expiredKeys.push(kvKey);
        } else if (res.ok || res.status === 201) {
          sent++;
        }
      } catch {
        // Network error — skip this subscriber (do not remove)
      }
    }),
  );

  // Remove expired subscriptions (immediate KV expiry)
  await Promise.allSettled(
    expiredKeys.map((key) => env.CACHE_KV.put(key, "", { expirationTtl: 1 })),
  );

  return jsonResponse({ ok: true, sent, expired: expiredKeys.length });
}
