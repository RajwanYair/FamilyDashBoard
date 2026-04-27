/**
 * Tests for worker/src/routes/reports.ts and worker/src/utils/d1-reports.ts
 *
 * All tests run in happy-dom without Miniflare.
 * D1 operations are mocked via in-memory stubs.
 */

import { describe, it, expect } from "vitest";
import { handleReportsIngest, handleReportsDigest } from "../../../worker/src/routes/reports";
import {
  storeReport,
  queryReportSummary,
  pruneOldReports,
} from "../../../worker/src/utils/d1-reports";
import type { Env, D1Database, D1PreparedStatement, D1Result } from "../../../worker/src/types";

// ── D1 stub ───────────────────────────────────────────────────────────────────

type ReportRow = {
  id?: number;
  ts: number;
  type: string;
  url: string;
  detail: string;
  day: string;
};

function makeD1Stub(rows: ReportRow[] = []): D1Database {
  const stored: ReportRow[] = [...rows];
  let nextId = rows.length + 1;

  const stmtStub = (query: string): D1PreparedStatement => {
    let boundArgs: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind(...args: unknown[]) {
        boundArgs = args;
        return stmt;
      },
      run: async () => {
        if (query.includes("INSERT INTO browser_reports")) {
          const [ts, type, url, detail, day] = boundArgs as [
            number,
            string,
            string,
            string,
            string,
          ];
          stored.push({ id: nextId++, ts, type, url, detail, day });
        } else if (query.includes("DELETE FROM browser_reports")) {
          const cutoff = boundArgs[0] as string;
          const before = stored.length;
          stored.splice(0, stored.length, ...stored.filter((r) => r.day >= cutoff));
          return { results: [], success: true, meta: { rows_written: before - stored.length } };
        }
        return { results: [], success: true };
      },
      first: async () => null,
      all: async <T>(): Promise<D1Result<T>> => {
        // GROUP BY type, day simulated
        if (query.includes("GROUP BY type, day")) {
          const since = boundArgs[0] as string;
          const filtered = stored.filter((r) => r.day >= since);
          const counts: Record<string, number> = {};
          const days: Record<string, string> = {};
          for (const r of filtered) {
            const key = `${r.type}::${r.day}`;
            counts[key] = (counts[key] ?? 0) + 1;
            days[key] = r.day;
          }
          const results = Object.entries(counts).map(([key, count]) => {
            const [type] = key.split("::");
            return { type, day: days[key] ?? "", count };
          });
          return { results: results as unknown as T[], success: true };
        }
        return { results: stored as unknown as T[], success: true };
      },
    };
    return stmt;
  };

  return {
    prepare: stmtStub,
    exec: async () => ({ count: 1, duration: 0 }),
    _stored: stored, // expose for assertions
  } as D1Database & { _stored: ReportRow[] };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: async () => null,
      put: async () => undefined,
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    },
    REPORTS_TOKEN: "test-reports-token",
    DB: makeD1Stub(),
    ...overrides,
  };
}

// ── d1-reports unit tests ─────────────────────────────────────────────────────

describe("d1-reports — storeReport", () => {
  it("inserts a row with sanitised data", async () => {
    const db = makeD1Stub() as D1Database & { _stored: ReportRow[] };
    await storeReport(db, "csp-violation", "https://example.com/page?q=1", {
      blockedURL: "https://evil.com/script.js",
      userAgent: "Mozilla/5.0 (should be stripped)",
    });
    expect(db._stored).toHaveLength(1);
    expect(db._stored[0]!.type).toBe("csp-violation");
    // Query string must be stripped from URL
    expect(db._stored[0]!.url).toBe("https://example.com/page");
    // userAgent must NOT appear in stored detail
    expect(db._stored[0]!.detail).not.toContain("userAgent");
    expect(db._stored[0]!.detail).toContain("blockedURL");
  });

  it("handles empty body gracefully", async () => {
    const db = makeD1Stub() as D1Database & { _stored: ReportRow[] };
    await storeReport(db, "deprecation", "", {});
    expect(db._stored).toHaveLength(1);
    expect(db._stored[0]!.url).toBe("");
  });

  it("does not throw when D1 exec throws", async () => {
    const badDb: D1Database = {
      prepare: () => {
        throw new Error("D1 failure");
      },
      exec: async () => {
        throw new Error("D1 failure");
      },
    };
    await expect(storeReport(badDb, "csp-violation", "", {})).resolves.toBeUndefined();
  });
});

describe("d1-reports — queryReportSummary", () => {
  it("returns grouped counts", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const db = makeD1Stub([
      { ts: 1, type: "csp-violation", url: "https://a.com", detail: "{}", day: today },
      { ts: 2, type: "csp-violation", url: "https://b.com", detail: "{}", day: today },
      { ts: 3, type: "deprecation", url: "https://c.com", detail: "{}", day: today },
    ]);
    const summary = await queryReportSummary(db);
    const csp = summary.find((r) => r.type === "csp-violation");
    const dep = summary.find((r) => r.type === "deprecation");
    expect(csp?.count).toBe(2);
    expect(dep?.count).toBe(1);
  });

  it("returns empty array when no rows exist", async () => {
    const db = makeD1Stub();
    const summary = await queryReportSummary(db);
    expect(summary).toEqual([]);
  });

  it("swallows D1 errors and returns empty array", async () => {
    const badDb: D1Database = {
      prepare: () => {
        throw new Error("D1 offline");
      },
      exec: async () => {
        throw new Error("D1 offline");
      },
    };
    const summary = await queryReportSummary(badDb);
    expect(summary).toEqual([]);
  });
});

describe("d1-reports — pruneOldReports", () => {
  it("does not throw even when D1 fails", async () => {
    const badDb: D1Database = {
      prepare: () => {
        throw new Error("D1 failure");
      },
      exec: async () => {
        throw new Error("D1 failure");
      },
    };
    await expect(pruneOldReports(badDb, 30)).resolves.toBeUndefined();
  });
});

// ── handleReportsIngest ───────────────────────────────────────────────────────

describe("handleReportsIngest — POST /api/reports", () => {
  it("returns 204 for a valid CSP violation report array", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify([
        {
          type: "csp-violation",
          url: "https://example.com/page",
          body: { blockedURL: "https://evil.com/script.js", effectiveDirective: "script-src" },
        },
      ]),
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(204);
  });

  it("returns 204 for an empty array (no-op)", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]",
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(204);
  });

  it("returns 400 for invalid JSON body", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      body: "not json at all",
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is an object, not an array", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "csp-violation" }),
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(400);
  });

  it("returns 204 even when DB is not configured (feature disabled)", async () => {
    const env = makeEnv({ DB: undefined });
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      body: JSON.stringify([{ type: "deprecation", url: "https://example.com" }]),
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(204);
  });

  it("accepts multiple report types in one request", async () => {
    const db = makeD1Stub() as D1Database & { _stored: ReportRow[] };
    const env = makeEnv({ DB: db });
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      body: JSON.stringify([
        { type: "csp-violation", url: "https://a.com", body: {} },
        { type: "deprecation", url: "https://b.com", body: { message: "deprecated api" } },
        { type: "intervention", url: "https://c.com", body: {} },
      ]),
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(204);
  });

  it("truncates payload exceeding MAX_REPORTS_PER_REQUEST (50)", async () => {
    const db = makeD1Stub() as D1Database & { _stored: ReportRow[] };
    const env = makeEnv({ DB: db });
    const reports = Array.from({ length: 60 }, (_, i) => ({
      type: "csp-violation",
      url: `https://example.com/${i}`,
    }));
    const req = new Request("https://worker.example.com/api/reports", {
      method: "POST",
      body: JSON.stringify(reports),
    });
    const res = await handleReportsIngest(req, env);
    expect(res.status).toBe(204);
    expect(db._stored.length).toBeLessThanOrEqual(50);
  });
});

// ── handleReportsDigest ───────────────────────────────────────────────────────

describe("handleReportsDigest — GET /api/reports/digest", () => {
  it("returns 501 when REPORTS_TOKEN is not configured", async () => {
    const env = makeEnv({ REPORTS_TOKEN: undefined });
    const req = new Request("https://worker.example.com/api/reports/digest");
    const res = await handleReportsDigest(req, env);
    expect(res.status).toBe(501);
  });

  it("returns 501 when DB is not configured", async () => {
    const env = makeEnv({ DB: undefined });
    const req = new Request("https://worker.example.com/api/reports/digest");
    const res = await handleReportsDigest(req, env);
    expect(res.status).toBe(501);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports/digest");
    const res = await handleReportsDigest(req, env);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports/digest", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    const res = await handleReportsDigest(req, env);
    expect(res.status).toBe(401);
  });

  it("returns 200 JSON with summary when token is correct", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports/digest", {
      headers: { Authorization: "Bearer test-reports-token" },
    });
    const res = await handleReportsDigest(req, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; summary: unknown[]; generatedAt: string };
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.summary)).toBe(true);
    expect(typeof json.generatedAt).toBe("string");
  });

  it("returns empty summary array when no reports stored", async () => {
    const env = makeEnv({ DB: makeD1Stub() });
    const req = new Request("https://worker.example.com/api/reports/digest", {
      headers: { Authorization: "Bearer test-reports-token" },
    });
    const res = await handleReportsDigest(req, env);
    const json = (await res.json()) as { summary: unknown[] };
    expect(json.summary).toEqual([]);
  });

  it("returns Cache-Control: no-store on digest response", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/api/reports/digest", {
      headers: { Authorization: "Bearer test-reports-token" },
    });
    const res = await handleReportsDigest(req, env);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
