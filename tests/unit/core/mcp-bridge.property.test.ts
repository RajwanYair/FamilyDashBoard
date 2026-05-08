/**
 * fast-check property tests — src/core/mcp-bridge.ts 
 *
 * Properties under test:
 *  MB1. deepFreezeJson produces a deep-frozen result (no nested object is mutable).
 *  MB2. deepFreezeJson preserves JSON-serialisable values exactly.
 *  MB3. deepFreezeJson strips non-JSON-serialisable values (functions, undefined, Symbols).
 *  MB4. deepFreezeJson handles null and primitives without throwing.
 *  MB4b. deepFreezeJson converts -0 to +0 (JSON semantics).
 *  MB5. deepFreezeJson is idempotent.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { deepFreezeJson } from "@/core/mcp-bridge";

// ── Helper ────────────────────────────────────────────────────────────────────

function isDeepFrozen(val: unknown): boolean {
  if (val === null || typeof val !== "object") return true;
  if (!Object.isFrozen(val)) return false;
  if (Array.isArray(val)) return val.every(isDeepFrozen);
  return Object.values(val as Record<string, unknown>).every(isDeepFrozen);
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const jsonArb = fc.jsonValue();

// ── MB1: result is deep-frozen ───────────────────────────────────────────────

describe("mcp-bridge — MB1: deep-frozen output", () => {
  it("all nested objects are frozen", () => {
    fc.assert(
      fc.property(jsonArb, (val) => {
        const result = deepFreezeJson(val);
        expect(isDeepFrozen(result)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

// ── MB2: preserves JSON-serialisable values ──────────────────────────────────

describe("mcp-bridge — MB2: preserves JSON-serialisable values", () => {
  it("output matches JSON.parse(JSON.stringify(input))", () => {
    fc.assert(
      fc.property(jsonArb, (val) => {
        const result = deepFreezeJson(val);
        const expected = JSON.parse(JSON.stringify(val));
        expect(result).toEqual(expected);
      }),
      { numRuns: 50 },
    );
  });
});

// ── MB3: strips non-serialisable values ──────────────────────────────────────

describe("mcp-bridge — MB3: strips non-serialisable", () => {
  it("functions and undefined are removed", () => {
    const input = { a: 1, b: () => 42, c: undefined, d: "ok" };
    const result = deepFreezeJson(input);
    expect(result).toEqual({ a: 1, d: "ok" });
  });
});

// ── MB4: handles null and primitives ─────────────────────────────────────────

describe("mcp-bridge — MB4: handles null/primitives", () => {
  it("null returns null", () => {
    expect(deepFreezeJson(null)).toBeNull();
  });

  it("number passes through", () => {
    fc.assert(
      fc.property(
        fc
          .double({ noNaN: true, noDefaultInfinity: true })
          .filter((n) => !Object.is(n, -0)),
        (n) => {
          expect(deepFreezeJson(n)).toBe(n);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("negative zero becomes positive zero (JSON semantics)", () => {
    expect(deepFreezeJson(-0)).toBe(0);
  });

  it("string passes through", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(deepFreezeJson(s)).toBe(s);
      }),
      { numRuns: 20 },
    );
  });
});

// ── MB5: idempotent ──────────────────────────────────────────────────────────

describe("mcp-bridge — MB5: idempotent", () => {
  it("calling twice yields same result", () => {
    fc.assert(
      fc.property(jsonArb, (val) => {
        const first = deepFreezeJson(val);
        const second = deepFreezeJson(first);
        expect(second).toEqual(first);
      }),
      { numRuns: 30 },
    );
  });
});
