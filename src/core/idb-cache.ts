/**
 * FamilyDashBoard v7.9 — IndexedDB Cache Tier (Sprint 43)
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
export async function idbGet<T = unknown>(
  key: string,
  ttl = 0,
): Promise<T | null> {
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
 * Check whether IDB is available in the current environment.
 */
export function isIdbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
