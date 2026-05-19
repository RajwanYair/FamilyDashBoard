# ADR-091 — Web Push VAPID Skeleton for Alert Notifications

**Status**: Accepted (skeleton — gated behind 3+ user requests and VAPID provisioning)
**Date**: 2025-07-14
**Authors**: FamilyDashBoard maintainers
**Supersedes**: —
**Superseded by**: —
**Related**: ADR-025 (AlertsOrchestrator SSE), ADR-089 (AlertsLiveDO WS), ROADMAP D7 / A-Push

---

## Context

FamilyDashBoard delivers security alerts (Pikud Ha-Oref / Tzeva-Adom) to an always-on TV display.
When the display is off or the browser tab is backgrounded, the alert card shows nothing — the
dashboard is a polling/SSE client, not a push client.

The ROADMAP (§6.4 CONTINUITY, D7 / A-Push) specifies opt-in Web Push for alerts on a companion
phone as a P2 item, gated behind **3+ explicit user requests**. Until that gate is met, the feature
must have minimal worker code surface (no dead code, no exposure to unauthenticated routes that do
nothing useful).

Web Push (RFC 8030) with VAPID (RFC 8292) allows a Worker to send encrypted push notifications to
any browser that has called `PushManager.subscribe()` with the Worker's public key. The encrypted
payload is delivered through the browser vendor's push service (FCM, APNs, etc.) and displayed as
a system notification by the Service Worker.

---

## Decision

We implement a **skeleton** of the Web Push VAPID infrastructure in the Cloudflare Worker:

1. `GET /api/push/key` — returns the VAPID public key (for `PushManager.subscribe()`).
2. `POST /api/push/subscribe` — stores a `PushSubscription` in `CACHE_KV` (TTL: 90 days).
3. `DELETE /api/push/subscribe` — removes a subscription (immediate KV expiry).
4. `POST /api/push/send` — token-gated endpoint that returns `501 not_implemented` until VAPID
   signing is fully implemented.

All four routes return `503 vapid_not_enabled` when `VAPID_ENABLED !== "true"`, making the entire
feature opt-in at the environment level. No VAPID key generation or ECDSA signing is included in
this skeleton.

### Gating strategy

| Gate                       | State       | Action                                            |
| -------------------------- | ----------- | ------------------------------------------------- |
| `VAPID_ENABLED` env var    | Not set     | All `/api/push/*` return 503                      |
| `VAPID_PUBLIC_KEY` secret  | Not set     | GET /api/push/key returns 503                     |
| `VAPID_PRIVATE_KEY` secret | Not set     | POST /api/push/send returns 501 (not_implemented) |
| 3+ user requests gate      | Not yet met | Feature not exposed to users                      |

### Security considerations

- `POST /api/push/subscribe` is unauthenticated — any client can register a subscription endpoint.
  This is intentional: browsers cannot authenticate themselves before Push subscription, and
  the stored endpoint is only a URL + public encryption key (no PII).
- `POST /api/push/send` requires `Authorization: Bearer <ERROR_REPORTING_TOKEN>` — reuses the
  existing admin token gate to prevent push spam until a dedicated auth mechanism is designed.
- Subscription endpoints are validated to be HTTPS-only.
- KV entries expire after 90 days — push subscriptions silently expire if not renewed by the client.

---

## Architecture

```text
Browser
  └── PushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
        └── POST /api/push/subscribe { endpoint, keys: {p256dh, auth} }
              └── CACHE_KV.put("push:sub:<id>", JSON, { expirationTtl: 7776000 })

Admin / Worker cron
  └── POST /api/push/send (Authorization: Bearer <token>)
        └── [501 until implemented]
              └── Future: ECDSA-P256 VAPID JWT + RFC 8291 payload encryption
                          → POST to subscription.endpoint (FCM/APNs)
```

---

## Full VAPID Implementation Plan (post gate-unlock)

When the 3+ requests gate is met and VAPID keys are provisioned:

1. **Generate VAPID keys**: `wrangler secret put VAPID_PRIVATE_KEY` + `VAPID_PUBLIC_KEY`
   (P-256 key pair, URL-safe base64 encoded).
2. **Implement `handlePushSend()`**:
   - `CACHE_KV.list({ prefix: "push:sub:" })` → all stored subscriptions.
   - For each subscription, build the VAPID JWT:
     - Header: `{"typ":"JWT","alg":"ES256"}`
     - Claims: `{"aud":<push service origin>,"exp":<now+12h>,"sub":"mailto:owner@example.com"}`
     - Sign with P-256 ECDSA using `crypto.subtle.sign("ECDSA", privateKey, data)`
   - Encrypt the push payload per RFC 8291 (AES-128-GCM with subscription's `p256dh` key).
   - `POST <subscription.endpoint>` with `Authorization: vapid t=<jwt>,k=<pubkey>`.
   - Remove subscriptions that return HTTP 410 (Gone — subscription expired on push service).
3. **Add client-side opt-in UI**: `src/ui/push-opt-in.ts` (not part of this ADR).

---

## Consequences

### Positive

- Infrastructure is in place before the user-request gate is met — zero rework when gate unlocks.
- Fail-closed gating ensures no accidental push spam in dev/staging environments.
- Subscription storage is trivially testable via KV stubs (16 unit tests passing).
- TTL-based subscription expiry prevents stale endpoint accumulation.

### Negative / Risks

- KV is not ideal for large-scale subscription fan-out (no secondary indexes). If the subscriber
  count grows beyond ~10000, migrate to D1 or an external store.
- The 501 skeleton means `POST /api/push/send` is publicly reachable (but gated by token) and
  always returns an error — no DoS risk, but consumes a small amount of Worker CPU per request.
- VAPID key rotation is not addressed — future ADR required if keys are compromised.

---

## References

- [RFC 8030 — Generic Event Delivery Using HTTP Push](https://www.rfc-editor.org/rfc/rfc8030)
- [RFC 8292 — Voluntary Application Server Identification (VAPID)](https://www.rfc-editor.org/rfc/rfc8292)
- [RFC 8291 — Message Encryption for Web Push](https://www.rfc-editor.org/rfc/rfc8291)
- [Web Push Protocol — Google Web Fundamentals](https://web.dev/push-notifications-web-push-protocol/)
- `worker/src/routes/push.ts` — skeleton implementation
- `tests/unit/worker/push.test.ts` — 16 unit tests
- `docs/adr/ADR-089-alerts-live-do-hibernatable-ws.md` — AlertsLiveDO (in-app delivery)
