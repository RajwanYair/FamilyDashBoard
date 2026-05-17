/**
 * fast-check property tests — src/core/worker-client.ts
 *
 * Properties under test:
 *  WC1. Any valid lat/lon pair is URL-encoded in the weather request.
 *  WC2. Any HTTP status ≥ 400 causes wc.health() to throw.
 *  WC3. Query params with special chars are correctly percent-encoded in the URL.
 *  WC4. WorkerEnvelope structure is preserved through wc round-trips.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

const WORKER_BASE = "https://fdb.rajwanyair.workers.dev";

describe("worker-client — WC1: lat/lon params encoded in weather URL", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("weather URL contains the exact lat and lon passed in", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        async (lat, lon) => {
          vi.resetModules();
          const capturedUrls: string[] = [];
          vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
            capturedUrls.push(url);
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: Date.now() }),
            });
          }));
          const { wc } = await import("@/core/worker-client");
          await wc.weather({ lat, lon });
          expect(capturedUrls).toHaveLength(1);
          const u = new URL(capturedUrls[0]!);
          expect(parseFloat(u.searchParams.get("lat")!)).toBeCloseTo(lat, 4);
          expect(parseFloat(u.searchParams.get("lon")!)).toBeCloseTo(lon, 4);
        },
      ),
      { numRuns: 10 },
    );
  });
});

describe("worker-client — WC2: HTTP status ≥ 400 always throws", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("wc.health() throws for any 4xx/5xx status", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        async (status) => {
          vi.resetModules();
          vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status,
            json: () => Promise.resolve({}),
          }));
          const { wc } = await import("@/core/worker-client");
          await expect(wc.health()).rejects.toThrow();
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe("worker-client — WC3: special chars in params are percent-encoded", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("news URL correctly encodes arbitrary feed URL in query string", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 80 }).filter(s => !s.includes(" ")),
        async (feedUrl) => {
          vi.resetModules();
          const capturedUrls: string[] = [];
          vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
            capturedUrls.push(url);
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ data: {}, source: "test", stale: false, ts: Date.now() }),
            });
          }));
          const { wc } = await import("@/core/worker-client");
          await wc.news({ url: feedUrl });
          const u = new URL(capturedUrls[0]!);
          // URL.searchParams.get() decodes percent-encoding
          expect(u.searchParams.get("url")).toBe(feedUrl);
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe("worker-client — WC4: envelope data/source/stale/ts preserved", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("wc returns exactly the envelope fields the worker responds with", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          source: fc.constantFrom("worker", "cache", "stale-fallback"),
          stale: fc.boolean(),
          ts: fc.integer({ min: 0, max: 2_000_000_000 }),
        }),
        async ({ source, stale, ts }) => {
          vi.resetModules();
          const envelope = { data: { ok: true, status: "up", ts }, source, stale, ts };
          vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(envelope),
          }));
          const { wc } = await import("@/core/worker-client");
          const result = await wc.health();
          expect(result.source).toBe(source);
          expect(result.stale).toBe(stale);
          expect(result.ts).toBe(ts);
        },
      ),
      { numRuns: 10 },
    );
  });
});
