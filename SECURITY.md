# Security Policy

## Scope

FamilyDashBoard is a static, client-only PWA. It runs entirely in the browser
with no server-side components owned by this project. The Cloudflare Worker in
`worker/` is a thin proxy/aggregator with no user accounts, sessions, or
secrets at rest.

## Supported versions

Only the most recent **minor** release on `main` (currently `13.12.x`) receives
security fixes. Older tags are archival.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Use one of these private channels:

1. GitHub's [private vulnerability reporting](https://github.com/RajwanYair/FamilyDashBoard/security/advisories/new)
   (preferred).
2. Email the maintainer at the address in the repository's commit history.

Please include:

- Affected version / commit SHA.
- Description of the vulnerability and impact.
- Steps to reproduce or a proof-of-concept.
- Any suggested mitigation.

You should receive an acknowledgement within 7 days. We aim to release a fix
within 30 days for high/critical issues.

## Threat model (in scope)

- XSS via untrusted upstream data (RSS, ICS, weather, news APIs).
- Prototype pollution / `__proto__` injection in JSON payloads.
- Service worker cache poisoning.
- Cloudflare Worker route abuse (open redirect, SSRF) — see
  `worker/src/utils/url-allowlist.ts`.
- Supply-chain risks in build tooling.

## Out of scope

- Issues requiring a malicious browser extension installed by the victim.
- Self-XSS via `localStorage` edits (no auth surface to escalate to).
- Denial of service against the Cloudflare Worker (rate limiting is provider-side).

## Hardening already in place

- Strict CSP on the deployed page (see `_headers`).
- Trusted Types policy (`src/core/trusted-types.ts`).
- No `eval`, no `innerHTML` with user data — enforced by CI security scan.
- Worker URL allowlist for proxy fetches.
- SLSA build provenance attached to release artifacts.
- Subresource integrity (SRI) on all external script references (none currently).

## Disclosure

After a fix is released, the advisory is published with credit to the reporter
unless they request anonymity.
