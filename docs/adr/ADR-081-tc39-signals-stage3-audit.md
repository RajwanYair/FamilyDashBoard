# ADR-081: TC39 Signals Stage 3 Audit — Continue HOLD

| Field        | Value                                                  |
| ------------ | ------------------------------------------------------ |
| **Date**     | 2026-06-20                                             |
| **Status**   | Accepted                                               |
| **Deciders** | @RajwanYair                                            |
| **Tags**     | signals, state, tc39, zero-dep, v15                    |
| **Related**  | ADR-038 (in-house signals), ADR-002 (zero client deps) |

---

## Context

[ADR-038](ADR-038-in-house-signals.md) adopted a hand-rolled
`signal / computed / effect / batch / untrack` primitive (~200 LOC) in
`src/core/signals.ts`, deliberately mirroring the TC39 Signals proposal
public API so a future swap is a one-line import change.

The ROADMAP (§7.6, §3.2) gates migration to the TC39 polyfill on:

- **Stage 4** (spec finalised)
- **Polyfill ≤ 1.5 KB gzip**

**v14.24.0 audit (2026-06-20):**

| Criterion                              | Status                                                            |
| -------------------------------------- | ----------------------------------------------------------------- |
| TC39 Stage                             | **Stage 3** (champion: Rob Eisenberg; last TC39 meeting: 2025-12) |
| Reference polyfill (`signal-polyfill`) | ~2.8 KB gzip (npm `signal-polyfill@0.2.0`)                        |
| Size gate ≤ 1.5 KB gzip                | ❌ Still 1.3 KB above threshold                                   |
| Stage 4                                | ❌ Advancement expected H1 2027 per TC39 plenary notes            |
| In-house `signals.ts` line count       | 224 LOC, 0 deps, 100% covered                                     |

**Progress since ADR-038:** Proposal advanced from Stage 1 → Stage 3 in 2025. The public API is now stable — no breaking changes expected. The
polyfill has shrunk from ~4 KB to ~2.8 KB gzip but remains above the 1.5 KB
gate.

## Decision

**Continue HOLD. No migration in v14.x or v15.0.0.**

The in-house `signals.ts` is the correct choice for this release cycle:

- Zero runtime dependency (ADR-002 compliance).
- 100% test coverage with property-based tests.
- API surface is identical to the proposal — no migration cost when the
  time comes.
- Polyfill at 2.8 KB gzip is nearly double our 1.5 KB gate.

### Re-trigger conditions

Migration to the TC39 polyfill is re-triggered **when both conditions
are met simultaneously**:

1. TC39 Signals advances to **Stage 4** (spec ratified by TC39 plenary).
2. The reference polyfill (`signal-polyfill` or equivalent) ships at
   **≤ 1.5 KB gzip** with the full `signal / computed / effect / batch`
   surface.

Expected earliest: **v15.x (2027-Q1)** if Stage 4 advances on schedule.

## Consequences

- `src/core/signals.ts` remains the authoritative signal primitive.
- No new imports from `signal-polyfill` or `@lit-labs/signals`.
- When migration is triggered: replace `src/core/signals.ts` with the
  polyfill, update the single import in `src/main.ts`, delete the 224
  LOC hand-rolled implementation. Estimated effort: 1 sprint.
- Next audit: v15.0.0 release cycle (check polyfill size + TC39 stage).
