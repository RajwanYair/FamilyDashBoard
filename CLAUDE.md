# CLAUDE.md — FamilyDashBoard v7.19.0

> Context file for Claude Code / Claude agents.
> **Canonical rules live in `.github/copilot-instructions.md`** — this file is a lean entry point.

## Quick Reference

- **Stack**: TypeScript 5.9 + Vite 8 + Vitest 4 (happy-dom) · ESLint 10 · 0 errors / 0 warnings
- **Install**: `npm install` from parent `MyScripts/` — never here. No local `package-lock.json`.
- **Tests**: `npx vitest run` — 2931+ tests / 79 suites / 0 failures
- **Lint**: `npx eslint src tests --max-warnings 0`
- **Build**: `npx vite build` (Pages) · `npx vite build --base ./` (local file://)
- **All checks**: `npm run check`

## Key Constraints

1. Zero runtime dependencies — no external JS/CSS/CDN
2. No `innerHTML` with unsanitized data — use `textContent`
3. All fetches: try/catch + proxy fallback + `diagLog()`
4. All API data: `cSet`/`cGet`/`cGetStale` dual-layer cache
5. Static PWA — no auth, no server/backend
6. Hebrew RTL · 6 themes · `<dialog>` overlays · CSS `@layer` architecture

## File Map

```text
src/                   # TypeScript v7 modular source (Vite build)
src/public/            # Vite static dir — icon.svg, manifest.webmanifest
tests/unit/            # Vitest — 2931+ tests / 79 suites
sw.js                  # ServiceWorker v7.19.0
BestDashBoard.html     # Legacy v5 dashboard (read-only, archived)
```

For full rules, gotchas, architecture, and naming conventions see:
- **Rules & Naming**: `.github/copilot-instructions.md`
- **Architecture**: `ARCHITECTURE.md`
- **File details**: `.github/instructions/workspace.instructions.md`
