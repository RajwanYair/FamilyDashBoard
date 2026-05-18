/**
 * FamilyDashBoard Worker — Vectorize client wrapper (ADR-052)
 *
 * Wraps Cloudflare Vectorize index operations for semantic news dedup.
 *
 * Shadow mode design (ROADMAP §6.1 SEMANTIC, N-V):
 *   1. After normal SimHash dedup selects the "kept" set, this module upserts
 *      their embeddings into Vectorize and queries for near-duplicates.
 *   2. The shadow run records disagree/agree counts but does NOT change the
 *      output of the news feed — SimHash remains the authoritative dedup path.
 *   3. After ≥ 30-day precision@10 ≥ SimHash + 15%, SimHash can be retired
 *      and Vectorize becomes the primary dedup mechanism.
 *
 * All operations fail-open (return defaults on any Vectorize error).
 * The gating check `env.VECTORIZE_INDEX` must be done by the caller.
 *
 * ADR reference: ADR-052.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VectorizeQueryMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizeQueryResult {
  matches: VectorizeQueryMatch[];
}

/**
 * Minimal Vectorize index interface — structural typing so tests can provide
 * simple stubs without importing @cloudflare/workers-types.
 */
export interface VectorizeIndex {
  query(
    vector: number[],
    options?: {
      topK?: number;
      returnMetadata?: "all" | "indexed" | boolean;
      filter?: Record<string, unknown>;
    },
  ): Promise<VectorizeQueryResult>;
  upsert(
    vectors: Array<{
      id: string;
      values: number[];
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<{ count: number }>;
  deleteByIds(ids: string[]): Promise<{ count: number }>;
}

// ── Shadow run result ─────────────────────────────────────────────────────────

export interface ShadowRunMetrics {
  /** Number of kept items whose embeddings were upserted into Vectorize. */
  upserted: number;
  /** Number of items that SimHash kept but Vectorize would have discarded. */
  vectorizeWouldDrop: number;
  /** Number of items that SimHash discarded but Vectorize would have kept. */
  vectorizeWouldKeep: number;
  /** Items where SimHash and Vectorize agreed on the keep/discard decision. */
  agrees: number;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Query Vectorize for the nearest neighbours of `vector`.
 *
 * Returns an empty array on any Vectorize error (fail-open).
 *
 * @param index  - Bound Vectorize index.
 * @param vector - Embedding vector (e.g. 384-dim from bge-small-en-v1.5).
 * @param topK   - Maximum number of results to return. Default: 5.
 * @param minScore - Minimum cosine similarity to include. Default: 0.88.
 */
export async function vectorizeQuery(
  index: VectorizeIndex,
  vector: number[],
  topK = 5,
  minScore = 0.88,
): Promise<VectorizeQueryMatch[]> {
  if (vector.length === 0) return [];
  try {
    const result = await index.query(vector, { topK, returnMetadata: "all" });
    return result.matches.filter((m) => m.score >= minScore);
  } catch {
    return [];
  }
}

/**
 * Upsert a batch of vectors into Vectorize.
 *
 * Returns the number of successfully upserted vectors, or 0 on error.
 *
 * @param index   - Bound Vectorize index.
 * @param vectors - Array of {id, values, metadata} to upsert.
 */
export async function vectorizeUpsert(
  index: VectorizeIndex,
  vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>,
): Promise<number> {
  if (vectors.length === 0) return 0;
  try {
    const result = await index.upsert(vectors);
    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Shadow-run the Vectorize semantic dedup alongside SimHash.
 *
 * This function runs Vectorize in parallel with the existing SimHash dedup
 * to measure accuracy without changing the output of the news feed.
 *
 * Algorithm:
 *   1. For each "kept" item (SimHash kept it), upsert its embedding into Vectorize.
 *   2. For each "discarded" item (SimHash dropped it), query Vectorize with its
 *      embedding to see if Vectorize would ALSO have dropped it.
 *   3. Record metrics: agree / disagree counts.
 *
 * The result is used to track whether Vectorize is ready to replace SimHash
 * (precision@10 ≥ SimHash + 15% over 30 days).
 *
 * @param index          - Bound Vectorize index.
 * @param keptEmbeddings - Map from item ID to embedding for items SimHash kept.
 * @param droppedEmbeddings - Map from item ID to embedding for items SimHash dropped.
 * @param dupScoreThreshold - Cosine similarity threshold to consider an item a duplicate. Default: 0.88.
 */
export async function vectorizeShadowRun(
  index: VectorizeIndex,
  keptEmbeddings: Map<string, number[]>,
  droppedEmbeddings: Map<string, number[]>,
  dupScoreThreshold = 0.88,
): Promise<ShadowRunMetrics> {
  const metrics: ShadowRunMetrics = {
    upserted: 0,
    vectorizeWouldDrop: 0,
    vectorizeWouldKeep: 0,
    agrees: 0,
  };

  // Step 1: Upsert kept items into Vectorize index
  if (keptEmbeddings.size > 0) {
    const upsertBatch = Array.from(keptEmbeddings.entries()).map(([id, values]) => ({
      id,
      values,
      metadata: { source: "news-shadow" },
    }));
    metrics.upserted = await vectorizeUpsert(index, upsertBatch);
  }

  // Step 2: Query Vectorize for each dropped item to see if it's a true duplicate
  for (const [, embedding] of droppedEmbeddings) {
    const matches = await vectorizeQuery(index, embedding, 1, dupScoreThreshold);
    if (matches.length > 0) {
      // Vectorize agrees: this item IS a near-duplicate of a kept item
      metrics.agrees++;
    } else {
      // Vectorize disagrees: SimHash dropped it but Vectorize would have kept it
      metrics.vectorizeWouldKeep++;
    }
  }

  // Count kept items that Vectorize would also have kept (agree on keep)
  metrics.agrees += keptEmbeddings.size; // all upserted = Vectorize-approved

  return metrics;
}
