# AI Customizations — FamilyDashBoard

> Version: v14.2.0 · Tests: 6303 / 205 suites · Coverage thresholds: 93.9 / 85.1 / 94.2 / 95.3

This repository uses the current VS Code Copilot customization model:

- Always-on instructions via `.github/copilot-instructions.md` and `AGENTS.md`
- File-scoped rules via `.github/instructions/*.instructions.md`
- Reusable slash prompts via `.github/prompts/*.prompt.md`
- Custom agents via `.github/agents/*.agent.md`
- Agent skills via `.github/skills/*/SKILL.md`
- Persistent memory via the three-tier memory tool (`/memories/`, `/memories/session/`, `/memories/repo/`)
- Optional MCP server configuration via `.vscode/mcp.json` or user-profile `mcp.json`
- Edit-time hooks via `.github/hooks/*.json` (e.g. `post-edit.json`)

Custom agents are the current term for what older tooling and docs sometimes called custom chat modes. Use agents when you need a persistent persona, scoped tools, or handoffs. Use prompts for lightweight one-shot tasks. Use skills for repeatable multi-step implementation playbooks. Use subagents (`runSubagent`) to run a stateless specialist task without polluting the main conversation.

## What Loads Automatically

| Customization           | Location                                 | Scope                                         | Use It For                                                |
| ----------------------- | ---------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Repository instructions | `.github/copilot-instructions.md`        | All chats in this workspace                   | Core coding rules, architecture, naming, hard constraints |
| Agent-wide instructions | `AGENTS.md`                              | All chats in this workspace                   | How AI customizations are organized in this repo          |
| File instructions       | `.github/instructions/*.instructions.md` | Matching files or semantically relevant tasks | CI/CD, HTML, release work, workspace map                  |
| Prompt files            | `.github/prompts/*.prompt.md`            | Manual `/prompt-name` invocation              | Repeatable task scaffolds                                 |
| Custom agents           | `.github/agents/*.agent.md`              | Manual agent selection or subagent use        | Specialized personas with narrower guidance               |
| Skills                  | `.github/skills/*/SKILL.md`              | Auto-loaded when relevant                     | Tested operational checklists                             |

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
| `/test-coverage`       | Add targeted tests to meet the 93.7%/85.0%/94.1%/95.1% coverage thresholds  |
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

This repository does not require a committed workspace `mcp.json`, but it is designed to work well with MCP servers.

- Put shared, reusable MCP servers in the user profile or your shared parent environment.
- Put repository-specific MCP servers in `.vscode/mcp.json` only when the whole team should share them.
- Prefer least privilege. Only enable servers that materially improve the current task.
- Do not hardcode secrets in `mcp.json`. Use input variables or environment-backed values.
- On Windows, do not rely on sandboxing for local MCP servers because VS Code sandboxing is not currently available there.

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

- Use the **Chat Customizations editor** (gear icon in chat) to inspect loaded instructions, prompts, agents, skills, and MCP servers.
- Use **Chat Diagnostics** (`Copilot: Open Chat Diagnostics`) when a prompt, instructions file, or agent does not appear to load.
- Use **`MCP: List Servers`** in the Command Palette to start, stop, or inspect MCP servers.
- Use the **Extensions view MCP section** to manage server state visually.
- Use `tool_search` before calling any deferred tool — loading a deferred tool without searching first will fail.
- Keep guidance short, concrete, and reference-based. Avoid duplicating the same rule in five places.
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

Some VS Code tools are deferred and must be loaded via `tool_search` before use. Always call `tool_search` with a natural-language description first. Do not retry with different queries if the first search returns no results — the tool is not available. Examples of deferred tools: `runTests`, `run_task`, `get_task_output`, `get_changed_files`, `mcp_github_*`, `github-pull-request_*`.

## Subagents

This repository exposes four subagents that can be invoked via the `runSubagent` tool. Subagent invocations are stateless — the parent agent must pass the full task description in one prompt and ask for the exact return shape it needs.

| Subagent             | Use For                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `Explore`            | Read-only codebase exploration, Q&A, multi-file searches without cluttering the chat |
| `api-integrator`     | New data sources, fetch path repairs, worker/proxy fallback, cache strategy          |
| `dashboard-designer` | RTL layout, theme tokens, card composition, TV readability                           |
| `quality-reviewer`   | Pre-release gates, coverage audits, dead-code scans, lint compliance                 |

Guidelines for invoking subagents:

- Specify thoroughness for `Explore`: `quick`, `medium`, or `thorough`.
- Always include the success/return shape in the prompt ("Return: file paths + line numbers").
- Subagents do not stream back to the user; surface their result yourself with a concise summary.
- Prefer a subagent over manually chaining many search and file-reading operations.

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

Light-weight edit-time hooks live under `.github/hooks/`. The current hook is:

- `post-edit.json` — emits a reminder after each tool use to verify RTL layout, CSS variable usage, and TV font readability.

Keep hook payloads small and informational. Hooks must not block edits or fail the chat session.

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
