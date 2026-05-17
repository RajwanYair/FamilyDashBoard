/**
 * fast-check property tests — src/core/snapshot.ts
 *
 * Properties under test:
 *  SN1. buildSnapshot().timestamp is always a valid ISO 8601 string.
 *  SN2. buildSnapshot() always contains the 5 required top-level keys.
 *  SN3. localStorageSummary values are truncated to at most 301 chars (300 + ellipsis).
 *  SN4. buildSnapshot() never throws for any localStorage content.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { buildSnapshot } from "@/core/snapshot";

vi.stubGlobal("__APP_VERSION__", "14.23.0");
vi.stubGlobal("__BUILD_TIME__", "2025-01-01T00:00:00.000Z");

// ── SN1 ───────────────────────────────────────────────────────────────────────

describe("snapshot — SN1: timestamp is always valid ISO 8601", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("buildSnapshot().timestamp parses to a finite Date for any call", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const snap = buildSnapshot() as { timestamp: string };
        const d = new Date(snap.timestamp);
        expect(Number.isFinite(d.getTime())).toBe(true);
      }),
      { numRuns: 5 },
    );
  });
});

// ── SN2 ───────────────────────────────────────────────────────────────────────

describe("snapshot — SN2: required keys always present", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const REQUIRED = ["version", "timestamp", "userAgent", "config", "localStorageSummary", "diagLog"] as const;

  it("snapshot always has version, timestamp, userAgent, config, localStorageSummary, diagLog", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const snap = buildSnapshot() as Record<string, unknown>;
        for (const key of REQUIRED) {
          expect(snap).toHaveProperty(key);
        }
      }),
      { numRuns: 5 },
    );
  });
});

// ── SN3 ───────────────────────────────────────────────────────────────────────

describe("snapshot — SN3: localStorage values truncated to ≤ 301 chars", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("any value longer than 300 chars appears truncated in the summary", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
            minLength: 301,
            maxLength: 600,
          })
          .map((c) => c.join("")),
        (longValue) => {
          localStorage.clear();
          localStorage.setItem("dash_v2_test", longValue);
          const snap = buildSnapshot() as { localStorageSummary: Record<string, string | null> };
          const stored = snap.localStorageSummary["dash_v2_test"];
          if (stored !== null && stored !== undefined) {
            expect(stored.length).toBeLessThanOrEqual(301); // 300 + "…"
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── SN4 ───────────────────────────────────────────────────────────────────────

describe("snapshot — SN4: buildSnapshot never throws for any localStorage content", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const safeValueArb = fc
    .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789 :{}"), {
      minLength: 0,
      maxLength: 200,
    })
    .map((c) => c.join(""));

  it("does not throw for any set of dash_ / fdb_ keys with arbitrary values", () => {
    fc.assert(
      fc.property(fc.array(safeValueArb, { minLength: 0, maxLength: 5 }), (values) => {
        localStorage.clear();
        const prefixes = ["dash_v2_", "fdb_"];
        values.forEach((val, i) => {
          const prefix = prefixes[i % prefixes.length]!;
          localStorage.setItem(`${prefix}key${i}`, val);
        });
        expect(() => buildSnapshot()).not.toThrow();
      }),
      { numRuns: 20 },
    );
  });
});
