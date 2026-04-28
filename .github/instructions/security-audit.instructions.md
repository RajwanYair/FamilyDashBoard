---
applyTo: ".github/**,docs/security.md,docs/privacy.md,worker/**,src/core/**,src/main.ts,src/index.html,sw.ts"
description: "OWASP Top 10:2021 audit checklist mapped to FamilyDashBoard's static-PWA threat surface. Rotated per major release, smoke-checked per patch, drilled quarterly."
---

# Security Audit — OWASP Top 10:2021 (rotated per major release)

> **Mandate**: Roadmap §3 #26. Audit ALL items in order before tagging any
> `vX.0.0` major release. Fill the **Verified** column in this file with
> commit hashes, then commit the result with the audit log.
>
> For minor and patch releases, audit the items flagged in the
> "Patch-cycle smoke check" section only. Quarterly: audit any 3 items at
> random plus all items where the verification commit is older than 6
> months.

## Last full audit

- **Release**: pending v14.0.0
- **Auditor**: self
- **Date**: pending
- **Commit hash range**: pending

## OWASP Top 10:2021 mapping to FamilyDashBoard

| #     | Risk                                | Static-PWA exposure                                                       | Mitigation in repo                                                                                                                                                                                                                                                                                          | Verified (commit) |
| ----- | ----------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A01   | Broken Access Control               | **Not applicable** — no auth, no user data, no per-user resources         | Static-PWA constraint reaffirmed in `.github/copilot-instructions.md` rule #26. Edge worker exposes only public read-only data routes documented in `worker/openapi.yaml`. No write endpoints reachable without DO-rate-limited tokens.                                                                     | pending           |
| A02   | Cryptographic Failures              | **Low** — only optional config-share URL crypto                           | AES-GCM-256 + HMAC-SHA-256 in `src/core/config-share.ts`. No password storage, no PII at rest. Confirm `crypto.subtle` usage on every release; reject `crypto-js`/userland crypto. Document in `docs/sync.md`.                                                                                              | pending           |
| A03   | Injection                           | **Medium** — DOM injection, fetch URL injection, JSON deserialization     | Rule #3: no `innerHTML` with unsanitized data. Trusted Types policy enforced in CSP. All worker route inputs validated via Valibot. URL params sanitized via `URL` constructor (never string concat). Audit `Select-String 'innerHTML','outerHTML' src/` per release — must be `textContent`/`replaceChildren()`. | pending           |
| A04   | Insecure Design                     | **Low** — single-tenant, client-only, no session                          | Threat model lives in `docs/security.md`. ADR-002 (zero deps), ADR-003 (worker-first). No user-facing DB → no DB design risks. Re-audit: any new ADR introducing user input or state must include a threat-model paragraph.                                                                                 | pending           |
| A05   | Security Misconfiguration           | **Medium** — CSP, COOP/COEP/CORP, Permissions-Policy, HSTS, Trusted Types | `src/index.html` line 12 + `_headers`. CSP `connect-src` allowlist must be reviewed every patch — wildcards (e.g. `https://*.intel.com`) flagged for narrowing per Roadmap #25. Verify `_headers` matches CSP meta on every minor release. Confirm Permissions-Policy denies all 28 sensitive APIs.         | pending           |
| A06   | Vulnerable & Outdated Components    | **Low** — 0 client deps, 2 worker deps                                    | Dependabot + Renovate (Actions SHA-pinned). `npm audit --audit-level=high` blocks CI. SBOM (CycloneDX) attached to every release; SBOM-diff bot runs per PR. Manual review of Hono / Valibot CHANGELOG before bumping major.                                                                                | pending           |
| A07   | Identification & Auth Failures      | **Not applicable** — no auth                                              | Static-PWA constraint (rule #26). If auth ever proposed, it must include a fresh ADR superseding ADR-002 + ADR-003.                                                                                                                                                                                         | pending           |
| A08   | Software & Data Integrity Failures  | **Medium** — supply chain                                                 | Subresource Integrity auto-injected (v13.9). SLSA L2 today, L3 target v14.2. Sigstore/cosign signature on `dist.zip` + `worker.js`. Renovate pins GitHub Actions to commit SHAs. `--ignore-scripts` on CI installs.                                                                                         | pending           |
| A09   | Security Logging & Monitoring       | **Low** — no PII to log                                                   | Diag KV captures error envelopes (no IP, no UA-CH high-entropy). Reporting API endpoint sampled. D1 telemetry rate-limited per IP. `error-tracker.ts` strips request bodies by default. Audit: confirm no PII in last 30 days of D1 writes.                                                                 | pending           |
| A10   | Server-Side Request Forgery (SSRF)  | **Medium** — worker proxies external APIs                                 | All upstream URLs hard-coded in `worker/src/routes/*.ts` (no client-controlled host). Provider chain `PROXIES` documented in `docs/data-sources.md`. Per-route Valibot schemas reject unexpected query keys. CORS allowlist in `_headers` restricts callers to GH Pages + `localhost:5173`.                 | pending           |

## Patch-cycle smoke check

Run on every patch release (`vX.Y.Z` with `Z > 0`):

- [ ] `Select-String -Pattern 'innerHTML','outerHTML' -Path src -Recurse` — **0 hits** outside test fixtures.
- [ ] `Select-String -Pattern 'eval','new Function' -Path src -Recurse` — **0 hits**.
- [ ] `Select-String -Pattern 'fetch\(`' -Path src -Recurse` — **0 hits** (URLs must be `URL` objects or template-safe).
- [ ] `npm audit --audit-level=high` — exits 0.
- [ ] `node scripts/check-smart-contrast.mjs` — exits 0.
- [ ] CSP `connect-src` allowlist matches between `src/index.html` and `_headers`.
- [ ] No `eslint-disable`, `@ts-ignore`, or `@ts-nocheck` newly introduced.
- [ ] No `localStorage` write of secrets, OAuth tokens, JWTs, or session IDs.

## Quarterly drill (any 3 random items from the table above)

Pick three items via `Get-Random -InputObject 1..10 -Count 3` and re-verify
their mitigation. Record commit hashes in the table.

## Reject conditions (auto-block release)

- Any A-entry above with **Verified** older than 12 months.
- New code introduces a runtime client dependency (violates ADR-002).
- New worker route lacks Valibot schema (violates A03 + A10).
- `connect-src` widens with a new wildcard without a commit message
  containing `Roadmap #25` and a follow-up issue link.
- Trusted Types policy regression (`require-trusted-types-for 'script'`
  removed or disabled).

## CSP wildcard quarterly-narrow policy (Roadmap #25)

Wildcards in CSP directives (e.g. `https://*.intel.com` in `connect-src`) **must**
be reviewed once per quarter (Mar / Jun / Sep / Dec) and narrowed to the
minimum subdomain set actually contacted by the deployed worker. Procedure:

1. Pull last 90 days of unique `connect-src` hostnames from the worker
   analytics pipeline (or browser `Report-Only` violation logs).
2. Replace `https://*.intel.com` with the explicit list (e.g.
   `https://api.intel.com https://cdn.intel.com`).
3. Update both `src/index.html` meta CSP and `_headers` in the same commit.
4. Open a follow-up issue tagged `security:csp-narrow` with the diff and
   the previous wildcard's last-seen-by date.
5. Tick the `CSP wildcard review` row in the audit table with the commit
   hash and date.

Reviewer rubric: any wildcard older than **120 days** without a narrow-or-renew
commit auto-blocks the next minor release.
