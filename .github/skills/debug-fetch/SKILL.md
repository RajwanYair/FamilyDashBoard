---
name: debug-fetch
description: "Debug broken API calls and fetch failures in FamilyDashBoard. Use when: a dashboard pane shows an error indicator, data is not loading or is stale, proxy fallback is failing, a stock or weather or news feed is broken, or diagLog shows repeated failures. Covers diagnostic overlay, proxy chain testing, cache state inspection, and common failure patterns."
argument-hint: "Which pane is broken? (e.g. stocks, weather, news, calendar, currency)"
---

# Debug Fetch — FamilyDashBoard

Use this skill when the problem is likely in transport, proxy fallback, worker routing, stale cache behavior, parsing, or loader registration.

## Step 1 — Diagnostic Overlay

Press **`D`** in the browser. Shows per-pane sync status and fetch log.

Look for: which pane is red, how far down the proxy chain each attempt got, whether direct fetch succeeded.

If the module should now be worker-first, verify whether the failure happened in the worker path before assuming a browser-side proxy bug.

## Step 2 — Identify Pattern

| Symptom | Likely Cause |
|---------|-------------|
| All proxies fail | API URL changed or service down |
| Worker path fails before proxies | Worker route bug, validation failure, or missing env/config |
| Direct OK, proxies fail | CORS issue on proxies only |
| Direct + all proxies fail | Network/firewall/API outage |
| Proxy hangs (no response) | Missing `fetchWithTimeout` |
| Stale data after reload | Cache TTL not expired |
| `fetch OK` but wrong data | Response format changed |
| No diagLog entries | Loader not registered in `initDashboard()` |

## Step 3 — Inspect Cache

DevTools -> Application -> Local Storage -> `dash_v2_<service>` keys.

- Check `_ts` timestamp — if recent, cache is serving fresh data
- Delete key + reload to force re-fetch

Code references: `cGet(KEY, TTL)` returns null if expired, `cGetStale(KEY)` always returns if exists.

## Step 4 — Test URL in Console

```javascript
// Direct
fetch('https://<url>').then(r => r.json()).then(console.log).catch(console.error);
// Via proxy (substitute the proxy URL)
fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://<url>'))
  .then(r => r.json()).then(console.log).catch(console.error);
```

If the card uses worker-backed fetch, inspect the worker route and its tests before changing the browser-side module.

## Step 5 — Common Fixes

| Problem | Fix |
|---------|-----|
| API URL changed | Update URL constant in `src/core/constants.ts`, grep for old domain |
| Proxy returns HTML | Validate response: `if (text.startsWith('<')) throw new Error('HTML')` |
| Worker route missing validation | Add a typed adapter or route validation and test it in `tests/unit/worker/worker.test.ts` |
| RSS structure changed | Check `<item>`, `<title>`, `<link>` paths in raw feed |
| Missing timeout | Use `fetchWithTimeout(url, 8000)` not bare `fetch(url)` |
| Stock symbol delisted | Remove/replace in `STOCK_SYMBOLS` array |
| Calendar ICS expired | Get fresh private ICS URL from Google Calendar settings |

## Step 6 — Verify

```powershell
npx vitest run
```

If a URL or constant changed, update the corresponding test in `tests/unit/`.

## Quick Cheatsheet

```text
1. Press D -> check which pane is red
2. Read diagLog -> find where chain broke
3. DevTools > Network -> filter by API domain
4. DevTools > Console -> manually fetch URL
5. DevTools > Local Storage -> delete stale cache
6. Fix URL / proxy / parse
7. npx vitest run
```

## Good End State

- The failing pane reports useful `diagLog()` output
- Sync state distinguishes stale versus hard failure
- The fetch path is consistent with the current worker/proxy architecture
- At least one targeted unit test covers the repaired branch
