/**
 * FamilyDashBoard v13 — Provider Adapter Types (Sprint 88)
 *
 * A ProviderAdapter is the contract for every external data source.
 * Cards don't call fetch() directly; they use an adapter that:
 *   1. Builds the URL
 *   2. Parses / validates the response
 *   3. Reports success/failure to provider health
 *   4. Handles cache get/set
 *
 * Cards only see `adapter.fetch()` → `T | null`.
 */

import type { ProviderStatus } from "../core/provider";

// ── Adapter result ─────────────────────────────────────────────────────────

/** Discriminated union: either success with data or failure with reason. */
export type ProviderResult<T> =
  | { ok: true; data: T; cachedAt?: string }
  | { ok: false; error: string; stale?: T | undefined };

// ── Adapter interface ──────────────────────────────────────────────────────

export interface ProviderAdapter<T> {
  /** Unique provider ID — matches health tracking (e.g. "open-meteo"). */
  readonly id: string;

  /** Human-readable name shown in diagnostics (e.g. "Open-Meteo Weather"). */
  readonly displayName: string;

  /** Cache key used with cGet/cSet (e.g. "wx"). */
  readonly cacheKey: string;

  /** Default TTL for cache entries in milliseconds. */
  readonly cacheTtl: number;

  /**
   * Fetch fresh data from the provider.
   * On success returns `{ ok: true, data }`.
   * On failure returns `{ ok: false, error, stale? }` — `stale` is the
   * last known good data from cache if available.
   */
  fetch(): Promise<ProviderResult<T>>;

  /**
   * Current health status derived from provider.ts tracking.
   * Returns the snapshot status at call time.
   */
  status(): ProviderStatus;
}

// ── Adapter options ────────────────────────────────────────────────────────

/**
 * Common options passed when constructing an adapter.
 */
export interface ProviderAdapterOptions {
  /** Override default cache TTL (milliseconds). */
  cacheTtl?: number;
  /** Maximum fetch timeout in milliseconds. */
  timeout?: number;
}
