/**
 * Small storage-area adapter for state that is not cache data.
 *
 * Keeping access here lets callers handle unavailable or quota-limited storage
 * without reaching into browser storage APIs directly.
 */

export type StorageArea = "local" | "session";

function getStorage(area: StorageArea): Storage | null {
  try {
    return area === "local" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

export function readStorageValue(area: StorageArea, key: string): string | null {
  const storage = getStorage(area);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageValue(area: StorageArea, key: string, value: string): boolean {
  const storage = getStorage(area);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageValue(area: StorageArea, key: string): boolean {
  const storage = getStorage(area);
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
