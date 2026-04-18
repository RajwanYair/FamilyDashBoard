/**
 * FamilyDashBoard v7 — Dual-Layer Cache
 *
 * In-memory Map (fast, volatile) + localStorage (persistent, 7-day eviction).
 * All keys are prefixed with `dash_v2_` for namespace isolation.
 */

import { LS_PREFIX, LS_MAX_AGE, MS_PER_MIN } from "./constants";
import { idbSet, idbGetEntry, idbKeys, idbClear, idbDel } from "./idb-cache";

// ── In-memory layer ──
interface MemEntry {
  data: unknown;
  ts: number;
}

const mem = new Map<string, MemEntry>();

// ── Evict stale localStorage entries ──
export function cEvict(): void {
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(LS_PREFIX)) continue;

    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { ts?: number };
      if (typeof entry.ts === "number" && now - entry.ts > LS_MAX_AGE) {
        keysToRemove.push(k);
      }
    } catch {
      keysToRemove.push(k);
    }
  }

  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }
}

/**
 * Get cached data. Returns `null` if missing or expired.
 * @param key - Cache key (auto-prefixed)
 * @param ttl - Maximum age in milliseconds
 */
export function cGet<T = unknown>(key: string, ttl: number): T | null {
  const now = Date.now();

  // Check in-memory first
  const entry = mem.get(key);
  if (entry && now - entry.ts < ttl) {
    _recordCacheHit();
    return entry.data as T;
  }

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) { _recordCacheMiss(); return null; }
    const parsed = JSON.parse(raw) as { data: T; ts: number };
    if (now - parsed.ts < ttl) {
      // Promote to in-memory for speed
      mem.set(key, { data: parsed.data, ts: parsed.ts });
      _recordCacheHit();
      return parsed.data;
    }
  } catch {
    // Corrupted entry — ignore
  }

  _recordCacheMiss();
  return null;
}

/**
 * Get stale data (ignores TTL). Used as fallback when fresh fetch fails.
 */
export function cGetStale<T = unknown>(key: string): T | null {
  // Check in-memory
  const entry = mem.get(key);
  if (entry) return entry.data as T;

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T };
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Async version of cGet that explicitly checks IDB as L2 tier.
 * Priority order: memory → IDB → localStorage.
 * Use for card loaders that can await (preferred for new code).
 * @param key  - Cache key (auto-prefixed for IDB too)
 * @param ttl  - Maximum age in milliseconds
 */
export async function cGetAsync<T = unknown>(
  key: string,
  ttl: number,
): Promise<T | null> {
  const now = Date.now();

  // L1: in-memory
  const entry = mem.get(key);
  if (entry && now - entry.ts < ttl) {
    _recordCacheHit();
    return entry.data as T;
  }

  // L2: IndexedDB (async — explicit tier, v7.10)
  const idbEntry = await idbGetEntry<T>(key);
  if (idbEntry && now - idbEntry.ts < ttl) {
    // Promote to memory for future sync access
    mem.set(key, { data: idbEntry.data, ts: idbEntry.ts });
    _recordCacheHit();
    return idbEntry.data;
  }

  // L3: localStorage (sync fallback)
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as { data: T; ts: number };
      if (now - parsed.ts < ttl) {
        mem.set(key, { data: parsed.data, ts: parsed.ts });
        _recordCacheHit();
        return parsed.data;
      }
    }
  } catch {
    // Corrupted entry — ignore
  }

  _recordCacheMiss();
  return null;
}

/**
 * Async stale getter: memory → IDB (any age) → localStorage (any age).
 * Used as last-resort offline fallback when fresh fetch fails.
 * @param key - Cache key
 */
export async function cGetStaleAsync<T = unknown>(key: string): Promise<T | null> {
  // L1: in-memory
  const entry = mem.get(key);
  if (entry) return entry.data as T;

  // L2: IDB (any age)
  const idbEntry = await idbGetEntry<T>(key);
  if (idbEntry) {
    mem.set(key, { data: idbEntry.data, ts: idbEntry.ts });
    return idbEntry.data;
  }

  // L3: LS (any age)
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T };
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Store data in in-memory, localStorage, and IndexedDB caches.
 * IDB write is fire-and-forget (async, does not block callers).
 */
export function cSet(key: string, data: unknown): void {
  const ts = Date.now();
  mem.set(key, { data, ts });

  // Write to IDB asynchronously (fire-and-forget)
  void idbSet(key, data);

  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts }));
  } catch {
    // localStorage full — evict old entries and retry
    cEvict();
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts }));
    } catch {
      // Still full — silently fail (in-memory + IDB cache still works)
    }
  }
}

/**
 * Hydrate the in-memory cache from IDB on startup.
 * Reads all non-stale IDB entries into memory so subsequent synchronous
 * cGet() calls find them without a round-trip to localStorage.
 * @returns number of entries loaded into memory
 */
export async function hydrateFromIdb(): Promise<number> {
  try {
    const keys = await idbKeys();
    const now = Date.now();
    let count = 0;
    for (const key of keys) {
      // Skip if already warm in memory
      if (mem.has(key)) continue;
      const entry = await idbGetEntry(key);
      if (!entry) continue;
      // Skip stale entries (matches LS_MAX_AGE = 7 days)
      if (now - entry.ts > LS_MAX_AGE) continue;
      mem.set(key, { data: entry.data, ts: entry.ts });
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Clear all cached data (memory, localStorage, and IDB).
 * IDB clear is fire-and-forget (async).
 */
export function cClear(): void {
  mem.clear();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(LS_PREFIX)) {
      localStorage.removeItem(k);
    }
  }
  void idbClear();
}

/** F6 (v7.2): Returns age in minutes of the oldest dash_v2_ cache entry. 0 if none found. */
export function getOldestCacheAgeMinutes(): number {
  let oldest = Date.now();
  let found = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LS_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { ts?: number };
      if (typeof parsed.ts === "number" && parsed.ts < oldest) {
        oldest = parsed.ts;
        found = true;
      }
    } catch {
      /* skip malformed entries */
    }
  }
  if (!found) return 0;
  const ageMs = Date.now() - oldest;
  return ageMs < 0 ? 0 : Math.floor(ageMs / MS_PER_MIN);
}

// ── Sprint 29: cache statistics ───────────────────────────────────────────────

let _cacheHits = 0;
let _cacheMisses = 0;

/** Increment hit counter (called internally by cGet). */
export function _recordCacheHit(): void { _cacheHits++; }
/** Increment miss counter (called internally by cGet). */
export function _recordCacheMiss(): void { _cacheMisses++; }

/** Returns current cache hit/miss counts and hit rate. */
export function cacheStats(): { hits: number; misses: number; hitRate: number } {
  const total = _cacheHits + _cacheMisses;
  return {
    hits: _cacheHits,
    misses: _cacheMisses,
    hitRate: total === 0 ? 0 : Math.round((_cacheHits / total) * 100) / 100,
  };
}

/** Reset stats counters (useful in tests). */
export function resetCacheStats(): void {
  _cacheHits = 0;
  _cacheMisses = 0;
}

// ── Sprint 51: IDB migration + IDB eviction ───────────────────────────────────

/**
 * One-time migration: copy all `dash_v2_*` localStorage entries into IDB.
 * Uses the flag key `dash_v2_idb_migrated` to skip on subsequent loads.
 * @returns number of entries migrated (0 if already migrated or IDB unavailable)
 */
export async function migrateLocalStorageToIdb(): Promise<number> {
  const FLAG = LS_PREFIX + "idb_migrated";
  if (localStorage.getItem(FLAG)) return 0;

  const entries: Array<{ key: string; data: unknown; ts: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(LS_PREFIX)) continue;
    if (k === FLAG) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { data: unknown; ts: number };
      if (typeof parsed.ts !== "number") continue;
      // Strip the LS_PREFIX to get the bare key used by idbSet
      const bareKey = k.slice(LS_PREFIX.length);
      entries.push({ key: bareKey, data: parsed.data, ts: parsed.ts });
    } catch {
      // Skip malformed entries
    }
  }

  for (const e of entries) {
    await idbSet(e.key, e.data);
  }

  if (entries.length > 0) {
    localStorage.setItem(FLAG, "1");
  }
  return entries.length;
}

/**
 * Evict stale entries from IDB (older than LS_MAX_AGE = 7 days).
 * Mirror of cEvict() for the IDB tier.
 * @returns number of entries removed
 */
export async function cEvictIdb(): Promise<number> {
  const keys = await idbKeys();
  const now = Date.now();
  let removed = 0;

  for (const key of keys) {
    const entry = await idbGetEntry(key);
    if (!entry) continue;
    if (now - entry.ts > LS_MAX_AGE) {
      await idbDel(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Null-coalescing cache read (Sprint 59).
 *
 * Returns the fresh cache value if available; otherwise calls `fallback()`
 * and stores its result before returning it. Useful for synchronous
 * getters that have a cheap default factory.
 *
 * @param key      - Cache key
 * @param ttl      - Maximum age in milliseconds
 * @param fallback - Factory called on a cache miss; result is stored
 * @returns Cached or freshly-computed value
 */
export function cOr<T>(key: string, ttl: number, fallback: () => T): T {
  const hit = cGet<T>(key, ttl);
  if (hit !== null) return hit;
  const computed = fallback();
  cSet(key, computed);
  return computed;
}

/**
 * IDB cold-start loader (Sprint 47).
 *
 * Provides a standard pattern for the card page-load phase:
 *   1. Try IDB/memory async cache first (no network).
 *   2. If found and non-stale → call `render(data)` directly.
 *   3. Return the data so the caller can decide whether to skip the fetch.
 *
 * This replaces the common `cGet(key, ttl) ?? cGetStale(key)` pattern
 * with an async-first flow that checks IDB tier L2 before localStorage.
 *
 * @param key    - Cache key (same key used with `cSet`)
 * @param ttl    - Maximum age for a "fresh" hit in milliseconds
 * @param render - Called synchronously when data is available
 * @returns The cached data if found (fresh or stale), or null
 */
export async function coldStart<T>(
  key: string,
  ttl: number,
  render: (data: T) => void,
): Promise<T | null> {
  // Try async-first (IDB L2 + memory L1)
  const fresh = await cGetAsync<T>(key, ttl);
  if (fresh !== null) {
    render(fresh);
    return fresh;
  }

  // Stale fallback (any age)
  const stale = await cGetStaleAsync<T>(key);
  if (stale !== null) {
    render(stale);
    return stale;
  }

  return null;
}

// ── Sprint 95: Cache age helper ──────────────────────────────────────────

/**
 * Returns the age in milliseconds of a cached entry, or `null` if not found.
 * Checks in-memory cache first, then localStorage.
 * Does NOT check TTL — it simply measures elapsed time since the entry was stored.
 */
export function cAge(key: string): number | null {
  const now = Date.now();

  // In-memory
  const entry = mem.get(key);
  if (entry) return now - entry.ts;

  // localStorage
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number };
    if (typeof parsed.ts === "number") return now - parsed.ts;
  } catch {
    // Corrupted entry
  }

  return null;
}
