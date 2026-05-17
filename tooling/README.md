# Shared Tooling Configs

> Version: 9.4.0 · Vendored into FamilyDashBoard for CI self-sufficiency.
> Source of truth: FamilyDashBoard `tooling/` (evolved beyond parent stubs) → sync back to `MyScripts/tooling/` for sibling adoption.

All TypeScript/JavaScript projects under `MyScripts/` share a single `node_modules/` install.
Each project extends these shared configs and adds only project-specific overrides.

## Sync Status (audited v14.22.0)

| Config              | FDB vendored | Parent `MyScripts/tooling/` | Status                   |
| ------------------- | ------------ | --------------------------- | ------------------------ |
| eslint/web-ts-app   | ✅ rich      | stub                        | **FDB → parent pending** |
| eslint/node-ts-app  | ✅ rich      | stub                        | **FDB → parent pending** |
| eslint/base.mjs     | ✗ (renamed)  | ✅ exists                   | merged into factory      |
| tsconfig/base-ts    | ✅ rich      | stub                        | **FDB → parent pending** |
| tsconfig/base-node  | ✅ match     | ✅ match                    | in sync ✓                |
| vitest/base         | ✅ rich      | stub (176 B)                | **FDB → parent pending** |
| vitest/happy-dom    | ✅ rich      | stub                        | **FDB → parent pending** |
| vitest/node         | ✅ rich      | stub                        | **FDB → parent pending** |
| ci/check.yml        | ✅ FDB only  | ✗                           | promote to parent        |
| mcp/                | ✅ FDB only  | ✗                           | promote to parent        |
| stylelint/          | ✗            | ✅ exists                   | vendor into FDB          |
| htmlhint/           | ✗            | ✅ exists                   | vendor into FDB          |
| markdownlint        | ✗            | ✅ exists                   | vendor into FDB          |
| playwright.base.ts  | ✗            | ✅ exists                   | vendor into FDB          |
| prettier.base.json  | ✗            | ✅ exists                   | vendor into FDB          |
| commitlint.base.cjs | ✗            | ✅ exists                   | vendor into FDB          |
| vite.base.ts        | ✗            | ✅ exists                   | vendor into FDB          |

**Drift status (v14.22.0)**: `eslint/web-ts-app.mjs` +491B and `vitest/base.mjs` +1250B since last baseline. Both changes are intentional (new rules + new vitest options). Baseline updated in `check-cross-project-gate.mjs`.

**Next action (V14-HARMONISE backlog)**: Copy FDB-enriched configs → parent (`MyScripts/tooling/`), then vendor remaining parent configs into FDB. Target: v15.0.0.

---

## Sibling Repo Adoption Guide

The following sibling projects under `MyScripts/` can adopt FamilyDashBoard's enriched presets instead of maintaining their own copies. No live publish is needed — all share a single `node_modules/` install at `MyScripts/`.

### BudgetManager (Node.js / Python CLI)

BudgetManager needs `tooling/eslint/node-ts-app.mjs` and `tooling/vitest/node.mjs` for its TypeScript modules.

**Step 1 — ESLint:**

```js
// BudgetManager/eslint.config.mjs
import { createNodeTsAppEslintConfig } from "../FamilyDashBoard/tooling/eslint/node-ts-app.mjs";
import { dirname, fileURLToPath } from "node:url";

export default createNodeTsAppEslintConfig({
  tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
  sourceFiles: ["src/**/*.ts"],
  testFiles: ["Tests/**/*.ts"],
});
```

**Step 2 — Vitest:**

```js
// BudgetManager/vitest.config.ts
import { defineConfig } from "vitest/config";
import base from "../FamilyDashBoard/tooling/vitest/node.mjs";

export default defineConfig({ ...base, test: { ...base.test, include: ["Tests/**/*.test.ts"] } });
```

### CrossTideWeb (Static browser app)

CrossTideWeb needs `tooling/ci/check.yml` for its CI pipeline.

**Step 1 — CI Workflow:**

```yaml
# CrossTideWeb/.github/workflows/ci.yml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          {
            node-version: "22",
            cache: "npm",
            cache-dependency-path: "../MyScripts/package-lock.json",
          }
      - run: npm install
        working-directory: ../MyScripts
      - uses: ./FamilyDashBoard/tooling/ci/check.yml
        with: { working-directory: ., run-build: "true", bundle-size-limit-kb: "200" }
```

### Wedding (Browser TypeScript app)

Wedding needs `tooling/eslint/web-ts-app.mjs` and `tooling/vitest/happy-dom.mjs`.

**Step 1 — ESLint:**

```js
// Wedding/eslint.config.mjs
import { createWebTsAppEslintConfig } from "../FamilyDashBoard/tooling/eslint/web-ts-app.mjs";
import { dirname, fileURLToPath } from "node:url";

export default createWebTsAppEslintConfig({
  tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
  sourceFiles: ["src/**/*.ts"],
  testFiles: ["tests/**/*.ts"],
});
```

**Step 2 — Vitest:**

```js
// Wedding/vitest.config.ts
import { defineConfig } from "vitest/config";
import happyDom from "../FamilyDashBoard/tooling/vitest/happy-dom.mjs";

export default defineConfig({
  ...happyDom,
  test: { ...happyDom.test, include: ["tests/**/*.test.ts"] },
});
```

### Version pinning

There is no npm publish; sibling repos reference `FamilyDashBoard/tooling/` by relative path. To pin to a known-good state, record the FamilyDashBoard git commit hash in the sibling repo's README under a `tooling-ref:` comment.

---

## Directory Layout

```text
tooling/
  ci/
    check.yml           ← Composite GitHub Actions action (typecheck → lint → test → build)
  eslint/
    web-ts-app.mjs      ← Browser TypeScript apps (FamilyDashBoard)
    node-ts-app.mjs     ← Node.js / Cloudflare Worker TypeScript apps
    js-browser-app.mjs  ← Vanilla JavaScript browser apps
  mcp/
    README.md           ← Shared MCP patterns, skills templates, agent templates
    base-mcp.json       ← Shared MCP server config (copy to .vscode/mcp.json)
  tsconfig/
    base-typescript.json ← Strict TypeScript base (browser / bundler)
    base-node.json       ← Node.js / Cloudflare Worker TypeScript base
  vitest/
    README.md           ← Preset API docs and usage guide
    base.mjs            ← Shared Vitest defaults (forks pool, mocks, timeouts)
    happy-dom.mjs       ← DOM test preset (extends base, environment: happy-dom)
    node.mjs            ← Node.js test preset (extends base, environment: node)
```

---

## CI Composite Action — `ci/check.yml`

A reusable [composite GitHub Actions action](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action)
that runs the full check suite in order: typecheck → lint → markdownlint → tests → build → bundle size.

### Usage

```yaml
# .github/workflows/ci.yml  (or any caller workflow)
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: "../MyScripts/package-lock.json"
      - run: npm install
        working-directory: ../MyScripts
      - uses: ./tooling/ci/check.yml
        with:
          working-directory: .
          run-build: "true"
          bundle-size-limit-kb: "300"
```

### Inputs

| Input                  | Default   | Description                                       |
| ---------------------- | --------- | ------------------------------------------------- |
| `node-version`         | `"22"`    | Node.js version (informational — caller installs) |
| `working-directory`    | `"."`     | Repo root where `package.json` lives              |
| `run-build`            | `"true"`  | Whether to run the Vite build step                |
| `build-command`        | `"build"` | npm script name for the build step                |
| `bundle-size-limit-kb` | `"300"`   | Max gzip bundle size in KB (`"0"` = skip)         |

### Outputs

| Output        | Description                               |
| ------------- | ----------------------------------------- |
| `test-result` | Vitest exit code (`0` = all tests passed) |

---

## Tool Versions

| Tool              | Version | Config file(s)                  |
| ----------------- | ------- | ------------------------------- |
| TypeScript        | ^6.0.3  | `tsconfig/base-typescript.json` |
| ESLint            | ^10.2.1 | `eslint/web-ts-app.mjs`         |
| typescript-eslint | ^8.59.0 | `eslint/web-ts-app.mjs`         |
| @eslint/js        | ^10.0.1 | all eslint factories            |
| Vitest            | ^4.1.5  | `vitest/base.mjs`               |
| happy-dom         | ^20.9.0 | `vitest/happy-dom.mjs`          |

---

## ESLint Factories

### `web-ts-app.mjs` — Browser TypeScript App

For projects with `src/**/*.ts` source, `tests/**/*.ts` tests, and an optional `sw.js` Service Worker.

```js
// eslint.config.mjs
import { createWebTsAppEslintConfig } from "./tooling/eslint/web-ts-app.mjs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default createWebTsAppEslintConfig({
  tsconfigRootDir: __dirname,
  sourceFiles: ["src/**/*.ts"],
  testFiles: ["tests/**/*.ts"],
  swFiles: ["sw.js"],
});
```

**Exports:**

- `createWebTsAppEslintConfig(options)` — returns a flat ESLint config array
- `browserGlobals` — browser globals object (reusable in other factories)
- `sharedRules` — core JS rules (reusable in other factories)

**Options:**

| Option            | Default                    | Description                          |
| ----------------- | -------------------------- | ------------------------------------ |
| `ignores`         | `["node_modules/**", ...]` | File patterns to ignore              |
| `sourceFiles`     | `["src/**/*.ts"]`          | TS source files to lint              |
| `sourceProject`   | `"./tsconfig.json"`        | tsconfig used for type-aware linting |
| `tsconfigRootDir` | _required_                 | Absolute path to project root        |
| `testFiles`       | `["tests/**/*.ts"]`        | Test files (relaxed rules)           |
| `swFiles`         | `["sw.js"]`                | Service Worker files (JS rules)      |
| `sourceRules`     | `{}`                       | Extra rules for source files         |
| `testRules`       | `{}`                       | Extra rules for test files           |

---

### `node-ts-app.mjs` — Node.js / Cloudflare Worker TypeScript App

For projects targeting Node.js or Cloudflare Workers (no DOM globals).

```js
// eslint.config.mjs (in worker/)
import { createNodeTsAppEslintConfig } from "../tooling/eslint/node-ts-app.mjs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default createNodeTsAppEslintConfig({
  tsconfigRootDir: __dirname,
  useCloudflareGlobals: true, // adds Request, Response, KV namespace globals
  sourceFiles: ["src/**/*.ts"],
  testFiles: ["tests/**/*.ts"],
});
```

**Options:** Same as `web-ts-app.mjs` plus:

| Option                 | Default | Description                              |
| ---------------------- | ------- | ---------------------------------------- |
| `useCloudflareGlobals` | `false` | Adds CF Worker globals (Request, caches) |

---

### `js-browser-app.mjs` — Vanilla JS Browser App

For JavaScript-only projects (no TypeScript). Used by legacy browser apps.

```js
// eslint.config.mjs
import { createJsBrowserAppEslintConfig } from "./tooling/eslint/js-browser-app.mjs";

export default createJsBrowserAppEslintConfig({
  sourceFiles: ["src/**/*.js"],
  testFiles: ["tests/**/*.js"],
});
```

---

## TypeScript Configs

### `base-typescript.json` — Browser / Bundler

Strict TypeScript for browser apps built with Vite (bundler module resolution).

```json
{
  "extends": "./tooling/tsconfig/base-typescript.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts"]
}
```

**Key settings:** `strict: true`, `noUnusedLocals`, `noUnusedParameters`,
`verbatimModuleSyntax`, `moduleResolution: bundler`, `noEmit: true`.

### `base-node.json` — Node.js / Cloudflare Worker

TypeScript for Node.js or Cloudflare Workers (NodeNext resolution, emits output).

```json
{
  "extends": "./tooling/tsconfig/base-node.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

**Key settings:** All strict settings from base + `esModuleInterop: true`, `outDir`, `declaration`.

---

## Vitest Presets

### `base.mjs` — Shared Defaults

Core Vitest settings: `forks` pool, `maxForks: 4`, `testTimeout: 10000`, `restoreMocks: true`.

```ts
// vitest.config.ts
import { sharedVitestTestConfig } from "./tooling/vitest/base.mjs";

test: {
  ...sharedVitestTestConfig,
  setupFiles: ["tests/setup.ts"],
}
```

### `happy-dom.mjs` — DOM Tests

Extends `base.mjs` and sets `environment: "happy-dom"`. Use for browser unit tests.

```ts
import { sharedHappyDomTestConfig } from "./tooling/vitest/happy-dom.mjs";

test: { ...sharedHappyDomTestConfig, setupFiles: ["tests/setup.ts"] }
```

### `node.mjs` — Node.js / Worker Tests

Extends `base.mjs` and sets `environment: "node"`. Use for pure TypeScript or Worker tests.

```ts
import { sharedNodeTestConfig } from "./tooling/vitest/node.mjs";

test: { ...sharedNodeTestConfig }
```

---

## Using in Other Projects

The shared configs resolve through Node's module walk-up from `MyScripts/node_modules/`.
Each workspace extends these files using relative paths:

```text
MyScripts/
  node_modules/         ← All devDependencies installed here
  tooling/              ← Shared configs (this directory)
  FamilyDashBoard/
    eslint.config.mjs   ← import from "../tooling/eslint/web-ts-app.mjs"
    tsconfig.json       ← extends "../tooling/tsconfig/base-typescript.json"
    vitest.config.ts    ← import from "./tooling/vitest/base.mjs"
  BudgetManager/
    eslint.config.mjs   ← import from "../tooling/eslint/node-ts-app.mjs"
    tsconfig.json       ← extends "../tooling/tsconfig/base-node.json"
  Worker/
    tsconfig.json       ← extends "../tooling/tsconfig/base-node.json"
```

---

## Keeping Configs in Sync

When a new tooling version is released:

1. Update the version in `MyScripts/package.json` devDependencies
2. Run `npm install` from `MyScripts/`
3. Update `tooling/` configs for any breaking changes
4. Bump the version comment at the top of each modified file
5. Update the **Tool Versions** table in this README
6. Run `npm run check` from each workspace to verify

---

## Cross-Project Registry (V14-HARMONISE)

All active `MyScripts/` workspaces that consume these shared configs.
This table is the source of truth for + V14-HARMONISE alignment work.

| Project                    | Package name       | Stack                                     | ESLint factory    | Vitest preset   | Status                                                             |
| -------------------------- | ------------------ | ----------------------------------------- | ----------------- | --------------- | ------------------------------------------------------------------ |
| **FamilyDashBoard**        | `family-dashboard` | Vite 8 · TS 6 · Browser PWA · Hebrew RTL  | `web-ts-app.mjs`  | `happy-dom.mjs` | ✅ v13.17                                                          |
| **BudgetManager**          | `budget-manager`   | Vite · TS · Browser PWA · Hebrew RTL      | `web-ts-app.mjs`  | `base.mjs`      | ⚠️ eslint+tsconfig ✅ — vitest uses `base.mjs` not `happy-dom.mjs` |
| **CrossTideWeb**           | `crosstide-web`    | Vite · TS · Stock monitoring dashboard    | ❌ custom         | ❌ custom       | ❌ custom eslint+vitest — needs migration                          |
| **Wedding**                | `wedding-manager`  | Vite · TS · RSVP/seating app · Hebrew RTL | ⚠️ `base.mjs`     | ❌ not present  | ⚠️ partial — using older base.mjs; no vitest config                |
| **FamilyDashBoard/worker** | (inlined)          | Cloudflare Worker · Hono · Valibot        | `node-ts-app.mjs` | `node.mjs`      | ✅ v13.17                                                          |

### Adding a New Project

1. Create your project directory under `MyScripts/`.
2. In `package.json` set `"type": "module"` — no `devDependencies` here (they live in `MyScripts/package.json`).
3. In `eslint.config.mjs` extend the appropriate factory (`web-ts-app.mjs` or `node-ts-app.mjs`).
4. In `tsconfig.json` extend `../tooling/tsconfig/base-typescript.json` (browser) or `../tooling/tsconfig/base-node.json` (Node/Worker).
5. In `vitest.config.ts` spread the matching preset (`sharedHappyDomTestConfig` or `sharedNodeTestConfig`).
6. Add the project to the **Cross-Project Registry** table above.
7. Run `npm run check` from the project root to verify the wiring is correct.

### CI Integration Pattern

Each project's CI workflow should follow the same gate order to prevent drift:

```yaml
steps:
  - name: Type check
    run: npx tsc --noEmit
  - name: Lint
    run: npx eslint src tests --max-warnings 0
  - name: Test
    run: npx vitest run
  - name: Build
    run: npx vite build
```

Use `actions/checkout@v4` and `actions/setup-node@v4`. Set `node-version` to the same LTS as `MyScripts/package.json`. Never install deps inside a project workspace — always `cd MyScripts && npm ci`.

### V14-HARMONISE Roadmap

V14 unification goal: all four sibling projects use the same shared preset versions with zero
per-project overrides to ESLint rules or TypeScript strictness settings.

**Planned steps (tracked in docs/ROADMAP.md):**

| Sprint | Task                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| 73     | Document cross-project registry + status column ← **done**                        |
| 168    | audit all three sibling repos; update registry with actual status ← **done**      |
| 74+    | Migrate BudgetManager vitest to `happy-dom.mjs` preset                            |
| 74+    | Migrate CrossTideWeb eslint to `web-ts-app.mjs` factory                           |
| 74+    | Migrate CrossTideWeb vitest to `happy-dom.mjs` preset                             |
| 74+    | Migrate Wedding eslint to `web-ts-app.mjs` factory                                |
| 74+    | Add `vitest.config.ts` to Wedding using `happy-dom.mjs` preset                    |
| V14    | Bump all four repos to `tooling@v14`, single `npm install` pass                   |
| V14    | Enforce `tooling-version` field in each project's `package.json`                  |
| V14    | CI gate: fail if `tooling-version` in any project doesn't match `tooling/VERSION` |

**Blocking constraint:** sibling repos are not submodules — they exist as peer directories under
`MyScripts/` on the developer machine only. V14 audit must be done locally; CI enforces only
`FamilyDashBoard/` and its `worker/` inlined sub-project.

---

### Sibling Repo Audit Findings

Audited 2026-05. Three sibling repos under `MyScripts/` assessed against shared preset baseline.

#### BudgetManager — ⚠️ Partially Aligned

| Config   | Status | Notes                                                                                                                                                                              |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint   | ✅     | `createWebTsAppEslintConfig` from `../tooling/eslint/web-ts-app.mjs`                                                                                                               |
| tsconfig | ✅     | Extends `../tooling/tsconfig/base-typescript.json`                                                                                                                                 |
| Vitest   | ⚠️     | Uses `sharedVitestTestConfig` from `../tooling/vitest/base.mjs` — should switch to `sharedHappyDomTestConfig` from `happy-dom.mjs` (sets `environment: "happy-dom"` automatically) |

**Migration step:** In `vitest.config.ts` replace import of `base.mjs` → `happy-dom.mjs`
and drop the manual `environment: "node"` override if tests are browser-targeted.

---

#### CrossTideWeb — ❌ Not Aligned

| Config   | Status | Notes                                                                                                  |
| -------- | ------ | ------------------------------------------------------------------------------------------------------ |
| ESLint   | ❌     | Custom flat config using `@eslint/js` + `typescript-eslint` directly — no `createWebTsAppEslintConfig` |
| tsconfig | ⚠️     | Uses its own base settings, not extending shared `base-typescript.json`                                |
| Vitest   | ❌     | Custom config — no shared preset spread                                                                |

**Migration steps:**

1. Replace `eslint.config.mjs` with `createWebTsAppEslintConfig({ tsconfigRootDir, ... })`.
2. Add `"extends": "../tooling/tsconfig/base-typescript.json"` to `tsconfig.json`.
3. Spread `sharedHappyDomTestConfig` (or `sharedNodeTestConfig`) in `vitest.config.ts`.

---

#### Wedding — ⚠️ Partially Aligned

| Config   | Status  | Notes                                                                                                                          |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ESLint   | ⚠️      | Tries to import `../tooling/eslint/base.mjs` (older file) with try/catch fallback — should migrate to `web-ts-app.mjs` factory |
| tsconfig | Unknown | Not audited yet                                                                                                                |
| Vitest   | ❌      | No `vitest.config.ts` present                                                                                                  |

**Migration steps:**

1. Replace `eslint.config.mjs` with `createWebTsAppEslintConfig({ tsconfigRootDir, ... })` — no try/catch needed.
2. Create `vitest.config.ts` spreading `sharedHappyDomTestConfig`.
3. Update tsconfig to extend `../tooling/tsconfig/base-typescript.json`.
