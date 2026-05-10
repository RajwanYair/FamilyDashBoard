/**
 * fast-check property tests — src/core/error-reporter.ts
 *
 * Properties under test:
 *  ER1. reportErrors deduplicates by ts+message
 *  ER2. _getPending length ≤ sum of input lengths (no inflation)
 *  ER3. _resetReporter clears pending queue
 *  ER4. empty array input leaves pending unchanged
 *  ER5. multiple calls accumulate unique errors
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { reportErrors, _resetReporter, _getPending } from "@/core/error-reporter";

beforeEach(() => {
  _resetReporter();
});

// ── ER1: deduplication ───────────────────────────────────────────────────────

describe("error-reporter — ER1: deduplication", () => {
  it("same ts+message is not added twice", () => {
    const entry = { ts: 1000, message: "fail", source: "test", stack: "" };
    reportErrors([entry]);
    reportErrors([entry]);
    expect(_getPending().length).toBe(1);
  });
});

// ── ER2: no inflation ────────────────────────────────────────────────────────

describe("error-reporter — ER2: no inflation", () => {
  it("pending length ≤ total distinct entries added", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ts: fc.integer({ min: 1, max: 100 }),
            message: fc.stringMatching(/^err-[a-z]{1,5}$/),
            source: fc.constant("test"),
            stack: fc.constant(""),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (entries) => {
          _resetReporter();
          reportErrors(entries as never);
          expect(_getPending().length).toBeLessThanOrEqual(entries.length);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── ER3: reset clears pending ────────────────────────────────────────────────

describe("error-reporter — ER3: reset", () => {
  it("_resetReporter clears all pending", () => {
    reportErrors([{ ts: 1, message: "x", source: "s", stack: "" }] as never);
    _resetReporter();
    expect(_getPending()).toEqual([]);
  });
});

// ── ER4: empty input no change ───────────────────────────────────────────────

describe("error-reporter — ER4: empty array", () => {
  it("empty errors array does not add to pending", () => {
    reportErrors([{ ts: 1, message: "a", source: "s", stack: "" }] as never);
    const before = _getPending().length;
    reportErrors([]);
    expect(_getPending().length).toBe(before);
  });
});

// ── ER5: accumulation ────────────────────────────────────────────────────────

describe("error-reporter — ER5: accumulation", () => {
  it("different errors accumulate", () => {
    reportErrors([{ ts: 1, message: "a", source: "s", stack: "" }] as never);
    reportErrors([{ ts: 2, message: "b", source: "s", stack: "" }] as never);
    expect(_getPending().length).toBe(2);
  });
});
