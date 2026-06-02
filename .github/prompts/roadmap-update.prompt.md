---
description: "Track and update roadmap progress: mark completed items, identify blockers, prioritize next work."
mode: "agent"
---

# Roadmap Tracker

Update `docs/ROADMAP.md` progress tracking based on recent commits and current codebase state.

## Workflow

1. **Read current roadmap** — `docs/ROADMAP.md`
2. **Check recent commits** — Use gitkraken MCP or `git log --oneline -20` to identify shipped work
3. **Cross-reference** — Match commits to roadmap items
4. **Update status** — Mark completed items, update "In Progress" markers
5. **Identify blockers** — Check for items that depend on external APIs or blocked PRs
6. **Prioritize** — Suggest next 3-5 items based on dependencies and impact

## Rules

- Never remove roadmap items — mark them as completed with a date
- Link completed items to their commit or PR
- Keep the roadmap format consistent with the existing structure
- Update the "Refresh date" header when making changes
- Move shipped items to CHANGELOG.md reference (don't duplicate content)
