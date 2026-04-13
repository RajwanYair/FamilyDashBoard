---
mode: "agent"
description: "Add a new dashboard section (widget/card). Provide the section name, data source, and refresh interval."
---

# Add New Dashboard Section

> Use the `/add-api` skill for the full integration checklist.

## Requirements

- **Section name**: {{sectionName}}
- **Data source**: {{dataSource}}
- **Refresh interval**: {{refreshInterval}}

## Implementation Steps

1. **HTML**: Add card markup in the appropriate column of `.dashboard-grid`
2. **CSS**: Adjust grid column proportions if needed, use CSS custom properties
3. **JavaScript**:
   - Add sync indicator to `syncIndicators` object
   - Create `load{{SectionName}}()` async function with:
     - `if (!_pageVisible) return;` guard
     - `setSync('{{id}}', 'syncing')`
     - Cache: `cGet(key, TTL)` → `cGetStale(key)` → fetch → `cSet(key, data)`
     - `setSync('{{id}}', 'success'|'error')` on every exit path
     - `diagLog()` on success and error
   - Register in `initDashboard()` loaders array
   - Add `setInterval(() => safeLoad(load{{SectionName}}), interval)`
4. **Tests**: Add describe block (see `/update-tests` skill)

## Constraints

- Hebrew text with RTL alignment
- Font size readable on TV (base 28px)
- No external libraries
