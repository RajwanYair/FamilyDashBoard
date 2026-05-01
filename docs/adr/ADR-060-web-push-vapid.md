# ADR-060: D7 — Web Push (VAPID) for Alerts → Phone (Gated)

- **Status**: Gated (3+ user requests required before implementation)
- **Date**: 2026-05-02 (v13.35.0 patch series)
- **Sprints**: 340
- **Related**: ADR-018 (CSP), ADR-058 (MCP design), ROADMAP §1.11 D7

## Context

The `alerts` card surfaces civil-defense events (rocket, earthquake,
hostile-aircraft) via `pikud-haoref` proxies. Today, alerts are visible
only when the dashboard is the active tab on a mounted TV. Several
near-family operators have asked whether high-severity alerts could
also push-notify their phones.

Web Push with VAPID (Voluntary Application Server Identification) is
the platform answer: a service worker subscribes to a push channel,
the Worker proxy holds a VAPID private key, and only severity ≥
**rocket** triggers a push. This is exactly the right shape for
civil-defense — high signal, no marketing.

## Decision

**Gate** D7 behind a measurable user-demand threshold. Implementation
proceeds when **3 or more distinct family operators** have requested
phone push (tracked informally in repo discussions). Until then, ship
nothing.

When the gate clears, the implementation will be:

### Subscription

- Opt-in via the config panel (`Alerts → Push to phone`).
- Subscription stored on the Worker side in **D1** keyed by a random
  device UUID (no email, no phone, no name).
- Subscription record fields: `endpoint`, `p256dh`, `auth`, `severity_min`,
  `created_at`. Nothing else.
- Auto-expire after **180 days** of no dashboard heartbeat. The
  dashboard pings `/push/heartbeat` daily when foregrounded.

### Push Triggering

- The Worker `alerts` proxy already polls every 10 s. When a new alert
  arrives with severity ≥ `rocket`, fan-out push to all subscriptions
  whose `severity_min ≤ alert.severity`.
- Push payload is **encrypted to the subscription** using `aes128gcm`
  per RFC 8291. Worker holds VAPID private key in a Cloudflare Secret;
  never logged, never in source.
- Deduplication: push includes the alert ID; SW de-dups against IDB
  before showing notification.

### Privacy

- No subscription tracking beyond the fields above.
- No analytics on whether a push was opened.
- No re-engagement pushes ever. Civil-defense only.
- Public privacy policy section explicitly enumerates push usage.

### CSP Impact

- Adds `connect-src https://fcm.googleapis.com https://updates.push.services.mozilla.com`
  for the SW push subscribe call. Both endpoints are already
  same-origin from the SW's perspective during subscribe.
- Adds Notification API. No new directive needed.

## Consequences

- **Pro:** Solves a real safety request without forcing users onto a
  third-party app.
- **Pro:** VAPID + per-subscription encryption keeps the Worker proxy
  privacy-clean even if breached.
- **Con:** First piece of state the Worker stores per-user. D1 schema,
  GDPR delete endpoint, and 180-day expiry all become operational
  load.
- **Con:** Push subscription endpoints are technically a fingerprinting
  vector if leaked. Mitigated by random UUIDs and 180-day expiry.

## Why Gated, Not Adopted

This is the first feature the project has shipped that introduces
**persistent server-side per-user state**. That is a meaningful step
beyond "static PWA + stateless Worker proxy". The 3-user gate ensures
real demand justifies the operational complexity.

## References

- ROADMAP §1.11 D7
- RFC 8030 (Web Push)
- RFC 8291 (Web Push encryption)
- VAPID: RFC 8292
- ADR-018 (CSP — addendum required when adopted)
