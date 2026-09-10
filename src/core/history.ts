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

export interface HistorySample {
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
export async function historyAppend(key: string, value: number): Promise<boolean> {
  const db = await openHistoryDB();
  if (!db) return false;

  const now = Date.now();
  const cutoff = now - SEVEN_DAYS_MS;

  return new Promise<boolean>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Write new point
    store.add({ key, ts: now, v: value } satisfies HistorySample);

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

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

function normalizeHistoryLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 100;
  return Math.max(0, Math.floor(limit));
}

/**
 * Retrieve timestamped values for a series, sorted oldest-first.
 *
 * The timestamp is intentionally exposed for sampling decisions while
 * `historyGet()` remains the value-only compatibility API.
 */
export async function historyGetPoints(key: string, limit = 100): Promise<HistorySample[]> {
  const normalizedLimit = normalizeHistoryLimit(limit);
  if (normalizedLimit === 0) return [];

  const db = await openHistoryDB();
  if (!db) return [];

  return new Promise<HistorySample[]>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index("by_key_ts");

    const range = IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]);
    const req = idx.getAll(range);

    req.onsuccess = () => {
      const entries = ((req.result as HistorySample[]) ?? [])
        .filter(
          (entry) => entry?.key === key && Number.isFinite(entry.ts) && Number.isFinite(entry.v),
        )
        .sort((a, b) => a.ts - b.ts);
      resolve(entries.slice(-normalizedLimit));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Retrieve all values for a key, sorted oldest-first.
 * Returns an empty array when IDB is unavailable or no data exists.
 * @param key   Named series key
 * @param limit Maximum number of points to return (default: 100)
 */
export async function historyGet(key: string, limit = 100): Promise<number[]> {
  return (await historyGetPoints(key, limit)).map((entry) => entry.v);
}

/**
 * Append at most one sample per interval.
 *
 * Financial cards refresh more often than their trend windows need. Sampling
 * at the storage boundary keeps a seven-day chart representative instead of
 * showing only the last few minutes of repeated refreshes.
 */
export async function historyAppendSampled(
  key: string,
  value: number,
  minIntervalMs: number,
): Promise<boolean> {
  const latest = (await historyGetPoints(key, 1)).at(-1);
  const now = Date.now();
  if (latest && now - latest.ts < Math.max(0, minIntervalMs)) return false;
  return historyAppend(key, value);
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
export function sparklineSvg(values: number[], color: string, w = 60, h = 22): string {
  const points = values
    .filter((value) => Number.isFinite(value))
    .map((value, index) => ({ key: "values", ts: index, v: value }));
  return renderSparklinePoints(points, color, w, h);
}

/**
 * Render a timestamp-aware sparkline without bridging long data gaps.
 *
 * Financial history uses this variant so market closures and failed fetches
 * remain visible as breaks rather than implied interpolation.
 */
export function sparklineSvgPoints(
  points: HistorySample[],
  color: string,
  w = 60,
  h = 22,
  expectedIntervalMs = 0,
): string {
  return renderSparklinePoints(points, color, w, h, expectedIntervalMs);
}

function renderSparklinePoints(
  points: HistorySample[],
  color: string,
  w: number,
  h: number,
  expectedIntervalMs = 0,
): string {
  const finitePoints = points
    .filter((point) => point !== null && Number.isFinite(point.ts) && Number.isFinite(point.v))
    .sort((a, b) => a.ts - b.ts);
  if (finitePoints.length < 2) return "";
  const pad = 2;
  const min = Math.min(...finitePoints.map((point) => point.v));
  const max = Math.max(...finitePoints.map((point) => point.v));
  const range = max - min || 1;
  const firstTs = finitePoints[0]?.ts ?? 0;
  const lastTs = finitePoints.at(-1)?.ts ?? firstTs;
  const timeSpan = lastTs - firstTs;
  const gapThreshold =
    Number.isFinite(expectedIntervalMs) && expectedIntervalMs > 0
      ? expectedIntervalMs * 1.5
      : Number.POSITIVE_INFINITY;

  const coordinate = (point: HistorySample, index: number): string => {
    const position =
      timeSpan > 0 ? (point.ts - firstTs) / timeSpan : index / (finitePoints.length - 1);
    const x = (pad + position * (w - 2 * pad)).toFixed(2);
    const y = (h - pad - ((point.v - min) / range) * (h - 2 * pad)).toFixed(2);
    return `${x},${y}`;
  };

  const lines: string[] = [];
  const dots: string[] = [];
  let segment: string[] = [];
  for (let index = 0; index < finitePoints.length; index++) {
    const point = finitePoints[index]!;
    const previous = finitePoints[index - 1];
    if (previous && point.ts - previous.ts > gapThreshold) {
      if (segment.length >= 2) {
        lines.push(segment.join(" "));
      } else if (segment.length === 1) {
        const [x, y] = segment[0]!.split(",");
        dots.push(`<circle cx="${x}" cy="${y}" r="1.5"/>`);
      }
      segment = [];
    }
    segment.push(coordinate(point, index));
  }
  if (segment.length >= 2) {
    lines.push(segment.join(" "));
  } else if (segment.length === 1) {
    const [x, y] = segment[0]!.split(",");
    dots.push(`<circle cx="${x}" cy="${y}" r="1.5"/>`);
  }

  const polylines = lines
    .map(
      (pointsValue) =>
        `<polyline points="${pointsValue}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${polylines}${dots.join("")}</svg>`;
}
