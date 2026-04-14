/**
 * Tests for src/core/constants.ts
 *
 * Covers: CPU_CORES / MAX_CONCURRENT branch coverage — navigator.hardwareConcurrency ?? 4
 * and typeof navigator !== "undefined" fallback.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

describe("Constants — CPU_CORES with hardwareConcurrency", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses navigator.hardwareConcurrency when available", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { hardwareConcurrency: 16 });
    const { CPU_CORES } = await import("@/core/constants");
    expect(CPU_CORES).toBe(16);
  });

  it("falls back to 4 when hardwareConcurrency is undefined", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { hardwareConcurrency: undefined });
    const { CPU_CORES } = await import("@/core/constants");
    expect(CPU_CORES).toBe(4);
  });

  it("MAX_CONCURRENT is between 2 and 8", async () => {
    vi.resetModules();
    const { MAX_CONCURRENT } = await import("@/core/constants");
    expect(MAX_CONCURRENT).toBeGreaterThanOrEqual(2);
    expect(MAX_CONCURRENT).toBeLessThanOrEqual(8);
  });

  it("MAX_CONCURRENT is 2 for low core count", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { hardwareConcurrency: 2 });
    const { MAX_CONCURRENT } = await import("@/core/constants");
    expect(MAX_CONCURRENT).toBe(2);
  });

  it("falls back to 4 when navigator is undefined", async () => {
    vi.resetModules();
    // Remove navigator entirely from globalThis
    const origNav = globalThis.navigator;
    // @ts-expect-error — intentionally removing navigator for test
    delete globalThis.navigator;
    try {
      const { CPU_CORES } = await import("@/core/constants");
      expect(CPU_CORES).toBe(4);
    } finally {
      globalThis.navigator = origNav;
    }
  });
});

describe("Constants — static exports", () => {
  it("exports expected API endpoints", async () => {
    const { API } = await import("@/core/constants");
    expect(API.WEATHER).toContain("open-meteo.com");
    expect(API.HEBCAL).toContain("hebcal.com");
    expect(API.ALERTS).toContain("tzevaadom");
  });

  it("exports STOCK_SYMBOLS with expected entries", async () => {
    const { STOCK_SYMBOLS } = await import("@/core/constants");
    expect(STOCK_SYMBOLS.length).toBeGreaterThanOrEqual(10);
    expect(STOCK_SYMBOLS).toContain("INTC");
    expect(STOCK_SYMBOLS).toContain("NVDA");
  });

  it("exports WX_CODES and WX_EMOJI for weather codes", async () => {
    const { WX_CODES, WX_EMOJI } = await import("@/core/constants");
    expect(WX_CODES[0]).toBe("שמיים בהירים");
    expect(WX_EMOJI[0]).toBe("☀️");
    expect(WX_CODES[95]).toContain("סופת רעמים");
  });

  it("exports PROXIES array with at least 3 entries", async () => {
    const { PROXIES } = await import("@/core/constants");
    expect(PROXIES.length).toBeGreaterThanOrEqual(3);
    expect(PROXIES[0]).toContain("allorigins");
  });

  it("exports cache/timing constants", async () => {
    const { CACHE_TTL, FETCH_TIMEOUT_MS, WAKE_REFRESH_MS, LS_PREFIX } =
      await import("@/core/constants");
    expect(CACHE_TTL).toBe(300_000);
    expect(FETCH_TIMEOUT_MS).toBe(8_000);
    expect(WAKE_REFRESH_MS).toBe(1_800_000);
    expect(LS_PREFIX).toBe("dash_v2_");
  });
});
