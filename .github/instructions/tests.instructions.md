---
applyTo: "tests/**"
description: "Use when: writing or reviewing test files under tests/. Vitest patterns, mock conventions, and FamilyDashBoard test rules."
---

# Test Instructions — FamilyDashBoard v13.32.0

> Apply these rules to every file under `tests/`. See `copilot-instructions.md` for cross-cutting project rules.
> Baseline: 6067 / 196 suites / 0 failures · Coverage thresholds: 93.0 / 84.6 / 92.0 / 94.5 (statements / branches / functions / lines).

## Test Framework

- **Vitest 4** with `happy-dom` environment, `globals: true`, pool `forks`
- Test files: `tests/**/*.test.ts` — unit under `tests/unit/`, integration under `tests/integration/`
- Run: `npx vitest run` (all) · `npx vitest run <path>` (single file)
- Config: `vitest.config.ts` — do NOT add test-only settings to `vite.config.ts`

## Shared Test Helpers

Use helpers from `@tests/helpers` (alias for `tests/unit/helpers/`):

```ts
import {
  setCardDOM,
  cleanupDOM,
  makeCacheMocks,
  makeFetchMocks,
  withFakeTimers,
} from "@tests/helpers";
```

| Helper                        | Purpose                                           |
| ----------------------------- | ------------------------------------------------- |
| `setCardDOM(opts)`            | Set up a minimal card shell in `document.body`    |
| `setDOM(html)`                | Set full custom HTML on `document.body`           |
| `cleanupDOM()`                | Clear body in `afterEach`                         |
| `flushAsync(n?)`              | Flush N microtask ticks                           |
| `getEl(selector)`             | Query-with-throw (no null assertions)             |
| `getById(id)`                 | `#id` query-with-throw                            |
| `makeCacheMocks()`            | `{ cGet, cGetStale, cSet, cEvict }` all `vi.fn()` |
| `makeFetchMocks()`            | `{ fetchWithTimeout, … }` all `vi.fn()`           |
| `makeConfigMocks(overrides?)` | `loadConfig` → `DEFAULT_TEST_CONFIG`              |
| `makeDiagMocks()`             | `{ diagLog, diagError }` vi.fn()                  |
| `withFakeTimers()`            | Returns `{ advance, restore }`                    |
| `setFakeDate(date)`           | Sets system clock (requires fake timers)          |

## Mocking Conventions

- Use `vi.mock("@/core/cache", () => makeCacheMocks())` — not manual mock objects
- Always call `vi.resetAllMocks()` or specific `vi.clearAllMocks()` in `afterEach`
- Prefer `_resetForTest()` over `vi.resetModules()` for stateful core modules:
  - `import { _resetForTest } from "@/core/cache"` → `afterEach(_resetForTest)`
  - `import { _resetForTest } from "@/core/state"` → `afterEach(_resetForTest)`
- Never import real fetch/network code in unit tests — always mock `@/core/fetch`

## Cache Test Rules

- `cGet()` and `cGetStale()` return `null` (not `undefined`) on miss — check `!== null`
- Mock return value for a cache hit: `vi.mocked(cGet).mockReturnValue(fixture)`
- Mock return value for a cache miss: `vi.mocked(cGet).mockReturnValue(null)` (this is the default from `makeCacheMocks()`)
- For async cache (`cGetAsync` / `cGetStaleAsync`): mock with `vi.fn().mockResolvedValue(fixture)` for hits, `vi.fn().mockResolvedValue(null)` for misses
- For async cache writes (`cSetAsync`): mock with `vi.fn().mockResolvedValue(undefined)`
- After calling a function that uses async cache, drain microtasks: `for (let i = 0; i < 20; i++) await Promise.resolve()`
- Async cache mock factory: include both sync and async variants in `vi.mock("@/core/cache", () => ({ cGet: vi.fn().mockReturnValue(null), cGetStale: vi.fn().mockReturnValue(null), cSet: vi.fn(), cGetAsync: vi.fn().mockResolvedValue(null), cGetStaleAsync: vi.fn().mockResolvedValue(null), cSetAsync: vi.fn().mockResolvedValue(undefined) }))`

## DOM Tests

- Call `setCardDOM({ bodyId: "weather-body" })` in `beforeEach`, `cleanupDOM()` in `afterEach`
- Do NOT use `document.body.innerHTML = ""` directly — use `cleanupDOM()`
- Use `getById("element-id")` instead of `document.getElementById("id")!`

## Timer Tests

```ts
const timers = withFakeTimers();
afterEach(timers.restore);

it("refreshes after 5 minutes", async () => {
  await timers.advance(5 * 60_000);
  expect(loadSpy).toHaveBeenCalledTimes(2);
});
```

- Only use fake timers when a test genuinely advances time
- Always call `timers.restore()` in `afterEach` — never leave fake timers active across tests

## Async Tests

- Use `await flushAsync()` (50 microtasks) to let Promise chains settle without advancing the clock
- Use `await vi.runAllTimersAsync()` when a specific timer needs to fire
- Do NOT rely on `setTimeout(fn, 0)` in tests — it's environment-dependent

## What NOT to Do

- No `vi.resetModules()` inside `beforeEach` of high-frequency test suites (causes transform timeout)
- No `.only` or `.skip` committed to `main`
- No hardcoded fixture data duplicated across test files — extract to `tests/unit/fixtures/`
- No test that `expect`s on `innerHTML` — use `textContent` or `getAttribute`
- No `any` in test files — use the shared mock types from `@tests/helpers/mocks`
- No `console.log` in committed tests — remove debugging output before committing

## Coverage Targets

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 93.0%     |
| Branches   | 84.6%     |
| Functions  | 92.0%     |
| Lines      | 94.5%     |

Run `npx vitest run --coverage` to check. CI enforces these thresholds; PRs that lower them will fail.

## Property-Based Testing (fast-check)

When using `fast-check` for property tests:

- Use `fc.double()` not `fc.float()` for numeric arbitraries (more range, no NaN pitfalls)
- Use `.filter((v) => v.trim().length > 0)` on string arbitraries to exclude whitespace-only inputs
- Pair `fc.string({ minLength: 1 })` with `.filter((t) => t.trim().length > 0)` — `minLength` alone can produce whitespace-only strings
- Use `fc.oneof()` over `fc.frequency()` when weights don't matter
- Keep `numRuns` at the default (100) unless you have a specific reason to increase it

## Worker Route Tests (Stream W.5–W.8)

- Worker tests live in `tests/unit/worker/worker.test.ts` — they run in Node (no Miniflare)
- Use `vi.spyOn(globalThis, "fetch")` to mock upstream calls (not `vi.mock`)
- Restore mocks in `afterEach(() => { vi.restoreAllMocks(); })`
- For Zod schema tests: use `safeParse(Schema, data)` directly and check `.ok === true/false`
- For route handler tests: call `handleFoo(url)` directly and assert `res.status`
- URLs in `handleNews` tests must use an origin from `ALLOWED_NEWS_ORIGINS` (e.g. `rss.ynet.co.il`)
- NewsRssSchema: valid RSS requires `<channel>` + `<item>`; valid Atom requires `<feed>` + `<entry>`
- Worker typecheck (separate from main tscheck): `npx tsc --project worker/tsconfig.json --noEmit`
