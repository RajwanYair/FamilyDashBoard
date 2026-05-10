# ADR-040 — Mermaid Static Validator in CI

| Field  | Value      |
| ------ | ---------- |
| Date   | 2026-04-26 |
| Status | Accepted   |
| Sprint | 109        |

## Context

`docs/ARCHITECTURE.md`, `docs/adr/*.md`, and `CHANGELOG.md` contain fenced ` ```mermaid `
blocks. These diagrams are rendered by GitHub Markdown preview and local Mermaid tooling,
but no CI check previously verified that the fenced blocks:

1. Begin with a recognised diagram type (`graph`, `flowchart`, `sequenceDiagram`, `classDiagram`,
   `stateDiagram`, `erDiagram`, `gantt`, `pie`, `gitGraph`, `journey`, `quadrantChart`).
2. Have balanced curly braces `{}` inside the diagram body.
3. Close the fenced block with a matching triple-backtick fence.

Malformed diagrams silently fall back to raw text in GitHub's renderer and are never
caught by markdownlint.

## Decision

Add `scripts/check-mermaid.mjs` — a zero-dep Node.js script that statically validates
all fenced Mermaid blocks in the repository:

````js
// Simplified logic:
// 1. Find all .md files (excluding node_modules, dist, coverage)
// 2. For each file, extract ```mermaid … ``` blocks
// 3. Assert: diagram type is a known keyword
// 4. Assert: brace balance (open == close)
// 5. Assert: fence is properly closed
// Exit 1 on any violation; print filename + line number.
````

The script is wired into the CI `build` job:

```yaml
- name: Mermaid diagram validation
  run: node scripts/check-mermaid.mjs
```

## Consequences

- CI `build` job gains a ~1 second static validation step for Mermaid diagrams.
- Malformed diagrams are caught at PR merge time, not after deployment.
- No external Mermaid CLI (`@mermaid-js/mermaid-cli`) is required; the validator is
  intentionally shallow (structure only, no full parse) to stay zero-dep and fast.
- Full semantic validation (node references, arrow syntax) is out of scope for this ADR.

## Alternatives Considered

| Option                               | Rejected Reason                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `@mermaid-js/mermaid-cli` full parse | Adds ~150 MB Puppeteer/Chromium to CI; slower than a structural check for the failure modes targeted here. |
| markdownlint-rule-mermaid            | No published rule exists that covers brace balance and type checking simultaneously.                       |
| Skip validation entirely             | Silent breakage in rendered docs is unacceptable in a production-quality project.                          |
