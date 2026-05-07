# ADR-026: Replace Hand-Written Router with Hono

**Date:** 2026-04-23
**Status:** Accepted
**Deciders:** Project maintainer
**Context:** ---

## Context

`worker/src/index.ts` currently implements routing as an `if/else` chain on
`url.pathname`. After 16 routes, this chain has grown hard to navigate and
lacks type-safe request/response helpers. The CORS preflight, rate-limiting,
and request-logging middleware are wired by hand before and after the chain.

**Hono** is a lightweight web framework built for edge runtimes (Cloudflare
Workers, Deno Deploy, Bun). Its design goals match this project's constraints:

| Metric                        | Hand-written router  | Hono 4.x                                |
| ----------------------------- | -------------------- | --------------------------------------- |
| Bundle size (gzip)            | ~0 KB overhead       | ~12 KB (full) / ~3 KB (router only)     |
| Type-safe `c.req`, `c.json()` | No                   | Yes                                     |
| Middleware system             | Manual pre/post      | `app.use()`                             |
| Route matching                | String equality only | Pattern + param extraction              |
| Cloudflare Workers support    | Native               | First-class (`hono/cloudflare-workers`) |
| Bindings / env access         | `env` param          | `c.env`                                 |

Hono replaces the hand-written `if/else` chain while keeping all existing
route handler functions in `routes/*.ts` unchanged. The Hono app becomes a
thin orchestration layer.

---

## Decision

**Replace the hand-written router in `worker/src/index.ts` with a Hono app.**

- Install `hono@^4.7.0` as a runtime dependency.
- Use `hono/cloudflare-workers` or plain `Hono` with the `Env` bindings type.
- Keep all route handler functions in `routes/data.ts` and `routes/feeds.ts`
  unchanged — Hono is purely a routing/middleware shell.
- Retain the `scheduled` handler from (ADR-019 pre-warm).
- CORS, rate-limiting, and request-logging middleware are re-wired via
  `app.use('*', ...)` instead of inline pre/post checks.

---

## Implementation

```ts
import { Hono } from "hono";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

// Middleware: CORS, rate-limit, logging
app.use("*", cors());
app.use("*", rateLimitMiddleware());

// Routes
app.get("/api/weather", (c) => handleWeather(c.req.raw, c.env));
app.get("/api/currency", (c) => handleCurrency(c.env));
// ...

export default {
  fetch: app.fetch,
  scheduled(_event, env) { ... },
};
```

---

## Consequences

**Good:**

- Cleaner, more readable route table.
- Type-safe `c.env` bindings — no need to thread `env` through each handler.
- Middleware chain is declarative.
- Future route params (e.g. `/api/stocks/:sym`) work without string parsing.

**Neutral:**

- Adds ~12 KB gzip to Worker bundle. Combined with Valibot (~1.5 KB),
  total runtime deps remain well under 20 KB — a fraction of the previous
  Zod-only approach.
- Existing route handlers don't need to change signatures; they still accept
  `(url: URL, env: Env) => Promise<Response>`.

**Bad:**

- None identified.

---

## References

- Hono docs: <https://hono.dev/>
- ADR-023 (Valibot) — companion modernisation
