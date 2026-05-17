/**
 * fast-check property tests — worker/src/utils/d1-reports.ts
 *
 * Properties under test:
 *  D1R1. stripUrl (via storeReport): valid URLs are always stripped to origin+path (no query/fragment)
 *  D1R2. stripUrl: invalid URL strings → stored as empty string (no throw)
 *  D1R3. storeReport: never throws — errors are always swallowed
 *  D1R4. pruneOldReports: never throws when DB is unavailable
 *  D1R5. queryReportSummary: returns empty array when DB is unavailable
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import {
  storeReport,
  pruneOldReports,
  queryReportSummary,
} from "../../../worker/src/utils/d1-reports";
import type { D1Database } from "../../../worker/src/types";

// ── Mock D1Database ───────────────────────────────────────────────────────────

function makeMockDb(overrides: Partial<D1Database> = {}): D1Database {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({}),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
  };
  return {
    exec: vi.fn().mockResolvedValue({}),
    prepare: vi.fn().mockReturnValue(stmt),
    batch: vi.fn().mockResolvedValue([]),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    ...overrides,
  } as unknown as D1Database;
}

function makeFailingDb(): D1Database {
  return {
    exec: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockRejectedValue(new Error("DB unavailable")),
      all: vi.fn().mockRejectedValue(new Error("DB unavailable")),
      first: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    }),
    batch: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    dump: vi.fn().mockRejectedValue(new Error("DB unavailable")),
  } as unknown as D1Database;
}

// ── D1R1: valid URLs stripped to origin+path ─────────────────────────────────

describe("d1-reports — D1R1: valid URLs are stripped (no query/fragment)", () => {
  it("never throws and always stores origin+pathname for valid URLs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ withQueryParameters: true, withFragments: true }),
        async (url) => {
          const db = makeMockDb();
          await expect(storeReport(db, "csp-violation", url, {})).resolves.toBeUndefined();
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── D1R2: invalid URL strings stored as empty string ─────────────────────────

describe("d1-reports — D1R2: invalid URL strings never throw", () => {
  it("storeReport accepts arbitrary strings as url without throwing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ maxLength: 60 }),
          fc.constant(""),
          fc.constant("not-a-url"),
          fc.constant("ftp://??"),
        ),
        async (url) => {
          const db = makeMockDb();
          await expect(storeReport(db, "deprecation", url, {})).resolves.toBeUndefined();
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── D1R3: storeReport never throws ───────────────────────────────────────────

describe("d1-reports — D1R3: storeReport swallows all errors", () => {
  it("never rejects even when DB throws", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 200 }),
        async (type, url) => {
          const db = makeFailingDb();
          await expect(storeReport(db, type, url, {})).resolves.toBeUndefined();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── D1R4: pruneOldReports never throws ───────────────────────────────────────

describe("d1-reports — D1R4: pruneOldReports never throws", () => {
  it("never rejects for any days value when DB is unavailable", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 365 }),
        async (days) => {
          const db = makeFailingDb();
          await expect(pruneOldReports(db, days)).resolves.toBeUndefined();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── D1R5: queryReportSummary returns empty array on DB failure ────────────────

describe("d1-reports — D1R5: queryReportSummary returns [] on DB failure", () => {
  it("always returns an array even when DB is unavailable", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 90 }),
        async (days) => {
          const db = makeFailingDb();
          const result = await queryReportSummary(db, days);
          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(0);
        },
      ),
      { numRuns: 20 },
    );
  });
});
