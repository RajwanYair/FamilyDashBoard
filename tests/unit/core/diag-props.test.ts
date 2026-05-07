/**
 * Property-based tests for src/core/diag.ts (DP1–DP5)
 *
 * Uses fast-check to verify ring-buffer invariants and classifyProviderError
 * for all possible input shapes.
 */

import fc from "fast-check";
import { beforeEach, describe, it, expect } from "vitest";
import {
  diagLog,
  getDiagEntries,
  clearDiag,
  formatDiagEntry,
  classifyProviderError,
  type ProviderErrorKind,
} from "@/core/diag";
import { DIAG_BUFFER_SIZE } from "@/core/constants";

const KNOWN_KINDS: ProviderErrorKind[] = [
  "network",
  "parse",
  "timeout",
  "upstream",
  "unknown",
];

beforeEach(() => {
  clearDiag();
});

// ── DP1: diagLog messages are retrievable until the buffer is full ────────────

describe("DP1: diagLog messages are retrievable (within buffer capacity)", () => {
  it("every logged message appears in getDiagEntries for small batches", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), {
          minLength: 1,
          maxLength: DIAG_BUFFER_SIZE,
        }),
        (messages) => {
          clearDiag();
          for (const msg of messages) diagLog(msg);
          const logged = getDiagEntries(DIAG_BUFFER_SIZE).map((e) => e.msg);
          // All messages should be present (buffer not overflowed)
          return messages.every((msg) => logged.includes(msg));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── DP2: getDiagEntries respects the limit parameter ─────────────────────────

describe("DP2: getDiagEntries length is min(logged, limit)", () => {
  it("returns at most `limit` entries for any limit and batch size", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: DIAG_BUFFER_SIZE }),
        fc.integer({ min: 1, max: DIAG_BUFFER_SIZE * 2 }),
        (limit, msgCount) => {
          clearDiag();
          for (let i = 0; i < msgCount; i++) diagLog(`m${i}`);
          const entries = getDiagEntries(limit);
          return entries.length <= limit;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── DP3: buffer never exceeds DIAG_BUFFER_SIZE regardless of log volume ───────

describe("DP3: buffer size never exceeds DIAG_BUFFER_SIZE", () => {
  it("getDiagEntries with max limit never returns more than DIAG_BUFFER_SIZE", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: DIAG_BUFFER_SIZE + 1, max: DIAG_BUFFER_SIZE * 3 }),
        (msgCount) => {
          clearDiag();
          for (let i = 0; i < msgCount; i++) diagLog(`overflow-${i}`);
          const entries = getDiagEntries(DIAG_BUFFER_SIZE * 10);
          return entries.length <= DIAG_BUFFER_SIZE;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── DP4: formatDiagEntry always contains the original message text ────────────

describe("DP4: formatDiagEntry always embeds the original message", () => {
  it("formatted output contains the original msg for any logged string", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 60 }).filter((s) => !s.includes("[")),
        (msg) => {
          clearDiag();
          diagLog(msg);
          const entry = getDiagEntries(1)[0];
          if (!entry) return false;
          return formatDiagEntry(entry).includes(msg);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── DP5: classifyProviderError always returns one of 5 known kinds ────────────

describe("DP5: classifyProviderError returns one of 5 known ProviderErrorKind values", () => {
  it("any Error instance returns a valid kind", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 80 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (errMsg, providerId) => {
          clearDiag();
          const kind = classifyProviderError(new Error(errMsg), providerId);
          return KNOWN_KINDS.includes(kind);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("non-Error thrown values always return 'unknown'", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        fc.string({ minLength: 1, maxLength: 20 }),
        (nonErr, providerId) => {
          clearDiag();
          const kind = classifyProviderError(nonErr, providerId);
          return kind === "unknown";
        },
      ),
      { numRuns: 100 },
    );
  });
});
