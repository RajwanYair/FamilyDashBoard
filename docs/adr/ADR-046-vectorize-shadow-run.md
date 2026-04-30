# ADR-046 — Vectorize Shadow Run Before Retiring SimHash

| Field      | Value                                                      |
| ---------- | ---------------------------------------------------------- |
| Date       | 2026-04-30                                                 |
| Status     | Accepted (Plan)                                            |
| Sprint     | 229                                                        |
| Supersedes | n/a                                                        |
| Related    | Roadmap item N1, `worker/src/utils/simhash.ts`, ADR-003    |

## Context

The FamilyDashBoard worker uses a custom [SimHash](https://en.wikipedia.org/wiki/SimHash)
implementation (`worker/src/utils/simhash.ts`) to detect near-duplicate news
articles before storing them in D1 / KV. SimHash works well at the current
scale but has two known limitations:

- **Exact-match only for bits ≤ 3 hamming distance** — higher thresholds
  require a scanning pass over all stored hashes (O(n) with index tricks).
- **No semantic understanding** — two articles with identical meaning but
  different wording score as dissimilar.

Cloudflare introduced [Workers AI Vectorize](https://developers.cloudflare.com/vectorize/)
(GA June 2024) which exposes a managed HNSW vector index. Combined with
the Cloudflare AI text-embedding model (`@cf/baai/bge-small-en-v1.5`, 384
dimensions), it enables:

1. Semantic near-duplicate detection via cosine similarity.
2. "Related articles" retrieval at sub-millisecond latency.
3. Future: personalized feed ranking without client-side ML.

## Decision

**Run a 30-day shadow mode** before retiring SimHash:

### Phase 1 — Shadow mode (30 days, ~Sprint 229–236)

1. Add a `vectorizeArticle(text: string)` helper in a new file
   `worker/src/utils/vectorize.ts`.
2. In the news ingestion path (`worker/src/routes/feeds.ts`), call
   `vectorizeArticle()` **in parallel** with the existing SimHash check.
   Do **not** use the vector result for deduplication yet.
3. Store vector IDs in a `vec_id TEXT` column added to the `articles`
   D1 table (nullable — existing rows unaffected).
4. Emit a diagnostic metric (`ANALYTICS.writeDataPoint`) comparing the
   SimHash decision to the Vectorize cosine-similarity decision for each
   article pair.
5. If `VECTORIZE` binding is absent (e.g. local dev, non-CF deploy),
   `vectorizeArticle()` returns `null` and the shadow path is skipped —
   zero behaviour change.

### Phase 2 — Cutover gate (Sprint ~240)

After 30 days of shadow data:
- Agreement rate SimHash ↔ Vectorize ≥ 95% → proceed to Phase 3.
- Agreement rate < 95% → extend shadow period and open a follow-up ADR.

### Phase 3 — Retire SimHash

1. Remove SimHash dedup logic from `feeds.ts`.
2. Keep `simhash.ts` as a utility (tested, mutation-tested) but mark it
   `@deprecated` in JSDoc for eventual removal.
3. Update Stryker config: remove `simhash.ts` from `mutate` array.
4. Update `docs/data-sources.md` with the new dedup strategy.
5. Create `ADR-046-addendum.md` recording actual agreement rate.

## Consequences

**Positive**
- Semantic deduplication reduces false-positives (different wording, same
  story).
- Foundation for "related articles" X-card feature (Roadmap N1).
- Worker stays O(log n) via HNSW — no full-scan required.

**Negative / Risks**
- `VECTORIZE` is a Cloudflare-only binding → vendor lock-in increases for
  this code path. Mitigated by ADR-031 neutrality drill.
- Embeddings cost CF Workers AI tokens → monitor via `ANALYTICS`.
- `@cf/baai/bge-small-en-v1.5` is English-only; Hebrew headlines need
  transliteration or a multilingual model (`@cf/BAAI/bge-m3`).

## Alternatives Considered

| Option                        | Why Not Chosen                                   |
| ----------------------------- | ------------------------------------------------ |
| Replace SimHash immediately   | Too risky; shadow run validates the approach first |
| Use Pinecone / Weaviate       | Adds external vendor dependency; CF Vectorize is  |
|                               | already in-stack at zero egress cost              |
| Keep SimHash indefinitely     | Does not support semantic dedup or related-articles |

## Implementation Notes

```typescript
// worker/src/utils/vectorize.ts (Sprint 229 stub — Shadow mode only)
export async function vectorizeArticle(
  text: string,
  env: AppEnv,
): Promise<string | null> {
  if (!env.VECTORIZE || !env.AI) return null;
  try {
    const embedding = await env.AI.run("@cf/baai/bge-small-en-v1.5", {
      text: [text.slice(0, 1024)], // truncate to model limit
    });
    const vec = embedding.data[0];
    if (!vec) return null;
    const id = crypto.randomUUID();
    await env.VECTORIZE.upsert([{ id, values: vec }]);
    return id;
  } catch {
    return null; // shadow path — fail silent
  }
}
```

The `wrangler.toml` binding (to be added in the cutover sprint):
```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "fdb-articles"
```
