/**
 * fast-check property tests for src/core/worker-client.ts (V13-S28)
 *
 * Property-based tests that verify:
 *  1. URL construction: arbitrary valid params always produce parseable URLs
 *  2. workerGet() always throws on non-2xx status (for any status in 400–599)
 *  3. The WorkerEnvelope shape is preserved round-trip for arbitrary data
 *  4. Coordinate params are always included verbatim as query params
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ── helpers ───────────────────────────────────────────────────────────────────

const WORKER_BASE = "https://fdb.rajwanyair.workers.dev";

// ── Property tests ────────────────────────────────────────────────────────────

describe("worker-client — fast-check property tests", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── P1: weather URL construction preserves lat/lon ───────────────────────

  it("P1: wc.weather() always includes lat and lon in the URL (arbitrary coordinates)", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        async (lat, lon) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: 0 }),
          });
          await wc.weather({ lat, lon });
          const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
          const parsed = new URL(url);
          expect(parsed.searchParams.get("lat")).toBe(String(lat));
          expect(parsed.searchParams.get("lon")).toBe(String(lon));
        },
      ),
      { numRuns: 25 },
    );
  });

  // ── P2: stocks URL construction preserves the sym param ─────────────────

  it("P2: wc.stocks() always includes sym in the URL (arbitrary ticker strings)", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Z]{1,5}(-USD)?$/),
        async (sym) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ data: { chart: { result: [] } }, source: "test", stale: false, ts: 0 }),
          });
          await wc.stocks({ sym });
          const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
          const parsed = new URL(url);
          expect(parsed.searchParams.get("sym")).toBe(sym);
        },
      ),
      { numRuns: 20 },
    );
  });

  // ── P3: throws on any 4xx / 5xx status code ──────────────────────────────

  it("P3: wc.currency() always throws on non-2xx HTTP status (4xx/5xx range)", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        async (status) => {
          fetchSpy.mockResolvedValue({
            ok: false,
            status,
            json: () => Promise.resolve({ error: `HTTP ${status}` }),
          });
          await expect(wc.currency()).rejects.toThrow(String(status));
        },
      ),
      { numRuns: 20 },
    );
  });

  // ── P4: WorkerEnvelope round-trip — arbitrary JSON data is preserved ─────

  it("P4: WorkerEnvelope.data is returned unchanged for arbitrary JSON-serializable data", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.integer()),
          fc.record({ key: fc.string(), value: fc.integer() }),
        ),
        async (data) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ data, source: "worker", stale: false, ts: 1000, ttl: 300 }),
          });
          const result = await wc.alerts();
          expect(result.data).toEqual(data);
        },
      ),
      { numRuns: 30 },
    );
  });

  // ── P5: hebcal geonameid is always coerced to string in URL ─────────────

  it("P5: wc.hebcal() geonameid is always present as a query param for any numeric value", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 9_999_999 }),
        async (geonameid) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: 0 }),
          });
          await wc.hebcal({ geonameid });
          const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
          const parsed = new URL(url);
          expect(parsed.searchParams.get("geonameid")).toBe(String(geonameid));
        },
      ),
      { numRuns: 20 },
    );
  });

  // ── P6: all constructed URLs start with the worker base URL ─────────────

  it("P6: all wc routes target the correct worker base URL", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2000, max: 2100 }),
        async (year) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: 0 }),
          });
          await wc.hebcalHolidays({ year });
          const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
          expect(url.startsWith(WORKER_BASE)).toBe(true);
        },
      ),
      { numRuns: 15 },
    );
  });

  // ── P7: submitErrors always resolves regardless of HTTP outcome ──────────

  it("P7: submitErrors never throws even when fetch returns an error status", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        fc.array(fc.record({ msg: fc.string() }), { minLength: 1, maxLength: 5 }),
        async (status, errors) => {
          fetchSpy.mockResolvedValue({
            ok: false,
            status,
            json: () => Promise.resolve({}),
          });
          await expect(wc.submitErrors(errors)).resolves.toBeUndefined();
        },
      ),
      { numRuns: 15 },
    );
  });
});
