/**
 * Tests for worker/src/utils/vectorize-client.ts
 *
 * Covers: vectorizeQuery (success, fail-open, score filter, empty vector),
 * vectorizeUpsert (success, fail-open, empty batch),
 * vectorizeShadowRun (metrics, agree/disagree, upsert delegation).
 */

import { describe, it, expect, vi } from "vitest";
import {
  vectorizeQuery,
  vectorizeUpsert,
  vectorizeShadowRun,
} from "../../../worker/src/utils/vectorize-client";
import type { VectorizeIndex } from "../../../worker/src/utils/vectorize-client";

// ── Stubs ─────────────────────────────────────────────────────────────────────

function makeIndex(
  queryResult?: {
    matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>;
  },
  upsertResult?: { count: number },
): VectorizeIndex {
  return {
    query: vi.fn().mockResolvedValue(queryResult ?? { matches: [] }),
    upsert: vi.fn().mockResolvedValue(upsertResult ?? { count: 0 }),
    deleteByIds: vi.fn().mockResolvedValue({ count: 0 }),
  };
}

const DUMMY_VEC = [0.1, 0.2, 0.3, 0.4];

// ── vectorizeQuery ────────────────────────────────────────────────────────────

describe("vectorizeQuery", () => {
  it("returns matches above minScore threshold", async () => {
    const index = makeIndex({
      matches: [
        { id: "a", score: 0.95 },
        { id: "b", score: 0.8 },
        { id: "c", score: 0.92 },
      ],
    });

    const results = await vectorizeQuery(index, DUMMY_VEC, 5, 0.88);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns empty array when no match exceeds minScore", async () => {
    const index = makeIndex({ matches: [{ id: "x", score: 0.5 }] });
    const results = await vectorizeQuery(index, DUMMY_VEC, 5, 0.88);
    expect(results).toHaveLength(0);
  });

  it("returns empty array for empty vector input", async () => {
    const index = makeIndex({ matches: [{ id: "x", score: 0.99 }] });
    const results = await vectorizeQuery(index, [], 5, 0.88);
    expect(results).toHaveLength(0);
    expect(index.query).not.toHaveBeenCalled();
  });

  it("returns empty array (fail-open) when Vectorize throws", async () => {
    const index = makeIndex();
    (index.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("service unavailable"));
    const results = await vectorizeQuery(index, DUMMY_VEC, 5, 0.88);
    expect(results).toHaveLength(0);
  });

  it("passes topK to the index query", async () => {
    const index = makeIndex({ matches: [] });
    await vectorizeQuery(index, DUMMY_VEC, 10, 0.88);
    expect(index.query).toHaveBeenCalledWith(DUMMY_VEC, { topK: 10, returnMetadata: "all" });
  });
});

// ── vectorizeUpsert ───────────────────────────────────────────────────────────

describe("vectorizeUpsert", () => {
  it("returns count from Vectorize on success", async () => {
    const index = makeIndex(undefined, { count: 3 });
    const count = await vectorizeUpsert(index, [
      { id: "a", values: DUMMY_VEC },
      { id: "b", values: DUMMY_VEC },
      { id: "c", values: DUMMY_VEC },
    ]);
    expect(count).toBe(3);
    expect(index.upsert).toHaveBeenCalledOnce();
  });

  it("returns 0 for an empty batch without calling Vectorize", async () => {
    const index = makeIndex(undefined, { count: 99 });
    const count = await vectorizeUpsert(index, []);
    expect(count).toBe(0);
    expect(index.upsert).not.toHaveBeenCalled();
  });

  it("returns 0 (fail-open) when Vectorize throws", async () => {
    const index = makeIndex();
    (index.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));
    const count = await vectorizeUpsert(index, [{ id: "a", values: DUMMY_VEC }]);
    expect(count).toBe(0);
  });
});

// ── vectorizeShadowRun ────────────────────────────────────────────────────────

describe("vectorizeShadowRun", () => {
  it("upserts kept embeddings and returns correct agree count", async () => {
    const index = makeIndex({ matches: [] }, { count: 2 }); // query finds no dup for dropped

    const keptEmbeddings = new Map([
      ["item-1", DUMMY_VEC],
      ["item-2", DUMMY_VEC],
    ]);
    const droppedEmbeddings = new Map<string, number[]>(); // no dropped items

    const metrics = await vectorizeShadowRun(index, keptEmbeddings, droppedEmbeddings);

    expect(metrics.upserted).toBe(2); // index.upsert.count = 2
    expect(metrics.agrees).toBe(2); // 2 kept items = 2 agrees (Vectorize also kept them)
    expect(metrics.vectorizeWouldKeep).toBe(0);
    expect(metrics.vectorizeWouldDrop).toBe(0);
  });

  it("records vectorizeWouldKeep when Vectorize disagrees with SimHash drop", async () => {
    // Vectorize returns NO match for dropped items → it would have kept them
    const index = makeIndex({ matches: [] }, { count: 1 });

    const keptEmbeddings = new Map([["item-1", DUMMY_VEC]]);
    const droppedEmbeddings = new Map([
      ["dropped-1", DUMMY_VEC],
      ["dropped-2", DUMMY_VEC],
    ]);

    const metrics = await vectorizeShadowRun(index, keptEmbeddings, droppedEmbeddings);

    expect(metrics.vectorizeWouldKeep).toBe(2); // Vectorize found no dup for both
    expect(metrics.agrees).toBe(1); // 1 kept item agree
  });

  it("records agrees when Vectorize confirms SimHash drops are duplicates", async () => {
    // Vectorize returns a match for dropped items → agrees they are duplicates
    const index = makeIndex({ matches: [{ id: "item-1", score: 0.95 }] }, { count: 1 });

    const keptEmbeddings = new Map([["item-1", DUMMY_VEC]]);
    const droppedEmbeddings = new Map([["dropped-1", DUMMY_VEC]]);

    const metrics = await vectorizeShadowRun(index, keptEmbeddings, droppedEmbeddings);

    expect(metrics.agrees).toBe(2); // 1 kept + 1 dropped confirmed as dup
    expect(metrics.vectorizeWouldKeep).toBe(0);
  });

  it("handles empty kept and dropped maps without errors", async () => {
    const index = makeIndex({ matches: [] }, { count: 0 });

    const metrics = await vectorizeShadowRun(index, new Map(), new Map());

    expect(metrics.upserted).toBe(0);
    expect(metrics.agrees).toBe(0);
    expect(index.upsert).not.toHaveBeenCalled();
    expect(index.query).not.toHaveBeenCalled();
  });

  it("returns zero metrics (fail-open) when Vectorize upsert throws", async () => {
    const index = makeIndex({ matches: [] }, { count: 0 });
    (index.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("quota exceeded"));

    const keptEmbeddings = new Map([["item-1", DUMMY_VEC]]);
    const metrics = await vectorizeShadowRun(index, keptEmbeddings, new Map());

    // upserted should be 0 (upsertResult from failed upsert), agrees = keptEmbeddings.size
    expect(metrics.upserted).toBe(0);
    // agrees still counts the kept items even if upsert failed
    expect(metrics.agrees).toBe(1);
  });
});
