# Shared MCP Configuration — MyScripts Projects

> Version: 1.0.0 · Elevatable MCP patterns for all TypeScript projects under `MyScripts/`

This directory documents reusable MCP server configurations, skills patterns, and agent templates that any project in the `MyScripts/` family can adopt.

---

## Shared MCP Servers (Elevate to All Projects)

These servers are project-agnostic and benefit every workspace:

### 1. GitHub (Copilot-Managed)

```jsonc
{
  "github": {
    "type": "http",
    "url": "https://api.githubcopilot.com/mcp",
    "description": "GitHub MCP — PRs, issues, code search, workflows, labels, releases.",
  },
}
```

**Capabilities**: Tools + Resources + Prompts
**Use cases**: Issue triage, PR creation, code search, release management

### 2. Filesystem (Workspace-Scoped)

```jsonc
{
  "filesystem": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem@latest", "${workspaceFolder}"],
    "description": "Scoped read/write access to the workspace root.",
  },
}
```

**Capabilities**: Tools (read, write, list, search, move)
**Use cases**: Config reads, coverage reports, build outputs, test results

### 3. Fetch (API Testing)

```jsonc
{
  "fetch": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-fetch@latest"],
    "description": "Test API endpoints directly in chat. Supports GET/POST with headers.",
  },
}
```

**Capabilities**: Tools (fetch URL with method, headers, body)
**Use cases**: Upstream API verification, response schema inspection, header testing

### 4. GitKraken

```jsonc
{
  "gitkraken": {
    "type": "http",
    "url": "https://mcp.gitkraken.com/mcp",
    "description": "Git blame, log, diff, branch ops, PR workflow, Launchpad.",
  },
}
```

**Capabilities**: Tools (git operations, PR workflows)
**Use cases**: Cross-repo work, blame investigation, branch management

### 5. Playwright (Browser Automation)

```jsonc
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@microsoft/mcp-server-playwright"],
    "description": "Browser automation, screenshot capture, visual debugging, and E2E interaction.",
  },
}
```

**Capabilities**: Tools (navigate, screenshot, click, fill, evaluate)
**Use cases**: Visual regression debugging, E2E interaction, screenshot capture

### 6. Cloudflare (Edge Services)

```jsonc
{
  "cloudflare": {
    "type": "streamableHttp",
    "url": "https://mcp.cloudflare.com/sse",
    "description": "Cloudflare Workers, Pages, KV, D1, R2 — deploy, manage, debug edge services.",
  },
}
```

**Capabilities**: Tools (Workers deploy, KV read/write, D1 query, R2 manage, Pages deploy)
**Use cases**: Worker deployment, KV cache inspection, D1 telemetry queries, edge debugging

---

## Project-Specific Servers (Do NOT Elevate)

These are project-specific and should stay in the individual `.vscode/mcp.json`:

| Server            | Project          | Reason                                      |
| ----------------- | ---------------- | ------------------------------------------- |
| `familydashboard` | FamilyDashBoard  | Dashboard's own MCP bridge (localhost:7411) |
| Database servers  | Backend projects | Schema-specific, not portable               |

---

## Reusable Skills Patterns (Template for New Projects)

These skill structures can be adapted for any project:

### `add-api` — Data Source Integration

Applicable to any project that consumes external APIs. Template:

```markdown
# Add API Skill

1. Define endpoint + auth method
2. Create typed response interface
3. Implement fetch with error handling + retry
4. Add caching layer (project-specific strategy)
5. Wire to UI/consumer with loading states
6. Add diagnostic logging
7. Write integration tests
8. Document in data-sources
```

### `debug-fetch` — Network Debugging

Applicable to any project with network requests:

```markdown
# Debug Fetch Skill

1. Check diagnostic logs for error patterns
2. Verify endpoint reachability (direct + proxy)
3. Inspect cache state (stale vs fresh vs miss)
4. Check response schema against expected types
5. Verify error propagation to UI
6. Test fallback paths
```

### `release` — Version Release

Applicable to any semver-versioned project:

```markdown
# Release Skill

1. Bump version in package.json (+ related files)
2. Update CHANGELOG.md
3. Run full quality gate (typecheck + lint + test + build)
4. Verify bundle size budget
5. Tag commit with semver
6. Create GitHub release with notes
```

### `update-tests` — Test Maintenance

Applicable to any project with Vitest/Jest:

```markdown
# Update Tests Skill

1. Identify coverage gaps or broken assertions
2. Follow existing test file naming convention
3. Use project's mock patterns (spies, stubs, resets)
4. Validate with targeted test run first
5. Run full suite before committing
6. Update coverage thresholds if improved
```

---

## Reusable Agent Patterns (Template for New Projects)

### Quality Reviewer (Universal)

Every project benefits from a quality agent that:

- Runs typecheck → lint → test → build pipeline
- Checks for suppressions (`eslint-disable`, `@ts-ignore`)
- Scans for security anti-patterns
- Produces a structured PASS/FAIL report
- Fixes blockers before flagging warnings

### Data Flow Agent (API-Heavy Projects)

Projects with external data sources benefit from:

- Fetch debugging and proxy chain testing
- Cache strategy verification
- Schema validation of upstream responses
- Fallback path testing

### UI Agent (Frontend Projects)

Projects with UI benefit from:

- Accessibility audit
- RTL/i18n verification
- Theme token compliance
- Visual regression awareness

---

## Transport Selection Guide

| Scenario                         | Transport        | Notes                                    |
| -------------------------------- | ---------------- | ---------------------------------------- |
| Local CLI tool (npx package)     | `stdio`          | VS Code manages the subprocess lifecycle |
| Copilot-managed cloud service    | `http`           | Auth handled by VS Code/Copilot          |
| Self-hosted remote (your server) | `streamableHttp` | Modern bidirectional; preferred          |
| Legacy remote (older servers)    | `sse`            | Deprecated; migrate when possible        |

---

## Adoption Checklist for New Projects

1. Copy the shared servers block into `.vscode/mcp.json`
2. Add project-specific servers only if the whole team needs them
3. Create `.github/copilot/MCP_SERVERS.md` documenting server purposes
4. Add `tool_search` rule to `copilot-instructions.md` (rule 44 pattern)
5. List MCP tool dependencies in agent `tools:` allowlists
6. Never commit tokens or secrets in `mcp.json`
