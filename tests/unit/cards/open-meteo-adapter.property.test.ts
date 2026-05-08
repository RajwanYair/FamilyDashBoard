/**
 * fast-check property tests — src/cards/weather/open-meteo-adapter.ts
 *
 * Properties under test:
 *  OM1. createOpenMeteoAdapter returns a valid ProviderAdapter shape.
 *  OM2. adapter.id is always "open-meteo".
 *  OM3. adapter.cacheKey is always "wx".
 *  OM4. adapter.cacheTtl matches INTERVALS.WEATHER.
 *  OM5. adapter.status() returns a valid ProviderStatus value.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mock heavy dependencies to isolate the adapter factory shape invariants
vi.mock("@/core/cache", () => ({
  cGet: () => null,
  cGetStale: () => null,
  cSetAsync: async () => {},
}));
vi.mock("@/core/fetch", () => ({
  fetchJSONWithWorker: async () => ({}),
}));
vi.mock("@/core/diag", () => ({
  diagLog: () => {},
}));
vi.mock("@/core/provider", () => ({
  getProviderHealth: () => ({ status: "healthy" }),
  recordProviderFailure: () => {},
  recordProviderSuccess: () => {},
}));
vi.mock("@/types/api", () => ({
  isWeatherResponse: () => false,
}));

import { createOpenMeteoAdapter } from "@/cards/weather/open-meteo-adapter";
import { INTERVALS } from "@/core/constants";

beforeEach(() => {
  vi.clearAllMocks();
});

const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });
const lonArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

// ── OM1: createOpenMeteoAdapter returns a valid shape ─────────────────────────

describe("OM1: createOpenMeteoAdapter returns ProviderAdapter shape", () => {
  it("has required properties for any lat/lon", () => {
    fc.assert(
      fc.property(latArb, lonArb, (lat, lon) => {
        const adapter = createOpenMeteoAdapter(lat, lon);
        expect(adapter).toHaveProperty("id");
        expect(adapter).toHaveProperty("displayName");
        expect(adapter).toHaveProperty("cacheKey");
        expect(adapter).toHaveProperty("cacheTtl");
        expect(adapter).toHaveProperty("fetch");
        expect(adapter).toHaveProperty("status");
        expect(typeof adapter.fetch).toBe("function");
        expect(typeof adapter.status).toBe("function");
      }),
      { numRuns: 50 },
    );
  });
});

// ── OM2: adapter.id is always "open-meteo" ────────────────────────────────────

describe("OM2: adapter.id is always 'open-meteo'", () => {
  it("id property is constant regardless of lat/lon", () => {
    fc.assert(
      fc.property(latArb, lonArb, (lat, lon) => {
        const adapter = createOpenMeteoAdapter(lat, lon);
        expect(adapter.id).toBe("open-meteo");
      }),
      { numRuns: 30 },
    );
  });
});

// ── OM3: adapter.cacheKey is always "wx" ──────────────────────────────────────

describe("OM3: adapter.cacheKey is always 'wx'", () => {
  it("cacheKey is constant regardless of lat/lon", () => {
    fc.assert(
      fc.property(latArb, lonArb, (lat, lon) => {
        const adapter = createOpenMeteoAdapter(lat, lon);
        expect(adapter.cacheKey).toBe("wx");
      }),
      { numRuns: 30 },
    );
  });
});

// ── OM4: adapter.cacheTtl matches INTERVALS.WEATHER ───────────────────────────

describe("OM4: adapter.cacheTtl matches INTERVALS.WEATHER", () => {
  it("cacheTtl equals the weather interval constant", () => {
    fc.assert(
      fc.property(latArb, lonArb, (lat, lon) => {
        const adapter = createOpenMeteoAdapter(lat, lon);
        expect(adapter.cacheTtl).toBe(INTERVALS.WEATHER);
      }),
      { numRuns: 30 },
    );
  });
});

// ── OM5: adapter.status() returns a valid ProviderStatus ──────────────────────

describe("OM5: adapter.status() returns a valid ProviderStatus", () => {
  it("status is one of the valid enum values", () => {
    const validStatuses = ["healthy", "degraded", "down", "unknown"];
    fc.assert(
      fc.property(latArb, lonArb, (lat, lon) => {
        const adapter = createOpenMeteoAdapter(lat, lon);
        expect(validStatuses).toContain(adapter.status());
      }),
      { numRuns: 30 },
    );
  });
});
