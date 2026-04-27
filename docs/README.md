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

## Legacy And Archive Boundary

| File                                                   | Status                                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [legacy/BestDashBoard.html](legacy/BestDashBoard.html) | Archived legacy dashboard artifact. Preserve for historical reference only; do not treat as the current runtime or source of truth. |

## Release And Operations Docs

| File                                                                                                       | Purpose                                            |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [../.github/instructions/workspace.instructions.md](../.github/instructions/workspace.instructions.md)     | Environment, file map, and current tooling context |
| [../.github/instructions/pre-release.instructions.md](../.github/instructions/pre-release.instructions.md) | Mandatory pre-release checklist before tagging     |
| [../.github/CONTRIBUTING.md](../.github/CONTRIBUTING.md)                                                   | Contributor workflow and development expectations  |
| [../.github/SUPPORT.md](../.github/SUPPORT.md)                                                             | Support and operator guidance                      |
| [../.github/SECURITY.md](../.github/SECURITY.md)                                                           | Security policy                                    |

## Technical Guides

| File                                                     | Purpose                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| [adding-a-card.md](adding-a-card.md)                     | Step-by-step guide for adding a new card                        |
| [deployment.md](deployment.md)                           | GitHub Pages and Cloudflare Pages deployment                    |
| [data-sources.md](data-sources.md)                       | All external APIs, worker routes, cache keys, and failure modes |
| [card-architecture-audit.md](card-architecture-audit.md) | Card migration audit: FdbCard adoption status                   |

## Documentation Rules

- Top-level docs must describe the modular TypeScript app, not the archived single-file dashboard.
- If architecture changes, update [ARCHITECTURE.md](ARCHITECTURE.md), [adr/README.md](adr/README.md), and any impacted ADR in the same sprint.
- If a fact is duplicated across docs, the canonical source is [../.github/copilot-instructions.md](../.github/copilot-instructions.md).
