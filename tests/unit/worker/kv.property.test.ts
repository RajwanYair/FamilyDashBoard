/**
 * fast-check property tests — worker/src/utils/kv.ts
 *
 * Properties under test:
 *  KV1. kvGetStale returns null when the KV namespace returns null.
 *  KV2. kvGetStale always injects _stale: true on a successful read.
 *  KV3. kvGetStale returns null when JSON.parse throws (corrupt KV value).
 *  KV4. kvPut is non-fatal — resolves even when the KV namespace throws.
 *  KV5. kvGetStale round-trips any JSON-serialisable object.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { kvGetStale, kvPut } from "../../../worker/src/utils/kv";
import type { KVStore } from "../../../worker/src/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeKV(raw: string | null): KVStore {
  return {
    get: async () => raw,
    put: async () => undefined,
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
  };
}

function makeThrowingKV(): KVStore {
  return {
    get: async () => {
      throw new Error("KV unavailable");
    },
    put: async () => {
      throw new Error("KV unavailable");
    },
    list: async () => {
      throw new Error("KV unavailable");
    },
  };
}

// ── KV1: returns null when KV returns null ────────────────────────────────────

describe("kv — KV1: kvGetStale returns null on empty cache", () => {
  it("returns null for any key when KV has no value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 60 }), async (key) => {
        const result = await kvGetStale(makeKV(null), key);
        expect(result).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});

// ── KV2: injects _stale: true ─────────────────────────────────────────────────

describe("kv — KV2: kvGetStale injects _stale: true", () => {
  it("always marks returned object as stale", async () => {
    await fc.assert(
      fc.asyncProperty(fc.record({ value: fc.integer(), label: fc.string() }), async (obj) => {
        const kv = makeKV(JSON.stringify(obj));
        const result = await kvGetStale<typeof obj>(kv, "key");
        expect(result).not.toBeNull();
        expect(result?._stale).toBe(true);
        expect(result?.value).toBe(obj.value);
        expect(result?.label).toBe(obj.label);
      }),
      { numRuns: 30 },
    );
  });
});

// ── KV3: returns null on corrupt KV value ─────────────────────────────────────

describe("kv — KV3: kvGetStale returns null on corrupt JSON", () => {
  it("returns null for any non-JSON string", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => {
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        async (corrupt) => {
          const result = await kvGetStale(makeKV(corrupt), "k");
          expect(result).toBeNull();
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── KV4: kvPut is non-fatal ───────────────────────────────────────────────────

describe("kv — KV4: kvPut resolves even when KV throws", () => {
  it("never rejects regardless of KV failure", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 60, max: 86400 }),
        async (key, ttl) => {
          await expect(kvPut(makeThrowingKV(), key, { x: 1 }, ttl)).resolves.toBeUndefined();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── KV5: round-trip any JSON-serialisable value ───────────────────────────────

describe("kv — KV5: kvGetStale round-trips JSON-serialisable objects", () => {
  it("preserves all top-level properties", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== "_stale"),
          fc.oneof(fc.integer(), fc.boolean(), fc.string()),
        ),
        async (obj) => {
          const kv = makeKV(JSON.stringify(obj));
          const result = await kvGetStale<Record<string, unknown>>(kv, "key");
          expect(result).not.toBeNull();
          for (const [k, v] of Object.entries(obj)) {
            expect(result![k]).toBe(v);
          }
          expect(result!._stale).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });
});
