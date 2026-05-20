# GitHub Copilot Instructions — FamilyDashBoard v15.5.0

> TypeScript modular TV dashboard (`src/`) · Hebrew RTL · 7 Themes · 12 Cards · Vite 8 + TS 6.0.3 + Vitest 4.1.6
> **All tools installed at parent `MyScripts/`** — run `npm install` from `MyScripts/`, never here
> No local `package-lock.json` or `devDependencies` in `FamilyDashBoard/package.json`. Shared configs vendored into `tooling/`.
> Validation: `npm run check` for the canonical repository gate; `npx vitest run` and `npx eslint src tests --max-warnings 0` for focused checks
> Coverage thresholds: see `vitest.config.ts`

## Mandatory Rules

1. No external JS/CSS libraries or CDNs — zero runtime dependencies
2. No hardcoded colors — use CSS custom properties (`--accent`, etc.)
3. No `innerHTML` with unsanitized data — use `textContent`
4. No sync try/catch on async loaders — use `await` + `safeLoad()`
5. No `self.skipWaiting()` in SW install — only via `SKIP_WAITING` message
6. All async loaders: `if (!_pageVisible) return;` guard at top
7. All fetches: try/catch + proxy fallback (`PROXIES`) + `diagLog()`
8. All API data: `cSet`/`cGet`/`cGetStale` dual-layer cache
9. DOM refs in `el` object — no repeated `getElementById`
10. No duplicate CSS selectors — merge properties into the first occurrence
11. Verify function names before wiring (`loadAllStocks()` not `loadStocks()`)
12. `_tempUnit` = `'C'`/`'F'` (NOT `_useFahrenheit`)
13. Stock columns: `width` + `flex-shrink: 0` (NOT `min-width`)
14. Grep `id="X"` in `index.html` before keeping any loader — dead elements = dead code
15. Dev deps go in `MyScripts/package.json` (parent) — **never** add `devDependencies` to `FamilyDashBoard/package.json`

## Key Names & Gotchas

| Wrong             | Correct                   |
| ----------------- | ------------------------- |
| `loadStocks()`    | `loadAllStocks()`         |
| `_useFahrenheit`  | `_tempUnit` (`'C'`/`'F'`) |
| `getCachedData()` | `cGet(key, TTL)`          |
| `setCachedData()` | `cSet(key, data)`         |
| `setSyncStatus()` | `setSync(id, state)`      |

## Conventions

16. Card registry: `registerCard()` / `getCard()` in `src/core/card-registry.ts` — new cards must be registered here
17. New overlays: use `<dialog>` + `showModal()` / `close()` — not `<div>` visibility toggling
18. CSS architecture: `@layer tokens, themes, base, layout, components, animations` — add new rules to correct layer
19. Worker fetch: prefer `fetchJSONWithWorker<T>()` when `isWorkerEnabled()` — fallback to proxy chain otherwise
20. Themes: 7 total — black · blue · matrix · amber · purple · rose · high-contrast (ThemeName union in `types/config.ts`)
21. After each sprint/set of changes: `git add -A && git commit -m "feat|fix|chore: <description>"` before proceeding to the next sprint
22. `cGet()` and `cGetStale()` return `null` (not `undefined`) for cache misses — always check `!== null`, never `!== undefined`
23. `dist/` is built with `--base ./` for `file://` access; `removeCrossOrigin` Vite plugin strips `crossorigin` attrs, strips CSP meta, converts `type=module` → plain `<script>`, and outputs a single IIFE bundle
24. After **every** Copilot chat session: commit with `git add -A && git commit -m "chore: <session summary>"` before closing
25. **Card content layout: always use rectangular tile/grid blocks** — never plain vertical line lists. Each data point must be a self-contained visually-bordered tile in `display: grid` or `display: flex; flex-wrap: wrap`. Default: `grid-template-columns: repeat(auto-fit, minmax(Xpx, 1fr))`. Exception: sequential content (news feed, stock rows).
26. **Static PWA — no auth**: This is a client-only static HTML dashboard with no server/backend. Authentication (Google/Facebook/Apple/other) is not applicable and should never be added.
27. **Icons & manifests go in `src/public/`** (Vite static dir, copied verbatim to `dist/`). NOT in `src/assets/` (which Vite fingerprints). Fix: `<link rel="icon" href="/FamilyDashBoard/icon.svg">`.
28. **Hebrew date display**: use `Intl.DateTimeFormat('he-u-ca-hebrew', { ... })` — never compute Hebrew dates manually.
29. **GitHub Actions versions**: use `actions/checkout@v4`, `actions/setup-node@v4`. Do NOT use `@v5` or `@v6` (don't exist for these actions). Bundle size violations must `exit 1`, not `::warning::`.
30. **CI**: single unified workflow in `.github/workflows/ci.yml` covers all checks (typecheck → lint → test → build). `ci-v6.yml` is deleted — do not recreate it.
31. **PowerShell-only terminal** — The developer OS is **Windows / PowerShell**. Every terminal command MUST use PowerShell syntax. NEVER use Unix/bash commands. Forbidden: `tail`, `grep`, `cat`, `head`, `find`, `ls`, `rm`, `cp`, `mv`, `touch`, `export VAR=`, `&&` (use `;` instead). Use instead: `Select-Object -Last N`, `Select-String`, `Get-Content`, `Get-ChildItem`, `Remove-Item`, `Copy-Item`, `Move-Item`, `New-Item`, `$env:VAR =`. Chain commands with `;` not `&&`. Pipe with `|`.
32. **Pre-release gate**: Before every `git tag vX.Y.Z`, run the full checklist in `.github/instructions/pre-release.instructions.md`. Zero tolerance: 0 type errors · 0 lint errors · 0 lint warnings · 0 test failures · 0 markdown errors · no `eslint-disable` · no `@ts-ignore` · no dead code · no dead config files. All GitHub issues for the milestone must be closed with a commit hash before tagging.
33. **card `data-card-id` must match registry ID exactly** — use `"hebrew-cal"`, `"calendar"`, `"motivation"` (never short aliases `hcal`, `cal`, `moti`). The registry ID is the canonical identifier used for hide/show, layout persistence, and size config.
34. **Memory tool — three-tier scope**: persistent insights live in `/memories/` (cross-workspace user notes), session-only context in `/memories/session/`, and repo-scoped facts in `/memories/repo/`. Before creating new memory files, view the directory to avoid duplicates. Keep entries terse — bullets and one-line facts, not prose.
35. **Subagents** — invoke via `runSubagent` for read-only exploration (`Explore`), data flow work (`api-integrator`), UI work (`dashboard-designer`), or pre-release gating (`quality-reviewer`). Subagents are stateless: pass the full task description in one prompt and ask for the exact return shape you need.
36. **Skills auto-discovery** — repository skills under `.github/skills/*/SKILL.md` are surfaced to chat by description match. When a skill applies to the request, load it with `read_file` BEFORE acting. Do not just mention skills — read them.
37. **Custom agents replaced custom chat modes** — agents live in `.github/agents/*.agent.md` with `tools:` allowlist, `handoffs:` to peer agents, and `user-invocable: true`. Older docs that say "chat mode" should now say "custom agent".
38. **Model selection in prompts** — prompt files may set `model: "<Display Name> (copilot)"` frontmatter to lock a specific model (e.g. for release gating). When omitted, the active chat model is used.
39. **Context economy** — when a skill or agent already covers a task in full, invoke it rather than repeating its rules inline. Reference `.github/skills/*/SKILL.md` and `.github/agents/*.agent.md`. In particular: version-bump file list → load `release/SKILL.md`; data flow review → `@api-integrator`; UI/RTL review → `@dashboard-designer`; pre-release gate → `@quality-reviewer`.
40. **Browser support** — `.browserslistrc` targets Chrome 114+ · Edge 114+ · Firefox 128+ · Firefox ESR · Safari 17.4+ · Opera 100+ · Samsung 23+ · iOS 17.4+ · Android 114+ · ChromeAndroid 114+ · FirefoxAndroid 128+ · OperaMobile 80+. Chromium-based browsers (Brave, Vivaldi, Arc, Yandex) and WebKit-based mobile browsers (UC Browser, QQ Browser) are implicitly covered. Playwright smoke + a11y tests run on 11 device projects; visual regression runs on chromium only.
41. **Batch edits** — use `multi_replace_string_in_file` when making 2+ independent edits across files. Reduces round-trips and ensures atomicity. Each replacement must include 3+ lines of context.
42. **Code intelligence before refactoring** — use `vscode_listCodeUsages` to find all references before renaming or removing exports. Use `vscode_renameSymbol` for semantics-aware renames across the workspace.
43. **Interactive CLI flows** — use `send_to_terminal` + `get_terminal_output` for multi-step interactive prompts (npm init, wrangler login, etc.). Use `vscode_askQuestions` to gather user input before sending to terminal.
44. **MCP tools are deferred** — always call `tool_search` before using any MCP-provided tool or deferred VS Code tool. Do not retry if the first search returns no results.
45. **Task tracking** — use `manage_todo_list` for multi-step work. Mark one item `in-progress` at a time. Mark `completed` immediately after finishing each step. Skip for single-step operations.
46. **Extension-aware tooling** — prefer `get_errors` over terminal lint/tsc for single-file validation (ESLint, Stylelint, markdownlint, spell-checker all surface via `get_errors`). Use `run_task` for predefined workspace tasks (Vitest, Playwright, build, coverage) instead of manual terminal commands. Use `view_image` on VR screenshots in `test-results/` for visual regression diagnosis. Use `tool_search("playwright")` for MCP browser automation in chat.
47. **ESM config files** — all config files (`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`) use `import.meta.dirname` instead of `__dirname`. Never introduce CommonJS patterns (`require`, `__dirname`, `__filename`) in ESM config files.
48. **Build targets** — `tsconfig` base targets `ES2024`, Vite build targets `es2024`, lightningcss targets aligned with `.browserslistrc` (Chrome 114, Firefox 128, Safari 17.4). Keep all three in sync when updating browser support.
49. **Conversation compaction** — long sessions are automatically compacted by Copilot. Key state survives in `<conversation-summary>`. When resuming after compaction, re-read critical files before editing — do not rely on stale cached content.
50. **Vision & image tools** — use `view_image` to inspect VR baseline screenshots, test failure screenshots in `test-results/`, and SVG doc assets in `.github/assets/`. Prefer visual inspection over guessing at layout issues.
51. **Number formatting in docs** — never use a space as a thousands separator in any `.md` file. Write full numbers without separations: `7517`, `200000`, `10000`. This applies to code, comments, docs, changelogs, and ADRs everywhere in the project.
