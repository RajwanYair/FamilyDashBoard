/**
 * Tests for worker/src/middleware/early-hints.ts (Sprint 122, Roadmap #7).
 */
import { describe, it, expect } from "vitest";
import { buildEarlyHintsLinkHeader } from "../../../worker/src/middleware/early-hints";

describe("buildEarlyHintsLinkHeader", () => {
  it("returns a non-empty Link header string", () => {
    const header = buildEarlyHintsLinkHeader();
    expect(header.length).toBeGreaterThan(0);
  });

  it("contains rel=preload for weather endpoint", () => {
    const header = buildEarlyHintsLinkHeader();
    expect(header).toContain("</api/weather>");
    expect(header).toContain("rel=preload");
  });

  it("contains as=fetch for all preloads", () => {
    const header = buildEarlyHintsLinkHeader();
    const entries = header.split(",").map((s) => s.trim());
    for (const entry of entries) {
      expect(entry).toContain("as=fetch");
    }
  });

  it("contains crossorigin attribute on all preloads", () => {
    const header = buildEarlyHintsLinkHeader();
    const entries = header.split(",").map((s) => s.trim());
    for (const entry of entries) {
      expect(entry).toContain("crossorigin");
    }
  });

  it("includes all 6 priority API endpoints", () => {
    const header = buildEarlyHintsLinkHeader();
    expect(header).toContain("/api/weather");
    expect(header).toContain("/api/currency");
    expect(header).toContain("/api/hebcal");
    expect(header).toContain("/api/news/aggregate");
    expect(header).toContain("/api/crypto");
    expect(header).toContain("/api/alerts");
  });

  it("is a comma-separated list of 6 entries", () => {
    const header = buildEarlyHintsLinkHeader();
    const entries = header.split(",").map((s) => s.trim()).filter(Boolean);
    expect(entries).toHaveLength(6);
  });
});
