/**
 * FamilyDashBoard v6 — Dual-Layer Cache
 *
 * In-memory Map (fast, volatile) + localStorage (persistent, 7-day eviction).
 * All keys are prefixed with `dash_v2_` for namespace isolation.
 */

import { LS_PREFIX, LS_MAX_AGE } from "./constants";

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
    return entry.data as T;
  }

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; ts: number };
    if (now - parsed.ts < ttl) {
      // Promote to in-memory for speed
      mem.set(key, { data: parsed.data, ts: parsed.ts });
      return parsed.data;
    }
  } catch {
    // Corrupted entry — ignore
  }

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
 * Store data in both in-memory and localStorage caches.
 */
export function cSet(key: string, data: unknown): void {
  const ts = Date.now();
  mem.set(key, { data, ts });

  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts }));
  } catch {
    // localStorage full — evict old entries and retry
    cEvict();
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts }));
    } catch {
      // Still full — silently fail (in-memory cache still works)
    }
  }
}

/**
 * Clear all cached data (both layers).
 */
export function cClear(): void {
  mem.clear();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(LS_PREFIX)) {
      localStorage.removeItem(k);
    }
  }
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
  return ageMs < 0 ? 0 : Math.floor(ageMs / 60_000);
}
