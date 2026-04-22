# Shared Tooling Configs

> Version: 9.2.0 · Vendored into FamilyDashBoard for CI self-sufficiency.
> Source of truth: `MyScripts/tooling/` — keep files in sync when upgrading tools.

All TypeScript/JavaScript projects under `MyScripts/` share a single `node_modules/` install.
Each project extends these shared configs and adds only project-specific overrides.

---

## Directory Layout

```text
tooling/
  eslint/
    web-ts-app.mjs      ← Browser TypeScript apps (FamilyDashBoard)
    node-ts-app.mjs     ← Node.js / Cloudflare Worker TypeScript apps
    js-browser-app.mjs  ← Vanilla JavaScript browser apps
  tsconfig/
    base-typescript.json ← Strict TypeScript base (browser / bundler)
    base-node.json       ← Node.js / Cloudflare Worker TypeScript base
  vitest/
    base.mjs            ← Shared Vitest defaults (forks pool, mocks, timeouts)
    happy-dom.mjs       ← DOM test preset (extends base, environment: happy-dom)
    node.mjs            ← Node.js test preset (extends base, environment: node)
```

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
