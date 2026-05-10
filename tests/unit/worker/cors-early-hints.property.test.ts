/**
 * fast-check property tests — worker/src/middleware/cors.ts + early-hints.ts
 *
 * Properties under test:
 *  CO1. isPreflight: OPTIONS method → true
 *  CO2. isPreflight: non-OPTIONS method → false
 *  CO3. handlePreflight: status is always 204
 *  CO4. handlePreflight: includes Access-Control-Allow-Origin header
 *  CO5. buildEarlyHintsLinkHeader: contains all 6 preload paths
 *  CO6. buildEarlyHintsLinkHeader: each entry has rel=preload
 *  CO7. CORS_PREFLIGHT_HEADERS: Vary = "Origin"
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isPreflight,
  handlePreflight,
  CORS_PREFLIGHT_HEADERS,
} from "../../../worker/src/middleware/cors";
import { buildEarlyHintsLinkHeader } from "../../../worker/src/middleware/early-hints";

// ── CO1: OPTIONS → true ──────────────────────────────────────────────────────

describe("cors — CO1: isPreflight OPTIONS", () => {
  it("OPTIONS request is always a preflight", () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        const req = new Request(url, { method: "OPTIONS" });
        expect(isPreflight(req)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ── CO2: non-OPTIONS → false ─────────────────────────────────────────────────

describe("cors — CO2: isPreflight non-OPTIONS", () => {
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"] as const;

  it("non-OPTIONS methods are not preflights", () => {
    fc.assert(
      fc.property(fc.constantFrom(...methods), fc.webUrl(), (method, url) => {
        const req = new Request(url, { method });
        expect(isPreflight(req)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });
});

// ── CO3: handlePreflight status 204 ──────────────────────────────────────────

describe("cors — CO3: handlePreflight status", () => {
  it("always returns 204", () => {
    const res = handlePreflight();
    expect(res.status).toBe(204);
  });
});

// ── CO4: handlePreflight has ACAO header ─────────────────────────────────────

describe("cors — CO4: handlePreflight ACAO header", () => {
  it("includes Access-Control-Allow-Origin", () => {
    const res = handlePreflight();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ── CO5: buildEarlyHintsLinkHeader includes all paths ────────────────────────

describe("early-hints — CO5: all preload paths present", () => {
  const EXPECTED_PATHS = [
    "/api/weather",
    "/api/currency",
    "/api/hebcal",
    "/api/news/aggregate",
    "/api/crypto",
    "/api/alerts",
  ];

  it("header contains all 6 preload paths", () => {
    const header = buildEarlyHintsLinkHeader();
    for (const path of EXPECTED_PATHS) {
      expect(header).toContain(path);
    }
  });
});

// ── CO6: each entry has rel=preload ──────────────────────────────────────────

describe("early-hints — CO6: rel=preload in each entry", () => {
  it("every Link entry includes rel=preload", () => {
    const header = buildEarlyHintsLinkHeader();
    const entries = header.split(",").map((e) => e.trim());
    for (const entry of entries) {
      expect(entry).toContain("rel=preload");
    }
  });
});

// ── CO7: CORS headers include Vary: Origin ───────────────────────────────────

describe("cors — CO7: Vary header", () => {
  it("CORS_PREFLIGHT_HEADERS includes Vary: Origin", () => {
    const headers = new Headers(CORS_PREFLIGHT_HEADERS);
    expect(headers.get("Vary")).toBe("Origin");
  });
});
