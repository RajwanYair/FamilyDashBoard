---
mode: "agent"
description: "Add a new dashboard section (widget/card). Provide the section name, data source, and refresh interval. The prompt will guide placement in the grid layout, API integration with caching and proxy fallback, and sync indicator wiring."
---

# Add New Dashboard Section

Add a new section to the FamilyDashBoard.

## Requirements

- **Section name**: {{sectionName}}
- **Data source**: {{dataSource}}
- **Refresh interval**: {{refreshInterval}}

## Implementation Steps

1. **HTML**: Add a new `.section` div in the appropriate row (top-row or bottom-row)
2. **CSS**: Adjust grid column proportions if needed
3. **JavaScript**:
   - Add sync indicator to `syncIndicators` object
   - Create `update{{SectionName}}()` async function with:
     - `setSyncStatus('{{id}}', 'syncing')`
     - Cache check via `getCachedData(key)`
     - Fetch with proxy fallback
     - `setCachedData(key, data)`
     - Display function
     - `setSyncStatus('{{id}}', 'success'|'error')`
   - Call from `initDashboard()`
   - Add `setInterval()` with the specified refresh interval
   - Add to `updateRefreshTime()` chain

## Constraints

- Use CSS custom properties for all colors
- Hebrew text with RTL alignment
- Font size readable on TV (minimum 1em for body text)
- No external libraries
