# Documentation Map

This directory is the canonical entry point for product documentation in FamilyDashBoard.

## Current Product Docs

| File                                                                     | Purpose                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [../README.md](../README.md)                                             | Operator-friendly overview, setup, features, and release summary |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                       | Runtime structure, cache layers, worker topology, and invariants |
| [ROADMAP.md](ROADMAP.md)                                                 | Current strategy, stream priorities, and release direction       |
| [adr/README.md](adr/README.md)                                           | Accepted architectural decisions and their rationale             |
| [../CHANGELOG.md](../CHANGELOG.md)                                       | Versioned release history                                        |
| [../.github/copilot-instructions.md](../.github/copilot-instructions.md) | Canonical coding rules and project constraints                   |

## Release And Operations Docs

| File                                                                                                       | Purpose                                            |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [../.github/instructions/workspace.instructions.md](../.github/instructions/workspace.instructions.md)     | Environment, file map, and current tooling context |
| [../.github/instructions/pre-release.instructions.md](../.github/instructions/pre-release.instructions.md) | Mandatory pre-release checklist before tagging     |
| [../.github/CONTRIBUTING.md](../.github/CONTRIBUTING.md)                                                   | Contributor workflow and development expectations  |
| [../.github/SUPPORT.md](../.github/SUPPORT.md)                                                             | Support and operator guidance                      |
| [../.github/SECURITY.md](../.github/SECURITY.md)                                                           | Security policy                                    |

## Technical Guides

| File                                 | Purpose                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| [mcp.md](mcp.md)                     | MCP bridge operator guide (X11 / D1, ADR-066)                   |
| [adding-a-card.md](adding-a-card.md) | Step-by-step guide for adding a new card                        |
| [deployment.md](deployment.md)       | GitHub Pages and Cloudflare Pages deployment                    |
| [data-sources.md](data-sources.md)   | All external APIs, worker routes, cache keys, and failure modes |
| [error-viewer.md](error-viewer.md)   | Diagnostic overlay and error inspection                         |
| [keyboard.md](keyboard.md)           | Keyboard shortcuts reference                                    |
| [local-dev.md](local-dev.md)         | Local development setup and hot-reload guide                    |
| [privacy.md](privacy.md)             | Privacy policy and data handling                                |
| [screen-reader.md](screen-reader.md) | Accessibility and screen-reader support                         |
| [security.md](security.md)           | Security architecture and threat model                          |
| [sync.md](sync.md)                   | Configuration sync and export/import                            |
| [video-cards.md](video-cards.md)     | Video news card architecture and CSP considerations             |

## Documentation Rules

- Top-level docs must describe the modular TypeScript app, not the archived single-file dashboard.
- If architecture changes, update [ARCHITECTURE.md](ARCHITECTURE.md), [adr/README.md](adr/README.md), and any impacted ADR in the same sprint.
- If a fact is duplicated across docs, the canonical source is [../.github/copilot-instructions.md](../.github/copilot-instructions.md).
