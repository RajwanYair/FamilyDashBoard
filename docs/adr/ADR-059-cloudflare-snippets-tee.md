# ADR-059: D6 — Cloudflare Snippets / TEE for Static Header Injection (Track)

- **Status**: Tracking (not adopted; revisit when Snippets ships TEE GA)
- **Date**: 2026-05-02 (v13.35.0 patch series)
- **Sprints**: 339
- **Related**: ADR-018 (CSP/COOP/COEP), ADR-056 (2026 hardening), ROADMAP §1.11 D6

## Context

Today the dashboard's full security-header set (CSP, COOP, COEP, CORP,
HSTS, Permissions-Policy, Origin-Agent-Cluster, Trusted Types, NEL,
Reporting-Endpoints) is emitted from two places:

1. `_headers` — static file applied by Cloudflare Pages on the edge.
2. The Cloudflare Worker proxy — wraps responses with the same headers
   when a request hits the API surface.

The Worker copy adds approximately **3 KB** to the worker bundle (gzip)
and is duplicated logic. Cloudflare Snippets (lightweight edge-script
shim ≤ 5 KB, sub-millisecond) and the upcoming TEE (Trusted Execution
Environment) variant are designed precisely for "static header
injection" workloads — moving the header concern out of the Worker
hot-path entirely.

## Decision

**Track** D6. Do **not** migrate yet. Conditions to adopt:

1. Cloudflare Snippets is **GA in TEE mode** (currently beta).
2. Snippets supports the full 41-directive Permissions-Policy without
   manual minification.
3. Snippet execution is provably below 1 ms p99 in the project's
   regions (IL, US, EU).
4. The Worker bundle ceiling reaches ≤ 75 KB gzip (currently within
   budget but tight) and the 3 KB header savings would unlock a
   different feature.

Until then, keep dual emission. The `_headers` file is the source of
truth; the Worker copy is asserted equivalent by
`tests/unit/ops/permissions-policy.test.ts` and
`tests/unit/headers.test.ts`.

## Consequences

- **Pro (when adopted):** ~3 KB Worker bundle headroom; single source
  of truth for header policy.
- **Pro (when adopted):** TEE attestation can be referenced in the
  SLSA provenance for the static asset surface.
- **Con (today):** Snippets/TEE is a Cloudflare-specific lock-in.
  Migration must remain reversible — the `_headers` file stays
  authoritative even when Snippets is active, so a fly.io / Deno
  Deploy mirror still gets the same headers.
- **Con (today):** Adds a fourth runtime layer (static / Snippet /
  Worker / SW) that contributors must reason about. Documentation
  load.

## Migration Sketch (when adopted)

1. Generate `cloudflare-snippet.js` from `_headers` at build time
   (`scripts/generate-snippet.mjs`).
2. Remove the header-wrapping middleware from `worker/src/middleware/headers.ts`.
3. Add a vendor-neutrality CI check that asserts `_headers` is still
   emitted by the static deploy on fly.io and Deno Deploy mirrors.
4. ADR addendum recording the GA migration date and the measured
   bundle delta.

## References

- ROADMAP §1.11 D6
- Cloudflare Snippets docs: <https://developers.cloudflare.com/rules/snippets/>
- ADR-018 (security headers — current authoritative source)
- `_headers` (static header file)
- `worker/src/middleware/headers.ts` (Worker copy — slated for removal)
