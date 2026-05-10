/**
 * fast-check property tests — src/core/error-boundary.ts
 *
 * Properties under test:
 *  EB1. withErrorBoundary never throws/rejects regardless of the wrapped function's behavior.
 *  EB2. On success, the original return value is preserved exactly.
 *  EB3. On thrown Error, diagLog is called with cardId in the message.
 *  EB4. On thrown non-Error (string, number, object), still captures without throwing.
 *  EB5. Error UI element has role="alert" when card DOM is present.
 *  EB6. Idempotent error rendering — calling bounded() twice renders only one .card-error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));
vi.mock("@/core/error-tracker", () => ({
  recordError: vi.fn(),
}));

import { withErrorBoundary } from "@/core/error-boundary";
import { diagLog } from "@/core/diag";
import { recordError } from "@/core/error-tracker";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cardIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,23}$/).filter((s) => s.length >= 1);

const jsonValueArb = fc.oneof(
  fc.string({ maxLength: 30 }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.integer(), { maxLength: 5 }),
);

const errorMessageArb = fc.string({ minLength: 1, maxLength: 60 });

const nonErrorThrowableArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 40 }),
  fc.integer(),
  fc.constant(undefined),
  fc.constant(null),
  fc.record({ code: fc.integer(), msg: fc.string() }),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupCardDom(cardId: string): void {
  document.body.innerHTML = `
    <div data-card-id="${cardId}">
      <div class="card__body"></div>
    </div>
  `;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ── EB1: never throws/rejects ────────────────────────────────────────────────

describe("error-boundary — EB1: never throws regardless of wrapped fn", () => {
  it("sync throw → resolves undefined, never rejects", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, errorMessageArb, async (id, msg) => {
        const fn = withErrorBoundary(id, () => {
          throw new Error(msg);
        });
        // Must not reject
        const result = await fn();
        expect(result).toBeUndefined();
      }),
      { numRuns: 40 },
    );
  });

  it("async reject → resolves undefined, never rejects", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, errorMessageArb, async (id, msg) => {
        const fn = withErrorBoundary(id, async () => {
          throw new Error(msg);
        });
        const result = await fn();
        expect(result).toBeUndefined();
      }),
      { numRuns: 40 },
    );
  });
});

// ── EB2: success preserves return value ──────────────────────────────────────

describe("error-boundary — EB2: success preserves return value exactly", () => {
  it("any JSON-serializable value is returned unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, jsonValueArb, async (id, value) => {
        const fn = withErrorBoundary(id, () => value);
        const result = await fn();
        expect(result).toEqual(value);
      }),
      { numRuns: 80 },
    );
  });
});

// ── EB3: diagLog includes cardId ─────────────────────────────────────────────

describe("error-boundary — EB3: diagLog includes cardId on error", () => {
  it("diagLog message contains the card identifier", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, errorMessageArb, async (id, msg) => {
        vi.clearAllMocks();
        const fn = withErrorBoundary(id, () => {
          throw new Error(msg);
        });
        await fn();
        expect(diagLog).toHaveBeenCalledWith(expect.stringContaining(id));
      }),
      { numRuns: 40 },
    );
  });
});

// ── EB4: non-Error throwables handled ────────────────────────────────────────

describe("error-boundary — EB4: non-Error throwables handled gracefully", () => {
  it("string/number/object throws → resolves undefined", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, nonErrorThrowableArb, async (id, throwable) => {
        const fn = withErrorBoundary(id, () => {
          throw throwable;
        });
        const result = await fn();
        expect(result).toBeUndefined();
        expect(recordError).toHaveBeenCalled();
      }),
      { numRuns: 40 },
    );
  });
});

// ── EB5: error UI has role="alert" ───────────────────────────────────────────

describe("error-boundary — EB5: error tile has role=alert", () => {
  it("when card DOM exists, .card-error has role=alert", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, errorMessageArb, async (id, msg) => {
        setupCardDom(id);
        const fn = withErrorBoundary(id, () => {
          throw new Error(msg);
        });
        await fn();
        const errorEl = document.querySelector(".card-error");
        if (errorEl) {
          expect(errorEl.getAttribute("role")).toBe("alert");
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── EB6: idempotent rendering ────────────────────────────────────────────────

describe("error-boundary — EB6: idempotent error rendering", () => {
  it("calling bounded() twice produces only one .card-error element", async () => {
    await fc.assert(
      fc.asyncProperty(cardIdArb, async (id) => {
        setupCardDom(id);
        const fn = withErrorBoundary(id, () => {
          throw new Error("fail");
        });
        await fn();
        await fn();
        const errors = document.querySelectorAll(".card-error");
        expect(errors.length).toBe(1);
      }),
      { numRuns: 30 },
    );
  });
});
