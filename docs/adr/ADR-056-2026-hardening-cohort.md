# ADR-056: Sprint 327-331 Hardening — Origin-Agent-Cluster, Compute Pressure, Storage Buckets, 2026 Permissions-Policy cohort

- **Status**: Accepted
- **Date**: 2026-05-01 (v13.34.0 patch series)
- **Sprints**: 327–331
- **Related**: ADR-018 (CSP/COOP/COEP), ADR-053 (card config schema)

## Context

The 2026 web platform shipped several new opt-in primitives that are
relevant to a TV-mounted family dashboard:

- **Origin-Agent-Cluster** (`?1`) — requests an isolated agent cluster per
  origin to defend against cross-origin Spectre-class side-channels. Static
  PWA, no third-party iframes, so the trade-off (no `document.domain`
  setter, no cross-origin synchronous script access) is free.
- **Compute Pressure API** (`PressureObserver`) — surfaces nominal / fair /
  serious / critical CPU pressure. Useful as a passive system-info tile.
  Already covered by `compute-pressure=(self)` in Permissions-Policy.
- **Storage Buckets API** (`navigator.storageBuckets`) — per-origin named
  partitions for future per-card quota separation. Not yet broadly
  supported; we feature-detect and surface bucket count without taking
  any dependency.
- **2026 Permissions-Policy cohort** — `attribution-reporting`,
  `browsing-topics`, `idle-detection`, `interest-cohort`, `storage-access`,
  `unload`, `clipboard-read`, `private-state-token-issuance/redemption`,
  `keyboard-map`, `speaker-selection`, `gamepad`. All hard-denied to
  preserve the existing privacy posture (ADR-018).

Decisions D3, D4, D5 in `docs/ROADMAP.md` §1.11 selected these as the
P1 batch for the v13.34.0 patch.

## Decision

We will:

1. Set `Origin-Agent-Cluster: ?1` on all routes via `_headers` (Sprint 327).
2. Add a feature-detected `PressureObserver` helper (`initPressureObserver`,
   `getPressureState`, `destroyPressureObserver`) and a `🌡️ עומס` tile in
   the system-info card (Sprint 329).
3. Add a feature-detected `getStorageBuckets()` helper and a `🪣 דליים` tile
   that surfaces the bucket count or `—` when unsupported (Sprint 330).
4. Expand `Permissions-Policy` from 28 → 41 directives covering the 2026
   API cohort. Hard-deny by default; allow `compute-pressure=(self)` and
   `clipboard-write=(self)` only because they are first-party features
   (Sprint 331).
5. Tighten Renovate scheduling (D14): security at-any-time, minor/patch
   monthly, majors manual review, supply-chain digest pinning unchanged
   (Sprint 328).

## Consequences

### Positive

- One additional defence-in-depth layer (Origin-Agent-Cluster) at zero
  runtime cost.
- Two new diagnostic tiles surface pressure + storage partitioning state
  without any network calls.
- Permissions-Policy now denies 13 additional sensor / privacy /
  clipboard / token APIs by default, reducing the attack surface for any
  future third-party content that might be embedded.
- Renovate noise reduced: minor/patch PRs batched monthly instead of
  weekly; security PRs still land at-any-time.

### Negative / trade-offs

- `Origin-Agent-Cluster: ?1` becomes a one-way commitment per browsing
  context group. Reverting on a previously-loaded origin requires a hard
  reload. Acceptable for a static dashboard.
- `clipboard-write=(self)` opens a tiny attack vector (a card could write
  to the clipboard). Mitigated by Trusted Types + zero third-party JS
  (ADR-002).
- Compute Pressure tile shows `—` on Firefox / Safari (Chromium-only as
  of 2026-Q2). Acceptable: tile is optional and other tiles fill the
  grid.

## Tests

- `tests/unit/headers.test.ts` — asserts presence of Origin-Agent-Cluster,
  full COOP/COEP/CORP chain, HSTS, Trusted Types, and the 2026 hard-deny
  cohort.
- `tests/unit/cards/system-info-pressure.test.ts` — 4 tests covering
  feature-detection, observer wiring, state propagation, idempotent init,
  clean teardown.
- `tests/unit/cards/system-info-buckets.test.ts` — 4 tests covering API
  absent / zero buckets / multiple buckets / `keys()` rejection.
- `tests/unit/ops/permissions-policy.test.ts` — accepts the new
  `name=(self)` form alongside the existing `name=()` deny form.

## Rollback

Each of the five sprints is an isolated commit. Rollback is `git revert`
of the relevant commit (`671be45`, `2d20c76`, `b3e9228`, `df514b0`,
`2492228`) followed by a fresh `_headers` deploy. No data migration.
