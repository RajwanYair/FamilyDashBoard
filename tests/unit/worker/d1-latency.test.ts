/**
 * Tests for D1 p95 latency aggregation — (ROADMAP B5)
 *
 * Covers:
 *   - aggregateP95() pure function (all edge cases)
 *   - recordLatency() D1 interaction (via stub)
 *   - queryP95ByRoute() D1 interaction (via stub)
 */

import { describe, it, expect, vi } from "vitest";
import {
  aggregateP95,
  recordLatency,
  queryP95ByRoute,
  type RouteP95,
} from "../../../worker/src/utils/d1-telemetry";
import type { D1Database, D1PreparedStatement, D1Result } from "../../../worker/src/types";

// ── D1 stub ───────────────────────────────────────────────────────────────────

type LatencyRow = { route: string; day: string; ms: number };

function makeLatencyStub(rows: LatencyRow[] = []): D1Database {
  const stored = [...rows];

  const stmtStub = (query: string): D1PreparedStatement => {
    let boundArgs: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind(...args: unknown[]) {
        boundArgs = args;
        return stmt;
      },
      run: async (): Promise<D1Result> => {
        if (query.includes("INSERT INTO route_latency")) {
          const [route, day, ms] = boundArgs as [string, string, number];
          stored.push({ route, day, ms });
        }
        // DELETE is a no-op in the stub (we don't test pruning behavior)
        return { results: [], success: true, meta: {} } as D1Result;
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        const since = boundArgs[0] as string;
        const filtered = stored.filter((r) => r.day >= since);
        return { results: filtered as unknown as T[] };
      },
      first: async () => null,
    };
    return stmt;
  };

  return {
    exec: async () => ({ results: [], success: true, meta: {} }) as D1Result,
    prepare: stmtStub,
    batch: async () => [],
    dump: async () => new ArrayBuffer(0),
  };
}

// ── aggregateP95 — pure function tests ────────────────────────────────────────

describe("aggregateP95 — pure function", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateP95([])).toEqual([]);
  });

  it("single sample — p95 equals that sample", () => {
    const result = aggregateP95([{ route: "/api/weather", ms: 120 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ route: "/api/weather", p95ms: 120, sampleCount: 1 });
  });

  it("computes correct p95 for 20 evenly-spaced samples (1–20ms)", () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({
      route: "/api/test",
      ms: i + 1,
    }));
    const [res] = aggregateP95(samples);
    // p95 of 20 samples: ceil(20 * 0.95) - 1 = ceil(19) - 1 = 18 → ms[18] = 19
    expect(res?.p95ms).toBe(19);
    expect(res?.sampleCount).toBe(20);
  });

  it("computes correct p95 for 100 samples (1–100ms)", () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      route: "/api/news",
      ms: i + 1,
    }));
    const [res] = aggregateP95(samples);
    // p95 of 100 samples: ceil(100 * 0.95) - 1 = 94 → ms[94] = 95
    expect(res?.p95ms).toBe(95);
  });

  it("handles multiple routes independently", () => {
    const samples = [
      { route: "/api/a", ms: 10 },
      { route: "/api/b", ms: 200 },
      { route: "/api/a", ms: 20 },
      { route: "/api/b", ms: 400 },
    ];
    const result = aggregateP95(samples);
    expect(result).toHaveLength(2);
    const a = result.find((r) => r.route === "/api/a");
    const b = result.find((r) => r.route === "/api/b");
    expect(a?.p95ms).toBe(20); // single high sample of 2
    expect(b?.p95ms).toBe(400);
  });

  it("input need not be sorted — result is consistent regardless of order", () => {
    const samples = [
      { route: "/api/x", ms: 300 },
      { route: "/api/x", ms: 100 },
      { route: "/api/x", ms: 50 },
    ];
    const [res] = aggregateP95(samples);
    // Sorted: [50, 100, 300]. ceil(3*0.95)-1 = ceil(2.85)-1 = 3-1 = 2 → ms[2] = 300
    expect(res?.p95ms).toBe(300);
  });

  it("result is sorted alphabetically by route", () => {
    const samples = [
      { route: "/api/z", ms: 10 },
      { route: "/api/a", ms: 10 },
      { route: "/api/m", ms: 10 },
    ];
    const routes = aggregateP95(samples).map((r) => r.route);
    expect(routes).toEqual(["/api/a", "/api/m", "/api/z"]);
  });

  it("all identical samples — p95 equals that value", () => {
    const samples = Array.from({ length: 10 }, () => ({ route: "/api/eq", ms: 55 }));
    const [res] = aggregateP95(samples);
    expect(res?.p95ms).toBe(55);
  });
});

// ── recordLatency — D1 interaction ────────────────────────────────────────────

describe("recordLatency", () => {
  it("inserts a latency row into the stub without throwing", async () => {
    const db = makeLatencyStub();
    await expect(recordLatency(db, "/api/weather", 123.6)).resolves.toBeUndefined();
  });

  it("rounds ms to integer before inserting", async () => {
    let insertedMs: number | undefined;
    const db = makeLatencyStub();
    const origPrepare = db.prepare.bind(db);
    vi.spyOn(db, "prepare").mockImplementation((query: string) => {
      const stmt = origPrepare(query);
      if (query.includes("INSERT INTO route_latency")) {
        const origBind = stmt.bind.bind(stmt);
        vi.spyOn(stmt, "bind").mockImplementation((...args: unknown[]) => {
          insertedMs = args[2] as number;
          return origBind(...args);
        });
      }
      return stmt;
    });
    await recordLatency(db, "/api/test", 99.7);
    expect(insertedMs).toBe(100); // Math.round(99.7)
  });

  it("never throws even when D1 exec fails", async () => {
    const badDb = makeLatencyStub();
    vi.spyOn(badDb, "exec").mockRejectedValue(new Error("D1 unavailable"));
    await expect(recordLatency(badDb, "/api/test", 100)).resolves.toBeUndefined();
  });
});

// ── queryP95ByRoute — D1 interaction ─────────────────────────────────────────

describe("queryP95ByRoute", () => {
  it("returns empty array when no samples exist", async () => {
    const db = makeLatencyStub([]);
    const result = await queryP95ByRoute(db);
    expect(result).toEqual([]);
  });

  it("returns p95 for each route from stub data", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows: LatencyRow[] = [
      { route: "/api/weather", day: today, ms: 100 },
      { route: "/api/weather", day: today, ms: 200 },
      { route: "/api/weather", day: today, ms: 300 },
      { route: "/api/currency", day: today, ms: 50 },
    ];
    const db = makeLatencyStub(rows);
    const result: RouteP95[] = await queryP95ByRoute(db);
    const weather = result.find((r) => r.route === "/api/weather");
    const currency = result.find((r) => r.route === "/api/currency");
    expect(weather?.p95ms).toBeGreaterThan(0);
    expect(currency?.sampleCount).toBe(1);
  });

  it("returns empty array on D1 error (never throws)", async () => {
    const db = makeLatencyStub();
    vi.spyOn(db, "exec").mockRejectedValue(new Error("D1 down"));
    await expect(queryP95ByRoute(db)).resolves.toEqual([]);
  });
});
