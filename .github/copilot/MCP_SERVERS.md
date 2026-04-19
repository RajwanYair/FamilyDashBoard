# MCP Servers — FamilyDashBoard

This repository is compatible with VS Code's current MCP server model, but it does not require a committed workspace `mcp.json` to function.

## Placement Policy

Use this split consistently:

- Shared servers for many projects: user-profile `mcp.json` or a shared parent-level setup outside this repo
- Repository-specific servers that the whole team should share: `.vscode/mcp.json`
- One-off personal experiments: user profile only, not committed to the repo

This matches the broader tooling policy for `MyScripts/`: common tools belong at the shared level, repository-only behavior stays in the workspace.

## Recommended Server Types

| Server Type                    | Good Fit Here | Notes                                               |
| ------------------------------ | ------------- | --------------------------------------------------- |
| GitHub                         | Yes           | PRs, issues, labels, release and review workflows   |
| Fetch / web                    | Yes           | Docs lookup, API verification, release-note context |
| Filesystem                     | Yes           | Workspace-aware browsing and read/write tooling     |
| Playwright                     | Optional      | UI validation and screenshot workflows when needed  |
| Repo-specific internal servers | Conditional   | Commit only if the whole team needs the same config |

## Current VS Code MCP Concepts To Account For

MCP servers can provide more than tools:

- Tools for chat and agent execution
- Resources that can be attached as context
- Prompt templates exposed by the server
- MCP apps rendered inline in chat when supported

When documenting or choosing a server, consider all four capabilities, not just tools.

## Security Rules

- Never hardcode tokens or secrets in `mcp.json`.
- Prefer input variables, environment-backed values, or other secure indirection.
- Only trust and enable servers from known publishers.
- Use least privilege. If a server is not materially helping a task, disable it.
- Review trust prompts carefully. Starting a server directly from config can bypass the usual trust flow.

## Windows Notes

This repository is developed primarily on Windows and PowerShell.

- Do not assume local MCP sandboxing is available, because sandboxing is currently not available on Windows.
- If a local server needs shell commands, ensure the configuration and documentation reflect PowerShell usage.

## Operational Guidance

- Use the Chat Customizations editor to inspect which MCP servers are enabled.
- Use `MCP: List Servers` or the MCP section in Extensions to start, stop, or inspect a server.
- Use the MCP output log when tool discovery or startup fails.
- Keep the enable/disable state separate from the committed config. The state is user-specific.

## Repository Change Rules

- If you commit `.vscode/mcp.json`, document why the server must be shared by the team.
- If an agent or prompt relies on MCP-specific tools, mention that dependency in the relevant `.agent.md` or `.prompt.md` file.
- If a workflow or docs process depends on a server, add that requirement to `.github/AGENTS.md` and the relevant instruction or skill file.
