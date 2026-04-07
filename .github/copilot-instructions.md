# GitHub Copilot Instructions — FamilyDashBoard

> 📺 Single-file TV dashboard · 🇮🇱 Hebrew RTL · 🎨 Dark Glassmorphism · 🚫 Zero Dependencies

## Project Overview

Single-page family dashboard (`BestDashBoard.html`) designed for always-on TV display in the family living room.

## Technical Stack

- **Language**: HTML5, vanilla CSS3, vanilla JavaScript (ES2020+)
- **No build tools**: Zero dependencies — open the HTML file directly in a browser
- **APIs consumed**: Open-Meteo (weather + UV + hourly), Hebcal (Hebrew dates + Shabbat), Yahoo Finance (stocks via proxy), ER-API (currency), RSS feeds (news), Google Translate, Google Calendar embed
- **CORS proxies**: allorigins.win, codetabs.com
- **Design system**: Dark glassmorphism theme with CSS custom properties, animated background, bézier SVG charts

## Architecture

### Single-File Dashboard

- Everything lives in `BestDashBoard.html` — HTML + CSS + JS in one file
- No external JS/CSS frameworks (no React, no Tailwind, no jQuery)
- Data from APIs is fetched client-side with `fetch()`, cached in a `Map` for 5 minutes
- Auto-refresh via `<meta http-equiv="refresh" content="300">`
- All times use `Asia/Jerusalem` timezone

### UI Layout

- **Header**: Clock, Hebrew + English dates, greeting, temperature, Shabbat times, GIFs
- **Top row** (3 columns): News RSS | Google Calendar | Stocks (6 symbols)
- **Bottom row** (3 columns): Weather + hourly chart | Currency exchange | Motivation
- **Status bar**: Version + last refresh time

### Key Patterns

```javascript
// ✅ Always cache API responses
const cached = getCachedData(key);
if (cached) { displayData(cached); return; }

// ✅ Try direct fetch, then fall through proxies
for (const proxy of proxies) { ... }

// ✅ Hebrew-first UI — RTL layout, Hebrew translations
const translated = await translateToHebrew(text);
```

## Coding Standards

### HTML/CSS/JS

- **Indentation**: 2 spaces for HTML/CSS/JS
- **CSS**: Use CSS custom properties (`:root { --accent: ... }`) — never hardcode colors
- **JavaScript**: Modern ES2020+ syntax (async/await, optional chaining, nullish coalescing)
- **DOM**: Cache element references in `elements` object at startup — no repeated `getElementById`
- **Encoding**: UTF-8, RTL direction (`dir="rtl"`, `lang="he"`)
- **No inline event handlers**: Use `addEventListener` in JS

### API Integration

- Always wrap fetch calls in try/catch with proxy fallback
- Use `setCachedData` / `getCachedData` for every API response
- Update `syncIndicators` (syncing → success/error) for each data source
- Sanitize any user-facing content from external APIs

### Performance

- Lazy-load images (`loading="lazy"`)
- Stagger stock API calls with `setTimeout` offsets to avoid rate limits
- Use `will-change` CSS hint for trend chart SVGs
- Keep DOM updates minimal — compare before setting `.textContent`

## What NOT To Do

- Do NOT add npm/node/build tools — this is a zero-dependency project
- Do NOT use external CSS/JS libraries or CDNs for frameworks
- Do NOT hardcode API keys in the HTML file
- Do NOT remove the CORS proxy fallback mechanism
- Do NOT break the RTL layout
- Do NOT remove the auto-refresh meta tag
- Do NOT use `innerHTML` with unsanitized external data
