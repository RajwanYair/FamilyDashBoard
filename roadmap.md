# FamilyDashBoard — Roadmap

> Always-on family TV dashboard · Hebrew RTL · 1920×1080+

![Roadmap timeline](.github/assets/roadmap.svg)

---

## Status at a Glance

| Version    | Status      | Tests                       | Highlights |
| ---------- | ----------- | --------------------------- | ---------- |
| v5.x       | ✅ Released  | 1084 mocha / 61 suites      | Single-file HTML era (archived as `BestDashBoard.html`) |
| v6.0       | ✅ Released  | 510 Vitest / 29 suites      | Full TypeScript modular rewrite (Vite 8 + TS 5.9) |
| v6.1       | ✅ Released  | 574 Vitest / 30 suites      | Birthday chip, bookmarks, market badge, bg rotation |
| v6.2       | ✅ Released  | 849 Vitest / 31 suites      | Portfolio, alerts, weather tabs, news search, 50+ features |
| v6.3       | ✅ Released  | 896 Vitest / 31 suites      | Coverage sprint: news, alerts, bg-images, config-panel |
| v6.4       | ✅ Released  | 932 Vitest / 32 suites      | Coverage sprint: stocks, hebrew-cal, ticker, calendar |
| v6.5       | ✅ Released  | 1240 Vitest / 33 suites     | Coverage sprint: cache, base-card, motivation, maximize |
| **v7.0**   | ✅ Released  | 1390+ Vitest / 37 suites    | Card registry, tasks card, system-info, CSS @layer, dialog migration, 6 themes, `removeCrossOrigin` build plugin |
| v7.6       | ✅ Released  | 1541 Vitest / 38 suites     | Drag-and-drop card layout, layout persistence, config panel reset |
| v7.7       | ✅ Released  | 1554 Vitest / 38 suites     | Coverage sprint: 13 branch-gap tests (stocks, news, weather, hebrew-cal, ticker, layout-drag) |
| v7.8 infra | ✅ Released  | 1554 Vitest / 38 suites     | 0 markdownlint errors, dead files removed, CI uses markdownlint-cli2, lint:md in check pipeline |
| **v7.1.0** | ✅ Released  | 1554 Vitest / 38 suites     | Countdown card (11th), unified CI, Hebrew date fix, favicon fix |
| **v7.1.1** | ✅ Released  | 1570 Vitest / 39 suites     | Pre-release checklist pass, markdown lint fix, test count update |
| **v7.1.2** | ✅ Released  | 1574 Vitest / 39 suites     | VERSION fixed, applyCardSizes init, chores editor, help M/A shortcuts, tasks pending badge, market status bar chip, night dim indicator, theme doc fixes |
| **v7.1.3** | ✅ Released | 1605 Vitest / 39 suites     | Weather dew/gust wiring; portfolio editor in config; configurable tasks reset hour; W key °C/°F; sysinfo memory+CPU tiles; countdown test stability |
| v7.2       | 💡 Idea     | —                           | Multi-user profiles, cloud sync via Cloudflare KV |

---

## v7.0 — Released

Card type system · card registry · tasks card · system-info card · 6th theme (Rose) · CSS `@layer` · CSS `@container` · `color-mix()` tokens · dialog migration (`<dialog>` + `showModal()`) · worker-first fetch (`fetchViaWorker`) · `removeCrossOrigin` build plugin (file:// compatibility) · ESLint hardening · shared npm model · 1390+ tests / 37 suites.

### Remaining for v7.0 release (deferred to v7.1)

- [ ] Card registry → HTML: dynamic `data-card-id` slots rendered by registry
- [ ] Card add/remove via config panel (registry-aware)
- [ ] Cloudflare Worker migration for all remaining API routes
- [ ] Final v7.0 release tagging + changelog

---

## v7.1 — Released

- [x] Layout drag-and-drop (column assignment via config panel, persisted to localStorage) — v7.6
- [x] Card slot persistence: per-device layout via `dash_v2_layout_*` — v7.6
- [x] Card size control: sm/md/lg/xl chips in config panel — v7.1.2
- [x] URL-based config sharing (base64-encoded layout in `#cfg=` hash) — v7.0
- [x] Tasks card integration in Hebrew Calendar (`getTasksForToday()` bridge, `renderTasksStrip()`) — v7.0
- [x] Adaptive card maximize (`--max-font-scale` CSS variable, FLIP animation) — v7.1.x
- [x] VERSION constant sync across main.ts + status-bar.ts — v7.1.2
- [x] Countdown card (11th card) — v7.1.0
- [x] Chores JSON editor in config panel Advanced tab — v7.1.2
- [x] Help overlay M/A keyboard shortcuts — v7.1.2

### Remaining for v7.0 release (deferred to v7.1+)

- [ ] Card registry → HTML: dynamic `data-card-id` slots rendered by registry
- [ ] Card add/remove via config panel (registry-aware, new card discovery)
- [ ] Cloudflare Worker migration for all remaining API routes

### Problem

The current FLIP-animation maximize (`src/ui/maximize.ts` + `src/styles/maximize.css`) expands a card
to fill the viewport using `position: fixed`, but font sizes are bumped by hardcoded static `em`
multipliers per card type (e.g. `.card.maximized .news-body { font-size: 1.35em }`).
These do **not** scale relative to the actual new card size — on a very large 4K display they are
too small; on a small 720p display they may be too large. Content also does not fill the available
height, leaving dead whitespace in taller cards.

### Goal

When a card is maximized, its content and base font size should scale dynamically to fill the full
expanded size, proportional to the ratio of the expanded card area to the original collapsed area,
so every maximized card looks like it was designed for that size.

### Design Decisions

| Decision | Rationale |
|---|---|
| JS computes the scale ratio, CSS applies it | FLIP already captures both rects; ratio = `expandedWidth / collapsedWidth`. Avoids container-query complexity and works with existing `@layer` architecture. |
| `--max-font-scale` CSS custom property on the card element | Single property drives all `font-size`, `gap`, and `padding` in CSS; easy to animate; zero coupling between JS and per-card styles. |
| `clamp(1, var(--max-font-scale, 1), 4)` guard | Prevents scale from going absurdly large on ultra-wide displays or very small cards. |
| Per-card-type `overflow` and `flex` rules remain in CSS | JS only sets the scale number; layout strategy per card stays in the CSS layer. |
| `font-size` transition matches the FLIP duration | Feels cohesive; collapseCard resets the variable after the animation ends. |

### Implementation Plan

#### Step 1 — JS: Compute and inject `--max-font-scale` (`src/ui/maximize.ts`)

In `expandCard()`, after recording the FLIP rects:

```ts
const scaleW = last.width  / first.width;   // e.g. 3.4 on a 1920-wide screen
const scaleH = last.height / first.height;
// Use the smaller axis so content is never clipped in the other direction
const fontScale = Math.min(scaleW, scaleH);
card.style.setProperty("--max-font-scale", String(parseFloat(fontScale.toFixed(3))));
```

In `collapseCard()`, after removing the `maximized` class and when the animation ends:

```ts
const anim = card.animate([...], { duration: 300, easing: "ease-out" });
anim.finished.then(() => card.style.removeProperty("--max-font-scale"));
```

#### Step 2 — CSS: Replace hardcoded `em` multipliers with the computed scale (`src/styles/maximize.css`)

Replace all the per-type static font rules with a single variable-driven rule:

```css
/* Remove these hardcoded rules: */
/* .card.maximized .news-body    { font-size: 1.35em; } */
/* .card.maximized .stocks-body  { font-size: 1.3em;  } */
/* ... etc ... */

/* Replace with: */
.card.maximized .card-body,
.card.maximized .news-body,
.card.maximized .stocks-body,
.card.maximized .alerts-body,
.card.maximized .currency-body,
.card.maximized .moti-body,
.card.maximized .hc-body,
.card.maximized .cal-wrapper {
  font-size: clamp(1rem, calc(1rem * clamp(1, var(--max-font-scale, 1), 4)), 6rem);
  transition: font-size 0.3s ease-out;
}
```

Cards that require special layout adjustments (centering, no-scroll) keep those existing rules
untouched (e.g. `justify-content: center` on `.currency-body`, `flex-direction: column` on `.hc-body`).

#### Step 3 — Per-card layout audit

Each card body must fill its new dimensions without overflow or dead space:

| Card | Current issue | Fix |
|---|---|---|
| **News** | Scroll container has `max-height`; extra items hidden. | Set `.card.maximized .news-body { max-height: 100%; }` so the flex column fills available height. |
| **Stocks** | Table column widths use `flex-shrink: 0` + fixed `width`; scaling text may clip cells. | After font scale is applied, re-call `applyHiddenStocks()` to repaint column widths relative to new font. |
| **Calendar** | `.cal-agenda` has `overflow: auto` — works; but day-header font is a fixed `0.75em`. | Cascade `.cal-agenda` font-size from the parent body so headers inherit scale. |
| **Weather** | `wx-hourly-chart` max-height removed (already). | Verify `svg` viewBox scales with CSS width; add `width: 100%` if needed. |
| **Currency** | Flex-center already works. | No change needed. |
| **Hebrew Cal** | Flex-center already works. | No change needed. |
| **Alerts** | Items are variable length — may need scrolling. | Keep `overflow: auto`; scaled font makes each alert card taller, which is desirable. |

#### Step 4 — Smooth transition

Both `expandCard` and `collapseCard` trigger the CSS `transition: font-size 0.3s ease-out` rule
added in Step 2. The FLIP animation (scale transform) and the content font-size transition run in
parallel, giving a smooth "everything grows together" effect.

For `collapseCard`, clear the variable only **after** the collapse animation finishes (via
`animation.finished.then(...)`) so the font does not abruptly snap before the card reaches its
original size.

#### Step 5 — `prefers-reduced-motion` guard

The existing `@media (prefers-reduced-motion: reduce)` block already zeroes out `transition-duration`.
No changes needed; the font-size transition will be suppressed automatically on accessible setups.

#### Step 6 — Tests (`tests/unit/ui/maximize.test.ts`)

Add to the existing maximize suite:

- `expandCard sets --max-font-scale CSS variable on the card element`
- `expandCard scale value equals min(expandedW/collapsedW, expandedH/collapsedH)`
- `collapseCard removes --max-font-scale after animation finishes`
- `expandCard clamps scale to 4 maximum` (mock a card with 0.001px original size)

#### Step 7 — Acceptance checklist (manual QA)

- [ ] All 8 card types fill their maximized viewport slot with no whitespace dead zones
- [ ] Font is legible from 3 m on a 1920×1080 display when maximized
- [ ] Collapsing restores original font size with no visible snap
- [ ] `prefers-reduced-motion` shows no transition
- [ ] No horizontal scroll inside any maximized card
- [ ] `npx eslint src tests --max-warnings 0` passes
- [ ] `npx tsc --noEmit` passes
- [ ] All Vitest suites pass (0 failures)

### Files Changed

| File | Change |
|---|---|
| `src/ui/maximize.ts` | Compute `--max-font-scale` in `expandCard`; clear in `collapseCard.finished.then` |
| `src/styles/maximize.css` | Replace 8 static em rules with single `clamp()`-driven CSS variable rule |
| `tests/unit/ui/maximize.test.ts` | 4 new tests for scale computation and variable lifecycle |

---

## v7.2 — Ideas / backlog

- Multi-user profiles (family members, each with own config)
- Cloudflare KV sync (sync config across devices)
- Push notifications via Web Push API + Service Worker
- Offline-first data pre-seeding via SW install event
- Card templates marketplace (community-submitted card definitions)

---

## Design Principles

| Principle | Rule |
| --------- | ---- |
| Zero dependencies | No external JS/CSS libraries or CDNs at runtime |
| Hebrew RTL | Always `dir="rtl"` in HTML; CSS logical properties where possible |
| TV-first | 1920×1080 primary; readable from 3 m; no hover-only affordances |
| Cache everything | Dual-layer (memory + localStorage); stale-while-revalidate |
| 0 lint errors | `npx eslint src tests --max-warnings 0` must pass on every commit |
| 0 TS errors | `npx tsc --noEmit` must pass on every commit |
| No suppressions | Zero `eslint-disable` / `@ts-ignore` / `@ts-expect-error` allowed |
