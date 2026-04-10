---
name: add-api
description: "Add a new API data source to the FamilyDashBoard. Use when: integrating a new external data provider, adding a new dashboard card/widget with live data, wiring a new fetch with caching, proxy fallback, sync indicator, diagnostic logging, and refresh interval. Produces a complete, production-ready integration."
argument-hint: "Describe the new data source: name, URL, what it returns, desired refresh interval"
---

# Add API — FamilyDashBoard

## When to Use
- Adding a new external REST API or RSS feed
- Adding a new card/section that requires live data
- Refactoring an existing section to use the standard fetch/cache pattern

## Checklist Overview
1. Plan — identify symbol/key name, TTL, URL pattern
2. HTML — add card markup in `.top-row` or `.bottom-row`
3. CSS — column proportion adjustment if needed
4. JS — constants, loader function, display function, interval, init hook
5. Diagnostics — diagLog + setSync wiring
6. Tests — add regex-based test coverage

---

## Step 1 — Plan

Before writing code, determine:

| Decision | Question |
|----------|----------|
| Cache key | `dash_v2_<service>` (must be unique in `localStorage`) |
| Cache TTL | How often does this data realistically change? |
| Fetch URL | Does it support direct CORS? Or needs `fetchJSON()`? |
| Proxy needed | Yes → use `fetchJSON(url)`. No → use `fetch(url)` |
| Timeout risk | If slow proxies may hang → use `fetchWithTimeout(url, 8000)` |
| Refresh interval | Match to TTL. See existing intervals in `copilot-instructions.md` |

---

## Step 2 — HTML Card

Add in `BestDashBoard.html` inside `.top-row` or `.bottom-row`:

```html
<!-- NEW: <ServiceName> -->
<div class="card" id="card-<id>">
  <div class="card-header" onclick="toggleCardMaximize(this.parentElement)">
    <span class="card-title"><icon> <Name in Hebrew></span>
    <span class="sync-indicator" id="sync-<id>"></span>
  </div>
  <div class="card-body" id="pane-<id>">
    <div class="loading-placeholder">טוען...</div>
  </div>
</div>
```

**Rules:**
- Hebrew card title (RTL)
- `sync-<id>` must be unique and added to `syncIndicators` below
- `card-body` gets `contain: content` from the shared CSS rule

---

## Step 3 — CSS (if layout changes)

If adding a column changes proportions, update the grid in `.top-row` or `.bottom-row`:

```css
/* top-row — 3 columns */
.top-row { grid-template-columns: 38% 33% 29%; }

/* bottom-row — 3 columns */
.bottom-row { grid-template-columns: 50% 25% 25%; }
```

Always use CSS custom properties for colors — never hardcode. Use `var(--accent)`, `var(--text-primary)`, etc.

---

## Step 4 — JavaScript

### 4a. Sync indicator
In the `syncIndicators` object near the top of the `<script>`:
```javascript
const syncIndicators = {
  // ... existing entries ...
  '<id>': document.getElementById('sync-<id>'),
};
```

### 4b. Loader function
```javascript
async function load<Name>() {
  setSync('<id>', 'syncing');
  const KEY = 'dash_v2_<service>';
  const TTL = <milliseconds>;

  // 1. Check fresh cache first
  const cached = cGet(KEY, TTL);
  if (cached) { display<Name>(cached); setSync('<id>', 'success'); return; }

  // 2. Serve stale while fetching
  const stale = cGetStale(KEY);
  if (stale) display<Name>(stale);

  // 3. Fetch (use fetchJSON for CORS-restricted sources)
  try {
    const data = await fetchJSON('<api-url>');
    // OR: const data = await fetchWithTimeout('<api-url>', 8000).then(r => r.json());
    cSet(KEY, data);
    display<Name>(data);
    setSync('<id>', 'success');
    diagLog('<Name> OK');
  } catch (e) {
    setSync('<id>', 'error');
    diagLog('<Name> ERR: ' + e.message);
  }
}
```

### 4c. Display function

```javascript
function display<Name>(data) {
  const pane = el['pane-<id>'];
  if (!pane) return;

  // Build DOM nodes — use DocumentFragment for multiple items
  const frag = document.createDocumentFragment();
  // ... build nodes, use textContent not innerHTML for external text ...
  pane.replaceChildren(frag); // or: pane.textContent = value;
}
```

**Security rule:** Always use `textContent` for any string that came from an external API.
Do not use `innerHTML` with unsanitized API data.

### 4d. Fetch lock (prevents duplicate concurrent requests)
Wrap the outer fetch logic with fetch locks if the section can be triggered by multiple timers:
```javascript
if (!acquireLock('<id>')) return;
try {
  // ... fetch logic ...
} finally {
  releaseLock('<id>');
}
```

### 4e. Page Visibility guard
Skip fetches when the tab is hidden:
```javascript
if (!_pageVisible) return;
```

### 4f. Register in `init()`
Add to the `loaders` array inside `initDashboard()`:
```javascript
const loaders = [
  // ... existing loaders ...
  load<Name>,
];
```

### 4g. Add refresh interval
After `initDashboard()` sets up the loaders:
```javascript
setInterval(() => safeLoad(load<Name>), <intervalMs>);
```

---

## Step 5 — Diagnostics

- `diagLog()` must be called on both fetch success and error (see 4b above)
- Sync indicator must reach `'success'` or `'error'` on every path through the loader
- The diagnostic overlay (press `D`) will automatically show your new pane's status

---

## Step 6 — Tests

Add to `tests/dashboard.test.mjs`:

```javascript
// <Name> section tests
test('<Name> card markup exists', () => {
  assert.match(html, /id="card-<id>"/);
  assert.match(html, /id="pane-<id>"/);
  assert.match(html, /id="sync-<id>"/);
});

test('<Name> sync indicator registered', () => {
  assert.match(html, /'<id>'\s*:\s*document\.getElementById\('sync-<id>'\)/);
});

test('<Name> cache key uses dash_v2_ prefix', () => {
  assert.match(html, /dash_v2_<service>/);
});

test('<Name> loader uses safeLoad', () => {
  assert.match(html, /safeLoad\(load<Name>\)/);
});
```

---

## Reference Patterns

### fetchJSON (built-in, CORS proxy fallback)
```javascript
const data = await fetchJSON('https://api.example.com/data');
```

### fetchWithTimeout (for slow proxy risks)
```javascript
const res = await fetchWithTimeout('https://api.example.com', 8000);
const data = await res.json();
```

### Dual-layer cache
```javascript
cSet(KEY, data);           // write
cGet(KEY, TTL);            // read fresh only
cGetStale(KEY);            // read regardless of age
```

### Refresh intervals used in this project
| Typical TTL | Use case |
|-------------|----------|
| 60 000 ms   | Real-time / alerts |
| 300 000 ms  | Stocks (market open) |
| 900 000 ms  | News, calendar |
| 1 800 000 ms| Weather |
| 3 600 000 ms| Currency |
