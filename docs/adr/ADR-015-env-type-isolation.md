# ADR-015: Env Type Isolation in `worker/src/types.ts`

**Date:** 2026-07-14
**Status:** Accepted
**Deciders:** Project maintainer
**Implements:** ADR-013 (KV Stale Cache Strategy)

---

## Context

The Cloudflare Worker's `Env` interface (binding names for KV, secrets, and
environment variables) was originally defined inline inside
`worker/src/index.ts`. When ADR-013 required passing `env` into route handlers
(`handleStocks`, `handleAlerts`, `handleCrypto`), those handlers needed to
import `Env` from their caller.

A naïve import `import type { Env } from "../index"` creates a **circular
dependency**: `index.ts` imports route handlers from `routes/feeds.ts`, and
`routes/feeds.ts` would import `Env` from `index.ts`. While TypeScript resolves
type-only circular imports at compile time, they are a code smell, fail
certain bundlers, and confuse dependency analysers.

---

## Decision

**Extract `Env` (and any other shared worker interfaces) into
`worker/src/types.ts`. Both `index.ts` and route modules import from `types.ts`.**

```ts
// worker/src/types.ts
export interface Env {
  ENVIRONMENT: string;
  CACHE_KV: KVNamespace;
}
```

`index.ts` re-exports `Env` for backward compatibility with test files that
already import it from `index`:

```ts
// worker/src/index.ts
import type { Env } from "./types";
export type { Env }; // backward-compat re-export
```

Route handlers import directly from `../types`:

```ts
// worker/src/routes/feeds.ts
import type { Env } from "../types";
```

---

## Rationale

1. **No circular dependencies** — `types.ts` imports nothing from the worker
   source tree; the dependency graph is a DAG.
2. **Single source of truth for bindings** — adding a new KV namespace,
   D1 database, or secret requires editing one file.
3. **Test compatibility** — the re-export from `index.ts` means no test rewrites
   are needed; both import paths resolve to the same interface.

---

## Consequences

- `worker/src/types.ts` is the canonical location for all Cloudflare binding
  types. Do not redefine `Env` elsewhere.
- New worker utilities (e.g., `utils/kv.ts`) must import `Env` from `../types`,
  never from `../index`.
- The re-export in `index.ts` should be kept until all test imports are
  migrated to `../types`.

---

## Alternatives Considered

| Option                                               | Reason rejected                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Keep `Env` in `index.ts`, use `import type` circular | Works in TS but bad practice; confuses bundlers                                    |
| Inline `Env` in each route file                      | Duplication; drift risk when adding new bindings                                   |
| Use `typeof env` inference from wrangler types       | Requires `@cloudflare/workers-types` global which may not be available in test env |
