/**
 * FamilyDashBoard Worker — R2 asset proxy (ADR-050)
 *
 * Serves background images and other static assets from Cloudflare R2,
 * acting as a caching proxy for allowlisted image CDN origins.
 *
 * Route: GET /api/r2-asset?url=<percent-encoded-https-url>
 *
 * Behaviour:
 *   1. Validate `url` param — HTTPS only, allowlisted hostname, ≤ 512 chars.
 *   2. Derive R2 key: first 48 hex characters of SHA-256(normalised URL).
 *   3. R2 HIT  → serve with Cache-Control: public, max-age=86400, immutable.
 *   4. R2 MISS → fetch from origin, store in R2 (best-effort), serve response.
 *   5. Origin error → 502; R2 unavailable → pass-through to origin.
 *
 * Security controls:
 *   - Allowlist: only the hosts listed in ALLOWED_ASSET_HOSTS are accepted.
 *   - No SSRF: private IP ranges cannot appear in allowlisted CDN hostnames.
 *   - URL is not echoed back in error responses — only safe static strings.
 *   - owasp-allow:A10 annotation for the fetch entry point (CF DO context).
 */

import type { Env } from "../types";
import { r2Get, r2Put } from "../utils/r2-cache";

// ── Allowlist ─────────────────────────────────────────────────────────────────

/** CDN hostnames from which background images may be fetched and cached. */
const ALLOWED_ASSET_HOSTS = new Set([
  "picsum.photos",
  "fastly.picsum.photos",
  "images.unsplash.com",
  "images.pexels.com",
  "live.staticflickr.com",
  "upload.wikimedia.org",
  "i.ytimg.com",
  "openweathermap.org",
  "openmeteo.s3.amazonaws.com",
  "flagcdn.com",
]);

/** Maximum allowed length for the `url` query parameter. */
const MAX_URL_LEN = 512;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a compact R2 key from a URL by taking the first 48 hex chars
 * of the SHA-256 digest of the normalised (trimmed, lowercased) URL.
 *
 * 48 hex = 24 bytes = 192-bit prefix — sufficient to avoid collisions at any
 * plausible asset library size while keeping the key compact for R2 listing.
 */
async function urlToR2Key(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return (
    "bg/" +
    hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 48)
  );
}

/** Map common image file extensions to MIME types. */
function guessContentType(url: string): string {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg"; // safe default for photos
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * Handle GET /api/r2-asset?url=<encoded>
 *
 * Serves background images through R2 cache.
 * Falls back to direct origin fetch when R2 is not bound.
 */
export async function handleR2Asset(request: Request, env: Env): Promise<Response> {
  // owasp-allow:A05 owasp-allow:A10
  const reqUrl = new URL(request.url);
  const rawUrl = reqUrl.searchParams.get("url");

  if (!rawUrl) {
    return new Response(JSON.stringify({ ok: false, error: "missing_url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (rawUrl.length > MAX_URL_LEN) {
    return new Response(JSON.stringify({ ok: false, error: "url_too_long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate URL structure and protocol
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (targetUrl.protocol !== "https:") {
    return new Response(JSON.stringify({ ok: false, error: "https_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Allowlist check (SSRF guard)
  if (!ALLOWED_ASSET_HOSTS.has(targetUrl.hostname)) {
    return new Response(JSON.stringify({ ok: false, error: "origin_not_allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const key = await urlToR2Key(rawUrl);

  // ── R2 HIT path ──────────────────────────────────────────────────────────
  if (env.R2_ASSETS) {
    const cached = await r2Get(env.R2_ASSETS, key);
    if (cached !== null) {
      return new Response(cached.data, {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=86400, immutable",
          "X-Cache": "HIT",
          ...(cached.contentEncoding ? { "Content-Encoding": cached.contentEncoding } : {}),
        },
      });
    }
  }

  // ── Origin fetch path ─────────────────────────────────────────────────────
  let originRes: Response;
  try {
    originRes = await fetch(targetUrl.href, {
      headers: { "User-Agent": "FamilyDashBoard/1.0 (background-cache)" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "origin_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!originRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "origin_error" }), {
      status: originRes.status >= 400 && originRes.status < 600 ? originRes.status : 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read the body so we can store it in R2 and serve it
  let body: ArrayBuffer;
  try {
    body = await originRes.arrayBuffer();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "read_error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType =
    originRes.headers.get("Content-Type")?.split(";")[0]?.trim() ?? guessContentType(rawUrl);
  const contentEncoding = originRes.headers.get("Content-Encoding") ?? undefined;

  // Store in R2 (best-effort — never block the response on cache write)
  if (env.R2_ASSETS) {
    void r2Put(env.R2_ASSETS, key, body, {
      contentType,
      ...(contentEncoding !== undefined ? { contentEncoding } : {}),
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "X-Cache": "MISS",
      ...(contentEncoding ? { "Content-Encoding": contentEncoding } : {}),
    },
  });
}
