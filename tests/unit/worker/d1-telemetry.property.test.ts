/**
 * fast-check property tests — worker/src/utils/d1-telemetry.ts + routes/metrics.ts (Sprint 547)
 *
 * Properties under test:
 *  DT1. aggregateP95: sampleCount = total samples per route
 *  DT2. aggregateP95: p95ms always ≤ max of inputs
 *  DT3. aggregateP95: sorted by route alphabetically
 *  DT4. aggregateP95: empty input → empty output
 *  DT5. toProviderHealthPrometheus: empty → ""
 *  DT6. toProviderHealthPrometheus: output contains TYPE gauge header
 *  DT7. toProviderHealthPrometheus: one line per route
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { aggregateP95 } from "../../../worker/src/utils/d1-telemetry";
import { toProviderHealthPrometheus } from "../../../worker/src/routes/metrics";

// ── DT1: sampleCount matches input count per route ──────────────────────────

describe("d1-telemetry — DT1: sampleCount", () => {
  it("sampleCount equals the number of samples for each route", () => {
    const routeArb = fc.constantFrom("/api/weather", "/api/stocks", "/api/news");
    const sampleArb = fc.record({ route: routeArb, ms: fc.double({ min: 1, max: 5000, noNaN: true }) });

    fc.assert(
      fc.property(fc.array(sampleArb, { minLength: 1, maxLength: 30 }), (samples) => {
        const result = aggregateP95(samples);
        for (const row of result) {
          const expected = samples.filter((s) => s.route === row.route).length;
          expect(row.sampleCount).toBe(expected);
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── DT2: p95ms ≤ max ────────────────────────────────────────────────────────

describe("d1-telemetry — DT2: p95ms ≤ max", () => {
  it("p95 never exceeds maximum latency for that route", () => {
    const routeArb = fc.constantFrom("/api/weather", "/api/stocks");
    const sampleArb = fc.record({ route: routeArb, ms: fc.double({ min: 0, max: 10000, noNaN: true }) });

    fc.assert(
      fc.property(fc.array(sampleArb, { minLength: 1, maxLength: 30 }), (samples) => {
        const result = aggregateP95(samples);
        for (const row of result) {
          const maxMs = Math.max(...samples.filter((s) => s.route === row.route).map((s) => s.ms));
          expect(row.p95ms).toBeLessThanOrEqual(maxMs);
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── DT3: sorted alphabetically ──────────────────────────────────────────────

describe("d1-telemetry — DT3: sorted", () => {
  it("output is sorted by route name", () => {
    const routeArb = fc.constantFrom("/a", "/b", "/c", "/z");
    const sampleArb = fc.record({ route: routeArb, ms: fc.double({ min: 1, max: 100, noNaN: true }) });

    fc.assert(
      fc.property(fc.array(sampleArb, { minLength: 2, maxLength: 20 }), (samples) => {
        const result = aggregateP95(samples);
        const routes = result.map((r) => r.route);
        expect(routes).toEqual([...routes].sort());
      }),
      { numRuns: 5 },
    );
  });
});

// ── DT4: empty → empty ──────────────────────────────────────────────────────

describe("d1-telemetry — DT4: empty input", () => {
  it("empty array produces empty output", () => {
    expect(aggregateP95([])).toEqual([]);
  });
});

// ── DT5: toProviderHealthPrometheus empty → "" ───────────────────────────────

describe("metrics — DT5: empty → empty string", () => {
  it("empty array returns empty string", () => {
    expect(toProviderHealthPrometheus([])).toBe("");
  });
});

// ── DT6: output contains TYPE gauge header ───────────────────────────────────

describe("metrics — DT6: TYPE gauge header", () => {
  it("contains the Prometheus TYPE header", () => {
    const rows = [{ route: "/api/test", p95ms: 100, sampleCount: 5 }];
    const output = toProviderHealthPrometheus(rows);
    expect(output).toContain("# TYPE fdb_provider_health_p95_ms gauge");
  });
});

// ── DT7: one data line per route ─────────────────────────────────────────────

describe("metrics — DT7: one line per route", () => {
  it("generates one metric line per route entry", () => {
    const routeArb = fc.stringMatching(/^\/api\/[a-z]{3,8}$/);

    fc.assert(
      fc.property(fc.array(routeArb, { minLength: 1, maxLength: 5 }), (routes) => {
        const unique = [...new Set(routes)];
        const rows = unique.map((r, i) => ({ route: r, p95ms: (i + 1) * 10, sampleCount: i + 1 }));
        const output = toProviderHealthPrometheus(rows);
        const dataLines = output.split("\n").filter((l) => l.startsWith("fdb_provider_health_p95_ms{"));
        expect(dataLines.length).toBe(unique.length);
      }),
      { numRuns: 10 },
    );
  });
});
