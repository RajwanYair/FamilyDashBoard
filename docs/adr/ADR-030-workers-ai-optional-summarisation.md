# ADR-030 — Workers AI: Optional Hebrew Summarisation

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| **Date**     | 2026-04-23                                 |
| **Status**   | Accepted                                   |
| **Deciders** | @RajwanYair                                |
| **Tags**     | worker, ai, news, motivation, feature-flag |

---

## Context

Cloudflare Workers AI (GA 2025) provides inference at the edge with no cold-start and generous
free tier (10 K neurons/day on Free). Relevant models:

- `@cf/baai/bge-small-en` — multilingual 384-dim embedding (English + Hebrew support)
- `@cf/meta/llama-3.3-8b-instruct` — generation at edge; 32 K context; Hebrew quality acceptable
- `@cf/baai/bge-m3` — best multilingual embedding for Hebrew/English code-switching

Two use-cases were evaluated:

1. **News summarisation** — produce a 1-line Hebrew digest per RSS feed, cached 1 h in KV, displayed
   as a subtitle under the feed headline.
2. **Daily Hebrew motivational quote** — generate one new quote per day, cached 24 h, displayed in the
   motivation card as an alternative to the curated list.

Both are strict addenda — they augment existing cards; they do not replace any data path.

---

## Decision

Adopt Workers AI for both use-cases behind a **feature-flag** that defaults `false`.

- New worker routes: `POST /api/news/summarise` and `GET /api/motivation/hebrew`.
- Both guarded by `env.AI_ENABLED === "true"` — absent/false → 503 with body
  `{"ok":false,"error":"ai_disabled"}`.
- Client: new config flag `aiFeatures: boolean` (default `false`) added to `DashboardConfig`.
- Cards query the route only when `cfg.aiFeatures === true`.
- KV caching: 1 h for news summaries (key `ai-summary:<simhash>`), 24 h for motivation
  (key `ai-motivation:YYYY-MM-DD`).
- Zero impact on non-AI users: no extra fetches, no bundle impact, no latency change.
- SimHash v2 on news route: add `@cf/baai/bge-m3` embedding cosine-distance dedup alongside existing
  SimHash Hamming dedup. Gate: precision@10 > baseline by ≥ 15 % before enabling by default.

---

## Consequences

### Good

- Hebrew-first families get contextual summaries and fresh motivational content at zero cost.
- Embedding-based dedup dramatically reduces cross-paraphrase near-duplicates in the news feed.
- Entirely additive; opt-in default means zero regression risk.

### Neutral

- Workers AI adds a third worker dependency (`@cloudflare/workers-types` already references `Ai`
  binding via `workers-types`; no new npm dep).
- Latency of `/api/news/summarise` is ~200–500 ms cold; acceptable since it is fire-and-forget
  from the news card.
- Hebrew generation quality varies; motivation card shows AI quote alongside curated list.

**Related ADRs**: ADR-007 (news), ADR-011 (envelope), ADR-013 (KV stale cache).
