/**
 * fast-check property tests — worker/src/middleware 
 *
 * Properties under test:
 *  MW1. shouldTagCanary: undefined/null/"0" → false
 *  MW2. shouldTagCanary: "100" → always true
 *  MW3. shouldTagCanary: invalid string → false
 *  MW4. isRateLimited: first request → false
 *  MW5. isRateLimited: 121st request → true
 *  MW6. getRemainingRequests: fresh IP → MAX
 *  MW7. getClientIp: CF-Connecting-IP header preferred
 *  MW8. getClientIp: X-Forwarded-For fallback
 *  MW9. rateLimitResponse: 429 status
 *  MW10. clearRateLimitState: resets all windows
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  shouldTagCanary,
} from "../../../worker/src/middleware/canary";
import {
  isRateLimited,
  getRemainingRequests,
  getClientIp,
  rateLimitResponse,
  clearRateLimitState,
  MAX_REQUESTS_PER_WINDOW,
} from "../../../worker/src/middleware/rate-limit";

// ── MW1: shouldTagCanary disabled ────────────────────────────────────────────

describe("middleware — MW1: shouldTagCanary disabled", () => {
  it("returns false for undefined", () => {
    expect(shouldTagCanary(undefined)).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(shouldTagCanary("")).toBe(false);
  });
  it("returns false for '0'", () => {
    expect(shouldTagCanary("0")).toBe(false);
  });
});

// ── MW2: shouldTagCanary 100% ────────────────────────────────────────────────

describe("middleware — MW2: shouldTagCanary 100%", () => {
  it("always returns true for 100", () => {
    // Run multiple times since it involves Math.random
    for (let i = 0; i < 20; i++) {
      expect(shouldTagCanary("100")).toBe(true);
    }
  });
});

// ── MW3: shouldTagCanary invalid ─────────────────────────────────────────────

describe("middleware — MW3: shouldTagCanary invalid", () => {
  it("returns false for non-numeric strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => isNaN(parseInt(s, 10)) || parseInt(s, 10) <= 0),
        (s) => {
          expect(shouldTagCanary(s)).toBe(false);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── MW4: isRateLimited first request → false ─────────────────────────────────

describe("middleware — MW4: first request not limited", () => {
  beforeEach(() => clearRateLimitState());

  it("first request from any IP is not limited", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        clearRateLimitState();
        expect(isRateLimited(ip)).toBe(false);
      }),
      { numRuns: 10 },
    );
  });
});

// ── MW5: 121st request → limited ─────────────────────────────────────────────

describe("middleware — MW5: exceeds limit", () => {
  beforeEach(() => clearRateLimitState());

  it("becomes limited after MAX+1 requests", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      isRateLimited(ip);
    }
    expect(isRateLimited(ip)).toBe(true);
  });
});

// ── MW6: getRemainingRequests fresh → MAX ────────────────────────────────────

describe("middleware — MW6: getRemainingRequests fresh", () => {
  beforeEach(() => clearRateLimitState());

  it("returns MAX for new IP", () => {
    expect(getRemainingRequests("192.168.1.1")).toBe(MAX_REQUESTS_PER_WINDOW);
  });
});

// ── MW7: getClientIp CF-Connecting-IP ────────────────────────────────────────

describe("middleware — MW7: getClientIp CF header", () => {
  it("prefers CF-Connecting-IP", () => {
    const req = new Request("https://example.com", {
      headers: {
        "CF-Connecting-IP": "1.2.3.4",
        "X-Forwarded-For": "5.6.7.8",
      },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
});

// ── MW8: getClientIp X-Forwarded-For fallback ────────────────────────────────

describe("middleware — MW8: getClientIp XFF", () => {
  it("uses X-Forwarded-For when no CF header", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "9.8.7.6, 1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no headers", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});

// ── MW9: rateLimitResponse 429 ───────────────────────────────────────────────

describe("middleware — MW9: rateLimitResponse", () => {
  it("returns 429 status", () => {
    const resp = rateLimitResponse();
    expect(resp.status).toBe(429);
    expect(resp.headers.get("Retry-After")).toBe("60");
  });
});

// ── MW10: clearRateLimitState resets ─────────────────────────────────────────

describe("middleware — MW10: clearRateLimitState", () => {
  it("resets rate limit allowing fresh requests", () => {
    const ip = "10.0.0.99";
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 5; i++) {
      isRateLimited(ip);
    }
    expect(isRateLimited(ip)).toBe(true);
    clearRateLimitState();
    expect(isRateLimited(ip)).toBe(false);
  });
});
