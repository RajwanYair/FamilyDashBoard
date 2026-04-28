/**
 * Tests for worker/src/middleware/early-hints.ts (Sprint 122, Roadmap #7).
 * Sprint 142 (Roadmap #8): add earlyHintsMiddleware branch coverage.
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildEarlyHintsLinkHeader,
  earlyHintsMiddleware,
} from "../../../worker/src/middleware/early-hints";

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

// ── earlyHintsMiddleware ──────────────────────────────────────────────────────

function makeCtx(method: string, status: number) {
  const headers = new Headers();
  return {
    req: { method },
    res: { status, headers },
  };
}

describe("earlyHintsMiddleware", () => {
  it("appends Link header on GET with status 200", async () => {
    const ctx = makeCtx("GET", 200);
    const next = vi.fn().mockResolvedValue(undefined);
    await earlyHintsMiddleware(ctx as never, next);
    expect(ctx.res.headers.get("Link")).toContain("rel=preload");
  });

  it("appends Link header on GET with status 399 (< 400 boundary)", async () => {
    const ctx = makeCtx("GET", 399);
    const next = vi.fn().mockResolvedValue(undefined);
    await earlyHintsMiddleware(ctx as never, next);
    expect(ctx.res.headers.get("Link")).toContain("rel=preload");
  });

  it("does NOT append Link header on GET with status 400 (>= 400)", async () => {
    const ctx = makeCtx("GET", 400);
    const next = vi.fn().mockResolvedValue(undefined);
    await earlyHintsMiddleware(ctx as never, next);
    expect(ctx.res.headers.get("Link")).toBeNull();
  });

  it("does NOT append Link header on POST requests", async () => {
    const ctx = makeCtx("POST", 200);
    const next = vi.fn().mockResolvedValue(undefined);
    await earlyHintsMiddleware(ctx as never, next);
    expect(ctx.res.headers.get("Link")).toBeNull();
  });

  it("always calls next()", async () => {
    const ctx = makeCtx("GET", 200);
    const next = vi.fn().mockResolvedValue(undefined);
    await earlyHintsMiddleware(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
