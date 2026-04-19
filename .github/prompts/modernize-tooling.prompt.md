---
mode: "agent"
description: "Audit and modernize FamilyDashBoard developer tooling, VS Code chat customizations, GitHub workflows, MCP servers, hooks, and version pins."
---

# Modernize Tooling

Review the current workspace tooling and update it with the latest supported project practices.

## Audit Scope

- `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/tasks.json`, `.vscode/mcp.json`
- `.github/workflows/*.yml`
- `.github/ci/install-tools.sh`
- `.github/hooks/*.json`
- `.github/prompts/*.prompt.md`, `.github/AGENTS.md`
- `package.json`, `worker/package.json`, and the shared parent `MyScripts/package.json` when version pins need alignment

## Update Goals

- Align version pins with current stable releases actually used by the project
- Prefer official VS Code/Copilot customization features: prompt files, hooks, MCP servers, custom agents, and skills
- Enable current VS Code agent capabilities that improve debugging and workflow reliability
- Harden GitHub Actions with least privilege, concurrency control, timeouts, and accurate build commands
- Keep changes minimal, documented, and consistent with project rules

## Constraints

- Do not add runtime dependencies to the dashboard app
- Do not add local `devDependencies` to `FamilyDashBoard/package.json`
- Preserve PowerShell-only local workflow assumptions
- Update docs when the workflow or supported tool surface changes
