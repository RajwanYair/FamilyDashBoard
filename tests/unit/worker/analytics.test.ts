/**
 * Tests for worker/src/utils/analytics.ts (b, ADR-029).
 */
import { describe, it, expect, vi } from "vitest";
import {
  writeAnalyticsHit,
  normaliseRoute,
  writeVectorizeShadowMetrics,
} from "../../../worker/src/utils/analytics";
import type { AnalyticsEngineDataset } from "../../../worker/src/types";

// ── normaliseRoute ────────────────────────────────────────────────────────────

describe("normaliseRoute", () => {
  it("returns pathname without query string", () => {
    expect(normaliseRoute("https://fdb.workers.dev/api/weather?lat=1&lon=2")).toBe("/api/weather");
  });

  it("returns pathname without hash", () => {
    expect(normaliseRoute("https://fdb.workers.dev/health#section")).toBe("/health");
  });

  it("returns bare path unchanged", () => {
    expect(normaliseRoute("https://fdb.workers.dev/api/currency")).toBe("/api/currency");
  });

  it("returns fallback on invalid URL (strips at ?)", () => {
    expect(normaliseRoute("/api/test?foo=bar")).toBe("/api/test");
  });

  it("returns string unchanged when no ? and invalid URL", () => {
    expect(normaliseRoute("/api/test")).toBe("/api/test");
  });
});

// ── writeAnalyticsHit ────────────────────────────────────────────────────────

describe("writeAnalyticsHit", () => {
  it("is a no-op when dataset is undefined", () => {
    // Should not throw
    expect(() =>
      writeAnalyticsHit(undefined, "GET", "/api/weather", 200, "production"),
    ).not.toThrow();
  });

  it("calls writeDataPoint with correct blobs and doubles", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeAnalyticsHit(dataset, "GET", "/api/weather", 200, "production");
    expect(dataset.writeDataPoint).toHaveBeenCalledOnce();
    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["/api/weather", "GET", "production"],
      doubles: [200],
      indexes: ["/api/weather"],
    });
  });

  it("writes POST method correctly", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeAnalyticsHit(dataset, "POST", "/api/reports", 204, "preview");
    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["/api/reports", "POST", "preview"],
      doubles: [204],
      indexes: ["/api/reports"],
    });
  });

  it("writes error status codes", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeAnalyticsHit(dataset, "GET", "/api/weather", 429, "production");
    expect(dataset.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({ doubles: [429] }),
    );
  });

  it("does not throw when writeDataPoint throws", () => {
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint: vi.fn(() => {
        throw new Error("AE unavailable");
      }),
    };
    expect(() => writeAnalyticsHit(dataset, "GET", "/health", 200, "production")).not.toThrow();
  });

  it("uses indexes equal to route path", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeAnalyticsHit(dataset, "GET", "/api/stocks", 200, "development");
    const call = (dataset.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      indexes: string[];
    };
    expect(call.indexes).toEqual(["/api/stocks"]);
  });
});

// ── writeVectorizeShadowMetrics ───────────────────────────────────────────────

describe("writeVectorizeShadowMetrics", () => {
  const baseMetrics = { agrees: 8, vectorizeWouldDrop: 1, vectorizeWouldKeep: 1, upserted: 10 };

  it("is a no-op when dataset is undefined", () => {
    expect(() => writeVectorizeShadowMetrics(undefined, baseMetrics)).not.toThrow();
  });

  it("calls writeDataPoint with vectorize-shadow blobs and correct doubles", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeVectorizeShadowMetrics(dataset, baseMetrics);
    expect(dataset.writeDataPoint).toHaveBeenCalledOnce();
    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["vectorize-shadow"],
      doubles: [8, 1, 1, 10],
      indexes: ["vectorize-shadow"],
    });
  });

  it("writes all-zero metrics without throwing", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeVectorizeShadowMetrics(dataset, {
      agrees: 0,
      vectorizeWouldDrop: 0,
      vectorizeWouldKeep: 0,
      upserted: 0,
    });
    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["vectorize-shadow"],
      doubles: [0, 0, 0, 0],
      indexes: ["vectorize-shadow"],
    });
  });

  it("does not throw when writeDataPoint throws", () => {
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint: vi.fn(() => {
        throw new Error("AE unavailable");
      }),
    };
    expect(() => writeVectorizeShadowMetrics(dataset, baseMetrics)).not.toThrow();
  });

  it("uses 'vectorize-shadow' as the primary index", () => {
    const dataset: AnalyticsEngineDataset = { writeDataPoint: vi.fn() };
    writeVectorizeShadowMetrics(dataset, baseMetrics);
    const call = (dataset.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      indexes: string[];
    };
    expect(call.indexes).toEqual(["vectorize-shadow"]);
  });
});
