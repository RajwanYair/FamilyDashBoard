---
description: "Show current roadmap status, next priorities, and progress against streams."
mode: "agent"
---

# Roadmap Status

Read `docs/ROADMAP.md` and produce a concise progress report.

## Output Format

```markdown
## Roadmap Progress — v{{VERSION}}

### Active Streams

| Stream | Status | Next Action |
| ------ | ------ | ----------- |
| ...    | ...    | ...         |

### Completed This Cycle

- ...

### Blockers

- ...

### Next Priorities (top 5)

1. ...
```

## Rules

- Only report items from the roadmap file — do not invent work
- Mark items that have merged commits as "Done"
- Identify items blocked by external dependencies
- Suggest which items to tackle next based on priority and dependencies
