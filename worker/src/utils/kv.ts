/**
 * FamilyDashBoard Worker — KV cache helpers.
 *
 * Shared stale-fallback utilities used by multiple route handlers.
 * KV reads/writes are non-fatal: failures never break the primary response.
 */

/**
 * Try to read a cached value from KV.
 * Returns the parsed object with `_stale: true` injected, or null if absent.
 */
export async function kvGetStale<T>(
  kv: KVNamespace,
  key: string,
): Promise<(T & { _stale: true }) | null> {
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    return { ...parsed, _stale: true };
  } catch {
    return null;
  }
}

/** Write a successful upstream response to KV for future stale fallback. */
export async function kvPut(
  kv: KVNamespace,
  key: string,
  data: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch {
    // Non-fatal — KV write failures should not break the primary response.
  }
}
