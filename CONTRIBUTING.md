# Contributing to FamilyDashBoard

Thanks for your interest in contributing. This is a personal/family project, but
external contributions are welcome under the rules below.

## Ground rules

- This is a **static, client-only PWA**. No server, no auth, no telemetry.
- **Zero runtime dependencies** — see [ADR-002](docs/adr/ADR-002-zero-client-deps.md).
- All tooling lives at the parent `MyScripts/` workspace. From this repo, run
  `npm ...` and tooling is resolved via the parent `node_modules`.
- Windows / PowerShell is the primary developer environment. CI runs on Ubuntu.

## Local setup

```powershell
# From the parent MyScripts/ directory (one-time)
cd ..
npm install

# Then from this repo
cd FamilyDashBoard
npm run dev          # vite dev server
npm run check        # typecheck + lint + tests
npm run build        # production build → dist/
```

## Quality gates (zero tolerance)

Before opening a PR, all of these must pass with **0 errors / 0 warnings**:

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run
npm run lint:md
npm run check:bundle
```

No `// eslint-disable`, no `// @ts-ignore`, no waivers. Fix root causes.

## Branch + commit conventions

- Branch from `main`. Keep PRs focused (one topic).
- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat: …`, `fix: …`, `chore: …`, `docs: …`, `refactor: …`, `test: …`, `ci: …`.
- Commit hook validates the message via `commitlint`.

## Pull requests

PRs must include:

1. Summary of changes.
2. Output of `npm run check` (or link to passing CI).
3. Screenshots / clips for visible UI changes.
4. Confirmation that scope-lock rules in `.github/copilot-instructions.md` are
   honoured (no runtime deps, no innerHTML with untrusted data, etc.).

## Architecture decisions

Significant decisions go in `docs/adr/`. Use the existing ADRs as a template
and run `npm run adr:index` to regenerate the index.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.
