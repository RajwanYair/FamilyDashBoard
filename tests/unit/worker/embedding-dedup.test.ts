/**
 * Unit tests — Embedding-based near-duplicate detection
 *
 * Tests: cosineSimilarity, getEmbedding (mocked AI), isNearDuplicateByEmbedding
 */

import { describe, it, expect, vi } from "vitest";
import {
  cosineSimilarity,
  getEmbedding,
  isNearDuplicateByEmbedding,
} from "../../../worker/src/utils/simhash";

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
  });

  it("returns ~0.894 for [1,2] vs [2,1]", () => {
    // dot = 1*2 + 2*1 = 4; |a| = sqrt(5); |b| = sqrt(5); cos = 4/5 = 0.8
    expect(cosineSimilarity([1, 2], [2, 1])).toBeCloseTo(0.8, 4);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched-length vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for zero-magnitude vector", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it("symmetric: cosineSimilarity(a, b) === cosineSimilarity(b, a)", () => {
    const a = [0.1, 0.9, 0.3, 0.7];
    const b = [0.8, 0.2, 0.5, 0.4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

// ── isNearDuplicateByEmbedding ────────────────────────────────────────────────

describe("isNearDuplicateByEmbedding", () => {
  it("returns true for identical vectors (cosine=1 ≥ 0.92 threshold)", () => {
    const v = [1, 0, 0];
    expect(isNearDuplicateByEmbedding(v, v)).toBe(true);
  });

  it("returns false for orthogonal vectors (cosine=0 < 0.92 threshold)", () => {
    expect(isNearDuplicateByEmbedding([1, 0], [0, 1])).toBe(false);
  });

  it("respects custom threshold", () => {
    // cosine([1,2], [2,1]) ≈ 0.8
    expect(isNearDuplicateByEmbedding([1, 2], [2, 1], 0.75)).toBe(true);
    expect(isNearDuplicateByEmbedding([1, 2], [2, 1], 0.85)).toBe(false);
  });
});

// ── getEmbedding ──────────────────────────────────────────────────────────────

describe("getEmbedding", () => {
  it("returns the first embedding vector on success", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        shape: [1, 384],
        data: [[0.1, 0.2, 0.3]],
      }),
    };
    const result = await getEmbedding(mockAi, "test title");
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockAi.run).toHaveBeenCalledWith("@cf/baai/bge-small-en-v1.5", { text: "test title" });
  });

  it("returns null when AI throws an error", async () => {
    const mockAi = {
      run: vi.fn().mockRejectedValue(new Error("AI not available")),
    };
    const result = await getEmbedding(mockAi, "test title");
    expect(result).toBeNull();
  });

  it("returns null when data is empty", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ shape: [0, 384], data: [] }),
    };
    const result = await getEmbedding(mockAi, "test");
    expect(result).toBeNull();
  });

  it("returns null when data[0] is empty array", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ shape: [1, 0], data: [[]] }),
    };
    const result = await getEmbedding(mockAi, "test");
    expect(result).toBeNull();
  });

  it("returns null when result.data is undefined", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({}),
    };
    const result = await getEmbedding(mockAi, "test");
    expect(result).toBeNull();
  });

  it("calls the correct CF AI model name", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ shape: [1, 384], data: [[0.5]] }),
    };
    await getEmbedding(mockAi, "hello");
    expect(mockAi.run.mock.calls[0]?.[0]).toBe("@cf/baai/bge-small-en-v1.5");
  });
});
