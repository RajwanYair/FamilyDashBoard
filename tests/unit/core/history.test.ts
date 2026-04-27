/**
 * tests/unit/core/history.test.ts — Sprint 11
 *
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
