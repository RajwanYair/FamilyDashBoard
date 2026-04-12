# GitHub Copilot Instructions — FamilyDashBoard

> 📺 Single-file TV dashboard · 🇮🇱 Hebrew RTL · 🎨 5 Themes (OLED default) · 🚫 Zero Dependencies

## Project Overview

Single-page family dashboard (`BestDashBoard.html`) designed for always-on TV display in the family living room. Current version: **v5.0.0**.

## Technical Stack

- **Language**: HTML5, vanilla CSS3, vanilla JavaScript (ES2020+)
- **No build tools**: Zero dependencies — open the HTML file directly in a browser
- **APIs consumed**: Open-Meteo (weather + UV + hourly + precipitation probability), Hebcal (Hebrew dates + Shabbat + holidays + Zmanim + Parasha + Daf Yomi), Yahoo Finance v8/chart (stocks + gold/silver via proxy), CoinGecko (BTC-USD fallback), ER-API + exchangerate-api (currency), 17 Hebrew RSS feeds (news), Sefaria.org (daily halacha + Parasha + Psalm + Aliyot + Daf Yomi links), Google Calendar ICS (native parser + iframe fallback), tzevaadom.co.il (red alerts), OpenWeatherMap AQI (free tier, no key), USGS GeoJSON (earthquakes)
- **CORS proxies**: `allorigins.win`, `codetabs.com`, `corsproxy.io` (const array, direct fetch tried first)
- **Design system**: Dark glassmorphism with 5 CSS-variable themes, animated background, bézier SVG charts, 6 card entrance animations, card maximize (FLIP animation)
- **Tests**: 1135 tests / 61 suites — `node --test tests/dashboard.test.mjs` (zero dependencies, Node.js built-in runner)

## Architecture

### Single-File Dashboard

- Everything lives in `BestDashBoard.html` — HTML + CSS + JS in one file
- No external JS/CSS frameworks (no React, no Tailwind, no jQuery)
- Data fetched client-side with `fetch()`, dual-layer cache: in-memory `Map` + `localStorage` (prefix `dash_v2_`, 7-day eviction)
- Per-pane independent refresh via `setInterval` — no full-page reload
- All times use `Asia/Jerusalem` timezone

### Themes & Screen Modes

- **5 themes**: `black` (OLED default), `blue`, `matrix`, `amber`, `purple` — stored in `localStorage` as `dash_theme`
- **3 screen modes**: `tv` (default), `tablet`, `phone` — stored as `dash_screenMode`
- **Phone mode**: full-page scroll, all card content visible, scroll-loop animations disabled, clone items hidden
- **Keyboard shortcuts**: `T` = cycle themes, `D` = toggle diagnostic overlay, `A` = toggle alerts on/off, `Escape` = close maximized card / halacha overlay, `S` = toggle config panel, `N` = toggle night dimmer, `+`/`-` = font scale, `P` = print mode, `B` = bookmark-only news filter, `H`/`?` = help overlay

### UI Layout

- **Header**: Clock (HH:MM, 60s tick), Hebrew + English dates, greeting, temperature, market badge (no Shabbat/holiday in header — those are in the Hebrew Calendar card)
- **Ticker bar**: Daily halacha from Sefaria.org (reference badge + numbered segments, seamless loop)
- **Left column** (38%): News RSS (17 feeds, filter chips, age timestamps, copy+share buttons, 65% height) | Weather (split-panel: current + AQI + sky pill + wind arrow + extreme weather banner + RTL hourly chart with rain bars + 4-day forecast with precip bar, 35% height)
- **Middle column** (33%): Hebrew Calendar card / לוח עברי (candle lighting, havdalah, holidays, omer, Parasha + Aliyot, Zmanim grid, Daf Yomi, Psalm, Moon phase, Shabbat countdown, chore wheel, 20%) | Google Calendar/ICS (week strip + today-strip + agenda, 65%) | Currency USD+EUR+GBP+Gold+Silver with sparklines (15%)
- **Right column** (29%): Stocks (15 symbols incl. TA-35, brand-color logos, vol badge, sparklines, P&L overlay, 52w range, market countdown, 33%) | Red Alerts (toggleable via `A` key, off by default, 33%) | Motivation (50 static Hebrew quotes, 33%)
- **Status bar**: Version, connectivity indicator, day/year progress bars, last refresh time

### Cache Architecture

```javascript
// ✅ Versioned dual-layer cache (memory + localStorage)
const fresh = cGet(key, TTL);      // returns data if within TTL
const stale = cGetStale(key);      // returns data regardless of age
cSet(key, data);                   // stores in both layers with timestamp
cEvict();                          // removes entries older than 7 days on startup
```

### Fetch Pattern

```javascript
// ✅ Direct → proxy fallback with diagnostic logging
async function fetchJSON(url) {
  try { direct fetch } catch {}
  for (const proxy of PROXIES) { try { proxy fetch } catch { continue; } }
  throw new Error('All fetch attempts failed');
}
// ✅ Timeout wrapper for slow proxies (used by stock fetches)
function fetchWithTimeout(url, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}
```

### Error Resilience

- **`safeLoad(fn)`**: async-aware try/catch wrapper for each loader — one failure doesn't break others
- **Startup self-check**: validates MOTIVATIONS array, DOM refs, PROXIES, STOCK_SYMBOLS; auto-opens diagnostic overlay on failure
- **Global error catchers**: `unhandledrejection` + `error` events → diagLog + auto-show overlay
- **Diagnostic overlay** (press `D`): per-pane status + rolling fetch log
- **Offline banner**: slides down when `navigator.onLine` is false

### Card Animations

- 6 entrance keyframes: `cardSlideLeft`, `cardSlideRight`, `cardSlideUp`, `cardSlideDown`, `cardPopIn`, `cardFlipIn`
- On startup: each card gets a random animation with staggered delays
- Every 5 minutes: one random card re-animates for attention
- Respects `prefers-reduced-motion`

### Card Maximize

- Click any card header to expand it `position: fixed` over the grid area (FLIP animation)
- `toggleCardMaximize(card)`: records `getBoundingClientRect()`, sets fixed position at original rect, animates to target rect
- Maximized card top edge starts below the time-section header (clock stays visible)
- `_maximizedCard`: tracks the single expanded card
- Sibling cards hidden using `.grid-col > .card` selector (no `.col-split` wrapper anymore)
- Close: click header again or press `Escape`
- CSS: `.card.maximized` (z-index 900, transitions), `.card.card-hidden` (opacity 0)
- **Weather card exception**: `.card.maximized .weather-body` uses `overflow: hidden` (NOT `auto`) so its flex children pin correctly — `.wx-top-row` stays `flex: 0 0 auto` (top), `.wx-hourly-chart` grows with `flex: 1 1 0` (middle), `.wx-forecast` has `margin-top: auto` (bottom)
- All other bodies (news, calendar, stocks, alerts, currency, motivation) use `overflow: auto` when maximized

## Coding Standards

### HTML/CSS/JS

- **Indentation**: 2 spaces for HTML/CSS/JS
- **CSS**: Use CSS custom properties (`:root { --accent: ... }`) — never hardcode colors
- **CSS containment**: `contain: layout style` on `.card`, `contain: content` on pane bodies
- **JavaScript**: Modern ES2020+ syntax (async/await, optional chaining, nullish coalescing)
- **DOM**: Cache element references in `el` object at startup — no repeated `getElementById`
- **Encoding**: UTF-8, RTL direction (`dir="rtl"`, `lang="he"`)
- **No inline event handlers**: Use `addEventListener` in JS

### API Integration

- Always wrap fetch calls in try/catch with proxy fallback
- Use `cSet(key, data)` / `cGet(key, TTL)` / `cGetStale(key)` for every API response
- Use `setSync(id, 'syncing'|'success'|'error')` for sync indicators
- Log fetch attempts via `diagLog()` for diagnostic visibility
- Sanitize any user-facing content from external APIs

### Per-Pane Refresh Intervals

| Pane | Interval | Notes |
|------|----------|-------|
| Clock | 1 min | HH:MM only, no seconds |
| Alerts | 60s / 5min | 60s when active, 5min idle |
| Market badge | 1 min | Pre/open/after/closed states |
| Market countdown | 1 min | NYSE countdown chip below stocks |
| Halacha | 12 hours | Sefaria.org daily halacha |
| News | 15 min | 17 RSS feeds via CORS proxy |
| Stocks | 5 min / 30 min | 5min market open, 30min closed, raceProxies batch |
| Calendar | 15 min | ICS parse, iframe fallback |
| Weather | 30 min | Open-Meteo (hourly + precipitation_probability) |
| AQI | 1 hour | OpenWeatherMap free tier |
| Currency | 1 hour | ER-API + fallback + Gold/Silver via Yahoo Finance |
| Motivation | 2 min | Static quotes, no network, cycles through 50 quotes |
| Hebrew date | 3 hours | Hebcal |
| Shabbat | 6 hours | Hebcal |
| Hebrew Calendar card | 6 hours | Hebcal — candle/havdalah/holiday/omer/Parasha/Zmanim/DafYomi/Psalm |
| Holidays | 12 hours | Hebcal |
| Earthquakes | 1 hour | USGS GeoJSON, limit=20, count M3.5+ in 24h |
| Birthdays | on load | Parses `dash_birthday` localStorage |

### Performance

- Lazy-load images (`loading="lazy"`)
- `raceProxies()` via `Promise.any()` for fastest stock data
- `fetchWithTimeout()` with 8s AbortController prevents hanging on dead proxies
- CPU-aware concurrency: `runConcurrent()` pool sized at `navigator.hardwareConcurrency * 0.6`
- `scheduleIdle()` defers non-critical work via `requestIdleCallback`
- DocumentFragment batch DOM writes (alerts, news items)
- GPU-accelerated scroll layers: `translateZ(0)`, `backface-visibility: hidden`
- `will-change` CSS hint for SVG charts and scroll containers
- CSS `contain` for paint optimization
- `prefers-reduced-motion` disables all animations
- Fetch locks prevent duplicate concurrent requests per pane
- Page Visibility API pauses fetches when tab is hidden

## Release Convention

> **IMPORTANT — No binary artifacts:** This project has **no exe, dll, MSI, or build outputs of any kind**. Release artifacts: `BestDashBoard.html`, `sw.js`, `manifest.json`, `icon.svg` — all four are auto-attached to every GitHub Release by `release.yml` on `git push --tags`. Do NOT attempt to add build tooling or binary packaging.

Every version bump must:
1. Update version string in `BestDashBoard.html` (2 places: status bar span + comment block) + `sw.js` CACHE_NAME
2. Update `CHANGELOG.md` with a full entry
3. Update `README.md` badge + test count + structure
4. Update `package.json` version
5. Update version in `tests/dashboard.test.mjs` assertion
6. Run `node --test tests/dashboard.test.mjs` — must be 0 fail, 0 skip
7. Update SVG docs in `.github/assets/` (version, feature count, test count)
8. `git commit` all files + `git tag vX.Y.Z` + `git push origin main --tags`
9. GitHub Actions `release.yml` attaches all 4 artifacts automatically
10. GitHub Actions `deploy.yml` publishes to GitHub Pages automatically

## Roadmap

| Version | Feature | Status |
|---------|---------|--------|
| v4.8.x | Card UX polish, font density, Omer fix, stock fetch fix, currency layout | ✅ Done |
| v4.9 | Parasha, Zmanim, Daf Yomi, Psalm of Day, Moon phase, Parasha Aliyot, Shabbat countdown | ✅ Done |
| v4.10 | AQI card, °C/°F toggle, school holidays, Gold/Silver, config panel, chore wheel, portfolio P&L | ✅ Done |
| v4.11 | Earthquake monitor, news filter, currency sparklines, multi-city, 52w range, portfolio total | ✅ Done |
| v4.11 | TA-35, vol badge, cal week strip, AQI labels, per-stock sparklines, rain overlay, market countdown | ✅ Done |
| v4.11 | Sprint 8 (F71–80): GBP tile, heat-map strip, favicons, sector headers, AQI spark, Shabbat pill, Parasha progress, chart tooltip, PWA | ✅ Done |
| v4.12 | Sprint 9 (F81–90): 7-day forecast, halacha category, ICS URL config, family name, photo slideshow, alert zone filter, news tooltips, dim schedule, clock seconds, offline cache age | ✅ Done |
| v4.13 | Sprint 10 (F91–100): PWA manifest.json, ServiceWorker offline, home city, Hebcal geonameid, news feed toggle, stock hide, 10s alerts, transit card, card drag-reorder, chore config | ✅ Done |
| v4.14 | Sprint 11 (F101–110): SW update banner, multi-ICS calendar, news search, birthday chip, reconnect auto-refresh, halacha colors, settings export/import, Hebrew wind dir, next Zman header, visited news | ✅ Done |
| v4.15 | Sprint 12 (F111–120): SW offline shell, API cache, network recovery, push-notif bell, desktop alerts, unread badge, weather cities config, family members, config tabs, URL share | ✅ Done |
| v4.16 | Sprint 13 (F121–130): Toast system, UV index pill, rain % chart labels, calendar reminders, news translate, earthquake+halacha deeplinks, hourly chart toggle, search highlight, diag toast | ✅ Done |
| v4.17 | Sprint 14 (F131–140): Stock alert toast, portfolio P&L chip, ICS color borders, severe-weather toast, motivation share, news age tint, after-hours price, calendar conflict badge, countdown chip, print date | ✅ Done |
| v4.18 | Sprint 15 (F141–150): Dew point tile, wind gusts, news category badges, inline news expand, daily quote lock+next, news bookmarks, weekly weather summary, stock P&L row, help overlay upgrade | ✅ Done |
| v4.19 | Sprint 16 (F151–160): HaOmer row, precip forecast mm, 5-currency sparklines, cal today-strip, stocks summary bar, bookmark filter (B key), halacha overlay, wx min/max, card collapse, news font slider | ✅ Done |
| v5.0 | Sprint 17 (F161–170): Corp proxy config, SW v5.0.0 + expanded API cache, icon.svg, manifest icons, PWA install prompt, offline fallback, VERSION_ACTIVATED, periodic SW update, release assets | ✅ Done |
| v5.1 | Refactoring R1–R5 (partial): CSS design tokens, ARIA landmarks, JS constants (`DIAG_BUFFER_SIZE`, `WAKE_REFRESH_MS`), `cycleTheme()`, `injectScrollKeyframes()`, removed dead `loadShabbat`/`loadHolidays`, dropped AQI/Earthquake/Transit | ✅ Done |
| v5.2 | Web Push notifications for red alerts | 🔜 Planned |
| v5.3 | Refactoring R6–R8: Calendar/Alerts/Motivation, PWA polish, full test + lint pass | 🔜 Planned |
| v5.4 | Card drag-reorder (long-press header) | 💡 Idea |
| v5.5 | Family photo slideshow + transit departures | 💡 Idea |

## What NOT To Do

- Do NOT add npm/node/build tools — this is a zero-dependency project
- Do NOT use external CSS/JS libraries or CDNs for frameworks
- Do NOT hardcode API keys in the HTML file
- Do NOT remove the CORS proxy fallback mechanism
- Do NOT break the RTL layout
- Do NOT use `innerHTML` with unsanitized external data
- Do NOT remove the diagnostic overlay or self-check system
- Do NOT use synchronous try/catch around async loader functions (use `await`)
- Do NOT call `self.skipWaiting()` in the SW install event — only via `SKIP_WAITING` message
- Do NOT forget `if (!_pageVisible) return;` at the top of new async loaders
- Do NOT set test slice lengths shorter than the actual function body (causes false-fail assertions)
- Do NOT use `min-width` for stock row columns — use `width` + `flex-shrink: 0` for proper alignment
- Do NOT introduce sprint code without running `node --check` + ESLint — duplicate declarations kill the entire script silently
- Do NOT call `loadStocks()` — the function is `loadAllStocks()`; always verify function names before wiring
- Do NOT keep loader functions for HTML elements that no longer exist — always grep for `id="element-id"` in HTML to verify the target element exists before keeping its loader

## Lessons Learned (Sprints 8–17)

### Testing Pitfalls
- `scriptContent.slice(offset, offset + N)` regex tests fail silently when N is too small — increase slice by 500–1000 chars when a test fails unexpectedly
- After adding to an existing function (e.g. `updateNetworkBanner`), related tests that relied on a short slice will fail; always verify the actual function body length before writing slice-based tests
- Version assertion test (`html.includes("Dashboard vX.Y.Z")`) must always be updated; the `tests/dashboard.test.mjs` assertion label must also change
- F168 test: look for `reg.update()` NOT `registration.update()` — the local var is named `reg`

### JS Integrity / Linting
- **Always run `node --check` after any JS edit** — syntax errors kill the entire script silently (no browser error shown for single-file HTML)
- **Always run ESLint after sprints** — catches undeclared vars and duplicate declarations that `node --check` misses
- Sprint merges have produced duplicate function/const blocks multiple times — scan for duplicates before commit:
  - `NEWS_BOOKMARKS_KEY` was declared twice (Sprint 14+15 merge artifact) → killed entire script
  - `detectNewsCategory` was declared twice (Sprint 15 section duplicated)
  - Stray extra `}` after `parseICS()` return — caused `Unexpected token` SyntaxError
- Variable naming: temp unit is `_tempUnit` (values `'C'`/`'F'`), NOT `_useFahrenheit`
- Stock refresh function is `loadAllStocks()` — not `loadStocks()` (which doesn't exist)
- ESLint config (`eslint.config.mjs`) must include all browser globals; missing ones cause false `no-undef` errors — add `requestIdleCallback`, `Blob`, `alert`, `Notification`, `CSS`, `AbortSignal`, etc.

### SW / PWA
- SW `message` event handler is the correct pattern to skip waiting (`SKIP_WAITING`) — NOT auto-skipWaiting in install
- `navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())` ensures the page refreshes after the new SW activates
- SW NETWORK_BACK handler must call `loadAllStocks()` not `loadStocks()` — verify function names when wiring SW messages

### CSS / Stock Alignment
- Stock row columns don't align with `min-width` — use `width` + `flex-shrink: 0` for hard column sizing
- `.stk-info` needs `width: 5.5em` (covers longest symbol "S&P500", "BRK-B", "ת\"א 35")
- `.stk-vals` needs `width: 6em` (covers prices up to ~"$186,000")
- `.stk-chart` uses `flex: 1` to fill remaining space — all charts start at same x-position

### Feature Wiring Checklist
For any new header chip (like birthday chip, next-zman chip):
1. Add HTML element in `header-right` section
2. Add CSS rule (usually `display:none` initially, styled as pill)
3. Add to `el` object at startup
4. Wire population in the relevant loader function
5. If time-based: call update from `tickClock()`

### Docs / Instructions Hygiene
- Instruction files drift from reality — audit after every sprint: version numbers, test counts, file tree, key systems
- `cicd.instructions.md` had test count frozen at `342 / 44 suites` (from v4.3!) — update with every sprint
- Sprint-specific patterns sections in `dashboard.instructions.md` become stale — remove when superseded by higher-level principles
- copilot-instructions `Roadmap` table: deduplicate rows before commit (v5.1 appeared twice)

### Dead Code Detection (Refactoring Sprints)
- Before keeping any loader function, grep `id="X"` in HTML to verify the target element still exists — `loadShabbat()` and `loadHolidays()` survived 3+ sprints with zero effect because their target elements were removed
- A loader that starts with `if (!el.someRef) return;` is a red flag — if `el.someRef` is always null, the function is dead
- Test failures revealing `scriptContent.includes("...")` vs `html.includes("...")` mismatch show text moved from JS to HTML markup — fix by using `html` not `scriptContent`
- After any dead code removal, run `grep` for all references (call sites, setInterval, startup loaders, config handlers) — there are typically 4–5 spots per loader

### GH Issue Tracking
- After every sprint push: `gh issue create --label "enhancement" --title "feat: vX.Y.Z..." --body "Commit: HASH | Tag: vX.Y.Z | Tests: N/S/0"` then immediately `gh issue close N --comment "Resolved in commit HASH"`
- For bug/fix commits (not sprints): use `--label "bug"` or `--label "documentation"` as appropriate
- All issues #1–#64 are CLOSED as of 2026-04-12:
  - #57 = Sprint 17 / v5.0.0, closed with commit 4f6eb9d
  - #58/#59 = stock alignment CSS fix
  - #60 = JS SyntaxError fix (NEWS_BOOKMARKS_KEY duplicate + stray brace), commit 6b258c2
  - #63 = JS lint fix (_useFahrenheit→_tempUnit, loadStocks→loadAllStocks, detectNewsCategory dupe), commit 562f001
  - #64 = docs dedup + sync to v5.0.0, commit db48698
