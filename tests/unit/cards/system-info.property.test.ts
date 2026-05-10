/**
 * fast-check property tests — src/cards/system-info/system-info.ts
 *
 * Properties under test:
 *  SI1. formatHeapMb: zero inputs → ""
 *  SI2. formatHeapMb: positive → contains "MB"
 *  SI3. gpuShortName: result.length ≤ 30
 *  SI4. gpuShortName: trims at "/" or "("
 *  SI5. encodeConnType: "4g"→4, "3g"→3, "2g"→2, "slow-2g"→1
 *  SI6. encodeConnType: unknown → 0
 *  SI7. formatBytes: negative/NaN → "0 B"
 *  SI8. formatBytes: <1024 → "B"
 *  SI9. formatBytes: KB/MB/GB ranges
 *  SI10. appendRttHistory + getRttHistory ring buffer
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  formatHeapMb,
  gpuShortName,
  encodeConnType,
  formatBytes,
  appendRttHistory,
  getRttHistory,
  _resetRttHistory,
} from "@/cards/system-info/system-info";

// ── SI1: formatHeapMb zero ───────────────────────────────────────────────────

describe("system-info — SI1: formatHeapMb zero", () => {
  it("returns empty for zero used or limit", () => {
    expect(formatHeapMb(0, 100)).toBe("");
    expect(formatHeapMb(100, 0)).toBe("");
    expect(formatHeapMb(0, 0)).toBe("");
  });
});

// ── SI2: formatHeapMb positive → "MB" ────────────────────────────────────────

describe("system-info — SI2: formatHeapMb positive", () => {
  it("contains 'MB' suffix", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 2_000_000_000 }),
        (used, limit) => {
          const result = formatHeapMb(used, limit);
          expect(result).toContain("MB");
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── SI3: gpuShortName ≤ 30 chars ─────────────────────────────────────────────

describe("system-info — SI3: gpuShortName length", () => {
  it("always ≤ 30 chars", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (s) => {
        expect(gpuShortName(s).length).toBeLessThanOrEqual(30);
      }),
      { numRuns: 30 },
    );
  });
});

// ── SI4: gpuShortName trims correctly ────────────────────────────────────────

describe("system-info — SI4: gpuShortName trims", () => {
  it("trims at /", () => {
    expect(gpuShortName("NVIDIA GeForce RTX 4090/PCIe/SSE2")).toBe("NVIDIA GeForce RTX 4090");
  });
  it("trims at (", () => {
    expect(gpuShortName("Intel(R) UHD Graphics 770")).toBe("Intel");
  });
});

// ── SI5: encodeConnType known types ──────────────────────────────────────────

describe("system-info — SI5: encodeConnType known", () => {
  it("maps correctly", () => {
    expect(encodeConnType("4g")).toBe(4);
    expect(encodeConnType("3g")).toBe(3);
    expect(encodeConnType("2g")).toBe(2);
    expect(encodeConnType("slow-2g")).toBe(1);
  });
});

// ── SI6: encodeConnType unknown → 0 ─────────────────────────────────────────

describe("system-info — SI6: encodeConnType unknown", () => {
  it("returns 0 for any unknown string", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => !["4g", "3g", "2g", "slow-2g"].includes(s)),
        (s) => {
          expect(encodeConnType(s)).toBe(0);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── SI7: formatBytes negative/NaN ────────────────────────────────────────────

describe("system-info — SI7: formatBytes invalid", () => {
  it("returns '0 B' for negative or NaN", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-Infinity)).toBe("0 B");
  });
});

// ── SI8: formatBytes <1024 → "B" ────────────────────────────────────────────

describe("system-info — SI8: formatBytes bytes range", () => {
  it("returns B suffix for <1024", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1023 }), (b) => {
        expect(formatBytes(b)).toMatch(/^\d+ B$/);
      }),
      { numRuns: 15 },
    );
  });
});

// ── SI9: formatBytes KB/MB/GB ────────────────────────────────────────────────

describe("system-info — SI9: formatBytes larger", () => {
  it("KB range", () => {
    expect(formatBytes(2048)).toContain("KB");
  });
  it("MB range", () => {
    expect(formatBytes(5 * 1024 * 1024)).toContain("MB");
  });
  it("GB range", () => {
    expect(formatBytes(2 * 1024 ** 3)).toContain("GB");
  });
});

// ── SI10: RTT ring buffer ────────────────────────────────────────────────────

describe("system-info — SI10: RTT ring buffer", () => {
  beforeEach(() => {
    _resetRttHistory();
  });

  it("appends positive values and reads back", () => {
    appendRttHistory(50);
    appendRttHistory(100);
    expect(getRttHistory()).toEqual([50, 100]);
  });

  it("ignores non-positive values", () => {
    appendRttHistory(0);
    appendRttHistory(-10);
    appendRttHistory(Infinity);
    expect(getRttHistory()).toEqual([]);
  });

  it("caps at ring size (10)", () => {
    for (let i = 1; i <= 15; i++) appendRttHistory(i);
    const ring = getRttHistory();
    expect(ring.length).toBe(10);
    expect(ring[0]).toBe(6); // oldest surviving
  });
});
