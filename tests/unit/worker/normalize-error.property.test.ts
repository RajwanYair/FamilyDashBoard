/**
 * fast-check property tests — worker/src/utils/normalize-error.ts
 *
 * Properties under test:
 *  NE1. normalizeWorkerError always produces ok:false regardless of input.
 *  NE2. The returned code is always one of the four FDB-07x strings.
 *  NE3. The returned status is always a valid 5xx HTTP code.
 *  NE4. The returned message always contains the routeName passed in.
 *  NE5. Timeout-keyed errors always map to FDB-071 / 504.
 *  NE6. Parse-keyed errors always map to FDB-072 / 502.
 *  NE7. errorResponse always reflects the NormalizedError's status code.
 *  NE8. normalizeWorkerError handles non-Error throwables (strings, numbers, null).
 *  NE9. Upstream-keyed errors (HTTP/status/upstream in message) → FDB-070 / 502.
 *  NE10. errorResponse body JSON is valid and contains the code field.
 *  NE11. normalizeWorkerError message always starts with [routeName].
 *  NE12. normalizeWorkerError is deterministic — same inputs produce same output.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { normalizeWorkerError, errorResponse } from "../../../worker/src/utils/normalize-error";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary route name: non-empty printable ASCII string */
const routeArb = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter((s) => s.trim().length > 0 && !/[\x00-\x1f]/.test(s));

/** Arbitrary Error with any message */
const errorArb = fc.string({ minLength: 0, maxLength: 200 }).map((msg) => new Error(msg));

/** Messages that reliably trigger the timeout branch */
const timeoutMsgArb = fc
  .tuple(
    fc.constantFrom(
      "timeout occurred",
      "Timeout error",
      "request timeout: 5000ms",
      "upstream Timeout",
    ),
    fc.string({ minLength: 0, maxLength: 30 }),
  )
  .map(([kw, suffix]) => new Error(kw + (suffix ? ` ${suffix}` : "")));

/** Messages that reliably trigger the parse branch */
const parseMsgArb = fc
  .tuple(
    fc.constantFrom("JSON parse error", "SyntaxError", "JSON.parse failed", "parse failed"),
    fc.string({ minLength: 0, maxLength: 30 }),
  )
  .map(([kw, suffix]) => new Error(kw + (suffix ? `: ${suffix}` : "")));

// ── NE1: ok is always false ───────────────────────────────────────────────────

describe("normalizeWorkerError — NE1: ok is always false", () => {
  it("ok === false for any Error and routeName", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        expect(normalizeWorkerError(err, route).ok).toBe(false);
      }),
      { numRuns: 80 },
    );
  });
});

// ── NE2: code is always a known FDB-07x value ─────────────────────────────────

describe("normalizeWorkerError — NE2: code is always a valid FDB-07x string", () => {
  const VALID_CODES = new Set(["FDB-070", "FDB-071", "FDB-072", "FDB-073"]);

  it("code is one of FDB-070/071/072/073 for any input", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        const { code } = normalizeWorkerError(err, route);
        expect(VALID_CODES.has(code)).toBe(true);
      }),
      { numRuns: 80 },
    );
  });
});

// ── NE3: status is always a 5xx HTTP code ─────────────────────────────────────

describe("normalizeWorkerError — NE3: status is always a 5xx HTTP code", () => {
  it("status is in [500, 599] for any input", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        const { status } = normalizeWorkerError(err, route);
        expect(status).toBeGreaterThanOrEqual(500);
        expect(status).toBeLessThanOrEqual(599);
      }),
      { numRuns: 80 },
    );
  });
});

// ── NE4: message always contains routeName ────────────────────────────────────

describe("normalizeWorkerError — NE4: message always contains the routeName", () => {
  it("message includes [routeName] for any error + route combination", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        const { message } = normalizeWorkerError(err, route);
        expect(message).toContain(route);
      }),
      { numRuns: 80 },
    );
  });
});

// ── NE5: timeout-keyed errors → FDB-071 / 504 ────────────────────────────────

describe("normalizeWorkerError — NE5: timeout messages always map to FDB-071 / status 504", () => {
  it("any error message containing 'timeout'/'Timeout' → code FDB-071, status 504", () => {
    fc.assert(
      fc.property(timeoutMsgArb, routeArb, (err, route) => {
        const result = normalizeWorkerError(err, route);
        expect(result.code).toBe("FDB-071");
        expect(result.status).toBe(504);
      }),
      { numRuns: 50 },
    );
  });
});

// ── NE6: parse-keyed errors → FDB-072 / 502 ──────────────────────────────────

describe("normalizeWorkerError — NE6: parse/JSON messages always map to FDB-072 / status 502", () => {
  it("any error message containing 'JSON'/'parse'/'SyntaxError' → code FDB-072, status 502", () => {
    fc.assert(
      fc.property(parseMsgArb, routeArb, (err, route) => {
        const result = normalizeWorkerError(err, route);
        expect(result.code).toBe("FDB-072");
        expect(result.status).toBe(502);
      }),
      { numRuns: 50 },
    );
  });
});

// ── NE7: errorResponse reflects NormalizedError status ───────────────────────

describe("normalizeWorkerError — NE7: errorResponse.status matches NormalizedError.status", () => {
  it("HTTP status of errorResponse equals the normalized error status for any input", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        const normalized = normalizeWorkerError(err, route);
        const response = errorResponse(normalized);
        expect(response.status).toBe(normalized.status);
      }),
      { numRuns: 60 },
    );
  });
});

// ── NE8: non-Error throwables (string, number, null, undefined) ───────────────

describe("normalizeWorkerError — NE8: non-Error throwables are handled without throwing", () => {
  const nonErrorArb = fc.oneof(
    fc.string(),
    fc.integer(),
    fc.float({ noNaN: true }),
    fc.constant(null),
    fc.constant(undefined),
    fc.boolean(),
  );

  it("does not throw and returns a valid NormalizedError for any non-Error value", () => {
    fc.assert(
      fc.property(nonErrorArb, routeArb, (thrown, route) => {
        const result = normalizeWorkerError(thrown, route);
        expect(result.ok).toBe(false);
        expect(typeof result.code).toBe("string");
        expect(typeof result.message).toBe("string");
        expect(result.status).toBeGreaterThanOrEqual(500);
      }),
      { numRuns: 80 },
    );
  });
});

// ── NE9: upstream-keyed errors → FDB-070 / 502 ──────────────────────────────

describe("normalizeWorkerError — NE9: upstream errors → FDB-070", () => {
  const upstreamMsgArb = fc.oneof(
    fc.constant("HTTP 502 Bad Gateway"),
    fc.constant("status 503 from upstream"),
    fc.constant("upstream service unavailable"),
    fc.integer({ min: 400, max: 599 }).map((c) => `HTTP ${c} error`),
  );

  it("messages with HTTP/status/upstream keyword map to FDB-070 and 502", () => {
    fc.assert(
      fc.property(upstreamMsgArb, routeArb, (msg, route) => {
        const err = new Error(msg);
        const result = normalizeWorkerError(err, route);
        expect(result.code).toBe("FDB-070");
        expect(result.status).toBe(502);
      }),
      { numRuns: 40 },
    );
  });
});

// ── NE10: errorResponse body is valid JSON containing code ───────────────────

describe("normalizeWorkerError — NE10: errorResponse body JSON contains code", () => {
  it("response body parses as JSON and includes the code field", async () => {
    await fc.assert(
      fc.asyncProperty(errorArb, routeArb, async (err, route) => {
        const normalized = normalizeWorkerError(err, route);
        const response = errorResponse(normalized);
        const body = (await response.json()) as Record<string, unknown>;
        expect(body.code).toBe(normalized.code);
        expect(body.ok).toBe(false);
      }),
      { numRuns: 40 },
    );
  });
});

// ── NE11: message always starts with [routeName] ─────────────────────────────

describe("normalizeWorkerError — NE11: message prefix is [routeName]", () => {
  it("message starts with bracketed route name for any input", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        const result = normalizeWorkerError(err, route);
        expect(result.message.startsWith(`[${route}]`)).toBe(true);
      }),
      { numRuns: 60 },
    );
  });
});

// ── NE12: deterministic — same inputs → same output ──────────────────────────

describe("normalizeWorkerError — NE12: deterministic", () => {
  it("calling twice with same error and route yields identical result", () => {
    fc.assert(
      fc.property(errorArb, routeArb, (err, route) => {
        const r1 = normalizeWorkerError(err, route);
        const r2 = normalizeWorkerError(err, route);
        expect(r1).toEqual(r2);
      }),
      { numRuns: 60 },
    );
  });
});
