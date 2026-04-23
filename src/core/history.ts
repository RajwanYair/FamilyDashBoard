/**
 * FamilyDashBoard — Per-card 7-day rolling history (IDB-backed)
 *
 * Stores timestamped numeric data points per named key in IndexedDB.
 * Auto-evicts entries older than 7 days on every write.
 *
 * DB:     "FDBHistory"  (separate from the main cache DB)
 * Store:  "points"
 * Schema: { key: string; ts: number; v: number }  — keyed by [key, ts]
 */

const DB_NAME = "FDBHistory";
const DB_VERSION = 1;
const STORE_NAME = "points";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

interface HistoryPoint {
  key: string;
  ts: number;
  v: number;
}

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase | null> | null = null;

/** @internal — reset for tests */
export function _resetHistoryDb(): void {
  _db = null;
  _dbPromise = null;
}

function openHistoryDB(): Promise<IDBDatabase | null> {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  _dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { autoIncrement: true });
        store.createIndex("by_key_ts", ["key", "ts"], { unique: false });
        store.createIndex("by_ts", "ts", { unique: false });
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
 * Append a new data point and evict entries older than 7 days.
 * @param key   Named series key, e.g. "cur:USD", "weather:temp"
 * @param value Numeric value to record
 */
export async function historyAppend(key: string, value: number): Promise<void> {
  const db = await openHistoryDB();
  if (!db) return;

  const now = Date.now();
  const cutoff = now - SEVEN_DAYS_MS;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Write new point
    store.add({ key, ts: now, v: value } satisfies HistoryPoint);

    // Evict old points for this key via by_ts index
    const idx = store.index("by_ts");
    const range = IDBKeyRange.upperBound(cutoff, true);
    const cursorReq = idx.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve(); // best-effort
  });
}

/**
 * Retrieve all values for a key, sorted oldest-first.
 * Returns an empty array when IDB is unavailable or no data exists.
 * @param key   Named series key
 * @param limit Maximum number of points to return (default: 100)
 */
export async function historyGet(key: string, limit = 100): Promise<number[]> {
  const db = await openHistoryDB();
  if (!db) return [];

  return new Promise<number[]>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index("by_key_ts");

    // Use [key, 0] → [key, ∞] range to get all points for this key
    const range = IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]);
    const req = idx.getAll(range);

    req.onsuccess = () => {
      const entries = (req.result as HistoryPoint[]) ?? [];
      entries.sort((a, b) => a.ts - b.ts);
      resolve(entries.slice(-limit).map((e) => e.v));
    };
    req.onerror = () => resolve([]);
  });
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

/**
 * Render a lightweight inline SVG sparkline polyline from a values array.
 *
 * @param values  Ordered numeric values (oldest → newest)
 * @param color   CSS color string (e.g. "var(--positive)")
 * @param w       Viewbox width  (default: 60)
 * @param h       Viewbox height (default: 22)
 * @returns       SVG string ready for `innerHTML` assignment (wrapped in trustedHTML)
 */
export function sparklineSvg(
  values: number[],
  color: string,
  w = 60,
  h = 22,
): string {
  if (values.length < 2) return "";
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values
    .map((v, i) => {
      const x = (pad + (i / (values.length - 1)) * (w - 2 * pad)).toFixed(2);
      const y = (h - pad - ((v - min) / range) * (h - 2 * pad)).toFixed(2);
      return `${x},${y}`;
    })
    .join(" ");

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
