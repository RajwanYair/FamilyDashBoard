/**
 * fast-check property tests — worker/src/middleware/rate-limit.ts
 *
 * Properties under test:
 *  RL1. isRateLimited: first request from any IP is never blocked
 *  RL2. isRateLimited: 121st request from same IP is blocked
 *  RL3. getRemainingRequests: starts at MAX (120)
 *  RL4. getRemainingRequests: decreases with each request
 *  RL5. getClientIp: prefers CF-Connecting-IP
 *  RL6. getClientIp: falls back to X-Forwarded-For first entry
 *  RL7. rateLimitResponse: status 429
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  isRateLimited,
  getRemainingRequests,
  getClientIp,
  rateLimitResponse,
  clearRateLimitState,
  MAX_REQUESTS_PER_WINDOW,
} from "../../../worker/src/middleware/rate-limit";

beforeEach(() => {
  clearRateLimitState();
});

// ── RL1: first request never blocked ─────────────────────────────────────────

describe("rate-limit — RL1: first request", () => {
  it("first request from any IP is never blocked", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        clearRateLimitState();
        expect(isRateLimited(ip)).toBe(false);
      }),
      { numRuns: 10 },
    );
  });
});

// ── RL2: exceeding threshold triggers block ──────────────────────────────────

describe("rate-limit — RL2: exceeds threshold", () => {
  it("121st request is blocked", () => {
    clearRateLimitState();
    const ip = "10.0.0.1";
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(isRateLimited(ip)).toBe(false);
    }
    expect(isRateLimited(ip)).toBe(true);
  });
});

// ── RL3: getRemainingRequests starts at MAX ──────────────────────────────────

describe("rate-limit — RL3: initial remaining", () => {
  it("fresh IP has MAX_REQUESTS_PER_WINDOW remaining", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        clearRateLimitState();
        expect(getRemainingRequests(ip)).toBe(MAX_REQUESTS_PER_WINDOW);
      }),
      { numRuns: 5 },
    );
  });
});

// ── RL4: getRemainingRequests decreases ──────────────────────────────────────

describe("rate-limit — RL4: remaining decreases", () => {
  it("remaining decreases after each request", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        clearRateLimitState();
        const ip = "192.168.1.1";
        for (let i = 0; i < n; i++) isRateLimited(ip);
        expect(getRemainingRequests(ip)).toBe(MAX_REQUESTS_PER_WINDOW - n);
      }),
      { numRuns: 10 },
    );
  });
});

// ── RL5: getClientIp prefers CF-Connecting-IP ────────────────────────────────

describe("rate-limit — RL5: CF-Connecting-IP priority", () => {
  it("prefers CF-Connecting-IP over X-Forwarded-For", () => {
    fc.assert(
      fc.property(fc.ipV4(), fc.ipV4(), (cfIp, xffIp) => {
        const req = new Request("https://example.com", {
          headers: {
            "CF-Connecting-IP": cfIp,
            "X-Forwarded-For": xffIp,
          },
        });
        expect(getClientIp(req)).toBe(cfIp);
      }),
      { numRuns: 5 },
    );
  });
});

// ── RL6: getClientIp fallback to XFF first entry ─────────────────────────────

describe("rate-limit — RL6: XFF fallback", () => {
  it("uses first X-Forwarded-For entry when no CF header", () => {
    fc.assert(
      fc.property(fc.ipV4(), fc.ipV4(), (first, second) => {
        const req = new Request("https://example.com", {
          headers: {
            "X-Forwarded-For": `${first}, ${second}`,
          },
        });
        expect(getClientIp(req)).toBe(first);
      }),
      { numRuns: 5 },
    );
  });
});

// ── RL7: rateLimitResponse status 429 ────────────────────────────────────────

describe("rate-limit — RL7: 429 response", () => {
  it("returns 429 with Retry-After header", () => {
    const res = rateLimitResponse();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});
