/**
 * FamilyDashBoard Worker — Environment bindings interface.
 *
 * Extracted from index.ts so routes and utilities can import it
 * without creating circular dependencies.
 */

export interface Env {
  /** Runtime environment label ("production" | "preview" | "development"). */
  ENVIRONMENT: string;
  /** KV namespace for stale-fallback cache (Stream W.2). */
  CACHE_KV: KVNamespace;
}
