---
applyTo: "src/**/*.ts"
description: "Use when: writing or reviewing TypeScript source files in src/. Rules for types, async, modules, and FamilyDashBoard conventions."
---

# TypeScript Instructions — FamilyDashBoard v13.14.0

> Apply these rules to every `.ts` file under `src/`. Rules in `copilot-instructions.md` take precedence for cross-cutting concerns.

## Strict Mode Baseline

- Target: `ES2022` — use `Array.at()`, `Object.hasOwn()`, `structuredClone()`, `crypto.randomUUID()` freely
- Always use `"verbatimModuleSyntax"` — import types with `import type { … }`
- Avoid `any`. Use `unknown` at system boundaries; narrow immediately with type guards
- Never use `@ts-ignore` or `@ts-expect-error` without a comment explaining the root cause
- Never silence with `// eslint-disable` — fix the underlying issue instead

## Module & Import Conventions

- Use `@/` path alias for all `src/` imports: `import { cGet } from "@/core/cache"`
- Use `import type` for type-only imports: `import type { DashboardConfig } from "@/types/config"`
- Never use bare relative `../../../` paths across module layers
- Export order: types first, then values, then helpers

## Async & Error Handling

- All async loaders: guard with `if (!_pageVisible) return;` at the top of the function
- All fetches: `try/catch` + proxy fallback (`PROXIES`) + `diagLog()`
- Use `await` + `safeLoad()` — no raw `.then().catch()` chains in loader functions
- Never nest `try/catch` more than 2 levels — extract a helper
- `cGet()`/`cGetStale()` return `null` (not `undefined`) on cache miss — check `!== null`

## DOM Access Patterns

- DOM refs go in the `el` object at module scope — no repeated `getElementById` calls
- Use `textContent` not `innerHTML` for user-visible text — never interpolate unsanitized data
- New overlays: use `<dialog>` with `.showModal()` / `.close()` — not `<div>` visibility toggling
- Validate that DOM element IDs exist in `index.html` before writing any loader code (rule 14)

## Naming Conventions

| Context              | Convention                                                  |
| -------------------- | ----------------------------------------------------------- | -------------------------- |
| Module-private state | `_camelCase` prefix                                         |
| Test-only exports    | `_resetForTest` / `_*ForTest` pattern                       |
| Config toggle unit   | `\_tempUnit = 'C'                                           | 'F'`(not`\_useFahrenheit`) |
| Cache reads          | `cGet(key, ttl)` / `cGetStale(key)` / `cGetAsync(key, ttl)` |
| Cache writes         | `cSet(key, data)`                                           |
| Sync indicator       | `setSync(id, state)` (not `setSyncStatus`)                  |
| Card loader          | `loadAllX()` (not `loadX()`)                                |

## Type Guards

- Write a named type guard function (`isXyzResponse`) for every external API response type
- Place guards in `src/types/api.ts` next to the interface definition
- Guard pattern: `function isObj(v): v is Record<string, unknown>` + field-by-field checks
- Never cast `as T` directly on `JSON.parse()` output — always validate first

## Card Architecture

- Cards registered via `registerCard()` in `src/core/card-registry.ts`
- New cards extend `FdbCard` (`src/core/fdb-card.ts`) — do not use old `initX()` file-scoped pattern for new cards
- `data-card-id` must match the registry ID exactly (e.g. `"hebrew-cal"`, `"calendar"`, `"motivation"`)
- Card content layout: rectangular tile/grid blocks — never plain vertical line lists (rule 25)

## Cache & State Access

- Dual-layer cache: in-memory `Map` (fast) + `localStorage` (persistent) + IDB (L2 async)
- All API data: `cSet`/`cGet`/`cGetStale` for sync reads; `cSetAsync`/`cGetAsync`/`cGetStaleAsync` for async IDB writes
- Card loaders use `await cGetAsync(key, ttl)` for fresh reads, `await cGetStaleAsync(key)` for stale reads, `await cSetAsync(key, data)` for writes
- `cGetAsync()` / `cGetStaleAsync()` return `null` (not `undefined`) on cache miss — check `!== null`
- Never write to `localStorage` directly from a card — always use the cache API
- Reactive state singleton: `state.get()` / `state.set()` / `state.on()` — no global variables for UI state
- `state._resetForTest()` / `cache._resetForTest()` in test `afterEach` — not `vi.resetModules()`

## What NOT to Do

- No `console.log` / `console.warn` / `console.error` in `src/` — use `diagLog()` from `@/core/diag`
- No hardcoded colors — CSS custom properties only
- No `self.skipWaiting()` in SW install handler — only via `SKIP_WAITING` message
- No external JS/CSS libraries — zero runtime dependencies
- No `devDependencies` in `FamilyDashBoard/package.json` — all go in `MyScripts/package.json`

## Service Worker (sw.ts — Stream SW.4)

- **Canonical source**: `sw.ts` — compiled to `dist/sw.js` via `scripts/build-sw.mjs` during `vite build`
- **Typed global**: `const sw = self as unknown as ServiceWorkerGlobalScope;` — use `sw.*` everywhere (not `self.*`)
- **Version injection**: `declare const __APP_VERSION__: string;` at top — never hardcode a version string in sw.ts
- **SyncEvent**: declared inline — `interface SyncEvent extends ExtendableEvent { readonly tag: string; readonly lastChance: boolean; }`
- **tsconfig**: `tsconfig.sw.json` uses `lib: ["ES2020","WebWorker"]` — run `npm run typecheck:sw` to verify
- **Build script**: `node scripts/build-sw.mjs <version>` — uses TypeScript `transpileModule` from parent `node_modules`
- Never use `esbuild` directly — it is embedded in Vite and not available as a standalone package in this monorepo

## Worker Zod Schemas (worker/src/utils/schemas.ts — Streams W.5–W.8)

- All worker route handlers validate upstream responses with `safeParse(Schema, data)` before forwarding
- Schema naming: `FooBarSchema` — Zod `z.object({...}).passthrough()` for JSON; `z.string().refine(...)` for text
- `safeParse()` returns `{ ok: true, data }` or `{ ok: false, error }` — never throws
- Return HTTP 502 with `{ error: "...", detail: validated.error }` when validation fails
- News/RSS: use `NewsRssSchema` (structural XML marker check: `<channel>+<item>` or `<feed>+<entry>`)
- Worker typecheck: `npx tsc --project worker/tsconfig.json --noEmit`
