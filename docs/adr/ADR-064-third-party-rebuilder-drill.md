# ADR-064: D15 — Annual Third-Party `dist/` Reproducibility Verification

- **Status**: Adopt v14.2 (shipped Sprint 424 — `.github/workflows/rebuild-verify.yml` active)
- **Date**: 2026-05-03 (v13.36.0 patch series)
- **Sprints**: 347, 424
- **Related**: ADR-038 (SLSA L3 + Sigstore), ADR-046 (rebuilder-manifest), ROADMAP §1.11 D15

## Context

The dashboard already ships:

- **`rebuilder-manifest.json`** (ADR-046) — pins every input
  (toolchain, sources, lockfiles) needed to reproduce `dist/` byte-for-byte.
- **SLSA L3 + Sigstore** (ADR-038) — provenance attestation is signed
  and published per release.
- **`scripts/check-reproducible.mjs`** — local CI gate confirms two
  back-to-back builds produce identical hashes.

What's missing is a **third-party** rebuild — an unrelated party (or
GitHub Action under a different identity) that pulls the manifest,
builds, and attests that their hashes match. SLSA L3 considers this
the gold standard for build trust; without it we are only attesting
"this builder built this".

## Decision

**Adopt** D15 starting v14.2 with the following annual drill:

### Drill Cadence

- **Once per year**, on the v14.X.0 minor release that lands closest
  to the project anniversary (currently September).
- Skip the drill on patch releases — annual is sufficient signal.

### Drill Procedure

1. CI runs the existing `scripts/check-reproducible.mjs` and produces
   the per-file SHA-256 manifest into `dist/.rebuild-hashes.json`.
2. A separate workflow under `.github/workflows/rebuild-verify.yml`
   triggers a second build inside the [SLSA `verifier-action`](https://github.com/slsa-framework/slsa-verifier)
   container with **no shared cache**, **no shared toolchain mirror**,
   and a different runner generation.
3. The verifier asserts the hashes match. Mismatch → release-blocking
   failure with diff log uploaded as an artifact.
4. Result is committed to `docs/security.md` as a dated rebuilder
   attestation.

### What Counts as "Third-Party"

For v14.2 the verifier-action container is operated by the SLSA
framework, not by this project's GitHub identity. That is sufficient
third-party separation for the first drill.

For v15+ we will add a second verifier under a different cloud
provider (e.g., a Deno Deploy build of `scripts/check-reproducible.mjs`
that fetches the same `rebuilder-manifest.json` and produces hashes
independently). Tracked as a follow-on ADR.

### Drill Failure Handling

- Reproducibility failure is a **release blocker**. Do not tag, do not
  push, do not publish.
- Record the failing hash diff in a private security note (no public
  disclosure until investigated — could indicate compromise).
- Open a P0 issue with `security` label.

## Consequences

- **Pro:** Closes the SLSA L3 trust loop with zero new client-side
  surface. The drill runs entirely in CI.
- **Pro:** Annual cadence is sustainable — quarterly would be
  excessive given the tight reproducibility budget already enforced
  per-PR.
- **Con:** Requires the SLSA verifier-action container remain
  maintained. Mitigated by the v15+ second-verifier plan.
- **Con:** First drill (v14.2) may surface latent non-determinism
  (timestamps, sort orders, etc.) that the local check missed. That is
  the value of the drill — surface and fix.

## References

- ROADMAP §1.11 D15
- ADR-038 (SLSA L3 + Sigstore)
- ADR-046 (rebuilder-manifest.json contract)
- `scripts/check-reproducible.mjs`
- SLSA verifier-action: <https://github.com/slsa-framework/slsa-verifier>
- SLSA L3 spec: <https://slsa.dev/spec/v1.0/levels#build-l3>
