/**
 * fast-check property tests — src/core/provider-adapter.ts
 *
 * Properties under test:
 *  PA1. adapter.id and adapter.cacheKey equal the input options for any valid string pair.
 *  PA2. adapter.fetch() returns { ok: true, data } on cache hit for any serializable object.
 *  PA3. adapter.fetch() calls fetchFresh exactly once on a cache miss.
 *  PA4. adapter.fetch() returns { ok: false, stale } when fetchFresh throws and stale data exists.
 *  PA5. adapter.cacheTtl equals the input cacheTtl for any positive integer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));
vi.mock("@/core/provider", () => ({
  getProviderHealth: vi.fn().mockReturnValue({ status: "ok" }),
  recordProviderFailure: vi.fn(),
  recordProviderSuccess: vi.fn(),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/provider-toast", () => ({ notifyProviderBlocked: vi.fn() }));

import { createCachedProviderAdapter } from "@/core/provider-adapter";
import { cGet, cGetStale } from "@/core/cache";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Non-empty alpha-numeric ids */
const idArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), {
    minLength: 1,
    maxLength: 40,
  })
  .map((c) => c.join(""));

/** Any JSON-serializable record */
const payloadArb = fc.record({
  value: fc.integer(),
  label: fc.string(),
});

// ── PA1: id and cacheKey preserved ────────────────────────────────────────────

describe("provider-adapter — PA1: id and cacheKey are preserved verbatim", () => {
  it("adapter.id === options.id and adapter.cacheKey === options.cacheKey", () => {
    fc.assert(
      fc.property(idArb, idArb, (id, cacheKey) => {
        const adapter = createCachedProviderAdapter({
          id,
          displayName: "Test",
          cacheKey,
          cacheTtl: 60,
          fetchFresh: vi.fn().mockResolvedValue({}),
        });
        expect(adapter.id).toBe(id);
        expect(adapter.cacheKey).toBe(cacheKey);
      }),
      { numRuns: 40 },
    );
  });
});

// ── PA2: cache hit returns { ok: true, data } without calling fetchFresh ─────

describe("provider-adapter — PA2: cache hit short-circuits fetchFresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true with cached data for any payload shape", async () => {
    await fc.assert(
      fc.asyncProperty(payloadArb, async (payload) => {
        vi.mocked(cGet).mockReturnValue(payload);
        const fetchFresh = vi.fn();
        const adapter = createCachedProviderAdapter({
          id: "pa2-test",
          displayName: "PA2",
          cacheKey: "pa2",
          cacheTtl: 300,
          fetchFresh,
        });
        const result = await adapter.fetch();
        expect(result).toEqual({ ok: true, data: payload });
        expect(fetchFresh).not.toHaveBeenCalled();
      }),
      { numRuns: 30 },
    );
  });
});

// ── PA3: cache miss triggers exactly one fetchFresh call ──────────────────────

describe("provider-adapter — PA3: cache miss triggers fetchFresh exactly once", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls fetchFresh once for any payload returned on cache miss", async () => {
    await fc.assert(
      fc.asyncProperty(payloadArb, async (payload) => {
        vi.mocked(cGet).mockReturnValue(null);
        const fetchFresh = vi.fn().mockResolvedValue(payload);
        const adapter = createCachedProviderAdapter({
          id: "pa3-test",
          displayName: "PA3",
          cacheKey: "pa3",
          cacheTtl: 300,
          fetchFresh,
        });
        const result = await adapter.fetch();
        expect(result).toEqual({ ok: true, data: payload });
        expect(fetchFresh).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 30 },
    );
  });
});

// ── PA4: fetchFresh failure with stale data returns { ok: false, stale } ─────

describe("provider-adapter — PA4: failure + stale returns ok:false with stale", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:false and stale for any stale payload when fetchFresh throws", async () => {
    await fc.assert(
      fc.asyncProperty(payloadArb, async (stalePayload) => {
        vi.mocked(cGet).mockReturnValue(null);
        vi.mocked(cGetStale).mockReturnValue(stalePayload);
        const fetchFresh = vi.fn().mockRejectedValue(new Error("network error"));
        const adapter = createCachedProviderAdapter({
          id: "pa4-test",
          displayName: "PA4",
          cacheKey: "pa4",
          cacheTtl: 300,
          fetchFresh,
        });
        const result = await adapter.fetch();
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.stale).toEqual(stalePayload);
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── PA5: cacheTtl preserved ───────────────────────────────────────────────────

describe("provider-adapter — PA5: cacheTtl is preserved verbatim", () => {
  it("adapter.cacheTtl equals the input for any positive integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 86400 }), (ttl) => {
        const adapter = createCachedProviderAdapter({
          id: "pa5-test",
          displayName: "PA5",
          cacheKey: "pa5",
          cacheTtl: ttl,
          fetchFresh: vi.fn().mockResolvedValue({}),
        });
        expect(adapter.cacheTtl).toBe(ttl);
      }),
      { numRuns: 50 },
    );
  });
});
