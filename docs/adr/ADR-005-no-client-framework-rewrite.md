# ADR-005: No Full Client Framework Rewrite

**Date:** 2026-04-19
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard is already a modular TypeScript application with Vite, Vitest, an explicit card registry, a reactive state store, and an incremental `FdbCard` runtime. Periodic pressure exists to rewrite the frontend into React, Next.js, or another client framework in the name of maintainability.

That pressure increased while the codebase was still split between legacy card modules and the newer instance-backed runtime, making a rewrite look cleaner than finishing convergence.

---

## Decision

**Do not do a full client framework rewrite. Continue the current architecture with staged convergence on the existing TypeScript, DOM, and `FdbCard` foundations.**

---

## Rationale

1. **The foundations already exist** - strict TypeScript, Vite, Vitest, card registry, worker integration, and reactive config/state are already delivering the maintainability benefits that usually motivate a rewrite.
2. **The real risk is fragmentation, not framework absence** - the codebase problem is mixed runtime patterns. A rewrite would delay delivery while that same migration work still has to be done conceptually.
3. **TV dashboard constraints favor explicit DOM control** - FamilyDashBoard optimizes for fast cold start, low runtime weight, predictable always-on behavior, and TV-distance rendering rather than application-style navigation complexity.
4. **A rewrite would create parallel systems again** - introducing a framework would temporarily multiply patterns, test utilities, and rendering assumptions during migration.
5. **The worker/backend split is already the better abstraction line** - product leverage comes more from normalized edge data, cache behavior, and card lifecycle consistency than from replacing the frontend rendering model.

---

## Consequences

- New architecture work should strengthen the current TypeScript stack instead of introducing a second frontend paradigm.
- `FdbCard`, the registry, and shared rendering primitives remain the preferred path for incremental convergence.
- Build-time or worker-side dependencies can still be adopted when justified, but the browser runtime stays framework-free.
- This decision should only be revisited if the product gains requirements that the current architecture demonstrably cannot satisfy.

---

## Alternatives Considered

- **React or Next.js rewrite**: rejected - high migration cost, duplicates runtime patterns, and does not solve the highest-priority risks first.
- **Framework only for new cards**: rejected - would create a permanent split runtime model inside a product that already needs convergence.
