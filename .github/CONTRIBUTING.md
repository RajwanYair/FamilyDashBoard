# Contributing to FamilyDashBoard

> TypeScript modular TV dashboard · Vite 8 + TS 6.0.3 + Vitest 4.1.5 · Hebrew RTL

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

- **Node.js 24+** with npm
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
npx vite build --base ./

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

**Thresholds** (canonical source: `vitest.config.ts`): statements 93.0%, branches 84.6%, functions 92.0%, lines 94.5%. The thresholds ratchet upward each sprint as targeted tests are added — see Roadmap #8.

**Rules for new tests**:

- Place in `tests/unit/<same-path-as-source>/`
- Use `vi.stubGlobal` / `vi.fn()` for mocks — not global mutation
- Clean up with `afterEach(() => { vi.restoreAllMocks(); })`
- Never import `localStorage` — stub it via `vi.stubGlobal`
- **Prefer `_resetForTest()` over `vi.resetModules()`** — if the module under test has mutable module-level state, export a `_reset*ForTest()` function and call it in `beforeEach`/`afterEach`. Only use `vi.resetModules()` when you need to test module-scope initialization behavior (e.g., setting corrupt `sessionStorage` before the first import).

---

## Terminal: PowerShell Only

All terminal commands in this project use **PowerShell syntax**. Unix shell commands are not supported in the dev environment.

| Forbidden              | Use instead                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `&&`                   | `;` (chain commands)                                             |
| `grep`                 | `Select-String`                                                  |
| `cat`, `head`, `tail`  | `Get-Content`, `Select-Object -First N`, `Select-Object -Last N` |
| `find`                 | `Get-ChildItem`                                                  |
| `ls`, `rm`, `cp`, `mv` | `Get-ChildItem`, `Remove-Item`, `Copy-Item`, `Move-Item`         |
| `export VAR=value`     | `$env:VAR = "value"`                                             |

---

## Code Style

Follow all rules in `.github/copilot-instructions.md` — that is the canonical source. Key points:

1. No external runtime dependencies — zero npm packages at runtime
2. No `innerHTML` with unsanitized data — use `textContent`
3. No hardcoded colors — use CSS custom properties
4. No `eslint-disable` or `@ts-ignore`

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

See [ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the full system diagram and file structure.

---

## Key Rules

| Wrong                   | Correct                                  |
| ----------------------- | ---------------------------------------- |
| `loadStocks()`          | `loadAllStocks()`                        |
| `_useFahrenheit`        | `_tempUnit` (`'C'`/`'F'`)                |
| `getCachedData()`       | `cGet(key, TTL)`                         |
| `setCachedData()`       | `cSet(key, data)`                        |
| `setSyncStatus()`       | `setSync(id, state)`                     |
| `innerHTML = userInput` | `textContent = userInput`                |
| bare `fetch()`          | `fetchJSON()` or `fetchJSONWithWorker()` |
