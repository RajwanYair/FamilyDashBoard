# ADR-018 — CSP + COOP/COEP/CORP Security Posture

**Date:** 2026-04-22
**Status:** Accepted
**Deciders:** Reuven Airhar
**Tags:** security, csp, headers, privacy

---

## Context

FamilyDashBoard v10.0.0 lacked a Content-Security-Policy, Cross-Origin-Opener-Policy (COOP),
Cross-Origin-Embedder-Policy (COEP), and related defensive headers. The Mozilla Observatory score
at v10.0.0 was **D** (missing all security headers). A family TV dashboard does not handle
sensitive data, but:

1. A loose CSP allows XSS via injected `<script>` tags if any card renders unsanitized HTML
2. Without `X-Frame-Options: DENY` the page can be embedded in a hostile iframe (clickjacking)
3. Without COOP/COEP, the performance profiling APIs (`performance.measureUserAgentSpecificMemory`,
   `SharedArrayBuffer`) are unavailable — relevant for future Web Vitals work
4. Without an explicit `connect-src` allowlist, the browser permits connections to arbitrary URLs

The static HTML is hosted on GitHub Pages. GitHub Pages does **not** support custom HTTP
response headers — so COOP/COEP must be delivered via meta-equivalent where possible. Note:
COOP (`Cross-Origin-Opener-Policy`) **cannot** be set via a `<meta>` tag (it requires an HTTP
header). This is a documented limitation of the GitHub Pages deployment target.

---

## Decision

### Content Security Policy (`<meta http-equiv="Content-Security-Policy">` in `src/index.html`)

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
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
  "
/>
```

Key decisions:

- `connect-src` restricted to `'self'` + the worker base URL only (previously `https:` = all HTTPS)
- `script-src 'self'` — no inline scripts, no eval, no external scripts ever
- `style-src 'unsafe-inline'` required because of the inline `style=""` attributes used in
  progressive enhancement (e.g., card sizing, dimmer opacity). As of v15.5.0, all static
  inline styles have been removed from HTML; remaining dynamic `.style.*` calls are JS-only
  and do not require `style-src 'unsafe-inline'` relaxation beyond `script-src 'self'`.
- `media-src 'none'` until the video-news card ships (v11.1); will be updated per ADR-019
- `frame-src` restricted to calendar.google.com only (used by the optional embedded calendar view)
- The Vite build plugin `removeCrossOrigin` already strips this meta for local `file://` builds
  (CSP `'self'` = opaque origin on `file://` would block all JS execution)

### Worker API responses — headers added

All worker API responses include via `CORS_HEADERS` in `utils/response.ts`:

| Header                         | Value                                      | Purpose                                                       |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------- |
| `X-Content-Type-Options`       | `nosniff`                                  | Prevent MIME sniffing                                         |
| `X-Frame-Options`              | `DENY`                                     | Clickjacking protection for any API response rendered as HTML |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`          | Limit referer leakage                                         |
| `Permissions-Policy`           | `geolocation=(), microphone=(), camera=()` | Deny unused device access                                     |
| `Cross-Origin-Resource-Policy` | `cross-origin`                             | Allow cross-origin resource sharing (needed for CORS API)     |

### COOP/COEP — limitation documented

COOP requires an HTTP response header. GitHub Pages does not support custom headers.
**Mitigation strategy:**

- If the project migrates to Cloudflare Pages, add `COOP: same-origin` and `COEP: require-corp`
  via a `_headers` file (Cloudflare Pages format)
- The `_headers` file at `src/public/_headers` documents the intended values for any CDN/proxy deployment
- For now, `COEP` and `COOP` are deferred pending Cloudflare Pages migration (not
  applicable to GitHub Pages which does not support custom response headers)

### `_headers` file (`src/public/_headers`)

Documents intended headers (active on Cloudflare Pages, Netlify, Vercel; ignored by GitHub Pages).
Vite copies `src/public/` → `dist/` verbatim, placing `_headers` where deployment platforms expect it.

```text
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-site
```

### Rejected alternatives

| Alternative                          | Why rejected                                                        |
| ------------------------------------ | ------------------------------------------------------------------- |
| Nonce-based CSP                      | Vite generates hashed asset names at build time; nonces require SSR |
| Hash-based CSP for inline styles     | ~200 inline style attrs in index.html; hashing each is impractical  |
| Move to Cloudflare Pages now         | v12 work; migration cost not justified at current scale             |
| Remove all inline styles immediately | Would break progressive enhancement; planned for v12 cleanup        |

---

## Consequences

- **Mozilla Observatory score improves from D to B+** (CSP + nosniff + frame-options + referrer)
- Reaching A+ requires COOP/COEP which needs GitHub Pages → Cloudflare Pages migration (v12)
- The `connect-src` restriction will need to be updated whenever a new external service is added
- The video-news card (v11.1) will update `media-src` and possibly `frame-src` per ADR-019
- Worker API callers unaffected — the new CORP header is `cross-origin` which is correct for a
  public CORS API
