# ADR-075 — Production-Readiness Audit Cadence (Annual)

**Status**: Accepted · **Date**: 2026-05-16 · **Drivers**: ROADMAP Deep-Rethink v3.1, ratchet-stream maintenance, long-tail dead-code prevention.

## Context

ROADMAP v3 (2026-Q2) introduced five non-negotiable engineering rules (§0.1) and re-litigated 25 previously-rejected decisions (§1). The v3.1 refresh (this ADR) added an audit stamp confirming every claim was reverified against the live tree: 0 dead exports across 142 files, 0 ESLint suppressions, 0 `@ts-ignore`, 0 suspended CI gates, 0 abandoned features.

Without a formal cadence, the audit will not recur. Past projects in `MyScripts/` accumulated suspended CI options between v9 → v13 that required ~3 days of cleanup in `v13.x` "PRODUCTION-READY HARDENING" (see CHANGELOG line 1342). The cost of detection grows quadratically with elapsed time.

## Decision

Adopt an **annual production-readiness audit** synchronized with the major-version planning cycle (currently v15 stream). Audit runs once per calendar year (target: April–May), produces a tagged ROADMAP refresh (`v3 → v3.1 → v4.0 → …`), and gates the next major-release planning kick-off.

### Audit checklist (codified)

1. `npm run check:dead-exports` → must report `0 dead exports`
2. `Select-String -Pattern "eslint-disable|@ts-ignore|@ts-expect-error" -Path src,tests,worker,scripts -Recurse` → must return `0` matches (excluding intentional `eslint-disable-next-line` paired with an issue link)
3. `npm run check:test-focus` → no `.only` / `.skip` outside documented fixtures
4. `npm run check:artifacts` → no committed build artifacts
5. ROADMAP §1 "rejected decisions" — re-verify each is still rejected (technology and ecosystem may have shifted)
6. ROADMAP §2 "comparison matrix" — refresh peer column counts, stars, frontend stacks; add new entrants if 3+ peers have shipped them
7. ROADMAP §3 "per-card open backlog" — strike shipped items, move new asks in
8. ROADMAP §6 "strategic streams" — verify each [x]-shipped item lists the version it landed in
9. `npm run check` (full 24-gate sweep) → green
10. Append "Audit stamp" paragraph to ROADMAP §0 with date, ratchet counters, and commit hash

### Cadence governance

- **Trigger**: First commit after April 1 each year, or after every 5 minor releases — whichever is earlier
- **Owner**: Repository maintainer (currently @RajwanYair)
- **Deliverable**: One commit with `chore(audit): production-readiness sweep v3.X` containing ROADMAP refresh + this ADR's compliance verification
- **Failure mode**: If any item 1–4 fails, audit is **blocking** — must remediate before the next minor release tag

## Consequences

- ROADMAP refresh becomes a scheduled artifact, not an ad-hoc rewrite
- The 5 non-negotiable rules (§0.1) gain enforcement teeth via the annual sweep
- Prevents accumulation of suspended gates / dead code drift
- Adds ~2 hours/year of explicit audit work — negligible vs. cleanup-debt prevention
- ROADMAP version number becomes meaningful (v3.0 → v3.1 → v4.0 maps to audit cycles, not minor releases)

## Alternatives Considered

- **Pre-commit hooks**: Rejected — ROADMAP §1 explicitly rejects Husky / pre-commit per ADR-009 (CI is the gate, not local hooks)
- **Per-PR audit check**: Rejected — too noisy for routine work; the audit's value is in periodic re-litigation, not continuous enforcement
- **Quarterly cadence**: Rejected — too frequent; ratchet streams need 6-12 months between cycles to accumulate measurable drift

## References

- ROADMAP v3.1 §0 (audit stamp), §0.1 (non-negotiables), §1 (rejected decisions), §6 (strategic streams)
- CHANGELOG v13.x PRODUCTION-READY HARDENING (cleanup precedent)
- ADR-014 (shared tooling presets — annual sync precedent)
- ADR-031 (annual vendor-neutrality drill — separate annual cadence)
