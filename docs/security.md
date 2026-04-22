# Security Model — FamilyDashBoard v11.0

> This document describes the security posture, threat model, and mitigation decisions for the
> FamilyDashBoard project. Updated: 2026-04-22.

---

## 1. Threat Model

FamilyDashBoard is a **private, single-household, always-on family display**. It is a static PWA
served from GitHub Pages with no authentication, no user accounts, and no server-side session
management. The realistic threat surface is small but non-zero.

| Threat                        | Likelihood                        | Impact                   | Mitigation                                                                                  |
| ----------------------------- | --------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| XSS via injected script tag   | Low (zero third-party scripts)    | High (full page control) | `script-src 'self'` CSP blocks inline scripts                                               |
| XSS via unsanitized innerHTML | Low (codebase uses `textContent`) | High                     | Code rule + ESLint no-innerHTML check                                                       |
| Clickjacking                  | Very low (no auth, no money)      | Low                      | `X-Frame-Options: DENY` + `frame-ancestors 'none'`                                          |
| Upstream API data injection   | Low (validated with Zod)          | Medium                   | Zod schema validation on all worker routes                                                  |
| CORS abuse                    | Low (read-only public data)       | Low                      | Worker rate-limits per IP; `connect-src` allowlist                                          |
| Sensitive data leakage        | N/A                               | N/A                      | No PII stored beyond family name & calendar URL (user-entered, stays in localStorage)       |
| Dependency supply chain       | Very low (0 runtime client deps)  | High if occurred         | 0 client deps; 1 worker dep (Zod); Dependabot monthly; `npm audit --audit-level=high` in CI |
| Stale credentials             | N/A                               | N/A                      | No auth tokens or session secrets in the client                                             |
| Secret in source              | Very low                          | High                     | Worker uses `wrangler secret put ERROR_REPORTING_TOKEN`; checked by GitHub secret scanning  |

---

## 2. Content Security Policy

The `<meta http-equiv="Content-Security-Policy">` in `src/index.html` implements:

```text
default-src 'self';
script-src  'self';
style-src   'self' 'unsafe-inline';
img-src     'self' https: data: blob:;
connect-src 'self' https://fdb.rajwanyair.workers.dev;
font-src    'self';
frame-src   https://calendar.google.com;
media-src   'none';
base-uri    'self';
form-action 'none';
upgrade-insecure-requests;
```

### Rationale for `'unsafe-inline'` in style-src

The dashboard uses inline `style=""` attributes for progressive-enhancement overrides
(e.g., dimmer opacity, card sizing, news font scale). Removing them requires extracting ~200 attributes
into data-\* properties and applying them via CSS variables — planned for v12 cleanup (see ADR-018).

### Local builds

The Vite `removeCrossOrigin` plugin **strips the CSP meta tag** for local `file://` builds.
This is intentional: `script-src 'self'` on an opaque `file://` origin would block all JavaScript
execution. See `vite.config.ts` comments for the full explanation.

### Future updates

- **v11.1 (video-news card):** `media-src` and `connect-src` will be extended per ADR-019
- **v12 (Cloudflare Pages migration):** COOP + COEP HTTP headers become available, enabling
  `performance.measureUserAgentSpecificMemory()` and Spectre mitigations

---

## 3. Worker API Security Headers

All Cloudflare Worker responses include:

| Header                         | Value                                      |
| ------------------------------ | ------------------------------------------ |
| `X-Content-Type-Options`       | `nosniff`                                  |
| `X-Frame-Options`              | `DENY`                                     |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`          |
| `Permissions-Policy`           | `geolocation=(), microphone=(), camera=()` |
| `Cross-Origin-Resource-Policy` | `cross-origin`                             |
| `Access-Control-Allow-Origin`  | `*` (public read-only API)                 |

---

## 4. COOP / COEP Limitation

`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` require **HTTP response headers**.
GitHub Pages does not support custom response headers. The `_headers` file at the repo root documents
the intended values and will become effective if the deployment target changes to Cloudflare Pages,
Netlify, or Vercel.

---

## 5. Sub-Resource Integrity (SRI)

There are **zero third-party scripts** in this project. SRI is therefore not applicable.
All JavaScript and CSS is built from source by Vite and served from the same origin (`self`).
This decision is recorded to prevent future confusion.

---

## 6. Worker Rate Limiting

The Cloudflare Worker implements in-memory per-IP rate limiting:

- **Window:** 60 s
- **Limit:** 100 requests per window per IP
- Rate-limit info is returned via `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers
- Rate-limited responses return 429 with `Retry-After` header

---

## 7. Error Telemetry Privacy

The error reporting system (`error-reporter.ts` → `POST /api/errors`) collects:

- JavaScript error messages (truncated to 500 chars)
- Source file name and line number
- Timestamp

It does **not** collect:

- IP addresses (not stored server-side; only seen in CF logs)
- User-entered data (family name, calendar URL, city names)
- Browsing history or navigation events
- Any PII

The export endpoint (`GET /api/errors/export?token=<SECRET>`) is token-gated. The token is stored
as a Cloudflare Worker secret (`wrangler secret put ERROR_REPORTING_TOKEN`).

---

## 8. Secret Handling

| Secret                  | Storage                  | Rotation              |
| ----------------------- | ------------------------ | --------------------- |
| `ERROR_REPORTING_TOKEN` | Cloudflare Worker secret | `wrangler secret put` |
| No other secrets        | —                        | —                     |

No secrets are committed to the repository. GitHub native secret scanning is enabled.

---

## 9. Dependency Audit

| Layer         | Dependencies                      | Audit                                   |
| ------------- | --------------------------------- | --------------------------------------- |
| Client        | **0 runtime deps**                | No npm audit surface                    |
| Worker        | `zod` (validation)                | `npm audit --audit-level=high` in CI    |
| Dev toolchain | Multiple (in parent `MyScripts/`) | Dependabot monthly; reviewed in release |

`npm audit --audit-level=high` runs in the CI `security` job. Current status: **0 high+ vulnerabilities**.

---

## 10. Responsible Disclosure

This is a private household project. If you find a security issue, please open a GitHub issue
or email the author directly. There is no bug bounty program.
