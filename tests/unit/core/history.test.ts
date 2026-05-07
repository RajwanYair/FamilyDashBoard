/**
 * tests/unit/core/history.test.ts — *
 * Tests for src/core/history.ts (IDB history + sparklineSvg).
 * Uses an in-memory IDB mock (same pattern as idb-cache.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _resetHistoryDb,
  historyAppend,
  historyGet,
  sparklineSvg,
} from "../../../src/core/history";

// ── Minimal in-memory IDB mock ────────────────────────────────────────────────

function makeMockIdb() {
  let autoKey = 0;
  const store = new Map<number, unknown>();
  // Secondary index: by_ts
  const byTsIndex = {
    openCursor: vi.fn((range: IDBKeyRange | null) => {
      const cutoff = (range as IDBKeyRange & { upper: number }).upper;
      const keysToDelete: number[] = [];
      for (const [k, v] of store.entries()) {
        const entry = v as { ts: number };
        if (entry.ts <= cutoff) keysToDelete.push(k);
      }
      let i = 0;
      const makeCursor = (): IDBCursorWithValue | null => {
        if (i >= keysToDelete.length) return null;
        const key = keysToDelete[i++]!;
        return {
          delete: () => {
            store.delete(key);
            return makeReq<undefined>(undefined);
          },
          continue: () => {
            setTimeout(() => {
              (req.onsuccess as (e: unknown) => void)?.({ target: { result: makeCursor() } });
            }, 0);
          },
        } as unknown as IDBCursorWithValue;
      };
      const req = makeReq<IDBCursorWithValue | null>(makeCursor());
      return req;
    }),
  };
  // Secondary index: by_key_ts
  const byKeyTsIndex = {
    getAll: vi.fn((range: IDBKeyRange) => {
      const lower = (range as IDBKeyRange & { lower: [string, number] }).lower;
      const key = lower[0];
      const results = [...store.values()].filter((v) => (v as { key: string }).key === key);
      return makeReq<unknown[]>(results);
    }),
  };

  const objectStore = {
    add: vi.fn((value: unknown) => {
      store.set(++autoKey, value);
      return makeReq<number>(autoKey);
    }),
    index: vi.fn((name: string) => {
      if (name === "by_ts") return byTsIndex;
      if (name === "by_key_ts") return byKeyTsIndex;
      throw new Error(`Unknown index: ${name}`);
    }),
  };

  const tx = {
    objectStore: vi.fn(() => objectStore),
    oncomplete: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };

  // Fire oncomplete after microtasks
  const origAdd = objectStore.add.getMockImplementation();
  objectStore.add.mockImplementation((value: unknown) => {
    const result = origAdd?.(value);
    setTimeout(() => tx.oncomplete?.(), 0);
    return result;
  });

  const db = {
    transaction: vi.fn(() => tx),
  };

  const openReq = makeReq<IDBDatabase>(db as unknown as IDBDatabase);

  function open(_name: string, _version: number): IDBOpenDBRequest {
    const r = { ...openReq } as IDBOpenDBRequest;
    setTimeout(
      () => (r.onsuccess as unknown as (e: unknown) => void)?.({ target: { result: db } }),
      0,
    );
    return r;
  }

  return { open };
}

function makeReq<T>(result: T): IDBRequest<T> {
  const req = {
    result,
    onsuccess: null as ((e: unknown) => void) | null,
    onerror: null as ((e: unknown) => void) | null,
  };
  setTimeout(() => req.onsuccess?.({ target: req }), 0);
  return req as unknown as IDBRequest<T>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sparklineSvg", () => {
  it("returns empty string for < 2 values", () => {
    expect(sparklineSvg([], "red")).toBe("");
    expect(sparklineSvg([42], "red")).toBe("");
  });

  it("returns an SVG string for 2+ values", () => {
    const svg = sparklineSvg([10, 20, 15], "var(--accent)");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<polyline");
    expect(svg).toContain("var(--accent)");
  });

  it("uses the provided width and height in the viewBox", () => {
    const svg = sparklineSvg([1, 2, 3], "blue", 80, 30);
    expect(svg).toContain('viewBox="0 0 80 30"');
  });

  it("includes aria-hidden attribute", () => {
    const svg = sparklineSvg([1, 2], "blue");
    expect(svg).toContain('aria-hidden="true"');
  });

  it("handles flat values (all same) without NaN", () => {
    const svg = sparklineSvg([5, 5, 5], "green");
    expect(svg).not.toContain("NaN");
    expect(svg).toContain("<polyline");
  });
});

describe("historyGet — without IDB (IDB unavailable)", () => {
  beforeEach(() => {
    _resetHistoryDb();
    vi.stubGlobal("indexedDB", undefined);
  });

  it("returns empty array when IDB is unavailable", async () => {
    const result = await historyGet("test:key");
    expect(result).toEqual([]);
  });
});

describe("historyGet — IDB open error", () => {
  beforeEach(() => {
    _resetHistoryDb();
    vi.stubGlobal("IDBKeyRange", {
      upperBound: (value: number, exclusive: boolean) => ({ upper: value, upperOpen: exclusive }),
      bound: (lower: unknown, upper: unknown) => ({ lower, upper }),
    });
  });

  it("returns empty array when DB open fails (onerror path)", async () => {
    vi.stubGlobal("indexedDB", {
      open(_name: string, _version: number): IDBOpenDBRequest {
        const r: Partial<IDBOpenDBRequest> & {
          onerror?: ((e: unknown) => void) | null;
        } = {};
        setTimeout(() => r.onerror?.({ target: r }), 0);
        return r as IDBOpenDBRequest;
      },
    });
    _resetHistoryDb();
    const result = await historyGet("test:key");
    expect(result).toEqual([]);
  });
});

describe("historyAppend — without IDB (IDB unavailable)", () => {
  beforeEach(() => {
    _resetHistoryDb();
    vi.stubGlobal("indexedDB", undefined);
  });

  it("resolves without throwing when IDB is unavailable", async () => {
    await expect(historyAppend("test:key", 42)).resolves.toBeUndefined();
  });
});

describe("historyAppend + historyGet — with mock IDB", () => {
  beforeEach(() => {
    _resetHistoryDb();
    const mock = makeMockIdb();
    vi.stubGlobal("indexedDB", mock);
    // Stub IDBKeyRange (not available in happy-dom)
    vi.stubGlobal("IDBKeyRange", {
      upperBound: (value: number, exclusive: boolean) => ({ upper: value, upperOpen: exclusive }),
      bound: (lower: unknown, upper: unknown) => ({ lower, upper }),
    });
  });

  it("appends a value and retrieves it", async () => {
    await historyAppend("weather:temp", 25);
    const vals = await historyGet("weather:temp");
    expect(vals).toContain(25);
  });

  it("returns values in ascending timestamp order", async () => {
    await historyAppend("cur:USD", 3.5);
    await historyAppend("cur:USD", 3.6);
    const vals = await historyGet("cur:USD");
    expect(vals.length).toBeGreaterThanOrEqual(1);
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      await historyAppend("test:series", i);
    }
    const vals = await historyGet("test:series", 3);
    expect(vals.length).toBeLessThanOrEqual(3);
  });
});

// ── IDB upgrade: both branches of line 42 (store exists / store missing) ──────

describe("openHistoryDB — onupgradeneeded branches (line 42 TRUE and FALSE)", () => {
  afterEach(() => {
    _resetHistoryDb();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function makeFullMockIdb(opts: { storeAlreadyExists: boolean }) {
    let autoKey = 0;
    const storeMap = new Map<number, unknown>();
    const createIndexSpy = vi.fn();
    const createObjectStoreSpy = vi.fn().mockReturnValue({ createIndex: createIndexSpy });

    const byTsIndex = {
      openCursor: vi.fn(() => {
        const r = { result: null as IDBCursorWithValue | null, onsuccess: null as ((e: unknown) => void) | null, onerror: null as ((e: unknown) => void) | null };
        setTimeout(() => r.onsuccess?.({ target: r }), 0);
        return r as unknown as IDBRequest<IDBCursorWithValue | null>;
      }),
    };
    const byKeyTsIndex = {
      getAll: vi.fn(() => {
        const r = { result: [] as unknown[], onsuccess: null as ((e: unknown) => void) | null, onerror: null as ((e: unknown) => void) | null };
        setTimeout(() => r.onsuccess?.({ target: r }), 0);
        return r as unknown as IDBRequest<unknown[]>;
      }),
    };
    const objectStore = {
      add: vi.fn((value: unknown) => {
        storeMap.set(++autoKey, value);
        const r = { result: autoKey, onsuccess: null as ((e: unknown) => void) | null, onerror: null as ((e: unknown) => void) | null };
        setTimeout(() => { r.onsuccess?.({ target: r }); tx.oncomplete?.(); }, 5);
        return r as unknown as IDBRequest<number>;
      }),
      index: vi.fn((name: string) => {
        if (name === "by_ts") return byTsIndex;
        if (name === "by_key_ts") return byKeyTsIndex;
        throw new Error(`bad index: ${name}`);
      }),
    };
    const tx = { objectStore: vi.fn(() => objectStore), oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
    const db = {
      transaction: vi.fn(() => tx),
      objectStoreNames: { contains: vi.fn().mockReturnValue(opts.storeAlreadyExists) },
      createObjectStore: createObjectStoreSpy,
    };
    const openReq = { result: db as unknown as IDBDatabase, onsuccess: null as ((e: unknown) => void) | null, onerror: null as ((e: unknown) => void) | null, onupgradeneeded: null as ((e: unknown) => void) | null };
    const mockIdb = {
      open: vi.fn().mockImplementation((_n: string, _v: number) => {
        setTimeout(() => {
          (openReq.onupgradeneeded as unknown as ((e: unknown) => void))?.(
            { target: { result: db } }
          );
          (openReq.onsuccess as unknown as ((e: unknown) => void))?.(
            { target: { result: db } }
          );
        }, 0);
        return openReq as unknown as IDBOpenDBRequest;
      }),
    };
    return { mockIdb, createObjectStoreSpy, createIndexSpy };
  }

  it("creates the object store when it does NOT exist yet (line 42 TRUE)", async () => {
    vi.useFakeTimers();
    const { mockIdb, createObjectStoreSpy } = makeFullMockIdb({ storeAlreadyExists: false });
    vi.stubGlobal("indexedDB", mockIdb);
    vi.stubGlobal("IDBKeyRange", { upperBound: (v: number, e: boolean) => ({ upper: v, upperOpen: e }), bound: (l: unknown, u: unknown) => ({ lower: l, upper: u }) });
    _resetHistoryDb();
    const p = historyAppend("upgrade:key", 1);
    await vi.runAllTimersAsync();
    await p;
    expect(createObjectStoreSpy).toHaveBeenCalled();
  });

  it("skips createObjectStore when store already exists (line 42 FALSE)", async () => {
    vi.useFakeTimers();
    const { mockIdb, createObjectStoreSpy } = makeFullMockIdb({ storeAlreadyExists: true });
    vi.stubGlobal("indexedDB", mockIdb);
    vi.stubGlobal("IDBKeyRange", { upperBound: (v: number, e: boolean) => ({ upper: v, upperOpen: e }), bound: (l: unknown, u: unknown) => ({ lower: l, upper: u }) });
    _resetHistoryDb();
    const p = historyAppend("upgrade:key", 1);
    await vi.runAllTimersAsync();
    await p;
    expect(createObjectStoreSpy).not.toHaveBeenCalled();
  });
});

// ── Cursor delete path (lines 88-90): old entries get pruned ─────────────────

describe("historyAppend — cursor delete/continue path (lines 88-90)", () => {
  afterEach(() => {
    _resetHistoryDb();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("calls cursor.delete() and cursor.continue() for old entries during append", async () => {
    vi.useFakeTimers();

    let autoKey = 0;
    const storeMap = new Map<number, unknown>();
    const deleteSpy = vi.fn();
    const continueSpy = vi.fn();

    // Build byTsIndex that properly updates cursorReq.result on continue()
    const byTsIndex = {
      openCursor: vi.fn((range: IDBKeyRange | null) => {
        const cutoff = (range as IDBKeyRange & { upper: number }).upper;
        const keysToDelete: number[] = [];
        for (const [k, v] of storeMap.entries()) {
          const entry = v as { ts: number };
          if (entry.ts <= cutoff) keysToDelete.push(k);
        }
        let i = 0;
        const cursorReq = {
          result: null as IDBCursorWithValue | null,
          onsuccess: null as ((e: unknown) => void) | null,
          onerror: null as ((e: unknown) => void) | null,
        };
        const makeCursor = (): IDBCursorWithValue | null => {
          if (i >= keysToDelete.length) return null;
          const key = keysToDelete[i++]!;
          return {
            delete: () => {
              deleteSpy();
              storeMap.delete(key);
              return { result: undefined, onsuccess: null };
            },
            continue: () => {
              continueSpy();
              const next = makeCursor();
              setTimeout(() => {
                // CRITICAL: update result before firing onsuccess so history.ts sees null
                cursorReq.result = next;
                cursorReq.onsuccess?.({ target: cursorReq });
              }, 0);
            },
          } as unknown as IDBCursorWithValue;
        };
        cursorReq.result = makeCursor();
        setTimeout(() => cursorReq.onsuccess?.({ target: cursorReq }), 0);
        return cursorReq as unknown as IDBRequest<IDBCursorWithValue | null>;
      }),
    };

    const objectStore = {
      add: vi.fn((value: unknown) => {
        storeMap.set(++autoKey, value);
        const r = { result: autoKey, onsuccess: null as ((e: unknown) => void) | null, onerror: null as ((e: unknown) => void) | null };
        setTimeout(() => {
          r.onsuccess?.({ target: r });
          tx.oncomplete?.();
        }, 5);
        return r as unknown as IDBRequest<number>;
      }),
      index: vi.fn((name: string) => {
        if (name === "by_ts") return byTsIndex;
        throw new Error(`bad index: ${name}`);
      }),
    };

    const tx = {
      objectStore: vi.fn(() => objectStore),
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    const db = { transaction: vi.fn(() => tx) };

    const openReq = {
      result: db as unknown as IDBDatabase,
      onsuccess: null as ((e: unknown) => void) | null,
      onerror: null as ((e: unknown) => void) | null,
      onupgradeneeded: null as ((e: unknown) => void) | null,
    };

    const mockIdb = {
      open: vi.fn().mockImplementation((_n: string, _v: number) => {
        setTimeout(() => (openReq.onsuccess as unknown as (e: unknown) => void)?.({ target: { result: db } }), 0);
        return openReq as unknown as IDBOpenDBRequest;
      }),
    };

    vi.stubGlobal("indexedDB", mockIdb);
    vi.stubGlobal("IDBKeyRange", {
      upperBound: (value: number, exclusive: boolean) => ({ upper: value, upperOpen: exclusive }),
      bound: (lower: unknown, upper: unknown) => ({ lower, upper }),
    });

    _resetHistoryDb();

    // Insert one entry at a timestamp 8 days ago (old, should be pruned)
    const OLD_TS = Date.now() - 8 * 24 * 60 * 60 * 1000;
    storeMap.set(++autoKey, { key: "prune:test", ts: OLD_TS, v: 10 });

    // Append a new entry now — triggers cursor prune which should hit the old entry
    const appendPromise = historyAppend("prune:test", 20);
    await vi.runAllTimersAsync();
    await appendPromise;

    // Cursor delete and continue should have been called on the old entry
    expect(deleteSpy).toHaveBeenCalled();
    expect(continueSpy).toHaveBeenCalled();
  });
});
