# AI Customizations — FamilyDashBoard

> Version: v14.13.1 · Tests: 7228 / 282 suites · Coverage: 95.7 / 88.8 / 95.1 / 96.7

## Customization Model

| Type              | Location                                              | Loaded                 |
| ----------------- | ----------------------------------------------------- | ---------------------- |
| Repository rules  | `.github/copilot-instructions.md`                     | Always                 |
| File-scoped rules | `.github/instructions/*.instructions.md`              | On `applyTo:` match    |
| Slash prompts     | `.github/prompts/*.prompt.md`                         | On `/name` invocation  |
| Agents            | `.github/agents/*.agent.md`                           | On @mention or handoff |
| Skills            | `.github/skills/*/SKILL.md`                           | On description match   |
| Hooks             | `.github/hooks/*.json`                                | On tool event          |
| MCP servers       | `.vscode/mcp.json` or user profile                    | Per server config      |
| Memory            | `/memories/`, `/memories/session/`, `/memories/repo/` | On tool use            |

## When To Use What

| Need                                | Best Fit                         |
| ----------------------------------- | -------------------------------- |
| Project-wide coding rules           | `copilot-instructions.md`        |
| File-type rules (CSS/TS/HTML/tests) | `instructions/*.instructions.md` |
| Repeatable slash-command            | `prompts/*.prompt.md`            |
| Specialist persona with tool limits | `agents/*.agent.md`              |
| Multi-step implementation playbook  | `skills/*/SKILL.md`              |
| External tools/resources            | MCP servers                      |

## Agents (3)

- **`@api-integrator`** — API, fetch, proxy, caching, worker, sync dots
- **`@dashboard-designer`** — RTL, themes, CSS, cards, TV readability
- **`@quality-reviewer`** — Pre-release gates, coverage, dead-code, lint compliance

## Subagents

| Name                 | Use For                                           |
| -------------------- | ------------------------------------------------- |
| `Explore`            | Read-only codebase exploration, multi-file search |
| `api-integrator`     | Data sources, fetch repairs, cache strategy       |
| `dashboard-designer` | Layout, themes, card composition, TV readability  |
| `quality-reviewer`   | Pre-release gates, coverage, dead-code scans      |

## Key Conventions

- **Deferred tools**: call `tool_search` before any MCP/deferred tool
- **Code intelligence**: `vscode_listCodeUsages` before renaming; `vscode_renameSymbol` for refactors
- **Batch edits**: `multi_replace_string_in_file` for 2+ independent changes
- **Diagnostics**: `get_errors` over terminal lint/tsc for single-file checks
- **Tasks**: `run_task` over `run_in_terminal` for workspace-defined commands
- **Interactive**: `send_to_terminal` + `vscode_askQuestions` for CLI flows
- **Memory**: view `/memories/` before creating; keep entries terse
- **Model lock**: prompt frontmatter `model: "Name (copilot)"` for deterministic output
- **PowerShell only**: all terminal commands must be valid PowerShell (Windows)
- **Prompts**: 17 available — use `/sprint` for roadmap work, `/release-check` for gates
- **Hooks**: `PreToolUse` guards (no duplicate files, context in edits, prefer run_task, listUsages before rename, no parallel semantic_search); `PostToolUse` reminds conventions + checks exit codes

## Slash Prompts (17)

| Prompt                 | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `/sprint`              | Implement next N roadmap sprints in priority order    |
| `/release-check`       | Full pre-release checklist — all gates must be green  |
| `/version-bump`        | Bump version across all 16 documented files           |
| `/fix-lint`            | Fix all ESLint and TypeScript errors to zero warnings |
| `/fix-quality`         | Fix quality issues found by reviewer                  |
| `/test-coverage`       | Increase test coverage for a specific module          |
| `/code-review`         | Review code for quality, security, and conventions    |
| `/security-audit`      | OWASP Top 10 audit of the codebase                    |
| `/browser-compat`      | Check browser compatibility of new features           |
| `/debug-card`          | Debug a broken or stale dashboard card                |
| `/worker-debug`        | Debug a failing worker route or upstream API          |
| `/worker-route`        | Add or modify a Cloudflare Worker route               |
| `/add-card`            | Add a new dashboard card from scratch                 |
| `/add-section`         | Add a new section or overlay to the dashboard         |
| `/card-contract-audit` | Audit card HTML/TS/CSS contract compliance            |
| `/kv-stale-audit`      | Audit KV stale cache fallback patterns                |
| `/modernize-tooling`   | Upgrade or modernize build/test tooling               |

## MCP Servers (5 committed + 1 parent)

| Server                | Type           | Token-Saving Role                                             |
| --------------------- | -------------- | ------------------------------------------------------------- |
| `github`              | http           | PRs, issues, code search — no manual `gh` CLI needed          |
| `fetch`               | stdio          | Test upstream APIs in chat — no manual curl/Invoke-WebRequest |
| `filesystem`          | stdio          | Read coverage/test output — no manual file parsing            |
| `gitkraken`           | http           | Git blame, log, diff — no manual `git log` parsing            |
| `playwright`          | stdio          | Browser automation in chat — no manual E2E debugging          |
| `cloudflare` (parent) | streamableHttp | Workers/KV/D1 management — no manual wrangler CLI             |

> All MCP tools are deferred — call `tool_search` before first use. See `.github/copilot/MCP_SERVERS.md` for full docs.

## Extension-Aware Token Optimization

Extensions that surface data via `get_errors` (single call replaces multiple terminal runs):

| Extension          | Diagnostic Type                    | Token Savings                                 |
| ------------------ | ---------------------------------- | --------------------------------------------- |
| ESLint             | Lint errors/warnings               | Skip `npx eslint` for single files            |
| Stylelint          | CSS layer/property violations      | Skip `npx stylelint` for single files         |
| webhint            | Browser compat warnings            | Skip manual `.browserslistrc` checks          |
| markdownlint       | MD formatting issues               | Skip `npx markdownlint-cli2` for single files |
| Code Spell Checker | Spelling errors (Hebrew + English) | No manual spell-check needed                  |
| TypeScript         | Type errors                        | Skip `npx tsc --noEmit` for single files      |

Extensions that reduce Copilot work (user sees inline data):

| Extension        | What User Sees                | Copilot Can Skip               |
| ---------------- | ----------------------------- | ------------------------------ |
| Error Lens       | All errors inline in editor   | Re-explaining visible errors   |
| Coverage Gutters | Uncovered lines highlighted   | Parsing lcov.info manually     |
| Console Ninja    | `diagLog()` output inline     | Adding temporary debug logging |
| Version Lens     | Outdated deps in package.json | Running `npm outdated`         |
| Baseline Lens    | CSS/JS compat status inline   | Checking caniuse.com           |
| Color Highlight  | Hardcoded colors visible      | Grepping for hex values        |
| TODO Tree        | TODO/FIXME locations sidebar  | Grepping for TODO comments     |
