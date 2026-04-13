---
name: add-api
description: "Add a new API data source to the FamilyDashBoard. Use when: integrating a new external data provider, adding a new dashboard card/widget with live data, wiring a new fetch with caching, proxy fallback, sync indicator, diagnostic logging, and refresh interval. Produces a complete, production-ready integration."
argument-hint: "Describe the new data source: name, URL, what it returns, desired refresh interval"
---

# Add API — FamilyDashBoard

> Coding rules (cache, fetch, proxy, security) are in `copilot-instructions.md` and `dashboard.instructions.md`. This skill covers the step-by-step integration checklist.

## Step 1 — Plan

| Decision | Value |
|----------|-------|
| Cache key | `dash_v2_<service>` (unique in localStorage) |
| Cache TTL | Match data freshness needs (see Refresh Intervals in dashboard.instructions) |
| Proxy needed? | Yes -> `fetchJSON(url)` / No -> `fetchWithTimeout(url, 8000)` |
| Refresh interval | Match to TTL |

## Step 2 — HTML Card

Add inside the appropriate column in `.dashboard-grid`:

```html
<div class="card" id="card-<id>">
  <div class="card-header" onclick="toggleCardMaximize(this.parentElement)">
    <span class="card-title"><icon> <Hebrew Name></span>
    <span class="sync-indicator" id="sync-<id>"></span>
  </div>
  <div class="card-body" id="pane-<id>">
    <div class="loading-placeholder">טוען...</div>
  </div>
</div>
```

## Step 3 — CSS (if layout changes)

Update grid proportions if adding a column. Use CSS custom properties for all colors.

## Step 4 — JavaScript

Wire these pieces in the `<script>` block:

1. **Sync indicator**: Add `'<id>': document.getElementById('sync-<id>')` to `syncIndicators`
2. **Loader function**: `async function load<Name>()` with:
   - `if (!_pageVisible) return;` guard
   - `acquireLock('<id>')` / `releaseLock('<id>')` wrapper
   - `setSync('<id>', 'syncing')` at start
   - `cGet(KEY, TTL)` cache check -> `cGetStale(KEY)` -> fetch -> `cSet(KEY, data)`
   - `setSync('<id>', 'success'|'error')` on every exit path
   - `diagLog('<Name> OK')` / `diagLog('<Name> ERR: ' + e.message)`
3. **Display function**: `function display<Name>(data)` — use `textContent` (not `innerHTML`), DocumentFragment for lists
4. **Init**: Add `load<Name>` to the `loaders` array in `initDashboard()`
5. **Interval**: `setInterval(() => safeLoad(load<Name>), <intervalMs>)`

## Step 5 — Tests

Add to `tests/dashboard.test.mjs` (see `update-tests` skill for patterns):

```javascript
describe('<Name> Card', () => {
  it('card markup', () => { assert.ok(html.includes('id="card-<id>"')); });
  it('sync indicator', () => { assert.match(html, /'<id>'\s*:\s*document\.getElementById/); });
  it('cache key', () => { assert.match(html, /dash_v2_<service>/); });
  it('safeLoad', () => { assert.match(html, /safeLoad\(load<Name>\)/); });
  it('interval', () => { assert.match(html, /setInterval.*safeLoad\(load<Name>\)/); });
});
```

Add `'sync-<id>'` to the `syncDots` array in "HTML Structure" suite.

## Verification

```bash
node --check BestDashBoard.html
node --test tests/dashboard.test.mjs
```