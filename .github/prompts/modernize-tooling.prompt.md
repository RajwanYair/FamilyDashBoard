---
mode: "agent"
description: "Audit and modernize FamilyDashBoard developer tooling, VS Code chat customizations, GitHub workflows, MCP servers, hooks, agents, skills, prompts, and version pins."
---

# Modernize Tooling

Review the current workspace tooling and update it with the latest supported project practices.

## Audit Scope

- `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/tasks.json`, `.vscode/mcp.json`
- `.github/workflows/*.yml`
- `.github/ci/install-tools.sh`
- `.github/hooks/*.json`
- `.github/instructions/*.instructions.md` — `applyTo:` globs, `description:` fields
- `.github/prompts/*.prompt.md` — `mode:`, `model:`, `description:` fields
- `.github/agents/*.agent.md` — `tools:` allowlist, `handoffs:`, `user-invocable:`
- `.github/skills/*/SKILL.md` — discoverable descriptions, argument hints
- `.github/AGENTS.md`, `.github/copilot-instructions.md`, `.github/copilot/MCP_SERVERS.md`
- `package.json`, `worker/package.json`, and the shared parent `MyScripts/package.json` when version pins need alignment

## Update Goals

- Align version pins with current stable releases actually used by the project
- Use the current VS Code/Copilot customization features:
  - `applyTo:` glob frontmatter on instructions
  - `mode: agent` and optional `model: "<Display Name> (copilot)"` on prompts
  - `tools:` allowlist + `handoffs:` + `user-invocable:` on custom agents
  - Skills auto-discovery via `description:` in `SKILL.md`
  - Three-tier memory (`/memories/`, `/memories/session/`, `/memories/repo/`)
  - Subagents via `runSubagent` (Explore, api-integrator, dashboard-designer, quality-reviewer)
  - MCP servers via `.vscode/mcp.json` (workspace) or user profile (shared)
  - Edit-time hooks via `.github/hooks/*.json`
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
