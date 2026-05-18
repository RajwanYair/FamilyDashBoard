/**
 * FamilyDashBoard Worker — R2 static asset background cache (ADR-050).
 *
 * Provides a write-through cache layer backed by Cloudflare R2.
 * Use for large, infrequently-changing assets (SW shell, icon bundles, etc.)
 * that should survive cold-start KV evictions without re-fetching from origin.
 *
 * Key design decisions:
 *   - All operations are fire-and-forget from the caller's perspective:
 *     `get()` returns null (cache miss) rather than throwing on R2 errors.
 *     `put()` errors are silently swallowed — never let cache poison the response.
 *   - Keys are plain path strings (e.g. "dist/main.js") — no version prefix
 *     required because the caller controls the key namespace.
 *   - Content-Type and Content-Encoding are preserved via R2 httpMetadata so
 *     cached bytes can be served directly without re-header-ing.
 */

import type { R2Bucket, R2ObjectBody } from "../types";

/** Result returned by `r2Get`. */
export interface R2CacheEntry {
  data: ArrayBuffer;
  contentType: string;
  contentEncoding?: string;
}

/**
 * Retrieve a cached asset from R2.
 *
 * @returns The entry if found, or `null` on cache miss / R2 unavailable.
 */
export async function r2Get(bucket: R2Bucket, key: string): Promise<R2CacheEntry | null> {
  let obj: R2ObjectBody | null;
  try {
    obj = await bucket.get(key);
  } catch {
    return null;
  }
  if (obj === null) return null;
  try {
    const data = await obj.arrayBuffer();
    const contentType = obj.httpMetadata?.contentType ?? "application/octet-stream";
    const contentEncoding = obj.httpMetadata?.contentEncoding;
    return { data, contentType, ...(contentEncoding !== undefined ? { contentEncoding } : {}) };
  } catch {
    return null;
  }
}

/**
 * Store an asset in R2.
 * Fire-and-forget — errors are silently dropped.
 *
 * @param bucket - Bound R2Bucket.
 * @param key    - Storage key (e.g. "dist/main.js").
 * @param data   - Raw bytes to store.
 * @param meta   - Optional HTTP metadata forwarded on read.
 */
export async function r2Put(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | string,
  meta?: { contentType?: string; contentEncoding?: string },
): Promise<void> {
  try {
    await bucket.put(key, data, {
      httpMetadata: {
        ...(meta?.contentType !== undefined ? { contentType: meta.contentType } : {}),
        ...(meta?.contentEncoding !== undefined ? { contentEncoding: meta.contentEncoding } : {}),
      },
    });
  } catch {
    // Best-effort — never let cache writes fail the request
  }
}

/**
 * Delete a cached asset from R2.
 * Fire-and-forget — errors are silently dropped.
 */
export async function r2Delete(bucket: R2Bucket, key: string): Promise<void> {
  try {
    await bucket.delete(key);
  } catch {
    // Best-effort
  }
}
