# Shared Vitest Presets

> Vendored into this repo for CI self-sufficiency.
> Source of truth: `MyScripts/tooling/vitest/`
> Keep files in sync when upgrading Vitest.

These three presets are the building blocks for every `vitest.config.ts` under
`MyScripts/`. Each exports a plain object that is spread into `defineConfig`.

---

## Files

| File | Exports | Purpose |
| --- | --- | --- |
| `base.mjs` | `sharedVitestPoolConfig`, `sharedVitestTestConfig` | Core defaults used by all presets |
| `happy-dom.mjs` | `sharedHappyDomTestConfig` | DOM-heavy browser unit tests |
| `node.mjs` | `sharedNodeTestConfig` | Server-side / Worker / pure-TS unit tests |

---

## `base.mjs` — Core Defaults

### `sharedVitestPoolConfig`

Spread at **top level** of `defineConfig` (not inside `test:`):

```ts
import { sharedVitestPoolConfig } from "./tooling/vitest/base.mjs";

export default defineConfig({
  ...sharedVitestPoolConfig,   // pool + poolOptions go here
  test: { ... },
});
```

| Option | Value | Rationale |
| --- | --- | --- |
| `pool` | `"forks"` | Avoids happy-dom global-state contamination between suites |
| `poolOptions.forks.maxForks` | `min(cpuCount, 8)` | Caps parallelism to avoid excessive fork overhead |
| `poolOptions.forks.minForks` | `max(2, cpuCount / 2)` | Always uses at least 2 forks for small machines |
| `poolOptions.forks.isolate` | `false` | Re-uses module registry within a fork; per-suite isolation is handled by `beforeEach`/`afterEach` |

### `sharedVitestTestConfig`

Spread inside the `test:` block:

```ts
test: {
  ...sharedVitestTestConfig,
  // project-specific overrides follow
  setupFiles: ["./tests/setup.ts"],
},
```

| Option | Value | Notes |
| --- | --- | --- |
| `environment` | `"happy-dom"` | Default; overridden by `node.mjs` preset |
| `globals` | `true` | `describe`/`it`/`expect` available without import |
| `testTimeout` | `10 000 ms` | Generous for integration tests that hit IDB/LS |
| `hookTimeout` | `10 000 ms` | Matches `testTimeout` |
| `restoreMocks` | `true` | Auto-restores `vi.spyOn` mocks after each test |

---

## `happy-dom.mjs` — DOM Test Preset

Extends `sharedVitestTestConfig` with `environment: "happy-dom"` (same as the base,
but explicit so consumers don't inherit a future base change silently).

```ts
import { sharedHappyDomTestConfig } from "./tooling/vitest/happy-dom.mjs";

export default defineConfig({
  ...sharedVitestPoolConfig,
  test: {
    ...sharedHappyDomTestConfig,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

**Use for**: Card loaders, DOM manipulation, UI component tests, cache tests that
touch `localStorage`.

---

## `node.mjs` — Node / Worker Preset

Extends `sharedVitestTestConfig` with `environment: "node"`. No DOM globals.

```ts
import { sharedNodeTestConfig } from "./tooling/vitest/node.mjs";

export default defineConfig({
  ...sharedVitestPoolConfig,
  test: {
    ...sharedNodeTestConfig,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

**Use for**: Cloudflare Worker handlers, RSS parsers, pure-TypeScript utilities,
any test that must not have a DOM environment.

---

## Adding a New Preset

1. Create `tooling/vitest/<name>.mjs` that imports from `base.mjs`.
2. Export a single config object named `shared<Name>TestConfig`.
3. Add an entry to the table at the top of this README.
4. Update `tooling/README.md` to reflect the new file.
5. Sync the file to `MyScripts/tooling/vitest/` (source of truth).

---

## Version History

| Preset version | Vitest | Change |
| --- | --- | --- |
| Sprint 157 / v13.17.0 | 4.x | Initial README — documents `base.mjs`, `happy-dom.mjs`, `node.mjs` |
| Sprint 116 | 2.x | `pool: "forks"` introduced for happy-dom isolation |
| Sprint 101 | 1.x | `sharedVitestTestConfig` extracted to base |
