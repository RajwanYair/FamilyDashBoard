/**
 * fast-check property tests — worker/src/utils/response.ts
 *
 * Properties under test:
 *  WR1. jsonResponse status code matches param
 *  WR2. jsonResponse body is valid JSON of input
 *  WR3. jsonResponse includes CORS headers
 *  WR4. workerEnvelope includes timestamp
 *  WR5. workerEnvelope body has stale & provider fields
 *  WR6. workerEnvelope Cache-Control includes max-age
 *  WR7. proxyResponse preserves status code
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { jsonResponse, workerEnvelope, proxyResponse } from "../../../worker/src/utils/response";

// ── WR1: jsonResponse status ─────────────────────────────────────────────────

describe("response — WR1: jsonResponse status", () => {
  it("status matches provided value", () => {
    fc.assert(
      fc.property(fc.constantFrom(200, 400, 404, 500, 503), (status) => {
        const res = jsonResponse({ msg: "hi" }, status);
        expect(res.status).toBe(status);
      }),
      { numRuns: 5 },
    );
  });
});

// ── WR2: jsonResponse body ───────────────────────────────────────────────────

describe("response — WR2: jsonResponse body", () => {
  it("body is valid JSON serialization of data", async () => {
    const data = { num: 42, str: "hello", arr: [1, 2, 3] };
    const res = jsonResponse(data);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual(data);
  });
});

// ── WR3: jsonResponse CORS headers ───────────────────────────────────────────

describe("response — WR3: CORS headers", () => {
  it("includes Access-Control-Allow-Origin", () => {
    const res = jsonResponse({});
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("includes X-Content-Type-Options", () => {
    const res = jsonResponse({});
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

// ── WR4: workerEnvelope timestamp ────────────────────────────────────────────

describe("response — WR4: workerEnvelope timestamp", () => {
  it("envelope body contains numeric timestamp", async () => {
    const res = workerEnvelope({ temp: 25 }, "open-meteo", false, 300);
    const body = JSON.parse(await res.text());
    expect(typeof body.timestamp).toBe("number");
    expect(body.timestamp).toBeGreaterThan(0);
  });
});

// ── WR5: workerEnvelope fields ───────────────────────────────────────────────

describe("response — WR5: workerEnvelope stale + provider", () => {
  it("contains stale and provider from args", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (stale, provider) => {
          const res = workerEnvelope({ x: 1 }, provider, stale, 60);
          const body = JSON.parse(await res.text());
          expect(body.stale).toBe(stale);
          expect(body.provider).toBe(provider);
        },
      ),
      { numRuns: 8 },
    );
  });
});

// ── WR6: workerEnvelope Cache-Control ────────────────────────────────────────

describe("response — WR6: workerEnvelope cache-control", () => {
  it("includes max-age from cacheTtl param", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 86400 }), (ttl) => {
        const res = workerEnvelope({}, "p", false, ttl);
        const cc = res.headers.get("Cache-Control") ?? "";
        expect(cc).toContain(`max-age=${ttl}`);
      }),
      { numRuns: 5 },
    );
  });
});

// ── WR7: proxyResponse status ────────────────────────────────────────────────

describe("response — WR7: proxyResponse status", () => {
  it("preserves upstream status code", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(200, 404, 500), async (status) => {
        const upstream = new Response("body", {
          status,
          headers: { "Content-Type": "text/plain" },
        });
        const proxied = await proxyResponse(upstream, 120);
        expect(proxied.status).toBe(status);
      }),
      { numRuns: 3 },
    );
  });
});
