/**
 * fast-check property tests — src/core/diag.ts ( , 574)
 *
 * Properties under test:
 *  DG1. diagLog ring buffer never exceeds DIAG_BUFFER_SIZE (80).
 *  DG2. getDiagEntries returns newest-first (reversed chronological).
 *  DG3. getDiagEntries respects limit parameter.
 *  DG4. clearDiag empties the buffer completely.
 *  DG5. classifyProviderError returns a valid ProviderErrorKind.
 *  DG6. classifyProviderError: network keywords → "network".
 *  DG7. formatDiagEntry output contains the message.
 *  DG8. classifyProviderError: timeout keywords → "timeout".
 *  DG9. classifyProviderError: parse keywords → "parse".
 *  DG10. classifyProviderError: non-Error → "unknown".
 *  DG11. formatDiagEntry output starts with bracketed time.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  diagLog,
  getDiagEntries,
  clearDiag,
  classifyProviderError,
  formatDiagEntry,
} from "@/core/diag";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearDiag();
});

// ── DG1: ring buffer bounded by 80 ──────────────────────────────────────────

describe("diag — DG1: ring buffer never exceeds DIAG_BUFFER_SIZE", () => {
  it("after N logs, buffer length is min(N, 80)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (n) => {
        clearDiag();
        for (let i = 0; i < n; i++) diagLog(`msg-${i}`);
        // getDiagEntries with a large limit returns full buffer
        const entries = getDiagEntries(200);
        expect(entries.length).toBeLessThanOrEqual(80);
        expect(entries.length).toBe(Math.min(n, 80));
      }),
      { numRuns: 50 },
    );
  });
});

// ── DG2: getDiagEntries returns newest-first ─────────────────────────────────

describe("diag — DG2: getDiagEntries returns newest first", () => {
  it("first entry has the latest timestamp", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (n) => {
        clearDiag();
        for (let i = 0; i < n; i++) diagLog(`msg-${i}`);
        const entries = getDiagEntries(n);
        // Each entry.ts should be >= previous (since newest first, ts decreases)
        for (let i = 0; i < entries.length - 1; i++) {
          expect(entries[i].ts).toBeGreaterThanOrEqual(entries[i + 1].ts);
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── DG3: getDiagEntries respects limit ───────────────────────────────────────

describe("diag — DG3: getDiagEntries respects limit param", () => {
  it("returns at most `limit` entries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 80 }),
        fc.integer({ min: 1, max: 80 }),
        (insertCount, limit) => {
          clearDiag();
          for (let i = 0; i < insertCount; i++) diagLog(`msg-${i}`);
          const entries = getDiagEntries(limit);
          expect(entries.length).toBeLessThanOrEqual(limit);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── DG4: clearDiag empties buffer ────────────────────────────────────────────

describe("diag — DG4: clearDiag empties buffer", () => {
  it("after clear, getDiagEntries returns empty", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        clearDiag();
        for (let i = 0; i < n; i++) diagLog(`msg-${i}`);
        clearDiag();
        expect(getDiagEntries(100)).toHaveLength(0);
      }),
      { numRuns: 20 },
    );
  });
});

// ── DG5: classifyProviderError returns valid kind ────────────────────────────

describe("diag — DG5: classifyProviderError returns valid kind", () => {
  const validKinds = ["network", "parse", "timeout", "upstream", "unknown"];

  it("any Error input yields a valid kind", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (msg) => {
        clearDiag();
        const kind = classifyProviderError(new Error(msg), "test-provider");
        expect(validKinds).toContain(kind);
      }),
      { numRuns: 50 },
    );
  });

  it("non-Error input yields a valid kind", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant(null)), (err) => {
        clearDiag();
        const kind = classifyProviderError(err, "test-provider");
        expect(validKinds).toContain(kind);
      }),
      { numRuns: 30 },
    );
  });
});

// ── DG6: network keywords → "network" kind ──────────────────────────────────

describe("diag — DG6: network error keywords yield 'network' kind", () => {
  it("messages with network keywords classify as network", () => {
    const networkKeywords = ["Failed to fetch", "NetworkError", "network request failed", "CORS"];
    fc.assert(
      fc.property(fc.constantFrom(...networkKeywords), (keyword) => {
        clearDiag();
        const kind = classifyProviderError(new Error(keyword), "net-test");
        expect(kind).toBe("network");
      }),
      { numRuns: 10 },
    );
  });
});

// ── DG7: formatDiagEntry output contains message ─────────────────────────────

describe("diag — DG7: formatDiagEntry output contains original message", () => {
  it("formatted output includes the msg field", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.includes("\n")),
        (msg) => {
          const entry = { ts: Date.now(), msg };
          const formatted = formatDiagEntry(entry);
          expect(formatted).toContain(msg);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── DG8: timeout keywords → "timeout" ─────────────────────────────────────────

describe("diag — DG8: timeout error keywords", () => {
  it("messages with timeout/aborted keywords classify as timeout", () => {
    const keywords = ["timeout", "aborted", "Request timeout exceeded"];
    fc.assert(
      fc.property(fc.constantFrom(...keywords), (keyword) => {
        clearDiag();
        const kind = classifyProviderError(new Error(keyword), "timeout-test");
        expect(kind).toBe("timeout");
      }),
      { numRuns: 10 },
    );
  });
});

// ── DG9: parse keywords → "parse" ────────────────────────────────────────────

describe("diag — DG9: parse error keywords", () => {
  it("messages with json/parse/syntax keywords classify as parse", () => {
    const keywords = ["Unexpected JSON", "parse error", "SyntaxError in response"];
    fc.assert(
      fc.property(fc.constantFrom(...keywords), (keyword) => {
        clearDiag();
        const kind = classifyProviderError(new Error(keyword), "parse-test");
        expect(kind).toBe("parse");
      }),
      { numRuns: 10 },
    );
  });
});

// ── DG10: non-Error input → "unknown" ────────────────────────────────────────

describe("diag — DG10: non-Error input", () => {
  it("strings, numbers, null all classify as unknown", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant(null)), (err) => {
        clearDiag();
        const kind = classifyProviderError(err, "non-error-test");
        expect(kind).toBe("unknown");
      }),
      { numRuns: 30 },
    );
  });
});

// ── DG11: formatDiagEntry starts with bracketed time ────────────────────────

describe("diag — DG11: formatDiagEntry bracketed time prefix", () => {
  it("output starts with [HH:MM:SS] pattern", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (ts, msg) => {
          const formatted = formatDiagEntry({ ts, msg });
          expect(formatted).toMatch(/^\[\d{2}:\d{2}:\d{2}\]/);
        },
      ),
      { numRuns: 30 },
    );
  });
});
