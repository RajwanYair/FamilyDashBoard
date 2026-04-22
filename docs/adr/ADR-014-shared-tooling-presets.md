# ADR-014: Shared Tooling Presets in `tooling/`

**Date:** 2026-07-14
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard lives inside a monorepo (`MyScripts/`) alongside other
projects. Dev tools (ESLint, Prettier, Vitest, TypeScript) are installed once
at the parent level in `MyScripts/node_modules/`. Before Sprint I-0, each
project duplicated configuration boilerplate: a full ESLint flat-config file,
a Vitest config with repeated `pool`/`coverage` options, and individual
`tsconfig.json` bases.

This caused drift: upgrading a lint rule required touching every project's
config; the Cloudflare Worker sub-project (`worker/`) had slightly different
ESLint globals than the browser app, creating inconsistency.

---

## Decision

**Centralise reusable configuration in `tooling/` inside `FamilyDashBoard/`.
Each preset is a plain ES module that projects `import` and spread.**

### Directory layout

```text
tooling/
  tsconfig/
    base.json          # strict TS base (extends nothing external)
    browser-app.json   # browser lib (DOM, ES2022)
    node-app.json      # Node 20 (no DOM)
  vitest/
    base.mjs           # pool:forks, restoreMocks, coverage config
    happy-dom.mjs      # extends base, environment:"happy-dom"
    node.mjs           # extends base, environment:"node"
  eslint/
    browser-ts-app.mjs # ESLint factory for browser TS apps
    node-ts-app.mjs    # ESLint factory for Node/CF Worker apps
    js-browser-app.mjs # ESLint factory for vanilla JS browser apps
  README.md            # Usage docs with copy-paste templates
```

### Usage pattern (vitest)

```ts
import { sharedHappyDomTestConfig } from "../../tooling/vitest/happy-dom.mjs";
export default defineConfig({ test: sharedHappyDomTestConfig });
```

### Usage pattern (ESLint)

```ts
import { createNodeTsAppEslintConfig } from "../../tooling/eslint/node-ts-app.mjs";
export default createNodeTsAppEslintConfig({ useCloudflareGlobals: true });
```

---

## Rationale

1. **Single source of truth** — lint rules, test pool settings, and TS strictness
   flags are defined once and inherited.
2. **No extra tooling** — presets are plain `.mjs` files; no Nx, Turborepo, or
   Lerna required.
3. **Opt-in overrides** — each project spreads the preset and can add
   project-specific overrides without forking the preset.
4. **Zero runtime deps** — tooling files are never bundled into `dist/`.

---

## Consequences

- `tooling/` is checked into the repository and maintained alongside source.
- Consumers must adjust import paths if `tooling/` is moved.
- Changes to a shared preset affect all consumers simultaneously — intended
  behaviour, but requires care during major upgrades.

---

## Alternatives Considered

| Option                          | Reason rejected                                |
| ------------------------------- | ---------------------------------------------- |
| Duplicate config per project    | Already the problem; rejected                  |
| Publish presets as npm packages | Overkill for a monorepo; adds publish friction |
| Nx / Turborepo                  | Too heavy for a personal monorepo              |
