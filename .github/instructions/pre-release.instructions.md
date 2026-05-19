---
applyTo: "CHANGELOG.md,package.json,sw.js,README.md"
description: "Pre-release / production cleanup checklist. Run every item before tagging a release. Zero tolerance: 0 errors, 0 warnings, 0 suppressions."
---

# Pre-Release Checklist — FamilyDashBoard

Run every step below in order. **All gates must be green before `git tag vX.Y.Z`.**

---

## 1 · Quality Gates (zero tolerance)

Use the canonical repository gate first, then the release-only build/package steps.

```powershell
# Canonical production gate
npm run check

# CI-only supply-chain parity checks
npm run check:actions-pinned
npm run check:ignore-scripts
npm run check:sigstore
npm run check:reproducible

# Release-only packaging gates
npm run build
npm run check:bundle
npm run check:card-bundle
```

**Hard rules:**

- No `// eslint-disable` or `/* eslint-disable */` anywhere in `src/` or `tests/`
- No `@ts-ignore` or `@ts-expect-error` in `src/`
- No `it.only` / `test.only` / `describe.only` or the `.skip` variants in `tests/` (enforced by `npm run check:test-focus`; see ADR-073)
- No deprecated API calls — check ESLint deprecation rules and TypeScript `--target` output
- No `console.log` in `src/` (use `diagLog()`)
- ESLint config (`eslint.config.mjs`) must use the latest flat-config format — no legacy `.eslintrc`
- Dead exports are zero-tolerance: `node scripts/check-dead-exports.mjs --fail-on-dead`

---

## 2 · Dead Code / Dead Config / Dead Files

- [ ] Run `npm run check` — all repository gates pass with 0 failures
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
| 3   | `CHANGELOG.md`                                   | New `## [X.Y.Z]` section with release evidence; move `[Unreleased]` block        |
| 4   | `README.md`                                      | `Version-X.Y.Z` badge and release-facing version text                            |
| 5   | `.github/copilot-instructions.md`                | Header version only                                                              |
| 6   | `.github/instructions/workspace.instructions.md` | Header version only                                                              |
| 7   | `.github/AGENTS.md`                              | Header line `> Version: vX.Y.Z ...`                                              |
| 8   | `docs/ARCHITECTURE.md`                           | Title `(vX.Y.Z)` and release-facing version text                                 |
| 9   | `.github/assets/banner.svg`                      | Version string in footer text                                                    |
| 10  | `.github/assets/architecture.svg`                | Version ×3 (title, sw.js label, footer)                                          |
| 11  | `.github/assets/preview.svg`                     | `Dashboard vX.Y.Z` footer text                                                   |
| 12  | `.github/assets/data-sources.svg`                | Title line `— vX.Y.Z`                                                            |
| 13  | `.github/assets/roadmap.svg`                     | Release-facing version text only                                                 |
| 14  | `docs/ROADMAP.md`                                | Refresh-date header `Shipped baseline: vX.Y.Z`                                   |
| 15  | `.github/skills/release/SKILL.md`                | Release-process guidance if the release flow changed                             |
| 16  | `docs/security.md`                               | Title `Security Model — FamilyDashBoard vX.Y.Z` (line 1)                         |

- [ ] All 16 files above have been updated with the new version and release-facing metadata
- [ ] **Run `node scripts/check-version-consistency.mjs`** — must exit 0 (CI also enforces this)
- [ ] `CHANGELOG.md` — unreleased items moved to new version section; old sprints collapsed to one line each
- [ ] `docs/ARCHITECTURE.md` — reflects current card list (12 cards), module graph, CSS layer order

**Deduplication rule:** Keep volatile release evidence in `CHANGELOG.md`, generated check output, or config files such as `vitest.config.ts`. Active operator docs should reference those canonical sources instead of copying changing counts.

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

- Tag format: `vMAJOR.MINOR.PATCH` — `release.yml` auto-creates GitHub Release on push
- Attach `dist.zip`, `sw.js`, `dist/icon.svg` — handled by `release.yml` automatically
- After tag push: verify both `release.yml` and the Pages deploy triggered from successful `ci.yml` are green

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
