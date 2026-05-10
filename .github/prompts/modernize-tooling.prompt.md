---
description: "Audit and modernize FamilyDashBoard developer tooling, VS Code chat customizations, GitHub workflows, MCP servers, hooks, agents, skills, prompts, and version pins."
tools:
  [
    "read_file",
    "grep_search",
    "file_search",
    "semantic_search",
    "get_errors",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "create_file",
    "run_in_terminal",
    "get_terminal_output",
    "manage_todo_list",
    "vscode_listCodeUsages",
    "memory",
    "tool_search",
    "fetch_webpage",
    "runSubagent",
  ]
---

# Modernize Tooling

Review the current workspace tooling and update it with the latest supported project practices (May 2026).

## Audit Scope

- `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/tasks.json`, `.vscode/mcp.json`
- `.github/workflows/*.yml`
- `.github/ci/install-tools.sh`
- `.github/hooks/*.json` — hook events: `PostToolUse`, `PreToolUse`
- `.github/instructions/*.instructions.md` — `applyTo:` globs, `description:` fields
- `.github/prompts/*.prompt.md` — `mode:`, `model:`, `description:`, `tools:` fields
- `.github/agents/*.agent.md` — `tools:` allowlist, `handoffs:`, `user-invocable:`, `argument-hint:`
- `.github/skills/*/SKILL.md` — discoverable `description:`, `argument-hint:` frontmatter
- `.github/AGENTS.md`, `.github/copilot-instructions.md`, `.github/copilot/MCP_SERVERS.md`, `.github/copilot/config.json`
- `package.json`, `worker/package.json`, and the shared parent `MyScripts/package.json` when version pins need alignment

## Update Goals

- Align version pins with current stable releases actually used by the project
- Use the current VS Code/Copilot customization features:
  - `applyTo:` glob frontmatter on instructions (file-scoped activation)
  - `mode: agent` and optional `model: "<Display Name> (copilot)"` on prompts
  - `tools:` allowlist + `handoffs:` + `user-invocable:` + `argument-hint:` on custom agents
  - Skills auto-discovery via `description:` in `SKILL.md` frontmatter
  - Three-tier memory (`/memories/`, `/memories/session/`, `/memories/repo/`)
  - Subagents via `runSubagent` with `agentName` parameter (Explore, api-integrator, dashboard-designer, quality-reviewer)
  - MCP servers: tools + resources + prompts + sampling/elicitation + inline apps
  - MCP transport: prefer `streamableHttp` (new), use `stdio` (local), deprecate `sse`
  - MCP auth: OAuth 2.0 flows or `${input:TOKEN}` variables
  - Edit-time hooks via `.github/hooks/*.json` (PostToolUse, PreToolUse events)
  - `vscode_askQuestions` for structured multi-option user input
  - `vscode_listCodeUsages` / `vscode_renameSymbol` for semantic code intelligence
  - `send_to_terminal` / `get_terminal_output` for interactive CLI flows
  - `multi_replace_string_in_file` for batch edit operations
  - `fetch_webpage` for external documentation retrieval
  - `view_image` for multimodal image analysis
  - `manage_todo_list` for multi-step task tracking
  - Chat Customizations editor for inspecting loaded customizations
  - Chat Diagnostics (`Copilot: Open Chat Diagnostics`) for troubleshooting
- Harden GitHub Actions with least privilege, concurrency control, timeouts, and accurate build commands
- Keep changes minimal, documented, and consistent with project rules
- After a minor or major release, refresh test counts, coverage thresholds, and version banners across all `.github/**/*.md` files

## Constraints

- Do not add runtime dependencies to the dashboard app
- Do not add local `devDependencies` to `FamilyDashBoard/package.json`
- Preserve PowerShell-only local workflow assumptions
- Update docs when the workflow or supported tool surface changes
- Cross-check that test counts in `copilot-instructions.md`, `workspace.instructions.md`, `AGENTS.md`, and `quality-reviewer.agent.md` agree before committing

## Verification

```powershell
npx markdownlint-cli2 ".github/**/*.md"
npx tsc --noEmit
npx eslint src tests --max-warnings 0
```
