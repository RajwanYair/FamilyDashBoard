/**
 * FamilyDashBoard — Minimal IDB key-value store (Sprint 197 / M3)
 *
 * Thin wrapper around IndexedDB. Falls back to an in-memory Map when
 * IndexedDB is unavailable (test environments, private browsing).
 *
 * Rules: no external deps, no sync XHR, tree-shakeable.
 */

type Primitive = string | number | boolean | null;
export type JsonValue = Primitive | JsonValue[] | { [k: string]: JsonValue };

const _fallback = new Map<string, JsonValue>();
let _idbAvailable: boolean | null = null;

function isIDBAvailable(): boolean {
  if (_idbAvailable !== null) return _idbAvailable;
  _idbAvailable =
    typeof indexedDB !== "undefined" &&
    typeof indexedDB.open === "function";
  return _idbAvailable;
}

function openStore(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(storeName)) {
        req.result.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get a value by key. Returns null if not found. */
export async function idbGet<T>(
  dbName: string,
  storeName: string,
  key: string,
): Promise<T | null> {
  if (!isIDBAvailable()) return (_fallback.get(`${dbName}/${storeName}/${key}`) as T) ?? null;
  try {
    const db = await openStore(dbName, storeName);
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return (_fallback.get(`${dbName}/${storeName}/${key}`) as T) ?? null;
  }
}

/** Set a value by key. */
export async function idbSet<T>(
  dbName: string,
  storeName: string,
  key: string,
  value: T,
): Promise<void> {
  _fallback.set(`${dbName}/${storeName}/${key}`, value as JsonValue);
  if (!isIDBAvailable()) return;
  try {
    const db = await openStore(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* fallback already set */
  }
}

/** Delete a key. */
export async function idbDelete(
  dbName: string,
  storeName: string,
  key: string,
): Promise<void> {
  _fallback.delete(`${dbName}/${storeName}/${key}`);
  if (!isIDBAvailable()) return;
  try {
    const db = await openStore(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore */
  }
}

/** Clear the in-memory fallback — for test isolation only. */
export function _idbClearFallback(): void {
  _fallback.clear();
  _idbAvailable = null;
}
