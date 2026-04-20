# ADR-007: News Aggregation Strategy

**Date:** 2026-07-10
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

The news card fetches RSS feeds from multiple sources (Ynet, Haaretz, etc.) and displays headlines in Hebrew RTL. Several architectural questions arose during v8 development:

1. Should feeds be proxied through the Worker or fetched directly from the browser?
2. How should CORS restrictions for RSS/Atom feeds be handled?
3. How should multiple feeds be ranked, deduplicated, and merged?
4. What is the right TTL and staleness strategy for news content?

---

## Decision

**Route all RSS/news feed fetches through the Cloudflare Worker when available; fall back to the client-side proxy chain (`allorigins` → `codetabs` → `corsproxy.io`) otherwise.**

- The Worker normalizes each feed item to `{ title, url, source, publishedAt }` before returning it to the client.
- Feed merging and deduplication are performed at the Worker boundary.
- Client-side feed parsing is retained only as a fallback when the Worker is unreachable.
- News cache TTL is 15 minutes (`cSet`/`cGet`); stale content is served via `cGetStale` during fetch errors.

---

## Rationale

1. **CORS is handled centrally** — the Worker owns the CORS bypass, removing the need for multiple client-side proxy hops per feed.
2. **Normalization isolates schema volatility** — RSS/Atom fields vary across providers; the Worker normalizes to a stable contract, so the card never sees raw feed XML.
3. **TTL at the worker** — news is time-sensitive but not real-time. 15-minute server-side TTL prevents hammering upstream providers while keeping content fresh.
4. **Client fallback** — a non-functional Worker should not break the news card. The proxy chain maintains offline-mode parity.

---

## Consequences

- The Worker `news` route must accept a `?feeds=` query param listing the desired source URLs.
- The normalized `NewsItem` type lives in `src/types/api.ts` and is shared by the card and the Worker.
- Any new news source is added to the Worker route configuration, not to the card itself.
