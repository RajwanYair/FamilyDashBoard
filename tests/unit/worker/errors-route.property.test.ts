/**
 * fast-check property tests — worker/src/routes/errors.ts
 *
 * Properties under test:
 *  ERT1. handleErrors: non-POST methods always return 405
 *  ERT2. handleErrors: arrays with >20 entries always return 413
 *  ERT3. handleErrors: arrays with all-invalid entries always return 400
 *  ERT4. handleErrors: at least one valid entry always returns 204 (no KV env)
 *  ERT5. handleErrors: never throws for any valid JSON body
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { handleErrors } from "../../../worker/src/routes/errors";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Valid error payload matching the ErrorPayloadSchema */
const validEntryArb = fc.record({
  ts: fc.integer({ min: 0, max: 8_640_000_000_000_000 }), // max valid JS Date
  message: fc.string({ minLength: 1, maxLength: 100 }),
  source: fc.option(fc.string({ maxLength: 60 }), { nil: undefined }),
  lineno: fc.option(fc.integer({ min: 1, max: 9999 }), { nil: undefined }),
});

/** Invalid entry — missing required fields */
const invalidEntryArb = fc.oneof(
  fc.constant({}),
  fc.record({ ts: fc.string() }),
  fc.record({ message: fc.integer() }),
  fc.constant(null),
  fc.constant(42),
  fc.string(),
);

function makeRequest(method: string, body: unknown): Request {
  return new Request("https://worker.example.com/api/errors", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── ERT1: non-POST methods always return 405 ──────────────────────────────────

describe("errors-route — ERT1: non-POST methods return 405", () => {
  it("always returns 405 for any non-POST HTTP method", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("GET", "PUT", "PATCH", "DELETE", "HEAD"), async (method) => {
        const req = new Request("https://worker.example.com/api/errors", { method });
        const res = await handleErrors(req);
        expect(res.status).toBe(405);
      }),
      { numRuns: 15 },
    );
  });
});

// ── ERT2: >20 entries always return 413 ──────────────────────────────────────

describe("errors-route — ERT2: arrays with >20 entries return 413", () => {
  it("returns 413 for any array exceeding MAX_ERRORS_PER_REQUEST", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validEntryArb, { minLength: 21, maxLength: 50 }),
        async (entries) => {
          const req = makeRequest("POST", entries);
          const res = await handleErrors(req);
          expect(res.status).toBe(413);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ERT3: all-invalid arrays always return 400 ────────────────────────────────

describe("errors-route — ERT3: all-invalid entries return 400", () => {
  it("returns 400 when no entry passes schema validation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(invalidEntryArb, { minLength: 1, maxLength: 20 }),
        async (entries) => {
          const req = makeRequest("POST", entries);
          const res = await handleErrors(req);
          expect(res.status).toBe(400);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ERT4: at least one valid entry always returns 204 (no KV) ────────────────

describe("errors-route — ERT4: at least one valid entry returns 204 without KV", () => {
  it("returns 204 when valid entries are present (no KV env)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(validEntryArb, { minLength: 1, maxLength: 20 })
          .filter((arr) =>
            arr.every(
              (e) =>
                typeof e.ts === "number" &&
                isFinite(e.ts) &&
                typeof e.message === "string" &&
                e.message.length > 0,
            ),
          ),
        async (entries) => {
          const req = makeRequest("POST", entries);
          const res = await handleErrors(req, undefined);
          expect(res.status).toBe(204);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ERT5: handleErrors never throws for any valid JSON body ──────────────────

describe("errors-route — ERT5: handleErrors never throws", () => {
  it("always resolves (never rejects) for any JSON-serializable body", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.array(validEntryArb, { maxLength: 25 }),
          fc.array(invalidEntryArb, { maxLength: 25 }),
          fc.constant([]),
          fc.string(),
          fc.integer(),
          fc.boolean(),
        ),
        async (body) => {
          const req = makeRequest("POST", body);
          await expect(handleErrors(req, undefined)).resolves.toBeInstanceOf(Response);
        },
      ),
      { numRuns: 25 },
    );
  });
});
