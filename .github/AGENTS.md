# AI Customizations — FamilyDashBoard

This repository uses the current VS Code Copilot customization model:

- Always-on instructions via `.github/copilot-instructions.md`, `AGENTS.md`, and `CLAUDE.md`
- File-scoped rules via `.github/instructions/*.instructions.md`
- Reusable slash prompts via `.github/prompts/*.prompt.md`
- Custom agents via `.github/agents/*.agent.md`
- Agent skills via `.github/skills/*/SKILL.md`
- Optional MCP server configuration via `.vscode/mcp.json` or user-profile `mcp.json`

Custom agents are the current term for what older tooling and docs sometimes called custom chat modes. Use agents when you need a persistent persona, scoped tools, or handoffs. Use prompts for lightweight one-shot tasks. Use skills for repeatable multi-step implementation playbooks.

## What Loads Automatically

| Customization | Location | Scope | Use It For |
|---|---|---|---|
| Repository instructions | `.github/copilot-instructions.md` | All chats in this workspace | Core coding rules, architecture, naming, hard constraints |
| Agent-wide instructions | `AGENTS.md` | All chats in this workspace | How AI customizations are organized in this repo |
| Claude compatibility | `CLAUDE.md` | Claude-compatible tools and VS Code | Cross-tool compatibility with the same conventions |
| File instructions | `.github/instructions/*.instructions.md` | Matching files or semantically relevant tasks | CI/CD, HTML, release work, workspace map |
| Prompt files | `.github/prompts/*.prompt.md` | Manual `/prompt-name` invocation | Repeatable task scaffolds |
| Custom agents | `.github/agents/*.agent.md` | Manual agent selection or subagent use | Specialized personas with narrower guidance |
| Skills | `.github/skills/*/SKILL.md` | Auto-loaded when relevant | Tested operational checklists |

## Current Agent Inventory

### `@dashboard-designer`

Use for RTL layout, theme work, card readability, CSS custom properties, typography, spacing, and TV-first presentation.

### `@api-integrator`

Use for API integrations, worker-first fetch flow, proxy fallback, caching, diagnostics, sync dots, and adapter or loader correctness.

## When To Use What

| Need | Best Fit |
|---|---|
| Project-wide coding rules | `.github/copilot-instructions.md` |
| Rules for `.github/**`, `.html`, or release files | `.github/instructions/*.instructions.md` |
| A reusable slash-command task | `.github/prompts/*.prompt.md` |
| A persistent specialist persona with tool limits | `.github/agents/*.agent.md` |
| A repeatable engineering playbook | `.github/skills/*/SKILL.md` |
| External tools, resources, prompts, or apps | MCP servers |

## Prompts

| Prompt | Purpose |
|---|---|
| `/code-review` | Review for bugs, risks, regressions, security, and maintainability |
| `/add-section` | Scaffold a dashboard section or card concept |
| `/fix-quality` | Tighten lint, type, test, and quality issues |
| `/modernize-tooling` | Refresh Copilot, CI, MCP, prompt, instruction, and workflow setup |

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `/add-api` | new API, new card, integration | Fetch + cache + sync + render + tests |
| `/debug-fetch` | broken API, stale pane, proxy failure | Diagnose network, parsing, worker, and cache failures |
| `/release` | version bump, tag, changelog | Release checklist, metadata updates, artifacts, verification |
| `/update-tests` | tests, coverage, flaky suite | Add or refine Vitest coverage safely |

## Instruction Files

| Instruction | Applies To | Purpose |
|---|---|---|
| `copilot-instructions` | All work | Canonical coding rules and hard constraints |
| `workspace.instructions` | `**` | File map, architecture, shell expectations, shared tooling layout |
| `dashboard.instructions` | `**/*.html` | HTML, layout, DOM, and styling rules |
| `cicd.instructions` | `**/*.yml, **/*.yaml, .github/**` | Workflows, Actions, permissions, CI conventions |
| `pre-release.instructions` | `CHANGELOG.md, package.json, sw.js, README.md` | Release gate and version-update checklist |

## MCP Server Guidance

This repository does not require a committed workspace `mcp.json`, but it is designed to work well with MCP servers.

- Put shared, reusable MCP servers in the user profile or your shared parent environment.
- Put repository-specific MCP servers in `.vscode/mcp.json` only when the whole team should share them.
- Prefer least privilege. Only enable servers that materially improve the current task.
- Do not hardcode secrets in `mcp.json`. Use input variables or environment-backed values.
- On Windows, do not rely on sandboxing for local MCP servers because VS Code sandboxing is not currently available there.

See `.github/copilot/MCP_SERVERS.md` for the project policy and recommended server patterns.

## Workflow Map

| Workflow | File | Purpose |
|---|---|---|
| CI | `.github/workflows/ci.yml` | Typecheck, lint, markdownlint, tests, security, worker checks, build |
| Pages deploy | `.github/workflows/deploy.yml` | Build and publish `dist/` to GitHub Pages |
| Release | `.github/workflows/release.yml` | Build tagged release artifacts and publish GitHub Release |
| Worker deploy | `.github/workflows/deploy-worker.yml` | Deploy Cloudflare Worker from `worker/` |
| Auto label | `.github/workflows/auto-label.yml` | Apply PR and issue labels |
| Dependabot merge | `.github/workflows/dependabot-auto-merge.yml` | Controlled automation for dependency PRs |

See `.github/workflows/README.md` for operational details and change rules.

## Diagnostics And Maintenance

- Use the Chat Customizations editor to inspect loaded instructions, prompts, agents, and skills.
- Use Chat Diagnostics when a prompt, instructions file, or agent does not appear to load.
- Keep guidance short, concrete, and reference-based. Avoid duplicating the same rule in five places.
- When a tool or workflow changes, update both the operational file and the markdown that describes it.

## Dashboard Keyboard Reference

| Key | Action |
|---|---|
| `T` | Cycle themes |
| `D` | Toggle diagnostics overlay |
| `A` | Toggle alerts |
| `S` | Open config panel |
| `N` | Toggle night dimmer |
| `+` / `-` | Change font scale |
| `P` | Print mode |
| `B` | Bookmark filter |
| `H` / `?` | Help overlay |
| `Esc` | Close overlay or maximized card |
