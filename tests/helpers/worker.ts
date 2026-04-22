/**
 * tests/helpers/worker.ts — Cloudflare Worker test utilities (Stream W.9)
 *
 * Reusable helpers for Cloudflare Worker unit tests.
 * Import via the `@tests/worker-helpers` alias (configured in vitest.config.ts).
 *
 * @example
 *   import { makeKv, makeWorkerEnv } from "@tests/worker-helpers";
 */

import type { Env, KVStore } from "../../worker/src/types";

// ── KV helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal `KVNamespace` mock for unit tests.
 *
 * @param getImpl - Optional replacement for `kv.get`. Defaults to returning null.
 * @param putImpl - Optional replacement for `kv.put`. Defaults to a no-op.
 *
 * @example
 *   const kv = makeKv(() => Promise.resolve(JSON.stringify({ ok: true })));
 *   const stale = await kvGetStale(kv, "test:key");
 */
export function makeKv(
  getImpl: () => Promise<string | null> = () => Promise.resolve(null),
  putImpl: () => Promise<void> = () => Promise.resolve(),
): KVStore {
  return {
    get: getImpl,
    put: putImpl,
    delete: async () => undefined,
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVStore;
}

// ── Env helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal `Env` binding for Worker unit tests.
 * Returns a fully-typed Env with a no-op CACHE_KV namespace.
 *
 * Pass `kvOverrides` to customise specific KV methods (e.g., inject a get spy).
 *
 * @example
 *   const env = makeWorkerEnv();
 *   const res = await handleAlerts(env);
 *
 * @example Custom KV get:
 *   const env = makeWorkerEnv({ get: vi.fn().mockResolvedValue('"cached"') });
 */
export function makeWorkerEnv(kvOverrides?: Partial<KVStore>): Env {
  const kv = makeKv();
  return {
    ENVIRONMENT: "test",
    CACHE_KV: kvOverrides ? ({ ...kv, ...kvOverrides } as unknown as KVStore) : kv,
  };
}
