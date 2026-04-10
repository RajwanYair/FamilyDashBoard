---
name: debug-fetch
description: "Debug broken API calls and fetch failures in FamilyDashBoard. Use when: a dashboard pane shows an error indicator, data is not loading or is stale, proxy fallback is failing, a stock or weather or news feed is broken, or diagLog shows repeated failures. Covers diagnostic overlay, proxy chain testing, cache state inspection, and common failure patterns."
argument-hint: "Which pane is broken? (e.g. stocks, weather, news, calendar, currency)"
---

# Debug Fetch — FamilyDashBoard

## When to Use
- A sync indicator shows 🔴 (error) or stays ⏳ (stuck syncing)
- A pane shows stale data or "טוען..." forever
- `diagLog` shows repeated `ERR` lines
- A specific API source stopped returning data
- Proxy fallback chain appears to be cycling forever

---

## Step 1 — Open the Diagnostic Overlay

Press **`D`** in the browser to open the diagnostic overlay.

The overlay shows:
- **Per-pane sync status**: success ✅ / syncing ⏳ / error ❌
- **Fetch log**: last N fetch attempts per URL, with direct/proxy labels and status

Look for:
- Which pane is failing (`sync-<id>` = error)
- How far down the proxy chain each attempt got
- Whether direct fetch worked or failed

---

## Step 2 — Identify the Failure Pattern

| Symptom | Likely Cause |
|---------|-------------|
| All proxies fail | API URL changed or service down |
| Direct OK, proxies fail | CORS issue on proxies only (shouldn't break — direct should win) |
| Direct fails, all proxies fail | Network / firewall / API outage |
| One proxy hangs (no response) | `fetchWithTimeout` not used — returns only after AbortController timeout |
| Data is stale even after reload | Cache TTL not expired — serve is returning cached data intentionally |
| `fetch OK` in diagLog but wrong data | Response format changed — parse error downstream |
| No diagLog entries for this pane | Loader not running — check `initDashboard()` registration |

---

## Step 3 — Inspect the Cache

Open browser DevTools → Application → Local Storage → look for `dash_v2_<service>` keys.

- Check the stored value and `_ts` timestamp
- If `_ts` is recent, the cache is serving fresh data and the loader won't fetch
- To force a re-fetch: delete the `dash_v2_<service>` key in DevTools → reload

In the code, find cache usage:
```javascript
const cached = cGet(KEY, TTL);   // returns null if expired
const stale  = cGetStale(KEY);   // always returns if exists
```

---

## Step 4 — Test the API URL Directly

In browser DevTools Console, test each stage:

```javascript
// 1. Direct fetch (no proxy)
fetch('https://<api-url>')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// 2. Via allorigins proxy
fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://<api-url>'))
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// 3. Via codetabs proxy
fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://<api-url>'))
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);

// 4. Via corsproxy.io
fetch('https://corsproxy.io/?' + encodeURIComponent('https://<api-url>'))
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

Whichever returns valid data → that proxy is working. If none work → API itself is down.

---

## Step 5 — Common Fixes

### API URL changed
Update the URL constant near the top of `<script>` in `BestDashBoard.html`.
Search for the old URL: `grep_search pattern: "<old-domain>"`.

### Proxy returned HTML error page (not JSON)
Some proxies return HTML errors for bad requests. Fix: validate response before parsing.
```javascript
const text = await res.text();
if (text.startsWith('<')) throw new Error('Proxy returned HTML');
const data = JSON.parse(text);
```

### RSS feed format changed
RSS fetched via proxy returns XML. If the feed structure changed:
- Open the raw feed URL in browser
- Check if `<item>`, `<title>`, `<link>`, `<description>` selector paths are still correct

### `fetchWithTimeout` not used → hanging proxies
For any fetch that goes through slow proxies, ensure:
```javascript
const res = await fetchWithTimeout(url, 8000);
```
Not:
```javascript
const res = await fetch(url);  // ❌ can hang forever
```

### Stock symbol delisted or renamed
`STOCK_SYMBOLS` array at top of script — remove or replace the bad symbol.
Yahoo Finance v8 API: if a symbol returns 404, the whole batch call may fail.

### Calendar ICS URL expired
Google Calendar ICS URLs can expire or change. Check the URL in the `CALENDAR_URL` constant.
If expired: update to a fresh private ICS URL from Google Calendar settings.

---

## Step 6 — Verify Page Visibility Guard

If fetches stop completely when switching tabs and never resume when returning:
```javascript
// Find in script:
document.addEventListener('visibilitychange', () => {
  _pageVisible = !document.hidden;
  if (_pageVisible) { /* triggers refresh */ }
});
```
Confirm `_pageVisible` is reset to `true` on `visibilitychange`.

---

## Step 7 — Re-run Tests

After any fix:
```bash
node --test tests/dashboard.test.mjs
```

If a URL or constant changed, update the corresponding regex in `tests/dashboard.test.mjs`.

---

## Quick Debug Cheatsheet

```
1. Press D → check which pane is red
2. Read diagLog → find where the chain broke
3. DevTools > Network → filter by the API domain name
4. DevTools > Console → manually fetch the URL
5. DevTools > Local Storage → delete stale cache
6. Fix URL / proxy logic / parse error
7. node --test to confirm no regressions
```
