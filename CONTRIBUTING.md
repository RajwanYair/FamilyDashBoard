# Contributing to FamilyDashBoard

> TypeScript modular TV dashboard · Vite 8 + TS 5.9 + Vitest 4 · Hebrew RTL

Thank you for your interest in contributing! This guide covers everything you need to get started.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Development Workflow](#development-workflow)
4. [Testing](#testing)
5. [Code Style](#code-style)
6. [Submitting a Pull Request](#submitting-a-pull-request)
7. [Architecture Overview](#architecture-overview)
8. [Key Rules](#key-rules)

---

## Prerequisites

- **Node.js** 20+ with npm
- **PowerShell** (Windows) or bash-compatible shell (Linux/macOS)
- Git

---

## Setup

All dev tools live in the **parent** `MyScripts/` directory, not in this project.

```powershell
# From the parent MyScripts/ directory:
npm install

# Then you can run commands from FamilyDashBoard/:
cd FamilyDashBoard
npx vite          # dev server at http://localhost:5173
```

> **Important**: Never run `npm install` inside `FamilyDashBoard/`. There is no local `package-lock.json` — this is intentional. All dependencies resolve from `MyScripts/node_modules/`.

---

## Development Workflow

```powershell
# Type-check
npx tsc --noEmit

# Lint (must be 0 errors, 0 warnings)
npx eslint src tests --max-warnings 0

# Markdown lint
npx markdownlint-cli2 "**/*.md"

# Run all tests
npx vitest run

# Run tests with coverage
npx vitest run --coverage

# Build for GitHub Pages
npx vite build

# Build for local file:// access
npx vite build --mode local

# Run everything (full quality gate)
npm run check
```

---

## Testing

Tests live in `tests/unit/` — one file per source module. We use Vitest 4 with `happy-dom`.

```powershell
# Run all tests
npx vitest run

# Watch mode during development
npx vitest

# Run a specific test file
npx vitest run tests/unit/core/fetch.test.ts

# Coverage report
npx vitest run --coverage
```

**Thresholds**: statements 75%, branches 70%, functions 75%, lines 75%.

**Rules for new tests**:

- Place in `tests/unit/<same-path-as-source>/`
- Use `vi.stubGlobal` / `vi.fn()` for mocks — not global mutation
- Clean up with `afterEach(() => { vi.restoreAllMocks(); })`
- Never import `localStorage` — stub it via `vi.stubGlobal`

---

## Code Style

Follow all rules in `.github/copilot-instructions.md`. Key points:

1. **No external runtime dependencies** — no npm packages in `src/` at runtime
2. **No raw `innerHTML`** — use `textContent`, or `createTextNode()` for user data
3. **No hardcoded colors** — always `var(--token-name)`
4. **Cache all API data** — `cSet(key, data)` after every successful fetch; check `cGet(key, TTL)` first
5. **Proxy fallback** — use `fetchJSON()` or `fetchJSONWithWorker()`, never bare `fetch()`
6. **`safeLoad()` wrappers** — every card loader is wrapped with `safeLoad()`
7. **`if (!_pageVisible) return`** — first line of every async card loader
8. **DOM refs** — all `getElementById` calls go in `el` objects, not repeated inline
9. **CSS layers** — new styles go in `@layer components`, new animations in `@layer animations`
10. **No `eslint-disable`**, no `@ts-ignore`

---

## Submitting a Pull Request

1. Fork the repository and create a feature branch from `main`
2. Make your changes, following the code style above
3. Run the full quality gate: `npm run check` — must be clean
4. Commit with conventional format: `feat(scope): description` / `fix(scope): description`
5. Open a PR targeting `main`

**PR checklist**:

- [ ] `npm run check` passes with 0 errors
- [ ] New code has matching tests
- [ ] No new `eslint-disable` or `@ts-ignore`
- [ ] No hardcoded colors or strings that belong in config
- [ ] CSS added to the correct `@layer`

---

## Architecture Overview

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full diagram. Quick summary:

```text
src/
  main.ts             Entry point — registers cards, starts intervals
  core/               Cache, config, fetch, sync, diagnostics
  cards/              11 cards — each folder has a loader + optional CSS
  ui/                 Overlays, header, keyboard, theme, layout
  styles/             CSS @layer files (tokens → themes → base → layout → components → animations)
  types/              TypeScript interfaces shared across modules
worker/
  src/index.ts        Cloudflare Worker router
  src/routes/         data.ts (weather/currency/hebcal) + feeds.ts (stocks/news/alerts/calendar)
  src/middleware/     cors.ts, rate-limit.ts, log.ts
  src/utils/          response.ts, allowlists.ts, validation.ts
tests/
  unit/               Vitest suites — one per source module
```

**Cards (11 total)**:
`calendar` · `countdown` · `currency` · `hebrew-cal` · `motivation` · `news` · `stocks` · `tasks` · `system-info` · `weather` · `alerts`

---

## Key Rules

| Wrong | Correct |
|-------|---------|
| `loadStocks()` | `loadAllStocks()` |
| `_useFahrenheit` | `_tempUnit` (`'C'`/`'F'`) |
| `getCachedData()` | `cGet(key, TTL)` |
| `setCachedData()` | `cSet(key, data)` |
| `setSyncStatus()` | `setSync(id, state)` |
| `innerHTML = userInput` | `textContent = userInput` |
| bare `fetch()` | `fetchJSON()` or `fetchJSONWithWorker()` |
