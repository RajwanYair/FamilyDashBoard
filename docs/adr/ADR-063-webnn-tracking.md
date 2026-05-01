# ADR-063: D2 — WebNN On-Device Inference (Track v15)

- **Status**: Tracking (revisit at v15 planning)
- **Date**: 2026-05-03 (v13.36.0 patch series)
- **Sprints**: 346
- **Related**: ADR-052 (Vectorize semantic dedup), ROADMAP §1.11 D2, §6 N-V

## Context

Two card workloads currently rely on either Worker-side AI or local
heuristics:

- **News rerank** — Worker-side Vectorize embeddings drive semantic
  dedup (ADR-052). Each rerank costs one Cloudflare Vectorize query
  per fetch.
- **Motivation curator** — Picks one of N hand-curated quotes by a
  simple weighted random + recency filter. No ML.

WebNN (Web Neural Network API) would push both inferences entirely
client-side: a small embedding model (e.g. MiniLM-L6, ~22 MB once
quantized) runs on the user's GPU/NPU at zero marginal cost and zero
network egress.

## Decision

**Track** D2 for v15. Do **not** adopt in v14.x. Conditions to revisit:

1. WebNN reaches **Chrome stable + Firefox stable** (currently Chrome
   135 origin trial, Firefox no public timeline).
2. Workers AI fallback path is provably equivalent (same envelope, same
   precision metrics) so absent-API users see no degradation.
3. The cached model footprint fits inside the existing **Storage
   Buckets** named partition (D4, ADR-056) — i.e., ≤ 30 MB gzipped.
4. Privacy review confirms no model weights leak the user's reading
   history (relevant for the news rerank case).

## Consequences

- **Pro (when adopted):** Zero per-rerank Vectorize cost. Zero network
  egress for inference. Faster (sub-50 ms vs. ~150 ms over WAN).
- **Pro (when adopted):** Native fit with the dashboard's "static PWA + zero telemetry" posture.
- **Con (today):** Browser support is single-vendor.
- **Con (today):** Quantized model footprint dwarfs the entire
  current bundle. Even with Storage Buckets eviction the cold-start
  cost is significant; only worth it for users who run the dashboard
  daily.
- **Con (today):** Vectorize already meets the precision target
  (ADR-052) — there is no quality argument for the migration, only an
  egress/cost one.

## Migration Sketch (when adopted)

1. Add `src/core/webnn-rerank.ts` with feature-detect + lazy load.
2. Bundle the embedding model into a separate Storage Bucket
   (`fdb-models`) so SW pre-cache stays small.
3. Worker rerank endpoint becomes a fallback (kept for absent-API
   users).
4. Bundle delta check: zero impact on the main JS chunk; model lives
   in its own bucket.

## References

- ROADMAP §1.11 D2
- ROADMAP §6 N-V (SimHash → Vectorize, current production pipeline)
- ADR-052 (Vectorize semantic dedup)
- WebNN spec: <https://www.w3.org/TR/webnn/>
- Chrome WebNN status: <https://chromestatus.com/feature/5763428080812032>
