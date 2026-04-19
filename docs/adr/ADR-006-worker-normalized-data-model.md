# ADR-006: Worker-Normalized Data Model

**Date:** 2026-04-19
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard depends on multiple third-party providers for weather, stocks, news, currency, alerts, calendars, and Hebrew calendar data. Upstream payloads vary in shape, naming, stability, and error behavior.

Without a normalized boundary, cards absorb provider quirks directly and provider swaps become card rewrites. That increases brittleness and duplicates parsing logic across the client.

---

## Decision

**Normalize external provider responses at the worker boundary whenever practical, and keep card rendering code oriented around stable domain models instead of raw upstream payloads.**

The client may still perform local mapping when needed, but the architectural target is worker-normalized outputs with shared contracts.

---

## Rationale

1. **Provider swaps become cheaper** - a route can change upstreams while preserving the same client-facing contract.
2. **Cards stay focused on rendering** - UI modules should consume weather, news, and market domain models rather than provider-specific field names and edge cases.
3. **Validation belongs at the boundary** - malformed or incomplete upstream payloads should be detected before they leak into card rendering.
4. **The worker is the shared control plane** - caching, normalization, allowlists, and telemetry already live there, so response shaping belongs there as well.
5. **This reduces duplicated risk** - multiple dashboard instances and future cards benefit from one normalized route rather than repeating fragile parsing logic in each client module.

---

## Consequences

- New data sources should prefer a worker route that returns a stable normalized contract.
- Card modules should move toward domain adapters and away from raw provider field access.
- Tests should cover normalized outputs at the worker boundary and adapter behavior in the client.
- Local fallback parsing remains acceptable during migration, but it is a bridge pattern rather than the end state.

---

## Alternatives Considered

- **Client-only normalization**: rejected as the default because it duplicates parsing, weakens provider swap flexibility, and leaks upstream quirks into UI modules.
- **Pass-through worker routes**: rejected for the same reason; they keep the operational control plane but miss the contract-stability benefit.
