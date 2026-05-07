/**
 * fast-check property tests — src/core/constants.ts 
 *
 * Properties under test:
 *  CN1. getNetworkMode returns one of the 4 valid NetworkMode values.
 *  CN2. STOCK_SYMBOLS all appear in STOCK_META keys.
 *  CN3. WX_CODES and WX_EMOJI have the same key set.
 *  CN4. INTERVALS values are all positive integers and multiples of MS_PER_MIN.
 *  CN5. MAX_CONCURRENT is between 2 and 8 inclusive.
 *  CN6. CUR_TILES have positive precision and non-empty label/key/icon.
 *  CN7. getNetworkMode never returns invalid string for random localStorage 
 *  CN8. PROXIES all start with https:// 
 *  CN9. STOCK_META name/he/domain fields are non-empty strings 
 *  CN10. Time constants are consistent: MS_PER_HOUR = 60*MS_PER_MIN, etc. 
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  getNetworkMode,
  STOCK_SYMBOLS,
  STOCK_META,
  WX_CODES,
  WX_EMOJI,
  INTERVALS,
  MAX_CONCURRENT,
  MS_PER_MIN,
  MS_PER_HOUR,
  MS_PER_DAY,
  CUR_TILES,
  LS_NETWORK_MODE,
  PROXIES,
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

// ── CN7: getNetworkMode never returns invalid for random inputs ──────────────

describe("constants — CN7: getNetworkMode returns valid for any localStorage", () => {
  const VALID_MODES = new Set(["auto", "worker-only", "no-worker", "no-proxy"]);

  afterEach(() => {
    localStorage.removeItem(LS_NETWORK_MODE);
  });

  it("always returns a valid NetworkMode for arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 50 }), (junk) => {
        localStorage.setItem(LS_NETWORK_MODE, junk);
        const mode = getNetworkMode();
        expect(VALID_MODES.has(mode)).toBe(true);
      }),
      { numRuns: 80 },
    );
  });
});

// ── CN8: PROXIES all start with https:// ─────────────────────────────────────

describe("constants — CN8: PROXIES all use HTTPS", () => {
  it("every proxy URL starts with https://", () => {
    for (const proxy of PROXIES) {
      expect(proxy.startsWith("https://")).toBe(true);
    }
  });
});

// ── CN9: STOCK_META name/he/domain fields are non-empty ──────────────────────

describe("constants — CN9: STOCK_META has non-empty name, he, domain", () => {
  it("every STOCK_META entry has non-empty name, he, and domain strings", () => {
    for (const sym of STOCK_SYMBOLS) {
      const meta = STOCK_META[sym];
      expect(typeof meta.name).toBe("string");
      expect(meta.name.length).toBeGreaterThan(0);
      expect(typeof meta.he).toBe("string");
      expect(meta.he.length).toBeGreaterThan(0);
      expect(typeof meta.domain).toBe("string");
      expect(meta.domain.length).toBeGreaterThan(0);
    }
  });
});

// ── CN10: Time constants are internally consistent ───────────────────────────

describe("constants — CN10: time constants consistent", () => {
  it("MS_PER_HOUR = 60 * MS_PER_MIN", () => {
    expect(MS_PER_HOUR).toBe(60 * MS_PER_MIN);
  });

  it("MS_PER_DAY = 24 * MS_PER_HOUR", () => {
    expect(MS_PER_DAY).toBe(24 * MS_PER_HOUR);
  });

  it("all are positive integers", () => {
    for (const v of [MS_PER_MIN, MS_PER_HOUR, MS_PER_DAY]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });
});
