# ADR-031 — Annual Vendor-Neutrality Build Drill

| Field       | Value                                            |
| ----------- | ------------------------------------------------ |
| **Date**    | 2026-04-23                                       |
| **Status**  | Accepted                                         |
| **Deciders** | @RajwanYair                                     |
| **Tags**    | infra, vendor, cloudflare, deno, bun, fly         |

---

## Context

FamilyDashBoard's backend runs exclusively on Cloudflare Workers. While CF is an excellent fit
(global edge, KV, D1, Durable Objects, free tier generous), full lock-in creates risk:

- Pricing or free-tier changes affecting `wrangler deploy` cost.
- Platform deprecation or capability regressions.
- Need to switch region strategy (e.g., GDPR compliance for EU family members).

The mitigation is NOT to maintain parallel deploys (expensive, high maintenance) but to
**prove the exit door exists** once per major release via a time-boxed build drill.

---

## Decision

Before each major version tag (`git tag vX.0.0`), run one of the three vendor drill targets in
rotation, document the result (pass/fail/delta), and commit the notes:

| Target | Runtime | Notes |
| --- | --- | --- |
| **Deno Deploy** | Deno 2 | `worker/src/index.ts` via `deno task serve`; no `wrangler.toml` |
| **Bun Deploy** | Bun 1.2 | `bun serve worker/src/index.ts`; Hono compatible |
| **fly.io** | Node 22 / Docker | `Dockerfile` + fly.toml; Hono Node adapter |

Drill process:

1. Create a branch `drill/vendor-YYYY-MM` (never merge to main).
2. Adapt `worker/src/index.ts` adapter layer for the target runtime.
3. Run `npm run check:worker-types` (stub bindings for unavailable KV/D1/DO).
4. Deploy to the target free tier.
5. Run `tests/integration/worker.test.ts` against the alternate URL.
6. Record result in `docs/adr/vendor-drill-log.md`.
7. Delete the branch; do **not** keep the alternate deploy running.

KV/D1/DO bindings use a `StorageAdapter` interface (to be extracted in v13) so stubs can be
swapped without touching business logic.

---

## Consequences

### Good

- Exit door is proven working at least once per major release.
- Forces clean separation between CF-specific bindings and business logic.
- No ongoing maintenance cost (drill is ephemeral).

### Neutral

- ~2–4 hours per drill. Acceptable at major-release cadence.
- DO and KV stubs reduce drill fidelity for alerts and caching paths.

**Related ADRs**: ADR-003 (worker-first API), ADR-013 (KV stale cache), ADR-025 (DO).
