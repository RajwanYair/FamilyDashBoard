# ADR-002: Zero Client-Side Runtime Dependencies

**Date:** 2026-04-17
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard is deployed to GitHub Pages as a static bundle. The client browser loads `dist/index.html` and one IIFE JavaScript bundle. There is no server-side rendering, no Node runtime, and no package manager at runtime.

The project policy has been "zero dependencies" since v4. As the codebase grew into a TypeScript modular app (v6+), this policy was reconsidered.

---

## Decision

**Maintain zero client-side runtime JavaScript dependencies.**

The `FamilyDashBoard/package.json` has no `dependencies` field. Only dev tooling (TypeScript, Vite, Vitest, ESLint) lives in the parent `MyScripts/package.json`. No third-party runtime library is shipped to the browser.

---

## Rationale

1. **Startup performance** — The bundle is fully under our control. No third-party code inflates the gzip size, no tree-shaking gaps, no dead code from unused library features.
2. **Security surface** — Each npm dependency is a potential supply-chain attack vector. Zero dependencies means zero upstream risk for the runtime bundle.
3. **Upgrade simplicity** — No `npm audit` warnings for transitive runtime dependencies. No breaking changes from upstream API shifts.
4. **TV display stability** — The dashboard runs on an always-on display. Dependency rot or yanked packages cannot break a deployed version.
5. **Learning and legibility** — The code is readable without knowing library internals. Standard Web APIs (Fetch, IDB, PerformanceObserver, CustomEvent) are used directly.

---

## Scope

This policy applies to the **client bundle** only.

Exceptions permitted:

- **Worker-side dependencies** (Cloudflare Worker) — high-value validation or schema packages (e.g. Zod) are acceptable because the worker is a different runtime context with different supply-chain risk tolerance.
- **Build-time dev dependencies** — TypeScript, Vite, Vitest, ESLint, and associated plugins are dev-only tools; they are not shipped to the browser.

---

## Consequences

- Custom utilities for caching, fetching, state management, and routing are written in-house.
- The code surface is larger than it would be with a library (e.g. React Query for caching), but it is simpler to control, audit, and deploy.
- Any proposed client-side dependency must submit an ADR and demonstrate that the benefit cannot be replicated with reasonable in-house code.

---

## Alternatives Considered

- **Use a lightweight framework (Preact, Solid)**: rejected — adds ~7 KB gzip minimum, fragments the team's mental model, complicates the IIFE build target.
- **Use a utility library (lodash, date-fns)**: rejected — the subset used does not justify the bundle cost; utilities are written as needed, tested, and remain in `src/core/utils.ts`.
