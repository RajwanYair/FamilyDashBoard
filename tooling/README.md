# Shared Tooling Configs

> Version: 9.2.0 · Vendored into FamilyDashBoard for CI self-sufficiency.
> Source of truth: `MyScripts/tooling/` — keep files in sync when upgrading tools.

All TypeScript/JavaScript projects under `MyScripts/` share a single `node_modules/` install.
Each project extends these shared configs and adds only project-specific overrides.

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
  tsconfig/
    base-typescript.json ← Strict TypeScript base (browser / bundler)
    base-node.json       ← Node.js / Cloudflare Worker TypeScript base
  vitest/
    README.md           ← Preset API docs and usage guide (Sprint 157)
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
This table is the source of truth for Sprint 73+ V14-HARMONISE alignment work.

| Project                    | Package name       | Stack                                     | ESLint factory    | Vitest preset   | Status         |
| -------------------------- | ------------------ | ----------------------------------------- | ----------------- | --------------- | -------------- |
| **FamilyDashBoard**        | `family-dashboard` | Vite 8 · TS 6 · Browser PWA · Hebrew RTL  | `web-ts-app.mjs`  | `happy-dom.mjs` | ✅ v13.6       |
| **BudgetManager**          | `budget-manager`   | Vite · TS · Browser PWA · Hebrew RTL      | `web-ts-app.mjs`  | `happy-dom.mjs` | ⏳ needs audit |
| **CrossTideWeb**           | `crosstide-web`    | Vite · TS · Stock monitoring dashboard    | `web-ts-app.mjs`  | `happy-dom.mjs` | ⏳ needs audit |
| **Wedding**                | `wedding-manager`  | Vite · TS · RSVP/seating app · Hebrew RTL | `web-ts-app.mjs`  | `happy-dom.mjs` | ⏳ needs audit |
| **FamilyDashBoard/worker** | (inlined)          | Cloudflare Worker · Hono · Valibot        | `node-ts-app.mjs` | `node.mjs`      | ✅ v13.6       |

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
| 74+    | Audit BudgetManager eslint config vs `web-ts-app.mjs`                             |
| 74+    | Audit CrossTideWeb tsconfig vs `base-typescript.json`                             |
| 74+    | Audit Wedding tsconfig + eslint vs shared presets                                 |
| V14    | Bump all four repos to `tooling@v14`, single `npm install` pass                   |
| V14    | Enforce `tooling-version` field in each project's `package.json`                  |
| V14    | CI gate: fail if `tooling-version` in any project doesn't match `tooling/VERSION` |

**Blocking constraint:** sibling repos are not submodules — they exist as peer directories under
`MyScripts/` on the developer machine only. V14 audit must be done locally; CI enforces only
`FamilyDashBoard/` and its `worker/` inlined sub-project.
