/**
 * fast-check property tests — worker-client envelope invariants (V13-OPS)
 *
 * Properties under test:
 *  E1. workerEnvelope always produces HTTP 200 regardless of payload shape.
 *  E2. The JSON body always contains the four required fields: data, stale,
 *      timestamp, provider.
 *  E3. `stale` is always a boolean in the serialised JSON.
 *  E4. `timestamp` is always a positive integer (ms since epoch).
 *  E5. `provider` is always the string passed in (round-trip identity).
 *  E6. `data` is always deeply equal to the object passed in (round-trip).
 *  E7. `Cache-Control` header always contains the cacheTtl value.
 *  E8. Content-Type header always contains "application/json".
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { workerEnvelope } from "../../../worker/src/utils/response";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** JSON-safe scalar or nested object, depth ≤ 2 */
const jsonValue = fc.jsonValue({ depthSize: "small" });

/** Provider string: any non-empty ASCII identifier */
const providerArb = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0);

/** Cache TTL: 0–86400 seconds */
const ttlArb = fc.integer({ min: 0, max: 86400 });

// ── Helper: parse the JSON body from a workerEnvelope Response ───────────────

async function parseEnvelope(
  res: Response,
): Promise<{ data: unknown; stale: boolean; timestamp: number; provider: string }> {
  return res.json() as Promise<{
    data: unknown;
    stale: boolean;
    timestamp: number;
    provider: string;
  }>;
}

// ── E1: always 200 ────────────────────────────────────────────────────────────

describe("workerEnvelope — E1: always returns HTTP 200", () => {
  it("status is 200 for any data/provider/stale/ttl combination", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.status).toBe(200);
      }),
      { numRuns: 100 },
    );
  });
});

// ── E2: envelope has all four required fields ─────────────────────────────────

describe("workerEnvelope — E2: JSON body contains data, stale, timestamp, provider", () => {
  it("all four required fields are present", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body).toHaveProperty("data");
          expect(body).toHaveProperty("stale");
          expect(body).toHaveProperty("timestamp");
          expect(body).toHaveProperty("provider");
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E3: stale is always a boolean ─────────────────────────────────────────────

describe("workerEnvelope — E3: stale is a boolean in serialised JSON", () => {
  it("typeof stale === 'boolean' for any input", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(typeof body.stale).toBe("boolean");
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E4: timestamp is a positive integer ──────────────────────────────────────

describe("workerEnvelope — E4: timestamp is a positive integer (ms since epoch)", () => {
  it("timestamp > 0 and is a finite integer", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(typeof body.timestamp).toBe("number");
          expect(Number.isFinite(body.timestamp)).toBe(true);
          expect(body.timestamp).toBeGreaterThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E5: provider round-trips ──────────────────────────────────────────────────

describe("workerEnvelope — E5: provider round-trips as an exact string", () => {
  it("provider in body equals the provider passed in", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body.provider).toBe(provider);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E6: data round-trips ──────────────────────────────────────────────────────

describe("workerEnvelope — E6: data round-trips through JSON serialisation", () => {
  it("body.data deeply equals the original data", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          // JSON round-trip: serialise the original then parse — must match
          expect(body.data).toEqual(JSON.parse(JSON.stringify(data)));
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E7: Cache-Control includes ttl ───────────────────────────────────────────

describe("workerEnvelope — E7: Cache-Control header encodes cacheTtl", () => {
  it("Cache-Control contains max-age=<cacheTtl>", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        const cc = res.headers.get("Cache-Control") ?? "";
        expect(cc).toContain(`max-age=${ttl}`);
      }),
      { numRuns: 50 },
    );
  });
});

// ── E8: Content-Type is application/json ─────────────────────────────────────

describe("workerEnvelope — E8: Content-Type is application/json", () => {
  it("Content-Type contains application/json", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.headers.get("Content-Type")).toContain("application/json");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E9: CORS — Access-Control-Allow-Origin is always "*" ─────────────────────

describe("workerEnvelope — E9: CORS Access-Control-Allow-Origin is always '*'", () => {
  it("Access-Control-Allow-Origin is '*' for any input", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E10: Security — X-Content-Type-Options is always "nosniff" ───────────────

describe("workerEnvelope — E10: X-Content-Type-Options is always 'nosniff'", () => {
  it("X-Content-Type-Options is 'nosniff' for any input", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E11: stale identity — body.stale strictly equals input stale ──────────────

describe("workerEnvelope — E11: stale field is an exact identity round-trip", () => {
  it("body.stale === stale passed in (true stays true, false stays false)", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body.stale).toBe(stale);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E12: null scalar data round-trips ────────────────────────────────────────

describe("workerEnvelope — E12: null and primitive scalar data round-trips", () => {
  // JSON does not preserve -0 (JSON.stringify(-0) === "0"), so exclude it.
  const primitiveArb = fc.oneof(
    fc.constant(null),
    fc.boolean(),
    fc.integer(),
    fc.float({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Object.is(n, -0)),
    fc.string(),
  );

  it("null/boolean/number/string data survives JSON round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(
        primitiveArb,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body.data).toEqual(data);
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── E13: array data round-trips ──────────────────────────────────────────────

describe("workerEnvelope — E13: array data round-trips through JSON", () => {
  const arrayArb = fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), {
    maxLength: 20,
  });

  it("arrays survive JSON serialisation/deserialisation unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        arrayArb,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body.data).toEqual(data);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E14: response body is always valid JSON (never throws) ────────────────────

describe("workerEnvelope — E14: response body is always parseable JSON", () => {
  it("JSON.parse on the response text never throws", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const res = workerEnvelope(data, provider, stale, ttl);
          const text = await res.text();
          expect(() => JSON.parse(text)).not.toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── E15: Cache-Control always contains "public" directive ─────────────────────

describe("workerEnvelope — E15: Cache-Control always contains 'public' directive", () => {
  it("Cache-Control includes 'public' for any ttl", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        const cc = res.headers.get("Cache-Control") ?? "";
        expect(cc).toContain("public");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E16: TTL boundary — ttl=0 produces max-age=0 in Cache-Control ─────────────

describe("workerEnvelope — E16: ttl=0 produces max-age=0 in Cache-Control", () => {
  it("Cache-Control is 'public, max-age=0' when ttl is 0", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), (data, provider, stale) => {
        const res = workerEnvelope(data, provider, stale, 0);
        expect(res.headers.get("Cache-Control")).toBe("public, max-age=0");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E17: Security — X-Frame-Options is always "DENY" (Sprint 76) ─────────────

describe("workerEnvelope — E17: X-Frame-Options is always 'DENY'", () => {
  it("X-Frame-Options header is 'DENY' for any input", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E18: Security — Referrer-Policy is always "strict-origin-when-cross-origin"

describe("workerEnvelope — E18: Referrer-Policy is always strict", () => {
  it("Referrer-Policy is 'strict-origin-when-cross-origin' for any input", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E19: Security — Permissions-Policy denies geo/mic/cam ────────────────────

describe("workerEnvelope — E19: Permissions-Policy denies sensitive APIs", () => {
  it("Permissions-Policy includes geolocation=() microphone=() camera=()", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        const pp = res.headers.get("Permissions-Policy") ?? "";
        expect(pp).toContain("geolocation=()");
        expect(pp).toContain("microphone=()");
        expect(pp).toContain("camera=()");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E20: Security — Cross-Origin-Resource-Policy is "cross-origin" ────────────

describe("workerEnvelope — E20: Cross-Origin-Resource-Policy is 'cross-origin'", () => {
  it("Cross-Origin-Resource-Policy header is 'cross-origin' for any input", () => {
    fc.assert(
      fc.property(jsonValue, providerArb, fc.boolean(), ttlArb, (data, provider, stale, ttl) => {
        const res = workerEnvelope(data, provider, stale, ttl);
        expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
      }),
      { numRuns: 50 },
    );
  });
});

// ── E21: timestamp monotonicity — body.timestamp ≤ Date.now() ────────────────

describe("workerEnvelope — E21: timestamp is always ≤ current time", () => {
  it("body.timestamp is a finite positive integer not in the future", async () => {
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const before = Date.now();
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          const after = Date.now();
          expect(body.timestamp).toBeGreaterThanOrEqual(before);
          expect(body.timestamp).toBeLessThanOrEqual(after);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── E22: large TTL — max-age reflects exact value ────────────────────────────

describe("workerEnvelope — E22: Cache-Control max-age reflects any positive TTL", () => {
  it("Cache-Control is 'public, max-age=<ttl>' for any ttl > 0", () => {
    fc.assert(
      fc.property(
        jsonValue,
        providerArb,
        fc.boolean(),
        fc.integer({ min: 1, max: 86400 }),
        (data, provider, stale, ttl) => {
          const res = workerEnvelope(data, provider, stale, ttl);
          expect(res.headers.get("Cache-Control")).toBe(`public, max-age=${ttl}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── E23: provider exact identity — whitespace preserved ───────────────────────

describe("workerEnvelope — E23: provider string exact identity (no trimming)", () => {
  it("provider round-trips exactly including leading/trailing whitespace", async () => {
    const whitespaceProviderArb = fc.string({ minLength: 1, maxLength: 40 });
    await fc.assert(
      fc.asyncProperty(
        jsonValue,
        whitespaceProviderArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body.provider).toBe(provider);
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── E24: deeply nested JSON data round-trips without loss ─────────────────────

describe("workerEnvelope — E24: deeply nested object data survives JSON round-trip", () => {
  // Use jsonValue (JSON-safe) instead of fc.object() which can emit undefined values.
  // JSON converts undefined array entries to null — use only JSON-safe values here.
  // depthSize "small" (not "medium") avoids Response.json() stream edge-cases in
  // happy-dom on Node 22 while still covering nested object round-trip correctness.
  const deepJsonArb = fc.jsonValue({ depthSize: "small" });

  it("deeply nested JSON-safe data is preserved after JSON serialisation", async () => {
    await fc.assert(
      fc.asyncProperty(
        deepJsonArb,
        providerArb,
        fc.boolean(),
        ttlArb,
        async (data, provider, stale, ttl) => {
          const body = await parseEnvelope(workerEnvelope(data, provider, stale, ttl));
          expect(body.data).toEqual(data);
        },
      ),
      { numRuns: 50 },
    );
  });
});
