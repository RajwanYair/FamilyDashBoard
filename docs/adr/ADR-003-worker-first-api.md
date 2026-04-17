# ADR-003: Worker-First API Path with Client Fallback Chain

**Date:** 2026-04-17
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard fetches data from multiple external APIs (weather, stocks, currency, news, Hebrew calendar, alerts). All of these require CORS handling. Prior to v7.5, the client used a public proxy fallback chain (allorigins, codetabs, corsproxy.io) as the primary data path.

The Cloudflare Worker (`worker/`) was introduced in v7 as an API proxy to eliminate CORS issues and normalize upstream responses.

---

## Decision

**Use `fetchViaWorker()` as the primary data path when `isWorkerEnabled()` returns true. The public proxy chain is retained as a fallback for offline worker scenarios and local development only.**

In production builds (`__USE_PROXIES__ = false`), the proxy chain is disabled at the Vite compile gate.

---

## Rationale

1. **CORS elimination** — Cloudflare Worker adds `Access-Control-Allow-Origin: *` upstream so the browser never needs a proxy shim for normally CORS-restricted APIs.
2. **Rate limit sharing** — The Worker acts as a shared cache and rate-limit buffer. Multiple dashboard instances do not individually exhaust free-tier API quotas.
3. **Response normalization** — Worker routes can normalize upstream provider quirks (Yahoo Finance URL formats, Hebcal pagination) before the client ever sees them. This keeps card code simpler.
4. **Security** — API keys (if ever needed) stay in the Worker environment, not in the client bundle.
5. **Error reporting** — The Worker's `/api/errors` endpoint gives the client a reliable receiver for structured telemetry without exposing a public logging service.

---

## Proxy Chain Retention

The public proxy chain (`allorigins → codetabs → corsproxy.io`) is retained for:

- Local development when the Worker is not deployed locally
- `isWorkerEnabled() === false` environments (offline/air-gapped)
- Degraded worker scenarios (Cloudflare outage)

The proxy chain is gated behind `__USE_PROXIES__` (Vite define). It is `false` in `npm run build` (GitHub Pages production) and `true` in `npm run build:local` (file:// builds).

---

## Consequences

- Cards should fetch via `fetchJSONWithWorker<T>(path)` when `isWorkerEnabled()`.
- Cards should fall back to `fetchJSON<T>(url)` (proxy chain) otherwise.
- Worker routes must return consistent JSON shapes to avoid card-side parsing divergence.
- Worker health must be monitored in the diagnostic overlay (D key).
- Adding a new data source requires: (1) a new Worker route, (2) a normalized domain type, (3) a card-side mapper.

---

## Alternatives Considered

- **Keep public proxy chain as primary**: rejected — public proxies are unreliable, rate-limited, and often blocked by firewalls. They are not suitable as a production-primary path.
- **Self-hosted backend**: rejected — Cloudflare Worker provides equivalent capabilities at zero operational cost for this traffic volume.
