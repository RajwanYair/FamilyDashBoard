---
mode: "agent"
description: "Add a new modular dashboard card. Provide the card name, data source, and refresh interval."
---

# Add New Dashboard Card

> Use the `/add-api` skill for the full integration checklist.

## Requirements

- **Card name**: {{sectionName}}
- **Data source**: {{dataSource}}
- **Refresh interval**: {{refreshInterval}}

## Implementation Steps

1. **Card module**: Add a dedicated module under `src/cards/{{id}}/` using the existing TypeScript card architecture.
2. **Registry**: Register the new card in `src/core/card-registry.ts` with the canonical `data-card-id` and loader wiring.
3. **Data flow**:

    - Start async loaders with `if (!_pageVisible) return;`
    - Use `cGet()` / `cGetStale()` / `cSet()` for cache flow
    - Use `diagLog()` and `setSync()` on every success and error path
    - Prefer worker-backed fetch helpers when available; otherwise use the proxy fallback chain

4. **UI**: Keep RTL layout, CSS variables, and rectangular tile/grid content layout consistent with the existing dashboard.
5. **Tests**: Add or update Vitest coverage in `tests/unit/` (see `/update-tests`).

## Constraints

- Hebrew text with RTL alignment
- Font size readable on TV from 3m distance
- No external libraries
