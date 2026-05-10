# MCP Servers — FamilyDashBoard

> Updated: May 2026 · VS Code MCP Protocol · Transport: stdio / streamableHttp / http (Copilot-managed)

This repository ships a committed `.vscode/mcp.json` for shared team servers and is designed to work with VS Code's full MCP feature set.

## Committed Servers (`.vscode/mcp.json`)

| Server       | Type    | Package / URL                                 | Purpose                                                                 |
| ------------ | ------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `github`     | `http`  | `api.githubcopilot.com/mcp` (Copilot-managed) | PRs, issues, code search, workflows, labels, releases via Copilot       |
| `fetch`      | `stdio` | `@modelcontextprotocol/server-fetch`          | Test API endpoints (Open-Meteo, Hebcal, Yahoo, CoinGecko) in chat       |
| `filesystem` | `stdio` | `@modelcontextprotocol/server-filesystem`     | Scoped read/write to workspace — coverage reports, configs, test output |
| `gitkraken`  | `http`  | `mcp.gitkraken.com/mcp`                       | Git blame, log, diff, branch ops, PR workflow, cross-repo work          |
| `playwright` | `stdio` | `@microsoft/mcp-server-playwright`            | Browser automation, screenshot capture, visual regression in chat       |

### Parent-Level Servers (`MyScripts/.vscode/mcp.json`)

| Server       | Type             | Purpose                                                        |
| ------------ | ---------------- | -------------------------------------------------------------- |
| `cloudflare` | `streamableHttp` | Workers, Pages, D1, KV, R2 management (shared across projects) |

All servers above are also configured at the parent level for cross-project use.

## Placement Policy

Use this split consistently:

- **Committed (`.vscode/mcp.json`)**: Servers the whole team uses — GitHub, fetch, filesystem
- **User profile**: Personal servers or experiments — keep out of version control
- **Parent-level (`MyScripts/`)**: Shared servers for all projects in the monorepo parent

This matches the broader tooling policy for `MyScripts/`: common tools belong at the shared level, repository-only behavior stays in the workspace.

## Recommended Server Types

| Server Type                    | Status         | Notes                                                                                          |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------------------------- |
| GitHub (Copilot-managed)       | ✅ Committed   | PRs, issues, labels, release and review workflows, code search                                 |
| Fetch / web                    | ✅ Committed   | API endpoint verification, upstream response inspection, header testing                        |
| Filesystem                     | ✅ Committed   | Workspace-aware browsing; coverage/test output; config reads                                   |
| GitKraken / GitLens            | ✅ Committed   | Cross-project worktree, branch, PR review, Launchpad. Useful for `MyScripts/` multi-repo       |
| Playwright                     | ✅ Committed   | Browser automation, screenshot capture, VR validation. Complements ms-playwright extension     |
| Cloudflare (Wrangler)          | ✅ Parent      | Workers, Pages, D1, KV, R2 management. `streamableHttp` transport via `mcp.cloudflare.com/mcp` |
| Repo-specific internal servers | ⏳ Conditional | Commit only if the whole team needs the same config                                            |

## MCP Capability Model (VS Code May 2026)

MCP servers provide up to five capability classes. When choosing or documenting a server, consider all:

| Capability               | Description                                                                               | Discovery                              |
| ------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| **Tools**                | Callable functions surfaced to chat and agent execution                                   | `tool_search` (deferred loading)       |
| **Resources**            | Read-only context attachments (files, URIs, data) agents can reference                    | Resources panel in chat customizations |
| **Prompts**              | Templated prompt scaffolds exposed by the server (invokable as slash commands)            | Prompt picker in chat                  |
| **Sampling/Elicitation** | Server requests structured input mid-task via VS Code UI (dropdowns, text, confirmations) | Automatic during tool execution        |
| **MCP Apps**             | Inline-rendered rich UI in chat (previews, interactive widgets, forms)                    | Rendered inline automatically          |

### VS Code Integration Points

| Surface                           | What It Does                                             |
| --------------------------------- | -------------------------------------------------------- |
| Chat Customizations editor (gear) | View all loaded tools, resources, prompts per server     |
| `MCP: List Servers` command       | Start, stop, restart, inspect individual servers         |
| Extensions view → MCP section     | Visual server management with status indicators          |
| MCP output log                    | Real-time transport logs for debugging connection issues |
| `tool_search` in agent mode       | Deferred discovery — MCP tools only load on demand       |
| Server lifecycle badges           | Shows running/stopped/error state per server             |

Disabled servers do not load tools, resources, or prompts — keep enable/disable state user-specific.

### Authentication

VS Code supports multiple authentication flows for remote MCP servers:

| Flow                             | Use When                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| OAuth 2.0 (`authorization_code`) | GitHub, Google, or other OAuth providers. VS Code launches browser flow. |
| Input variables (`${input:X}`)   | Static API keys. Prompts once, stores in VS Code secret store.           |
| Copilot-managed                  | GitHub MCP uses Copilot auth automatically. No user action needed.       |

Never hardcode tokens in `mcp.json`. Never commit `mcp.json` with personal tokens or input-variable defaults.

### Transport Types

| Transport        | Use When                                                     | Status        |
| ---------------- | ------------------------------------------------------------ | ------------- |
| `stdio`          | Local servers started by VS Code as a subprocess             | ✅ Active     |
| `http`           | Copilot-managed remote (GitHub MCP, GitKraken)               | ✅ Active     |
| `streamableHttp` | Modern self-hosted remote servers; preferred for new deploys | ✅ Preferred  |
| `sse`            | Legacy remote servers using Server-Sent Events               | ⚠️ Deprecated |

Prefer `streamableHttp` for new remote MCP servers; `stdio` for local processes; `http` for Copilot-managed cloud endpoints. Migrate `sse` servers when they support `streamableHttp`.

### Deferred Tool Discovery

MCP tools are **deferred** in VS Code agent mode — they are not loaded until explicitly requested:

1. Call `tool_search("describe what you need")` before using any MCP-provided tool
2. If `tool_search` returns no result, the server is not running or not configured — do not retry
3. Once loaded, the tool remains available for the rest of the session
4. Use broad queries to discover related tools in one call (e.g., "github" finds issues + PRs + code search)

### Agent–MCP Integration

When adding an agent (`.github/agents/*.agent.md`) that depends on MCP tools:

1. List dependent tools in the agent's `tools:` allowlist
2. Add a comment noting the MCP server dependency
3. Include fallback behavior when the server is unavailable
4. Document which capabilities (tools/resources/prompts) the agent uses

## Security Rules

- Never hardcode tokens or secrets in `mcp.json`
- Prefer input variables, environment-backed values, or Copilot-managed auth
- Only trust and enable servers from known publishers
- Use least privilege — if a server is not materially helping, disable it
- Review trust prompts carefully; starting a server from config can bypass the usual trust flow
- Audit `mcp.json` changes in PR review — treat as a security-sensitive file
- Loopback-only for locally exposed servers (e.g., dashboard MCP endpoint)

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
      "url": "http://localhost:7411/mcp",
    },
  },
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
- When a server provides **resources**, they appear as attachable context in the chat panel.
- When a server provides **prompts**, they appear as invokable slash commands.
- Use `tool_search("<server-tool-description>")` to discover MCP tools at runtime.

## Server Lifecycle

| State      | Meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| `starting` | Server subprocess is launching or HTTP handshake in progress |
| `running`  | Server is ready and tools are discoverable                   |
| `stopped`  | Server is not running; tools are unavailable                 |
| `error`    | Server failed to start; check MCP output log for diagnostics |
| `disabled` | User explicitly disabled; will not start until re-enabled    |

Use `MCP: Restart Server` when a server enters error state after a network or config change.

## Repository Change Rules

- If you commit `.vscode/mcp.json`, document why the server must be shared by the team.
- If an agent or prompt relies on MCP-specific tools, mention that dependency in the relevant `.agent.md` or `.prompt.md` file.
- If a workflow or docs process depends on a server, add that requirement to `.github/AGENTS.md` and the relevant instruction or skill file.
- When adding a new MCP server to the project, update the "Recommended Server Types" table above.
