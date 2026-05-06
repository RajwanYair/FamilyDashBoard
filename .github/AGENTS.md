# AI Customizations — FamilyDashBoard

> Version: v14.4.0 · Tests: 6387 / 214 suites · Coverage thresholds: 94.2 / 85.4 / 94.5 / 95.6

This repository uses the current VS Code Copilot customization model (May 2026):

- Always-on instructions via `.github/copilot-instructions.md` and `AGENTS.md`
- File-scoped rules via `.github/instructions/*.instructions.md` (`applyTo:` glob + `description:` frontmatter)
- Reusable slash prompts via `.github/prompts/*.prompt.md` (`mode: agent`, optional `model:`)
- Custom agents via `.github/agents/*.agent.md` (`tools:` allowlist, `handoffs:`, `user-invocable:`)
- Agent skills via `.github/skills/*/SKILL.md` (auto-discovered by `description:` match)
- Persistent memory via the three-tier memory tool (`/memories/`, `/memories/session/`, `/memories/repo/`)
- MCP servers via `.vscode/mcp.json` (workspace) or user-profile `mcp.json` — supports tools, resources, prompts, sampling/elicitation, and inline apps
- Edit-time hooks via `.github/hooks/*.json` (e.g. `post-edit.json`)
- Interactive terminal support via `send_to_terminal` + `vscode_askQuestions` for multi-step CLI flows
- Code intelligence via `vscode_listCodeUsages` and `vscode_renameSymbol` for semantic refactoring

Custom agents are the current term for what older tooling and docs sometimes called custom chat modes. Use agents when you need a persistent persona, scoped tools, or handoffs. Use prompts for lightweight one-shot tasks. Use skills for repeatable multi-step implementation playbooks. Use subagents (`runSubagent`) to run a stateless specialist task without polluting the main conversation. Use `vscode_askQuestions` to gather structured input from the user before executing complex operations.

## What Loads Automatically

| Customization           | Location                                 | Scope                                         | Use It For                                                   |
| ----------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Repository instructions | `.github/copilot-instructions.md`        | All chats in this workspace                   | Core coding rules, architecture, naming, hard constraints    |
| Agent-wide instructions | `AGENTS.md`                              | All chats in this workspace                   | How AI customizations are organized in this repo             |
| File instructions       | `.github/instructions/*.instructions.md` | Matching files (via `applyTo:` glob) or semantic match | CI/CD, HTML, CSS, TypeScript, tests, release, workspace map |
| Prompt files            | `.github/prompts/*.prompt.md`            | Manual `/prompt-name` invocation              | Repeatable task scaffolds with optional model lock           |
| Custom agents           | `.github/agents/*.agent.md`              | Manual agent selection or `runSubagent` use   | Specialized personas with scoped tools and handoffs          |
| Skills                  | `.github/skills/*/SKILL.md`              | Auto-loaded when `description:` matches task  | Tested operational checklists                                |
| Hooks                   | `.github/hooks/*.json`                   | Triggered on tool events (e.g. PostToolUse)   | Post-edit reminders, lint nudges                             |

## Current Agent Inventory

### `@dashboard-designer`

Use for RTL layout, theme work, card readability, CSS custom properties, typography, spacing, and TV-first presentation.

### `@api-integrator`

Use for API integrations, worker-first fetch flow, proxy fallback, caching, diagnostics, sync dots, and adapter or loader correctness.

### `@quality-reviewer`

Use for pre-release gates, PR reviews, coverage audits, dead-code scans, and structured quality reports. Produces a PASS/FAIL/WARNING report and fixes blockers.

## When To Use What

| Need                                              | Best Fit                                 |
| ------------------------------------------------- | ---------------------------------------- |
| Project-wide coding rules                         | `.github/copilot-instructions.md`        |
| Rules for `.github/**`, `.html`, or release files | `.github/instructions/*.instructions.md` |
| A reusable slash-command task                     | `.github/prompts/*.prompt.md`            |
| A persistent specialist persona with tool limits  | `.github/agents/*.agent.md`              |
| A repeatable engineering playbook                 | `.github/skills/*/SKILL.md`              |
| External tools, resources, prompts, or apps       | MCP servers                              |

## Prompts

| Prompt                 | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `/add-card`            | Scaffold a new card module (TS + CSS + tests + registry entry)               |
| `/add-section`         | Scaffold a dashboard section or card concept                                 |
| `/card-contract-audit` | Audit a card against the FdbCard CardRuntime contract                        |
| `/code-review`         | Review for bugs, risks, regressions, security, and maintainability           |
| `/debug-card`          | Debug a malfunctioning card (fetch path, render, config, stale)              |
| `/fix-lint`            | Fix ESLint / TypeScript / Prettier / Markdownlint issues                     |
| `/fix-quality`         | Fix accessibility, performance, and non-lint quality issues (for lint, use `/fix-lint`) |
| `/kv-stale-audit`      | Audit or debug KV stale fallback for a worker route (stocks, crypto, alerts) |
| `/modernize-tooling`   | Refresh Copilot, CI, MCP, prompt, instruction, and workflow setup            |
| `/release-check`       | Pre-release readiness gate (types + lint + tests + CHANGELOG + version)      |
| `/test-coverage`       | Add targeted tests to meet the 94.2%/85.4%/94.5%/95.6% coverage thresholds  |
| `/version-bump`        | Bump version in package.json, CHANGELOG, README badges, and sw.ts            |
| `/worker-debug`        | Debug a failing Cloudflare Worker route (fetch, Zod, KV, envelope)           |
| `/worker-route`        | Scaffold a new Cloudflare Worker route (handler + Zod schema + tests)        |
| `/sprint`              | Run next N roadmap sprints in priority order — commit each, release at end   |
| `/security-audit`      | Run OWASP Top 10 audit against the codebase and fix any blockers             |
| `/browser-compat`      | Add or fix a browser compatibility test (Vitest unit or Playwright E2E)      |

## Skills

| Skill           | Trigger                               | Purpose                                                      |
| --------------- | ------------------------------------- | ------------------------------------------------------------ |
| `/add-api`      | new API, new card, integration        | Fetch + cache + sync + render + tests                        |
| `/debug-fetch`  | broken API, stale pane, proxy failure | Diagnose network, parsing, worker, and cache failures        |
| `/release`      | version bump, tag, changelog          | Release checklist, metadata updates, artifacts, verification |
| `/update-tests` | tests, coverage, flaky suite          | Add or refine Vitest coverage safely                         |

## Instruction Files

| Instruction                | Applies To                                     | Purpose                                                               |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `copilot-instructions`     | All work                                                                             | Canonical coding rules, naming conventions, hard constraints          |
| `workspace.instructions`   | `**`                                                                                 | File map, architecture, shell expectations, shared tooling layout     |
| `dashboard.instructions`   | `**/*.html`                                                                          | HTML, layout, DOM, and styling rules                                  |
| `cicd.instructions`        | `**/*.yml, **/*.yaml, .github/**`                                                    | Workflows, Actions, permissions, CI conventions                       |
| `css.instructions`         | `src/styles/**/*.css, src/cards/**/*.css, src/ui/**/*.css`                           | CSS layer order, custom properties, RTL, TV display, tile layout      |
| `pre-release.instructions` | `CHANGELOG.md, package.json, sw.js, README.md`                                      | Release gate and 16-file version-update checklist                     |
| `security-audit.instructions` | `.github/**, docs/security.md, worker/**, src/core/**, src/main.ts, src/index.html` | OWASP Top 10 audit checklist for static-PWA threat surface           |
| `tests.instructions`       | `tests/**`                                                                           | Vitest 4 patterns, `_resetForTest()`, mock helpers, coverage ratchet  |
| `typescript.instructions`  | `src/**/*.ts`                                                                        | TypeScript strict rules, import conventions, ADR references           |

## MCP Server Guidance

This repository does not require a committed workspace `mcp.json`, but it is designed to work well with MCP servers. VS Code's MCP implementation (May 2026) supports five capability classes: **tools**, **resources**, **prompts**, **sampling/elicitation**, and **inline apps**.

- Put shared, reusable MCP servers in the user profile or your shared parent environment.
- Put repository-specific MCP servers in `.vscode/mcp.json` only when the whole team should share them.
- Prefer least privilege. Only enable servers that materially improve the current task.
- Do not hardcode secrets in `mcp.json`. Use input variables (`${input:TOKEN}`) or OAuth 2.0 flows.
- On Windows, do not rely on sandboxing for local MCP servers because VS Code sandboxing is not currently available there.
- Prefer `streamableHttp` transport for new remote servers; `stdio` for local processes. `sse` is deprecated.
- Use the **Chat Customizations editor** or `MCP: List Servers` to inspect running servers.
- MCP tools are deferred — always call `tool_search` before using any MCP-provided tool.

See `.github/copilot/MCP_SERVERS.md` for the project policy and recommended server patterns.

## Workflow Map

| Workflow               | File                                          | Purpose                                                              |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| CI                     | `.github/workflows/ci.yml`                    | Typecheck, lint, markdownlint, tests, security, worker checks, build |
| Pages deploy           | `.github/workflows/deploy.yml`                | Build and publish `dist/` to GitHub Pages                            |
| Release                | `.github/workflows/release.yml`               | Build tagged release artifacts and publish GitHub Release            |
| Worker deploy          | `.github/workflows/deploy-worker.yml`         | Deploy Cloudflare Worker from `worker/`                              |
| Auto label             | `.github/workflows/auto-label.yml`            | Apply PR and issue labels                                            |
| Dependabot merge       | `.github/workflows/dependabot-auto-merge.yml` | Controlled automation for dependency PRs                             |
| CodeQL                 | `.github/workflows/codeql.yml`                | SAST security scanning via GitHub CodeQL (TypeScript)                |
| OpenSSF Scorecard      | `.github/workflows/scorecard.yml`             | Supply-chain security posture score                                  |
| Security gate          | `.github/workflows/security.yml`              | Unified npm audit + source scan + dep-diff gate                      |
| SBOM                   | `.github/workflows/sbom.yml`                  | CycloneDX SBOM on release tags                                       |
| PR coverage            | `.github/workflows/pr-coverage.yml`           | Coverage diff comment on pull requests                               |
| Perf regression        | `.github/workflows/perf-regression.yml`       | Bundle delta + Lighthouse Web Vitals gate on PRs                     |
| Visual baselines       | `.github/workflows/visual-baselines.yml`      | Update Playwright VR snapshots (Ubuntu, manual)                      |

See `.github/workflows/README.md` for operational details and change rules.

## Diagnostics And Maintenance

- Use the **Chat Customizations editor** (gear icon in chat panel) to inspect loaded instructions, prompts, agents, skills, and MCP servers.
- Use **Chat Diagnostics** (`Copilot: Open Chat Diagnostics`) when a prompt, instructions file, or agent does not appear to load.
- Use **`MCP: List Servers`** in the Command Palette to start, stop, or inspect MCP servers.
- Use the **Extensions view MCP section** to manage server state visually.
- Use `tool_search` before calling any deferred tool — loading a deferred tool without searching first will fail.
- Use `vscode_listCodeUsages` for cross-file reference analysis before refactoring.
- Use `vscode_renameSymbol` for semantics-aware symbol renames across the workspace.
- Use `vscode_askQuestions` to collect structured input from the user (multi-select, options, free text).
- Use `manage_todo_list` for multi-step task tracking with in-progress / completed states.
- Use `send_to_terminal` + `get_terminal_output` for interactive CLI flows (prompts, REPLs, wizards).
- Use `fetch_webpage` to pull documentation or API references from external URLs.
- Keep guidance short, concrete, and reference-based. Avoid duplicating the same rule in five places.

## Extension ↔ Copilot Integration Map

The following extensions surface data directly to Copilot — use the indicated tools instead of running CLI commands:

| Extension            | Copilot Tool                           | Saves                                                     |
| -------------------- | -------------------------------------- | --------------------------------------------------------- |
| ESLint               | `get_errors`                           | Skip terminal eslint for single-file checks               |
| Stylelint            | `get_errors`                           | CSS layer/property validation without terminal             |
| Markdownlint         | `get_errors`                           | MD diagnostics inline; `run_task` for full sweep           |
| webhint              | `get_errors`                           | Browser-compat checks (validates `.browserslistrc`)        |
| Spell Checker (HE+EN)| `get_errors`                          | Catches typos in markdown/comments without extra passes    |
| Vitest Explorer      | `run_task` (Vitest tasks)              | Cleaner output, task reuse, no manual npx commands         |
| Playwright           | `run_task` + MCP `playwright`          | VR/E2E via tasks; browser automation via MCP in chat       |
| GitHub Actions ext   | `get_errors` on YAML                   | Workflow validation inline; no separate linter needed      |
| GitLens + GitKraken  | MCP `gitkraken`                        | Blame/log/diff in chat; supplements `vscode_listCodeUsages`|
| Git Graph            | Visual branch explorer                 | Branch topology questions; supplements gitkraken MCP       |
| Todo Tree            | grep `TODO\|FIXME\|HACK`              | Pre-release dead-code sweeps                               |
| Edge DevTools        | Local Lighthouse/axe                   | Supplements CI LHCI for preview-time audits               |
| PowerShell           | Terminal profile + debugging           | All `run_in_terminal` commands — never emit bash           |
| EditorConfig         | Format-on-save                         | Eliminates formatting fixups from edits                    |
| HTML CSS Support     | Class/ID completion                    | Reduces `semantic_search` for style references             |

**Token optimization**: `get_errors` returns structured diagnostics with zero output parsing. `run_task` reuses workspace-defined commands cleanly. Always prefer these over raw terminal commands when the extension covers the need.

- When a tool or workflow changes, update both the operational file and the markdown that describes it.

## Model Selection In Prompts

Prompt files (`.github/prompts/*.prompt.md`) may declare a `model:` key in YAML frontmatter to lock a specific Copilot model:

```yaml
---
mode: agent
model: "Claude Sonnet 4.5 (copilot)"
description: "..."
---
```

When `model:` is omitted the active chat model is used. Use model locking only for release-gating or auditing prompts that require stable, deterministic output.

## Deferred Tools

Some VS Code tools are deferred and must be loaded via `tool_search` before use. Always call `tool_search` with a natural-language description first. Do not retry with different queries if the first search returns no results — the tool is not available.

Categories of deferred tools:

| Category            | Examples                                                                        |
| ------------------- | ------------------------------------------------------------------------------- |
| Task runner         | `run_task`, `get_task_output`, `create_and_run_task`                            |
| Git / GitHub        | `get_changed_files`, `mcp_github_*`, `github-pull-request_*`                    |
| Testing             | `testFailure`                                                                   |
| Notebook            | `run_notebook_cell`, `edit_notebook_file`, `copilot_getNotebookSummary`         |
| Python / Pylance    | `mcp_pylance_*`, `configure_python_environment`                                 |
| Filesystem (MCP)    | `mcp_filesystem_*`                                                              |
| Browser / Playwright| `open_browser_page`                                                             |
| Mermaid             | `renderMermaidDiagram`, `mermaid-diagram-validator`, `get-syntax-docs-mermaid`   |
| VS Code commands    | `run_vscode_command`, `vscode_searchExtensions_internal`                         |

## Subagents

This repository exposes four subagents that can be invoked via the `runSubagent` tool. Subagent invocations are stateless — the parent agent must pass the full task description in one prompt and ask for the exact return shape it needs.

| Subagent             | Use For                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `Explore`            | Read-only codebase exploration, Q&A, multi-file searches without cluttering the chat |
| `api-integrator`     | New data sources, fetch path repairs, worker/proxy fallback, cache strategy          |
| `dashboard-designer` | RTL layout, theme tokens, card composition, TV readability, multimodal review        |
| `quality-reviewer`   | Pre-release gates, coverage audits, dead-code scans, lint compliance                 |

Guidelines for invoking subagents:

- Specify thoroughness for `Explore`: `quick`, `medium`, or `thorough`.
- Always include the success/return shape in the prompt ("Return: file paths + line numbers").
- Subagents do not stream back to the user; surface their result yourself with a concise summary.
- Prefer a subagent over manually chaining many search and file-reading operations.
- Pass the `agentName` parameter exactly as shown (case-sensitive).
- Optionally pass `model` to lock a specific model for deterministic output (e.g. `"Claude Opus 4.6 (copilot)"`).
- Large results are written to a temp file — use `read_file` to access the content.

## Persistent Memory (three-tier)

VS Code Copilot's `memory` tool stores notes across three scopes. Use `memory { command: "view", path: "/memories/" }` to inspect before creating.

| Scope               | Path                  | Lifetime                                | Use For                                                             |
| ------------------- | --------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| User memory         | `/memories/`          | Persists across all workspaces and chat | Coding preferences, recurring patterns, general insights            |
| Session memory      | `/memories/session/`  | Current conversation only               | Task-specific context, in-progress notes, working state             |
| Repository memory   | `/memories/repo/`     | Scoped to this workspace (write-once)   | Codebase conventions, build commands, repo-only verified facts      |

Guidelines:

- Before creating a new memory file, view the directory to avoid duplicates.
- Keep entries terse. Bullets and one-line facts only — no prose.
- Update or remove memories that turn out to be wrong or outdated.
- Only the `create` command is supported under `/memories/repo/` (write-once via Copilot).

## Hooks

Edit-time hooks live under `.github/hooks/`. They fire on specific VS Code Copilot tool events and inject additional context or reminders.

| Hook file         | Event          | Purpose                                                                                |
| ----------------- | -------------- | -------------------------------------------------------------------------------------- |
| `post-edit.json`  | `PostToolUse`  | Remind about RTL layout, CSS variables, TV readability, cGet null checks after edits   |

Hook payloads are JSON objects with a `hookSpecificOutput` field containing `additionalContext`. They must:

- Be small and informational (no blocking operations)
- Not fail the chat session
- Use PowerShell on `windows` key; Unix fallback on `fallback` key
- Return valid JSON that VS Code can parse

### Adding New Hooks

Supported hook events: `PostToolUse`, `PreToolUse`. Each can trigger `command` (shell) or `message` (static text). Keep them lightweight — heavy validation belongs in CI, not hooks.

## Dashboard Keyboard Reference

| Key       | Action                          |
| --------- | ------------------------------- |
| `T`       | Cycle themes                    |
| `D`       | Toggle diagnostics overlay      |
| `A`       | Toggle alerts                   |
| `S`       | Open config panel               |
| `N`       | Toggle night dimmer             |
| `+` / `-` | Change font scale               |
| `P`       | Print mode                      |
| `B`       | Bookmark filter                 |
| `H` / `?` | Help overlay                    |
| `Esc`     | Close overlay or maximized card |
