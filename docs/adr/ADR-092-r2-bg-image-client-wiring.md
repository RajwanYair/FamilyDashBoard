# ADR-092 — R2 Background Image Client Wiring

**Status**: Accepted
**Date**: 2026-05-19
**Authors**: FamilyDashBoard maintainers
**Supersedes**: —
**Superseded by**: —
**Related**: ADR-050 (R2 asset proxy route), ROADMAP §7 PLATFORM / R2 client wiring

---

## Context

ADR-050 (v14.14.x) introduced `GET /api/r2-asset?url=<encoded>` — a Cloudflare Worker route that
fetches external image URLs on first request, caches them in R2, and re-serves them from the
Cloudflare edge with `Cache-Control: public, max-age=86400, immutable`.

However, the client-side background image module (`src/ui/bg-images.ts`) was still setting the CSS
`backgroundImage` property directly to the raw CDN URL. The images were therefore served from
origin CDNs on every browser load — not from the R2 cache — and the Worker route was only exercised
when called directly.

The missing piece was the **client-side wiring**: the browser needed to send image requests through
the Worker proxy URL rather than directly to the CDN origin.

---

## Decision

We add `buildR2AssetUrl(url: string): string` to `src/ui/bg-images.ts`:

```typescript
export function buildR2AssetUrl(url: string): string {
  if (!isWorkerEnabled()) return url;
  return `${WORKER_BASE_URL}/api/r2-asset?url=${encodeURIComponent(url)}`;
}
```

The function is called in two places in the module:

1. `setLayer(layer, url)` — sets the CSS `backgroundImage` via `buildR2AssetUrl(url)`.
2. `rotateBgImage()` — preloads the next image via `img.src = buildR2AssetUrl(nextUrl)`.

`isWorkerEnabled()` returns `false` in two scenarios:

- The page is loaded via `file://` protocol (local dev without the Worker).
- `WORKER_BASE_URL` is empty (not yet configured).

In both cases `buildR2AssetUrl` falls back to the direct CDN URL transparently — existing behavior
is preserved and no visible regression occurs.

---

## Consequences

### Positive

- Background images now warm the R2 cache on first load.
- Subsequent loads (same browser or other browsers) serve from Cloudflare edge with
  `Cache-Control: public, max-age=86400, immutable` — zero egress cost to origin CDNs.
- The Worker route introduced in ADR-050 is now actually exercised by normal dashboard usage.
- Works transparently under `file://` protocol (local dev, local build) — no config required.
- The `buildR2AssetUrl` function is exported and fully unit-tested (`tests/unit/ui/bg-images-r2.test.ts`).

### Neutral

- The Worker URL (`WORKER_BASE_URL`) is a compile-time constant already defined in
  `src/core/constants.ts` — no new config keys.
- For browsers that already have the image cached by the browser's own HTTP cache, the R2 proxy URL
  will show up in cache storage rather than the original CDN URL. This is expected and desirable.

### Negative / Trade-offs

- A CDN image URL embedded in `config.bgImages` that is NOT in `ALLOWED_ASSET_HOSTS` (the R2 proxy
  allowlist) will receive a `403 origin_not_allowed` response from the Worker. The background image
  will silently fail to load. Operators must ensure all configured image URLs use hostnames from the
  allowlist defined in `worker/src/routes/r2-asset.ts`.
- The proxy adds one Worker hop per cache miss. For hot images this is negligible (edge-to-edge).

---

## Allowlist

The `ALLOWED_ASSET_HOSTS` set in `worker/src/routes/r2-asset.ts` currently includes:

```text
picsum.photos · fastly.picsum.photos · images.unsplash.com · images.pexels.com
live.staticflickr.com · upload.wikimedia.org · i.ytimg.com
openweathermap.org · openmeteo.s3.amazonaws.com · flagcdn.com
```

To use a background image from a different CDN, add its hostname to this set and deploy the Worker.

---

## Test Coverage

- `tests/unit/ui/bg-images-r2.test.ts` — 6 tests covering:
  - Returns R2-proxied URL when worker enabled
  - Returns direct URL when worker disabled (`file://` / unconfigured)
  - `?url=` query parameter decodes to the original URL exactly
  - Correct `/api/r2-asset` path
  - Correct `WORKER_BASE_URL` host prefix
  - URLs with percent-unsafe characters — no double-encoding
