/**
 * FamilyDashBoard v13 — IndexedDB Cache Tier (Sprint 43)
 *
 * Async third-tier cache for large payloads that overflow localStorage (5 MB limit).
 * In-memory → localStorage → IndexedDB (largest / most persistent).
 *
 * DB:    "FamilyDashBoard"
 * Store: "cache"
 * Key:   plain string (no prefix — IDB is already namespaced by DB name)
 */

const IDB_NAME = "FamilyDashBoard";
const IDB_VERSION = 1;
const STORE_NAME = "cache";

interface IdbEntry {
  data: unknown;
  ts: number;
}

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase | null> | null = null;

/** @internal — reset for tests */
export function _resetIdb(): void {
  _db = null;
  _dbPromise = null;
}

function openDB(): Promise<IDBDatabase | null> {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;

  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  _dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // No keyPath — we supply the key explicitly in put(value, key)
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    req.onerror = () => {
      _dbPromise = null;
      resolve(null);
    };
  });

  return _dbPromise;
}

/**
 * Retrieve an entry from IDB. Returns null on miss, error, or expiry.
 * @param key - Cache key
 * @param ttl - Maximum age in milliseconds (0 = no expiry check)
 */
export async function idbGet<T = unknown>(key: string, ttl = 0): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);

      req.onsuccess = () => {
        const entry = req.result as IdbEntry | undefined;
        if (!entry) return resolve(null);
        if (ttl > 0 && Date.now() - entry.ts > ttl) return resolve(null);
        resolve(entry.data as T);
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store data in IDB.
 * @param key - Cache key
 * @param data - Serialisable payload
 */
export async function idbSet(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const entry: IdbEntry = { data, ts: Date.now() };
      // Explicit key form: put(value, key)
      const req = tx.objectStore(STORE_NAME).put(entry, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Delete a single IDB entry.
 */
export async function idbDel(key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all entries from the IDB store.
 */
export async function idbClear(): Promise<void> {
  const db = await openDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Return all keys currently stored in IDB.
 */
export async function idbKeys(): Promise<string[]> {
  const db = await openDB();
  if (!db) return [];

  return new Promise<string[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAllKeys();

      req.onsuccess = () => resolve((req.result as string[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Retrieve a full IDB entry including its timestamp (for cache hydration).
 * Returns null on miss or error.
 * @param key - Cache key
 */
export async function idbGetEntry<T = unknown>(
  key: string,
): Promise<{ data: T; ts: number } | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise<{ data: T; ts: number } | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const entry = req.result as IdbEntry | undefined;
        if (!entry) return resolve(null);
        resolve({ data: entry.data as T, ts: entry.ts });
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Check whether IDB is available in the current environment.
 */
export function isIdbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Maximum IDB cache size in bytes (v8.1: 50 MB cap). */
export const IDB_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Estimate total origin storage usage in bytes using the StorageManager API.
 * Returns 0 if the API is unavailable (Safari < 15.2, node, etc.).
 */
export async function idbEstimateSize(): Promise<number> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return 0;
  }
  try {
    const est = await navigator.storage.estimate();
    return est.usage ?? 0;
  } catch {
    return 0;
  }
}

/**
 * LRU eviction: delete the oldest IDB entries until the estimated storage
 * usage drops below `maxBytes` (default: IDB_MAX_BYTES = 50 MB).
 *
 * Strategy: read all entries sorted by timestamp ascending, delete from
 * oldest until `idbEstimateSize()` is under the limit OR all entries exhausted.
 *
 * @param maxBytes - Byte threshold (default 50 MB)
 * @returns number of entries deleted
 */
export async function idbEvictLRU(maxBytes = IDB_MAX_BYTES): Promise<number> {
  const currentSize = await idbEstimateSize();
  if (currentSize <= maxBytes) return 0;

  // Collect all entries with their timestamps for sorting
  const keys = await idbKeys();
  const entries: Array<{ key: string; ts: number }> = [];

  for (const key of keys) {
    const entry = await idbGetEntry(key);
    if (entry) entries.push({ key, ts: entry.ts });
  }

  // Sort oldest first
  entries.sort((a, b) => a.ts - b.ts);

  let removed = 0;
  for (const { key } of entries) {
    await idbDel(key);
    removed++;
    // Re-check size after every 5 deletions to avoid over-eviction
    if (removed % 5 === 0) {
      const newSize = await idbEstimateSize();
      if (newSize <= maxBytes) break;
    }
  }
  return removed;
}

/**
 * Migrate localStorage keys to IDB (Sprint 49).
 *
 * For each key in `keys`:
 *   - reads the raw stringified value from localStorage
 *   - attempts JSON.parse (skips the key if it fails)
 *   - writes the parsed value to IDB under the same key
 *   - removes the localStorage entry on success
 *
 * Silent on errors — individual key failures do not abort the rest.
 *
 * @param keys - Array of localStorage key names to migrate
 * @returns Number of keys successfully migrated
 */
export async function migrateLsToIdb(keys: string[]): Promise<number> {
  let migrated = 0;
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // skip non-JSON or corrupt entries
      }
      await idbSet(key, parsed);
      localStorage.removeItem(key);
      migrated++;
    } catch {
      // Ignore individual key errors
    }
  }
  return migrated;
}

// ── Sprint 120: time-based stale IDB eviction ────────────────────────────────

/** Default IDB stale threshold — 3 days (matches LS_MAX_AGE). */
const IDB_STALE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Delete all IDB entries whose timestamp is older than `maxAgeMs`.
 * @param maxAgeMs - Maximum entry age in ms (default: 7 days)
 * @returns Count of entries evicted
 */
export async function idbEvictStale(maxAgeMs = IDB_STALE_MS): Promise<number> {
  const now = Date.now();
  const keys = await idbKeys();
  let evicted = 0;

  for (const key of keys) {
    const entry = await idbGetEntry(key);
    if (entry && now - entry.ts > maxAgeMs) {
      await idbDel(key);
      evicted++;
    }
  }
  return evicted;
}
