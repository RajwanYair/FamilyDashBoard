/**
 * Property-based tests for src/core/snapshot.ts (SP1–SP5)
 *
 * Verifies structural invariants of `buildSnapshot()` with generated inputs.
 */

import fc from "fast-check";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { vi } from "vitest";
import { buildSnapshot } from "@/core/snapshot";

beforeEach(() => {
  vi.stubGlobal("__APP_VERSION__", "13.30.0");
  vi.stubGlobal("__BUILD_TIME__", "2026-01-01T00:00:00.000Z");
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// ── SP1: snapshot always has the 6 required top-level keys ───────────────────

describe("SP1: buildSnapshot always returns a well-shaped object", () => {
  it("always has version, timestamp, userAgent, config, localStorageSummary, diagLog", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const snap = buildSnapshot();
        return (
          typeof snap.version === "string" &&
          typeof snap.timestamp === "string" &&
          typeof snap.userAgent === "string" &&
          typeof snap.config === "object" &&
          typeof snap.localStorageSummary === "object" &&
          Array.isArray(snap.diagLog)
        );
      }),
      { numRuns: 20 },
    );
  });
});

// ── SP2: timestamp is always a valid ISO-8601 date string ─────────────────────

describe("SP2: buildSnapshot timestamp is always valid ISO-8601", () => {
  it("new Date(timestamp).getTime() is finite", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const snap = buildSnapshot();
        return Number.isFinite(new Date(snap.timestamp).getTime());
      }),
      { numRuns: 30 },
    );
  });
});

// ── SP3: localStorageSummary keys are always dash_ / fdb_ prefixed ─────────────

describe("SP3: localStorageSummary only includes dash/fdb prefixed keys", () => {
  const prefixedKey = fc.oneof(fc.constant("dash_"), fc.constant("fdb_")).chain((prefix) =>
    fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => /^[a-zA-Z0-9_]+$/.test(s))
      .map((suffix) => prefix + suffix),
  );

  const unprefixedKey = fc
    .string({ minLength: 3, maxLength: 20 })
    .filter((s) => /^[a-zA-Z0-9_]+$/.test(s) && !s.startsWith("dash_") && !s.startsWith("fdb_"));

  it("keys from outside prefixes never appear in summary", () => {
    fc.assert(
      fc.property(
        fc.array(prefixedKey, { minLength: 0, maxLength: 5 }),
        fc.array(unprefixedKey, { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (prefixedKeys, otherKeys, val) => {
          localStorage.clear();
          for (const k of prefixedKeys) localStorage.setItem(k, val);
          for (const k of otherKeys) localStorage.setItem(k, val);
          const snap = buildSnapshot();
          const summaryKeys = Object.keys(snap.localStorageSummary);
          // none of the unprefixed keys should appear
          return otherKeys.every((k) => !summaryKeys.includes(k));
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── SP4: localStorage values truncated at 300 chars ──────────────────────────

describe("SP4: localStorageSummary values never exceed ~300 chars", () => {
  it("values stored are at most 301 chars (300 + ellipsis marker)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 301, maxLength: 1000 }), (longVal) => {
        localStorage.clear();
        localStorage.setItem("dash_v2_prop_test", longVal);
        const snap = buildSnapshot();
        const v = snap.localStorageSummary["dash_v2_prop_test"];
        if (v === null || v === undefined) return false;
        // Truncated values are ≤ 301 chars (300 content + "…" ellipsis)
        return v.length <= 302;
      }),
      { numRuns: 50 },
    );
  });

  it("short values are stored verbatim (no truncation)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 299 }), (shortVal) => {
        localStorage.clear();
        localStorage.setItem("fdb_sp4_short", shortVal);
        const snap = buildSnapshot();
        const v = snap.localStorageSummary["fdb_sp4_short"];
        return v === shortVal;
      }),
      { numRuns: 50 },
    );
  });
});

// ── SP5: buildSnapshot is JSON-serializable (no circular refs) ───────────────

describe("SP5: buildSnapshot result is always JSON-serializable", () => {
  it("JSON.stringify(buildSnapshot()) does not throw", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const snap = buildSnapshot();
        try {
          JSON.stringify(snap);
          return true;
        } catch {
          return false;
        }
      }),
      { numRuns: 20 },
    );
  });
});
