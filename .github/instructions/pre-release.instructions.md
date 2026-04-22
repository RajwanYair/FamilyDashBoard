---
applyTo: "CHANGELOG.md,package.json,sw.js,README.md"
description: "Pre-release / production cleanup checklist. Run every item before tagging a release. Zero tolerance: 0 errors, 0 warnings, 0 suppressions."
---

# Pre-Release Checklist — FamilyDashBoard

Run every step below in order. **All gates must be green before `git tag vX.Y.Z`.**

---

## 1 · Quality Gates (zero tolerance)

```powershell
# Type-check — 0 errors
npx tsc --noEmit

# Lint — 0 errors, 0 warnings, 0 suppressions
npx eslint src tests --max-warnings 0

# Markdown — 0 lint errors
npx markdownlint-cli2 "**/*.md" --ignore node_modules --ignore dist

# Tests — all pass, 0 failures
npx vitest run

# Build — must succeed cleanly
npx vite build
```

**Hard rules:**

- No `// eslint-disable` or `/* eslint-disable */` anywhere in `src/` or `tests/`
- No `@ts-ignore` or `@ts-expect-error` in `src/`
- No deprecated API calls — check ESLint deprecation rules and TypeScript `--target` output
- No `console.log` in `src/` (use `diagLog()`)
- ESLint config (`eslint.config.mjs`) must use the latest flat-config format — no legacy `.eslintrc`

---

## 2 · Dead Code / Dead Config / Dead Files

- [ ] Run `npx tsc --noEmit` — no "unused variable" or "unused import" warnings
- [ ] No orphaned test files (every `tests/unit/X.test.ts` has a matching `src/X.ts`)
- [ ] No unreferenced CSS selectors in `src/styles/` — cross-check against `src/index.html`
- [ ] No `src/assets/` files that aren't imported anywhere
- [ ] No `.github/workflows/` files that are disabled or superseded — one active CI: `ci.yml`
- [ ] `dependabot.yml` — version up-to-date, no deprecated `package-ecosystem` values
- [ ] `.vscode/extensions.json` — all recommendations exist and are still published

---

## 3 · Documentation Audit

Update ALL of these on every version bump. Search the old version string (e.g. `7.9.0`) to find occurrences.

| #   | File                                             | What to update                                                                   |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | `package.json`                                   | `"version"` — canonical single source                                            |
| 2   | `sw.js`                                          | Comment header version string (e.g. `/* FamilyDashBoard ServiceWorker — vX.Y.Z`) |
| 3   | `CHANGELOG.md`                                   | New `## [X.Y.Z]` section with test count; move `[Unreleased]` block              |
| 4   | `README.md`                                      | `Version-X.Y.Z` badge + `Vitest-NNNN_passing` badge (~lines 22-23)               |
| 5   | `CLAUDE.md`                                      | Header line 1, test count ×2 (lines ~17 and ~48)                                 |
| 6   | `.github/copilot-instructions.md`                | Header version (line 1) + test count (line 6)                                    |
| 7   | `.github/instructions/workspace.instructions.md` | Header version + test count (line 6)                                             |
| 8   | `ARCHITECTURE.md`                                | Test count in stack table (~line 14) + constraint list (~line 195)               |
| 9   | `.github/assets/banner.svg`                      | Version string + test count in footer text                                       |
| 10  | `.github/assets/architecture.svg`                | Version ×3 (title, sw.js label, footer) + test count                             |
| 11  | `.github/assets/preview.svg`                     | `Dashboard vX.Y.Z` footer text                                                   |
| 12  | `.github/assets/data-sources.svg`                | Title line `— vX.Y.Z`                                                            |
| 13  | `.github/assets/roadmap.svg`                     | Test count progression line                                                      |
| 14  | `ROADMAP.md`                                     | New row in released-versions table + `<!-- Last updated: vX.Y.Z -->` comment     |
| 15  | `.github/skills/release/SKILL.md`                | `All N+ tests / M+ suites` verification line                                     |

- [ ] All 15 files above have been updated with the new version and/or test count
- [ ] `CHANGELOG.md` — unreleased items moved to new version section; old sprints collapsed to one line each
- [ ] `ARCHITECTURE.md` — reflects current card list (11 cards), module graph, CSS layer order

**Deduplication rule:** If a fact appears in more than one file, keep it only in `copilot-instructions.md` (the single source of truth) and replace duplicates with a reference: `See copilot-instructions.md`.

---

## 4 · SVG Documentation Coverage

Every architecture diagram, data-flow, and table that exists as Markdown must also have an SVG in `.github/assets/`:

| Diagram                        | SVG File           |
| ------------------------------ | ------------------ |
| Card layout / column structure | `architecture.svg` |
| Fetch proxy chain              | `fetch-flow.svg`   |
| Cache layer diagram            | `cache-flow.svg`   |
| SW lifecycle                   | `sw-lifecycle.svg` |
| CSS layer stack                | `css-layers.svg`   |
| Theme token map                | `theme-tokens.svg` |

Use the `renderMermaidDiagram` or `mermaid-diagram-validator` tool to generate/validate SVG from Mermaid source, then save to `.github/assets/`.

---

## 5 · Wiring Audit

- [ ] Every card in `src/cards/` has a matching `data-card-id` in `src/index.html` that matches the registry ID exactly (no short aliases like `hcal`, `cal`, `moti`)
- [ ] Every `cfg-*` input in `src/index.html` is wired in both `populateForm()` and `collectForm()` in `src/ui/config-panel.ts`
- [ ] Every `DashboardConfig` field has a default in `DEFAULT_CONFIG`
- [ ] The config panel save handler re-inits every module that depends on config

---

## 6 · GitHub Issues / PRs

- [ ] All closed bugs have a linked commit hash in the issue comment
- [ ] All "done" milestone items are closed with `Fixes #N` in the merge commit or a closing comment
- [ ] No open issues labeled `bug` with a `fix committed` label — these must be closed
- [ ] Milestone for current release is 100% closed before tagging

---

## 7 · Git & Release

```powershell
# Ensure main is clean
git status
git diff --stat

# Commit everything
git add -A
git commit -m "chore: pre-release cleanup vX.Y.Z"

# Tag
git tag vX.Y.Z
git push origin main --tags
```

- Tag format: `vMAJOR.MINOR.PATCH` — CI (`release.yml`) auto-creates GitHub Release on push
- Attach `dist.zip`, `sw.js`, `icon.svg` — handled by `release.yml` automatically
- After tag push: verify GitHub Actions `ci.yml` passes on the tag run

---

## 8 · Session Commit Discipline

After **every** Copilot chat session — even if no pre-release is planned:

```powershell
git add -A
git commit -m "chore: <one-line session summary>"
git push origin main
```

One commit per session minimum. Use `feat:`, `fix:`, `chore:` prefixes.

---

## What Is NOT in Scope

- **Authentication (Google / Facebook / Apple)** — this is a static client-only PWA with no server. Auth is permanently out of scope. Do not add it.
- External CDN dependencies — permanently forbidden (Rule 1).
- `devDependencies` in `FamilyDashBoard/package.json` — all dev tools live in parent `MyScripts/package.json`.
