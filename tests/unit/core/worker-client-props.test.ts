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
      fc.asyncProperty(fc.stringMatching(/^[A-Z]{1,5}(-USD)?$/), async (sym) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: { chart: { result: [] } },
              source: "test",
              stale: false,
              ts: 0,
            }),
        });
        await wc.stocks({ sym });
        const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
        const parsed = new URL(url);
        expect(parsed.searchParams.get("sym")).toBe(sym);
      }),
      { numRuns: 20 },
    );
  });

  // ── P3: throws on any 4xx / 5xx status code ──────────────────────────────

  it("P3: wc.currency() always throws on non-2xx HTTP status (4xx/5xx range)", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 400, max: 599 }), async (status) => {
        fetchSpy.mockResolvedValue({
          ok: false,
          status,
          json: () => Promise.resolve({ error: `HTTP ${status}` }),
        });
        await expect(wc.currency()).rejects.toThrow(String(status));
      }),
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
      fc.asyncProperty(fc.integer({ min: 1, max: 9_999_999 }), async (geonameid) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: 0 }),
        });
        await wc.hebcal({ geonameid });
        const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
        const parsed = new URL(url);
        expect(parsed.searchParams.get("geonameid")).toBe(String(geonameid));
      }),
      { numRuns: 20 },
    );
  });

  // ── P6: all constructed URLs start with the worker base URL ─────────────

  it("P6: all wc routes target the correct worker base URL", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2000, max: 2100 }), async (year) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: 0 }),
        });
        await wc.hebcalHolidays({ year });
        const url: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
        expect(url.startsWith(WORKER_BASE)).toBe(true);
      }),
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

  // ── Sprint 233: WorkerEnvelope structural invariants ──────────────────────

  // P8: WorkerEnvelope.ts is always a number in the returned object
  it("P8: WorkerEnvelope.ts is always a finite number (arbitrary timestamp values)", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        async (ts) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ data: {}, source: "worker", stale: false, ts }),
          });
          const result = await wc.health();
          expect(typeof result.ts).toBe("number");
          expect(Number.isFinite(result.ts)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  // P9: WorkerEnvelope.stale is always a boolean (never coerced)
  it("P9: WorkerEnvelope.stale is always strictly boolean (arbitrary boolean values)", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (stale) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ data: { ok: true, status: "ok", ts: 0 }, source: "kv", stale, ts: 0 }),
        });
        const result = await wc.health();
        expect(typeof result.stale).toBe("boolean");
        expect(result.stale).toBe(stale);
      }),
      { numRuns: 20 },
    );
  });

  // P10: wc.news() always includes the feed URL as a URL-safe query param
  it("P10: wc.news() always encodes the feed URL as the 'url' query param", async () => {
    const { wc } = await import("@/core/worker-client");
    const urlArb = fc
      .tuple(
        fc.constantFrom("https", "http"),
        fc.stringMatching(/^[a-z0-9-]{3,20}$/),
        fc.stringMatching(/^[a-z0-9/-]{1,30}$/),
      )
      .map(([proto, host, path]) => `${proto}://${host}.example.com/${path}`);

    await fc.assert(
      fc.asyncProperty(urlArb, async (feedUrl) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: { items: [], count: 0, sources: 1, deduped: 0 },
              source: "kv",
              stale: false,
              ts: 0,
            }),
        });
        await wc.news({ url: feedUrl });
        const rawUrl: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
        const parsed = new URL(rawUrl);
        expect(parsed.searchParams.get("url")).toBe(feedUrl);
      }),
      { numRuns: 25 },
    );
  });

  // P11: wc.calendar() always includes the url param for any valid ICS URL
  it("P11: wc.calendar() preserves arbitrary calendar URL as the 'url' query param", async () => {
    const { wc } = await import("@/core/worker-client");
    const icsUrlArb = fc
      .stringMatching(/^[a-z]{3,8}$/)
      .map((name) => `https://calendar.google.com/calendar/ical/${name}/public/basic.ics`);

    await fc.assert(
      fc.asyncProperty(icsUrlArb, async (calUrl) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ data: {}, source: "kv", stale: false, ts: 0 }),
        });
        await wc.calendar({ url: calUrl });
        const rawUrl: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
        const parsed = new URL(rawUrl);
        expect(parsed.searchParams.get("url")).toBe(calUrl);
      }),
      { numRuns: 20 },
    );
  });

  // P12: WorkerEnvelope.source is always a non-empty string
  it("P12: WorkerEnvelope.source is always a non-empty string for any successful response", async () => {
    const { wc } = await import("@/core/worker-client");
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
        async (source) => {
          fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ data: [], source, stale: false, ts: Date.now() }),
          });
          const result = await wc.alerts();
          expect(typeof result.source).toBe("string");
          expect(result.source.length).toBeGreaterThan(0);
          expect(result.source).toBe(source);
        },
      ),
      { numRuns: 20 },
    );
  });

  // P13: wc.sefariaText() always includes ref verbatim in URL
  it("P13: wc.sefariaText() always includes the ref param verbatim in the URL", async () => {
    const { wc } = await import("@/core/worker-client");
    const refArb = fc
      .tuple(
        fc.constantFrom("Berakhot", "Shabbat", "Genesis", "Psalms"),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 15 }),
      )
      .map(([book, chap, verse]) => `${book}.${String(chap)}.${String(verse)}`);

    await fc.assert(
      fc.asyncProperty(refArb, async (ref) => {
        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: { ref, heRef: ref, text: "", he: "", book: "" },
              source: "sefaria",
              stale: false,
              ts: 0,
            }),
        });
        await wc.sefariaText({ ref });
        const rawUrl: string = (fetchSpy.mock.calls.at(-1) as [string, ...unknown[]])[0];
        const parsed = new URL(rawUrl);
        expect(parsed.searchParams.get("ref")).toBe(ref);
      }),
      { numRuns: 20 },
    );
  });
});
