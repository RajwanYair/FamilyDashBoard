/**
 * fast-check property tests — worker/src/middleware/cors.ts + early-hints.ts (Sprint 538)
 *
 * Properties under test:
 *  CO1. isPreflight returns true only for OPTIONS method
 *  CO2. handlePreflight returns 204 with CORS headers
 *  CO3. handlePreflight has null body
 *  EH1. buildEarlyHintsLinkHeader includes all preload entries
 *  EH2. buildEarlyHintsLinkHeader format is valid Link header
 *  EH3. Link header entries contain rel=preload and crossorigin
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isPreflight, handlePreflight, CORS_PREFLIGHT_HEADERS } from "../../../worker/src/middleware/cors";
import { buildEarlyHintsLinkHeader } from "../../../worker/src/middleware/early-hints";

// ── CO1: isPreflight only for OPTIONS ────────────────────────────────────────

describe("cors — CO1: isPreflight", () => {
  it("returns true only for OPTIONS", () => {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
    for (const method of methods) {
      const req = new Request("https://example.com/api/test", { method });
      expect(isPreflight(req)).toBe(method === "OPTIONS");
    }
  });
});

// ── CO2: handlePreflight 204 + headers ───────────────────────────────────────

describe("cors — CO2: handlePreflight status", () => {
  it("returns 204 No Content", () => {
    const res = handlePreflight();
    expect(res.status).toBe(204);
  });
  it("includes Access-Control-Allow-Origin", () => {
    const res = handlePreflight();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("includes Access-Control-Max-Age", () => {
    const res = handlePreflight();
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});

// ── CO3: handlePreflight null body ───────────────────────────────────────────

describe("cors — CO3: handlePreflight body", () => {
  it("has null body", async () => {
    const res = handlePreflight();
    const text = await res.text();
    expect(text).toBe("");
  });
});

// ── EH1: buildEarlyHintsLinkHeader includes paths ───────────────────────────

describe("early-hints — EH1: Link header paths", () => {
  it("includes /api/weather and /api/currency", () => {
    const link = buildEarlyHintsLinkHeader();
    expect(link).toContain("/api/weather");
    expect(link).toContain("/api/currency");
    expect(link).toContain("/api/hebcal");
    expect(link).toContain("/api/news/aggregate");
  });
});

// ── EH2: format is valid Link header ─────────────────────────────────────────

describe("early-hints — EH2: Link header format", () => {
  it("each entry is <path>; rel=preload; as=fetch; crossorigin", () => {
    const link = buildEarlyHintsLinkHeader();
    const entries = link.split(", ");
    for (const entry of entries) {
      expect(entry).toMatch(/^<\/api\/[^>]+>; rel=preload; as=fetch; crossorigin$/);
    }
  });
});

// ── EH3: Link entries contain required attributes ────────────────────────────

describe("early-hints — EH3: Link entry attributes", () => {
  it("all entries have rel=preload and crossorigin", () => {
    const link = buildEarlyHintsLinkHeader();
    const entries = link.split(", ");
    expect(entries.length).toBeGreaterThanOrEqual(6);
    for (const entry of entries) {
      expect(entry).toContain("rel=preload");
      expect(entry).toContain("crossorigin");
    }
  });
});
