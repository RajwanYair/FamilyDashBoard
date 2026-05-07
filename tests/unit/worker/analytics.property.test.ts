/**
 * fast-check property tests — worker/src/utils/analytics.ts
 *
 * Properties under test:
 *  AN1. normaliseRoute strips query string from valid URLs.
 *  AN2. normaliseRoute strips hash from valid URLs.
 *  AN3. normaliseRoute returns pathname for full URLs.
 *  AN4. normaliseRoute never throws for any string input.
 *  AN5. writeAnalyticsHit is no-op when dataset is undefined (no throw).
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { normaliseRoute, writeAnalyticsHit } from "../../../worker/src/utils/analytics";

// ── AN1: strips query string ─────────────────────────────────────────────────

describe("analytics — AN1: normaliseRoute strips query", () => {
  it("pathname only — no query string", () => {
    fc.assert(
      fc.property(
        fc.webPath(),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("#")),
        (path, qs) => {
          const url = `https://example.com${path}?${qs}`;
          const result = normaliseRoute(url);
          expect(result).not.toContain("?");
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── AN2: strips hash ─────────────────────────────────────────────────────────

describe("analytics — AN2: normaliseRoute strips hash", () => {
  it("no hash in output", () => {
    const result = normaliseRoute("https://example.com/api/test#section");
    expect(result).not.toContain("#");
    expect(result).toBe("/api/test");
  });
});

// ── AN3: returns pathname ────────────────────────────────────────────────────

describe("analytics — AN3: normaliseRoute returns pathname", () => {
  it("extracts pathname correctly", () => {
    fc.assert(
      fc.property(fc.webPath(), (path) => {
        const url = `https://example.com${path}`;
        // Compare against URL-normalised pathname — fc.webPath() can produce
        // percent-encoded segments that the URL constructor re-encodes differently.
        const expected = new URL(url).pathname;
        expect(normaliseRoute(url)).toBe(expected);
      }),
      { numRuns: 20 },
    );
  });
});

// ── AN4: never throws ────────────────────────────────────────────────────────

describe("analytics — AN4: normaliseRoute never throws", () => {
  it("handles any arbitrary string", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => normaliseRoute(s)).not.toThrow();
      }),
      { numRuns: 50 },
    );
  });
});

// ── AN5: writeAnalyticsHit no-op when undefined ──────────────────────────────

describe("analytics — AN5: writeAnalyticsHit is safe with undefined dataset", () => {
  it("does not throw when dataset is undefined", () => {
    expect(() => writeAnalyticsHit(undefined, "GET", "/api/test", 200, "prod")).not.toThrow();
  });

  it("calls writeDataPoint when dataset provided", () => {
    const mockDataset = { writeDataPoint: vi.fn() };
    writeAnalyticsHit(mockDataset as never, "POST", "/api/news", 201, "production");
    expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["/api/news", "POST", "production"],
      doubles: [201],
      indexes: ["/api/news"],
    });
  });
});
