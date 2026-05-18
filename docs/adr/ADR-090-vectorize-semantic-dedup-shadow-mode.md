# ADR-090 — Vectorize Semantic Dedup Shadow Mode for News Aggregator

**Status**: Accepted  
**Date**: 2025-07-14  
**Authors**: FamilyDashBoard maintainers  
**Supersedes**: —  
**Superseded by**: —  
**Related**: ADR-052 (R2 asset cache), ADR-030 (Workers AI embeddings), ROADMAP §6.1 SEMANTIC

---

## Context

FamilyDashBoard's `/api/feeds/news` handler aggregates RSS items from multiple Hebrew-language news
outlets and removes near-duplicate headlines before delivery. The current dedup stack uses two passes:

1. **SimHash pass** — 64-bit char 4-gram fingerprint, Hamming distance ≤ 3 (tight).
2. **Workers AI embedding pass** — cosine similarity on bge-small-en-v1.5 embeddings, threshold 0.92.

Both passes operate on each request independently; there is no persistent store of "seen" fingerprints
across requests. This means that if the same story is published with a slightly different headline across
two consecutive refresh cycles, it passes through both dedup filters.

[Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) is a globally-distributed vector
database available as a Cloudflare Worker binding. It enables cross-request semantic search: embeddings
from previous news cycles can be queried to identify stories that were already served.

The ROADMAP §6.1 SEMANTIC specifies a **30-day shadow run** strategy:

> Run Vectorize in parallel with SimHash. Do NOT change feed output. Measure precision@10.  
> Exit gate: precision@10 ≥ SimHash + 15% before retiring SimHash.

---

## Decision

We add a **shadow-mode Vectorize integration** to the news aggregate handler. The shadow run:

1. Runs **only when** both `env.VECTORIZE_INDEX` and `env.AI` bindings are provisioned.
2. Runs **after** the existing dedup passes have produced the final feed.
3. Upserts embeddings for the "kept" set into `fdb-news-dedup` (a cosine-metric 384-dim index).
4. Queries the index for embeddings of the "dropped" set to measure whether Vectorize agrees.
5. Records `ShadowRunMetrics` (upserted / agrees / vectorizeWouldKeep / vectorizeWouldDrop).
6. **Does not change the response** — the feed output is identical whether or not the shadow run fires.

### Why shadow mode first

Vectorize changes have permanent effects: once embeddings are stored, they influence subsequent queries.
Deploying in shadow mode allows us to:

- Measure precision@10 without any user-visible risk.
- Catch cross-request dedup gaps (same story, different phrasing, two refresh cycles apart).
- Validate that bge-small-en-v1.5 embeddings at threshold 0.88 are better than SimHash at threshold 3
  before switching the primary dedup path.

### Vectorize index configuration

| Parameter      | Value             | Rationale                                               |
| -------------- | ----------------- | ------------------------------------------------------- |
| Dimensions     | 384               | bge-small-en-v1.5 output dimension                     |
| Metric         | cosine            | Normalized — scale-invariant similarity for short text  |
| Index name     | `fdb-news-dedup`  | Descriptive, project-namespaced                         |
| Binding        | `VECTORIZE_INDEX` | Matches types.ts Env field                              |

Provision with:

```bash
wrangler vectorize create fdb-news-dedup --dimensions=384 --metric=cosine
```

### Gating

The binding `VECTORIZE_INDEX` is declared in `wrangler.toml` but provisioning is manual.
The CI environment does **not** provision Vectorize — shadow run code is exercised via unit tests
with in-memory stubs only.

---

## Architecture

```
handleNewsAggregate()
  │
  ├── SimHash dedup pass ─────────────────────────── [authoritative]
  ├── Workers AI embedding pass (env.AI optional) ── [authoritative]
  │
  └── [fire-and-forget]  if (env.VECTORIZE_INDEX && env.AI)
        │
        ├── getEmbedding() × keptItems[0..30]
        ├── vectorizeUpsert(keptEmbeddings)
        ├── getEmbedding() × droppedItems[0..10]
        ├── vectorizeQuery() × droppedItems
        └── ShadowRunMetrics { upserted, agrees, vectorizeWouldKeep, vectorizeWouldDrop }
```

The shadow block is wrapped in `void (async () => { ... })()` so it cannot delay or error the response.
All errors inside the block are caught and discarded.

---

## Components

| File                                    | Role                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `worker/src/utils/vectorize-client.ts`  | `vectorizeQuery`, `vectorizeUpsert`, `vectorizeShadowRun` helpers |
| `worker/src/routes/feeds.ts`            | Shadow run wired into `handleNewsAggregate` (fire-and-forget) |
| `worker/src/types.ts`                   | `VECTORIZE_INDEX?: VectorizeIndex` added to `Env`           |
| `worker/wrangler.toml`                  | `[[vectorize]]` binding declaration                         |
| `tests/unit/worker/vectorize-client.test.ts` | 13 unit tests covering all helper functions             |

---

## Consequences

### Positive

- **Zero production risk**: shadow mode never modifies feed output.
- **Cross-request dedup**: Vectorize persists embeddings across requests — SimHash cannot.
- **Precision measurement**: 30-day metrics will provide objective data to justify or reject
  the full Vectorize migration (ADR-052 exit gate).
- **Fail-open design**: missing binding, AI quota exhaustion, or Vectorize errors all result
  in the shadow block silently not running.

### Negative / Risks

- **Vectorize write cost**: each news aggregate request upserts ≤ 30 embeddings. At Vectorize's
  free-tier write rate (100K/day), typical traffic does not approach the limit.
- **Workers AI latency budget**: the shadow run fetches embeddings via `getEmbedding()` which is
  already called in the main embedding dedup pass. Shared execution inside the same Worker invocation
  means the shadow embeddings might reuse the AI binding concurrently — no extra latency added to
  the response path since the block is fire-and-forget.
- **Index pollution during testing**: manual provisioning ensures CI never accidentally writes to
  the production Vectorize index.

---

## Exit Gate

Promote Vectorize from shadow to primary when, over ≥ 30 days of shadow run data:

- **precision@10 ≥ SimHash + 15%** — measured from `agrees / (agrees + vectorizeWouldKeep)`.
- **No false-negative surge** — `vectorizeWouldDrop` < 5% of total kept items.
- **Latency within budget** — p99 of the embedding-augmented request ≤ 200 ms above baseline.

Upon meeting exit gate: migrate `handleNewsAggregate` to query Vectorize first, remove SimHash
fallback for the title-dedup pass, and record the promotion in a follow-up ADR.

---

## References

- [Cloudflare Vectorize Documentation](https://developers.cloudflare.com/vectorize/)
- [bge-small-en-v1.5 model card](https://huggingface.co/BAAI/bge-small-en-v1.5)
- `docs/adr/ADR-030-workers-ai-embedding.md` — Workers AI binding design
- `docs/adr/ADR-052-r2-asset-cache.md` — R2 integration (companion infrastructure ADR)
- `worker/src/utils/vectorize-client.ts` — implementation
