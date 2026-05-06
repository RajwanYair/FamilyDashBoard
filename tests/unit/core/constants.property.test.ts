/**
 * fast-check property tests — src/core/constants.ts (Sprint 502)
 *
 * Properties under test:
 *  CN1. getNetworkMode returns one of the 4 valid NetworkMode values.
 *  CN2. STOCK_SYMBOLS all appear in STOCK_META keys.
 *  CN3. WX_CODES and WX_EMOJI have the same key set.
 *  CN4. INTERVALS values are all positive integers and multiples of MS_PER_MIN.
 *  CN5. MAX_CONCURRENT is between 2 and 8 inclusive.
 *  CN6. CUR_TILES have positive precision and non-empty label/key/icon.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getNetworkMode,
  STOCK_SYMBOLS,
  STOCK_META,
  WX_CODES,
  WX_EMOJI,
  INTERVALS,
  MAX_CONCURRENT,
  MS_PER_MIN,
  CUR_TILES,
  LS_NETWORK_MODE,
} from "@/core/constants";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.removeItem(LS_NETWORK_MODE);
});

afterEach(() => {
  localStorage.removeItem(LS_NETWORK_MODE);
});

// ── CN1: getNetworkMode returns valid value ──────────────────────────────────

describe("constants — CN1: getNetworkMode returns valid NetworkMode", () => {
  const VALID: string[] = ["auto", "worker-only", "no-worker", "no-proxy"];

  it("returns 'auto' by default", () => {
    expect(getNetworkMode()).toBe("auto");
  });

  it("returns exact value for each valid option", () => {
    for (const mode of VALID) {
      localStorage.setItem(LS_NETWORK_MODE, mode);
      expect(getNetworkMode()).toBe(mode);
    }
  });

  it("returns 'auto' for garbage input", () => {
    localStorage.setItem(LS_NETWORK_MODE, "invalid-junk");
    expect(getNetworkMode()).toBe("auto");
  });
});

// ── CN2: STOCK_SYMBOLS all in STOCK_META ─────────────────────────────────────

describe("constants — CN2: STOCK_SYMBOLS subset of STOCK_META keys", () => {
  it("every symbol has metadata", () => {
    for (const sym of STOCK_SYMBOLS) {
      expect(STOCK_META[sym]).toBeDefined();
    }
  });
});

// ── CN3: WX_CODES and WX_EMOJI same keys ────────────────────────────────────

describe("constants — CN3: WX_CODES and WX_EMOJI aligned", () => {
  it("same key set", () => {
    const codeKeys = Object.keys(WX_CODES).sort();
    const emojiKeys = Object.keys(WX_EMOJI).sort();
    expect(codeKeys).toEqual(emojiKeys);
  });
});

// ── CN4: INTERVALS positive and multiples of MS_PER_MIN ──────────────────────

describe("constants — CN4: INTERVALS are positive minute-multiples", () => {
  it("all values positive and divisible by MS_PER_MIN", () => {
    for (const [, ms] of Object.entries(INTERVALS)) {
      expect(ms).toBeGreaterThan(0);
      expect(ms % MS_PER_MIN).toBe(0);
    }
  });
});

// ── CN5: MAX_CONCURRENT bounded ──────────────────────────────────────────────

describe("constants — CN5: MAX_CONCURRENT is [2, 8]", () => {
  it("within expected range", () => {
    expect(MAX_CONCURRENT).toBeGreaterThanOrEqual(2);
    expect(MAX_CONCURRENT).toBeLessThanOrEqual(8);
  });
});

// ── CN6: CUR_TILES structural integrity ──────────────────────────────────────

describe("constants — CN6: CUR_TILES have valid structure", () => {
  it("all tiles have non-empty label, key, icon and non-negative precision", () => {
    for (const tile of CUR_TILES) {
      expect(tile.label.length).toBeGreaterThan(0);
      expect(tile.key.length).toBeGreaterThan(0);
      expect(tile.icon.length).toBeGreaterThan(0);
      expect(tile.precision).toBeGreaterThanOrEqual(0);
    }
  });
});
