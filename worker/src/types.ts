/**
 * FamilyDashBoard Worker — Environment bindings interface.
 *
 * Extracted from index.ts so routes and utilities can import it
 * without creating circular dependencies.
 */

/**
 * Minimal KV namespace interface — only the methods used by this worker.
 * The Cloudflare KVNamespace satisfies this interface via structural typing,
 * so production deployment is unaffected. Defining it here avoids importing
 * the `@cloudflare/workers-types` ambient package in consumer files (e.g. tests).
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cacheStatus: null | "HIT" | "MISS" | "EXPIRED";
  }>;
}

export interface Env {
  /** Runtime environment label ("production" | "preview" | "development"). */
  ENVIRONMENT: string;
  /** KV namespace for stale-fallback cache (Stream W.2). */
  CACHE_KV: KVStore;
  /**
   * Secret token required to access GET /api/errors/export.
   * Set as a Worker secret (wrangler secret put ERROR_REPORTING_TOKEN).
   * Optional — export endpoint returns 501 when not configured.
   */
  ERROR_REPORTING_TOKEN?: string;
}
