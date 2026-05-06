/**
 * fast-check property tests — src/core/fetch.ts (Sprint 516)
 *
 * Properties under test:
 *  FT1. acquireLock: first call returns true, second with same name returns false.
 *  FT2. releaseLock: after release, acquireLock succeeds again.
 *  FT3. acquireLock: different names are independent.
 *  FT4. classifyFetchError: AbortError → "timeout"
 *  FT5. classifyFetchError: TypeError "failed to fetch" → "network"
 *  FT6. classifyFetchError: SyntaxError → "invalid-json"
 *  FT7. classifyFetchError: non-Error → "unknown"
 *  FT8. clearFetchLocks: resets all locks.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { acquireLock, releaseLock, clearFetchLocks, classifyFetchError } from "@/core/fetch";

beforeEach(() => {
  clearFetchLocks();
});

// ── FT1: acquireLock idempotency ─────────────────────────────────────────────

describe("fetch — FT1: acquireLock same name", () => {
  it("first call true, second false", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 30 }), (name) => {
        clearFetchLocks();
        expect(acquireLock(name)).toBe(true);
        expect(acquireLock(name)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });
});

// ── FT2: releaseLock re-enables acquire ──────────────────────────────────────

describe("fetch — FT2: releaseLock re-enables acquire", () => {
  it("acquire → release → acquire succeeds", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 30 }), (name) => {
        clearFetchLocks();
        acquireLock(name);
        releaseLock(name);
        expect(acquireLock(name)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ── FT3: different names independent ─────────────────────────────────────────

describe("fetch — FT3: different names independent", () => {
  it("acquiring one name does not block another", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (a, b) => {
          fc.pre(a !== b);
          clearFetchLocks();
          acquireLock(a);
          expect(acquireLock(b)).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── FT4: classifyFetchError — AbortError → timeout ───────────────────────────

describe("fetch — FT4: AbortError → timeout", () => {
  it("DOMException with name AbortError → timeout", () => {
    const err = new DOMException("The operation was aborted.", "AbortError");
    expect(classifyFetchError(err)).toBe("timeout");
  });
});

// ── FT5: classifyFetchError — TypeError "failed to fetch" → network ──────────

describe("fetch — FT5: TypeError failed to fetch → network", () => {
  it("TypeError with 'failed to fetch' → network", () => {
    const err = new TypeError("Failed to fetch");
    expect(classifyFetchError(err)).toBe("network");
  });

  it("TypeError with 'NetworkError' → network", () => {
    const err = new TypeError("NetworkError when attempting to fetch resource.");
    expect(classifyFetchError(err)).toBe("network");
  });
});

// ── FT6: classifyFetchError — SyntaxError → invalid-json ─────────────────────

describe("fetch — FT6: SyntaxError → invalid-json", () => {
  it("any SyntaxError → invalid-json", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (msg) => {
        const err = new SyntaxError(msg);
        expect(classifyFetchError(err)).toBe("invalid-json");
      }),
      { numRuns: 20 },
    );
  });
});

// ── FT7: classifyFetchError — non-Error → unknown ────────────────────────────

describe("fetch — FT7: non-Error → unknown", () => {
  it("numbers → unknown", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(classifyFetchError(n)).toBe("unknown");
      }),
      { numRuns: 20 },
    );
  });

  it("null → unknown", () => {
    expect(classifyFetchError(null)).toBe("unknown");
  });
});

// ── FT8: clearFetchLocks resets all ──────────────────────────────────────────

describe("fetch — FT8: clearFetchLocks", () => {
  it("all previously acquired locks are released", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        (names) => {
          clearFetchLocks();
          for (const n of names) acquireLock(n);
          clearFetchLocks();
          for (const n of names) {
            expect(acquireLock(n)).toBe(true);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
