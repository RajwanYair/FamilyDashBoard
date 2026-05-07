# Security Model — FamilyDashBoard v14.4.0

> This document describes the security posture, threat model, and mitigation decisions for the
> FamilyDashBoard project. Updated: 2026-05-06 (v14.4.0).

---

## 1. Threat Model

FamilyDashBoard is a **private, single-household, always-on family display**. It is a static PWA
served from GitHub Pages with no authentication, no user accounts, and no server-side session
management. The realistic threat surface is small but non-zero.

| Threat                        | Likelihood                        | Impact                   | Mitigation                                                                                           |
| ----------------------------- | --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| XSS via injected script tag   | Low (zero third-party scripts)    | High (full page control) | `script-src 'self'` CSP blocks inline scripts                                                        |
| XSS via unsanitized innerHTML | Low (codebase uses `textContent`) | High                     | Code rule + ESLint no-innerHTML check                                                                |
| Clickjacking                  | Very low (no auth, no money)      | Low                      | `X-Frame-Options: DENY` + `frame-ancestors 'none'`                                                   |
| Upstream API data injection   | Low (validated with Valibot)      | Medium                   | Valibot schema validation on all worker routes                                                       |
| CORS abuse                    | Low (read-only public data)       | Low                      | Worker rate-limits per IP; `connect-src` allowlist                                                   |
| Sensitive data leakage        | N/A                               | N/A                      | No PII stored beyond family name & calendar URL (user-entered, stays in localStorage)                |
| Dependency supply chain       | Very low (0 runtime client deps)  | High if occurred         | 0 client deps; 1 worker dep (Hono/Valibot); Dependabot monthly; `npm audit --audit-level=high` in CI |
| Stale credentials             | N/A                               | N/A                      | No auth tokens or session secrets in the client                                                      |
| Secret in source              | Very low                          | High                     | Worker uses `wrangler secret put ERROR_REPORTING_TOKEN`; checked by GitHub secret scanning           |

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
| `Permissions-Policy`           | 28 APIs explicitly denied — see `_headers` |
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
| Worker        | `hono`, `valibot` (validation)    | `npm audit --audit-level=high` in CI    |
| Dev toolchain | Multiple (in parent `MyScripts/`) | Dependabot monthly; reviewed in release |

`npm audit --audit-level=high` runs in the CI `security` job. Current status: **0 high+ vulnerabilities**.

---

## 10. Video Streams (video-news card — opt-in)

The `video-news` card is **disabled by default** (`hidden: true` in the card registry).
When enabled, it plays a live HLS stream inside a `<video>` element.

### CSP extension when video-news is enabled

The current base CSP sets `media-src 'none'`. When the card is enabled and stream
URLs are confirmed (deferred to v15), the following extensions
will be required:

| Directive     | Current value                 | Extended value (video-news enabled)                                                   |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `connect-src` | `'self' <worker-base>`        | `+ <hls-manifest-host>` (exact host from `StreamDescriptor.cspHosts.connect`)         |
| `media-src`   | `'none'`                      | `'self' blob: <hls-segment-host>` (exact host from `StreamDescriptor.cspHosts.media`) |
| `frame-src`   | `https://calendar.google.com` | Stays unchanged unless Mode C (iframe embed) is chosen                                |

The exact hosts are documented in `docs/adr/ADR-019-video-card-csp.md` and will be
locked in before the card ships to production. All hosts must be explicit — no wildcards.

### Integration modes (ADR-019)

| Mode | Description                               | CSP delta                                    |
| ---- | ----------------------------------------- | -------------------------------------------- |
| A    | Native `<video>` + HLS (CORS-open stream) | `connect-src` + `media-src` + `blob:`        |
| B    | Worker-proxied HLS manifest + segments    | `connect-src` worker only (no external host) |
| C    | `<iframe>` embed (last resort)            | `frame-src` + embed host                     |
| D    | Vendored `hls.js` + Mode A                | Same as Mode A + < 35 KB bundle growth       |

Mode B is the most restrictive CSP option because all external requests are routed
through the Cloudflare Worker, which is already in the `connect-src` allowlist.

### Terms of Service notice

The video-news card will only be enabled for channels where the operator's Terms of Service
permit direct embedding or where an official embed URL is provided. Channels that explicitly
prohibit third-party embedding will not be supported.

---

## 11. SRI Policy and SLSA Provenance

### Sub-Resource Integrity (SRI)

FamilyDashBoard has **zero third-party scripts or styles loaded at runtime** (Rule 1 from
`copilot-instructions.md`). No Content-Delivery-Network (CDN) URLs appear in `index.html`.
All JavaScript and CSS is bundled from source by Vite into a single IIFE served from the same
origin. Sub-Resource Integrity (SRI) hashes are therefore **not required and not generated**.

**Policy statement:**

- No `<script src="https://…">` or `<link rel="stylesheet" href="https://…">` are ever added.
- Any PR introducing a CDN reference will fail CI via the `eslint` rule `no-external-script-src`.
- This policy extends to the Cloudflare Worker: all dependencies are bundled by `wrangler build`.
- The CI pipeline checks for external script/style references on every push (`.github/workflows/ci.yml`).

If a future release requires a trusted third-party resource, the SRI hash (`integrity=`) must be
computed with `openssl dgst -sha384 | base64` and reviewed in the release checklist.

### SLSA Provenance (Equivalent Controls)

Since SRI is N/A for bundled build artifacts, the equivalent supply-chain integrity controls are:

| Control                 | Implementation                                                                   |
| ----------------------- | -------------------------------------------------------------------------------- |
| Source integrity        | All commits signed via GitHub; branch protection requires PR review              |
| Build reproducibility   | Vite build is deterministic per `package-lock.json` at `MyScripts/` parent       |
| Dependency pinning      | Dependabot opens PRs for `package.json` updates (`.github/dependabot.yml`)       |
| Dependency audit        | `npm audit --audit-level=high` runs in CI on every push                          |
| SBOM                    | `npm sbom --sbom-format cyclonedx` can be run per ADR-027                        |
| Worker bundle integrity | Cloudflare verifies bundle hash on deploy; `wrangler deploy --dry-run` in CI     |
| Release provenance      | GitHub Releases are tagged from a protected branch; release notes auto-generated |

For a full SLSA Level 2 upgrade path, see ADR-027 (SBOM Generation and Automated Dependency Updates).
For the SLSA Level 3 upgrade path (signed provenance attestations via GitHub Actions), see ADR-035.

---

## 12. Secret Rotation Schedule

| Secret                  | Storage                  | Rotation cadence         | Owner              |
| ----------------------- | ------------------------ | ------------------------ | ------------------ |
| `ERROR_REPORTING_TOKEN` | Cloudflare Worker secret | Annually or on suspicion | Project maintainer |
| `METRICS_TOKEN`         | Cloudflare Worker secret | Annually or on suspicion | Project maintainer |
| `REPORTS_TOKEN`         | Cloudflare Worker secret | Annually or on suspicion | Project maintainer |
| `FINNHUB_API_KEY`       | Cloudflare Worker secret | Per Finnhub terms (1 yr) | Project maintainer |
| GitHub PAT (Dependabot) | GitHub Actions secret    | Annually                 | Project maintainer |

**Rotation procedure:**

1. Generate new secret value (use `openssl rand -hex 32` for tokens).
2. Update in Cloudflare: `wrangler secret put SECRET_NAME`.
3. For GitHub secrets: Settings → Secrets → update value.
4. Revoke old value immediately after confirming new one works.
5. Add a note to `CHANGELOG.md` under the next release section.

No rotation schedule applies to the GitHub Pages deployment key (managed automatically by GitHub).

---

## 13. Responsible Disclosure

This is a private household project. If you find a security issue, please open a GitHub issue
or email the author directly. There is no bug bounty program.
