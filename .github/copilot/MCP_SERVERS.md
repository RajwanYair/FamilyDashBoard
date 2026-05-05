# MCP Servers — FamilyDashBoard

This repository is compatible with VS Code's current MCP server model, but it does not require a committed workspace `mcp.json` to function.

## Placement Policy

Use this split consistently:

- Shared servers for many projects: user-profile `mcp.json` or a shared parent-level setup outside this repo
- Repository-specific servers that the whole team should share: `.vscode/mcp.json`
- One-off personal experiments: user profile only, not committed to the repo

This matches the broader tooling policy for `MyScripts/`: common tools belong at the shared level, repository-only behavior stays in the workspace.

## Recommended Server Types

| Server Type                    | Good Fit Here | Notes                                                                                                                                                       |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                         | Yes           | PRs, issues, labels, release and review workflows                                                                                                           |
| Fetch / web                    | Yes           | Docs lookup, API verification, release-note context                                                                                                         |
| Filesystem                     | Yes           | Workspace-aware browsing and read/write tooling                                                                                                             |
| Playwright                     | Optional      | UI validation and screenshot workflows when needed                                                                                                          |
| GitKraken / GitLens            | Optional      | Cross-project worktree, branch, PR review and "start work" flows. Useful when juggling multiple `MyScripts/` repos.                                         |
| Azure (Cloud / Wrangler-side)  | Conditional   | Only when interacting with the Cloudflare worker's deployment surface or comparable Azure resources. Disabled by default; not required for static-PWA work. |
| Repo-specific internal servers | Conditional   | Commit only if the whole team needs the same config                                                                                                         |

## Current VS Code MCP Concepts To Account For

MCP servers can provide more than tools. When choosing or documenting a server, consider all five capability classes:

- **Tools** — callable functions surfaced to chat and agent execution
- **Resources** — read-only context attachments (files, URIs, database rows)
- **Prompts** — templated prompt scaffolds exposed by the server
- **Sampling / elicitation** — the server can request structured input from the user mid-task via VS Code's input UI
- **MCP apps** — inline-rendered UI in chat where supported by the host

VS Code surfaces MCP capabilities through the **Chat Customizations editor**, the `MCP: List Servers` command, the **Extensions view MCP section** (start / stop / inspect individual servers), and the MCP output log. Disabled servers do not load tools, resources, or prompts — keep enable/disable state user-specific.

### Authentication

VS Code supports two authentication flows for remote MCP servers:

- **OAuth 2.0 (`authorization_code`)** — VS Code launches the browser flow and stores the token securely. Use for GitHub, Google, or other OAuth providers.
- **Input variables** — `${input:TOKEN}` prompts the user once and stores in the secret store. Use for static API keys.

Never hardcode tokens in `mcp.json`. Never commit `mcp.json` with personal tokens or input-variable defaults.

### Transport Types

VS Code supports three MCP transport types. Document which one a server uses:

| Transport        | Use When                                              |
| ---------------- | ----------------------------------------------------- |
| `stdio`          | Local servers started by VS Code as a subprocess      |
| `sse`            | Legacy remote servers using Server-Sent Events        |
| `streamableHttp` | Modern remote servers; preferred for new deployments  |

Prefer `streamableHttp` for new remote MCP servers; `stdio` for local processes. `sse` is deprecated — migrate when the server supports `streamableHttp`.

### Deferred Tool Discovery

MCP tools are **deferred** in VS Code agent mode — they are not loaded until explicitly requested. Always call `tool_search` with a natural-language query before using any MCP tool. If `tool_search` returns no result for a tool, the server is not running or not configured.

### Tool Discovery

When adding an agent (`.github/agents/*.agent.md`) that depends on MCP tools, list those tools in the agent's `tools:` allowlist under a comment. This makes the dependency visible without requiring the server to be running at edit time.

## Security Rules

- Never hardcode tokens or secrets in `mcp.json`.
- Prefer input variables, environment-backed values, or other secure indirection.
- Only trust and enable servers from known publishers.
- Use least privilege. If a server is not materially helping a task, disable it.

---

## Dashboard-Exposed Local MCP Server (v14.x, X11)

FamilyDashBoard itself will expose a **read-only MCP server** at `localhost:7411/mcp` (opt-in via `?mcp=1`, ADR-066). This is a _server the dashboard exposes_, not a server you configure here.

**What it surfaces** (JSON, read-only): today-pane signal · calendar next-event · hebrew-cal next-zman · active alerts · weather summary · stocks top-mover · countdowns < 24 h.

**Security contract**: loopback-only (`127.0.0.1`), zero network egress, CSP unchanged. Verified by an integration test that the bind address is never a remote origin. RUM CSP violation sampling active for 30 days post-launch (Q9 open question, §8 of ROADMAP.md).

**For AI assistant configuration**: when X11 ships, add it to `.vscode/mcp.json` as a `streamableHttp` server:

```jsonc
// .vscode/mcp.json (X11 — add when v14.x ships)
{
  "servers": {
    "familydashboard": {
      "type": "streamableHttp",
      "url": "http://localhost:7411/mcp"
    }
  }
}
```

Do **not** add this entry today — the server is not yet implemented. Track progress in `docs/ROADMAP.md §6.4`.

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
