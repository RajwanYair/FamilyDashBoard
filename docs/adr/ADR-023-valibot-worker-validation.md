# ADR-023: Replace Zod with Valibot for Worker Schema Validation

**Date:** 2026-04-23
**Status:** Accepted
**Deciders:** Project maintainer
**Context:** V12-MODERNISE-7

---

## Context

The Cloudflare Worker uses Zod 3.24 to validate upstream API responses in
`worker/src/utils/schemas.ts`. Zod is the only runtime dependency of the Worker.

Key constraints for a Cloudflare Worker dependency:

| Metric | Zod 3.24 | Valibot 1.x |
| --- | --- | --- |
| Bundle size (minified + gzip) | ~14 KB | ~1.5 KB |
| Tree-shakeable | No | Yes |
| TypeScript 6 / ESM | Yes | Yes |
| Validation semantics | Same (parse/safeParse) | Same |
| Bundle cost per unused schema | Full Zod bundle | Zero (tree-shaken) |

**Valibot 1.0** (stable release) uses a modular API where each schema builder
(`v.object`, `v.string`, `v.array`, etc.) is a standalone export. Only the
schemas actually imported appear in the final Worker bundle. Zod ships as one
monolithic bundle regardless of which APIs are used.

For a Cloudflare Worker with a 1 MB compressed-size limit, saving ~12.5 KB on
the validation library is a meaningful improvement, particularly as the schema
surface grows.

---

## Decision

**Replace Zod with Valibot 1.x in `worker/src/utils/schemas.ts` and
`worker/src/routes/errors.ts`.** Remove Zod from `worker/package.json`.

The `safeParse` helper wrapper is rewritten to accept a Valibot `BaseSchema`
and delegate to Valibot's `v.safeParse(schema, data)`.

---

## Migration Map

| Zod | Valibot 1.x |
| --- | --- |
| `z.object({}).passthrough()` | `v.looseObject({})` |
| `z.string()` | `v.string()` |
| `z.number()` | `v.number()` |
| `z.number().finite()` | `v.pipe(v.number(), v.finite())` |
| `z.number().optional()` | `v.optional(v.number())` |
| `z.array(X)` | `v.array(X)` |
| `z.array(X).min(1)` | `v.pipe(v.array(X), v.minLength(1))` |
| `z.null().optional()` | `v.optional(v.null_())` |
| `z.record(z.string(), z.number())` | `v.record(v.string(), v.number())` |
| `z.union([A, B])` | `v.union([A, B])` |
| `z.string().refine(fn, msg)` | `v.pipe(v.string(), v.check(fn, msg))` |
| `z.unknown()` | `v.unknown()` |
| `schema.safeParse(data)` | `v.safeParse(schema, data)` |
| `result.success` | `result.success` |
| `result.data` | `result.output` |
| `result.error.issues[].message` | `result.issues[].message` |
| `z.infer<typeof S>` | `v.InferOutput<typeof S>` |

### Passthrough vs looseObject

Zod's `.passthrough()` preserves extra object keys. Valibot's `v.object()`
**strips** unknown keys by default (like Zod's `.strip()`). The Valibot
equivalent of `.passthrough()` is `v.looseObject()`.

Since all upstream API schemas use `.passthrough()` to tolerate upstream
additions, all `v.object({})` calls become `v.looseObject({})`.

---

## Consequences

**Good:**

- Worker bundle shrinks by ~12.5 KB gzip (~87% reduction on validation).
- Full tree-shaking: only imported schema builders appear in the bundle.
- Valibot 1.x has a stable API with no breaking changes planned until v2.

**Neutral:**

- `result.data` → `result.output` in the `safeParse` wrapper (one-line change).
- `z.infer` → `v.InferOutput` in type annotations.

**Bad:**

- None identified.

---

## References

- Valibot docs: <https://valibot.dev/guides/introduction/>
- Valibot v1 migration: <https://valibot.dev/guides/migrate-to-v1/>
- ADR-011 (worker normalization contract) — consumer contracts are unchanged
- ADR-012 (async provider adapter) — unaffected
