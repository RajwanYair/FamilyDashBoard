# ADR-050 — Cloudflare R2 Asset Cache

**Status**: Proposed
**Deciders**: RajwanYair
**Date**: 2026-04-30
**Sprint**: 249
**Stream**: ---

## Context

FamilyDashBoard's Worker (Cloudflare Workers, ADR-003) proxies API calls and aggregates news.
Several cards consume media-rich data — video thumbnails (video-news), weather icons, flag
images (currency). These assets are re-fetched from origin on every cache miss, incurring:

- Latency for first paint (thumbnails)
- Egress cost from origin APIs
- Potential rate-limit exposure for image CDNs

Cloudflare R2 (S3-compatible, zero egress fees) is co-located with the Worker and is the
natural asset cache tier for static or slowly-changing binary assets.

---

## Decision

Add a **Cloudflare R2 asset cache layer** to the FamilyDashBoard Worker for immutable or
long-lived binary assets (images, icons, audio).

### Cache architecture

```text
Dashboard card (fetch)
    │
    ▼
Worker: /r2-asset?url=<encoded-origin-url>
    │
    ├─[R2 hit]─► serve from R2 (Cache-Control: max-age=86400) ──────► client
    │
    └─[R2 miss]─► fetch from origin
                       │
                       ├─[success]─► store in R2 → serve → client
                       └─[failure]─► 502 with Retry-After: 60
```

### Scope of assets cached in R2

| Asset type                 | Origin               | R2 TTL  | Eviction                           |
| -------------------------- | -------------------- | ------- | ---------------------------------- |
| Video thumbnails (YouTube) | i.ytimg.com          | 24 h    | Auto-expired via R2 lifecycle rule |
| Weather condition icons    | openweathermap.org   | 24 h    | Auto-expired                       |
| Country flag SVGs          | flagcdn.com          | 7 days  | Auto-expired                       |
| Audio alerts (future)      | static.freesound.org | 30 days | Auto-expired                       |

### R2 key scheme

```text
r2-asset/{sha256-of-origin-url}
```

SHA-256 of the normalised (lowercased, decoded) origin URL is the R2 key. This prevents
path-traversal attacks and gives a stable, compact key without exposing the origin URL.

### Worker route added

```text
GET /r2-asset?url=<percent-encoded-origin-url>
```

Input validation:

- `url` must be percent-decoded and validated with `new URL(url)`
- Only whitelisted origin hostnames accepted (allowlist in `worker/src/constants.ts`)
- SSRF guard: block private IP ranges (RFC 1918/RFC 4193) before fetch
- Max `url` param length: 512 characters

### Security controls

| Control                  | Implementation                                                              |
| ------------------------ | --------------------------------------------------------------------------- |
| Allowlist-only origins   | `ALLOWED_ASSET_ORIGINS` constant in worker                                  |
| SSRF mitigation          | Reject requests to 10.x, 172.16-31.x, 192.168.x, ::1, localhost             |
| SHA-256 key              | No URL in R2 key (prevents key-enumeration)                                 |
| R2 public access         | Disabled — R2 bucket is private, served only via Worker                     |
| Content-Type enforcement | Worker sets `Content-Type` from extension allowlist (jpeg/png/webp/svg/ico) |
| Max asset size           | 5 MB per asset; larger assets are passed through without caching            |

### Cloudflare binding

`wrangler.toml` addition:

```toml
[[r2_buckets]]
binding = "ASSET_CACHE"
bucket_name = "familydashboard-asset-cache"
preview_bucket_name = "familydashboard-asset-cache-preview"
```

Worker environment type addition (`worker/src/env.d.ts`):

```typescript
interface Env {
  // …existing…
  ASSET_CACHE: R2Bucket;
}
```

---

## Implementation plan

### New / modified files

| File                                 | Change                                         |
| ------------------------------------ | ---------------------------------------------- |
| `worker/src/handlers/asset-cache.ts` | New route handler `handleAssetCache(req, env)` |
| `worker/src/constants.ts`            | Add `ALLOWED_ASSET_ORIGINS` allowlist          |
| `worker/src/router.ts`               | Wire `/r2-asset` route to `handleAssetCache`   |
| `worker/wrangler.toml`               | Add `[[r2_buckets]]` binding                   |
| `worker/src/env.d.ts`                | Add `ASSET_CACHE: R2Bucket` to `Env`           |
| `src/cards/video-news/video-news.ts` | Use `/r2-asset?url=` for thumbnail src         |
| `src/cards/currency/currency.ts`     | Use `/r2-asset?url=` for flag images           |

### Dashboard client changes

Cards that fetch images currently set `<img src="…">` directly. After this ADR is
implemented, the image URL is rewritten to:

```typescript
`${WORKER_BASE_URL}/r2-asset?url=${encodeURIComponent(originUrl)}`;
```

The fallback (if Worker is disabled / flag `isWorkerEnabled() === false`) continues to set
`src` to the origin URL directly.

---

## Consequences

| Positive                                                             | Negative                                            |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| Thumbnail latency drops from ~300 ms (cross-region) to ~30 ms (edge) | Requires R2 bucket provisioning (one-time)          |
| Zero egress fees from R2 to Worker                                   | Worker code complexity +1 handler                   |
| Reduces origin API rate-limit exposure                               | 5 MB cap excludes large video previews              |
| SSRF/key-enumeration attack surface handled at allowlist layer       | Allowlist must be maintained as card origins evolve |

---

## Alternatives rejected

| Alternative                            | Reason                                              |
| -------------------------------------- | --------------------------------------------------- |
| Cloudflare Cache API (KV edge cache)   | KV has 1 MB value limit; R2 supports 5 GB           |
| Proxying through allorigins / codetabs | These are text-only proxies; binary assets break    |
| Service Worker image cache             | SW per-device only; TTL management is complex in SW |
| Base64-inline images                   | Increases HTML/JS bundle; breaks streaming          |

---

## Exit gate

- [ ] `asset-cache.ts` handler passes unit tests (Miniflare + Vitest)
- [ ] SSRF guard blocks private-IP fetch attempts in tests
- [ ] `wrangler deploy` succeeds with R2 binding
- [ ] Video-news thumbnails load in ≤ 50 ms (measured via DevTools Network)
- [ ] R2 lifecycle rule set to 7-day expiry (no unbounded storage growth)
