# ADR-078 — Theme FOUC Prevention and OS Color-Scheme Preference on First Load

**Status**: Accepted · **Date**: 2026-05-17 · **Drivers**: UX correctness, TV readability, OS preference respect, zero-flash first paint.

## Context

FamilyDashBoard supports 7 themes (`black`, `blue`, `matrix`, `amber`, `purple`, `rose`, `high-contrast`). The active theme is persisted in `localStorage` under the key `dash_theme`. On startup, `initTheme()` reads this key and calls `applyTheme()` to set the `class="theme-*"` attribute on `<body>`.

### The FOUC problem

Before this change, `<body>` started with no theme class:

```html
<!-- before -->
<body>
```

The theme class was not applied until JavaScript executed. On slow machines or during long parse times, users briefly saw the browser's default styles — typically light-background, dark-text — before the theme was applied. On a dark-background TV dashboard (default `theme-black`), this manifested as a bright white flash followed by a black background, causing a jarring experience on wall-mounted displays.

### The OS preference problem

Before this change, `initTheme()` always defaulted to `theme-black` when no stored theme was present:

```typescript
// before — ignores OS preference
const saved = localStorage.getItem(LS_THEME);
applyTheme(saved ?? "black");
```

Users on macOS or Windows who set their OS to light mode (`prefers-color-scheme: light`) would always receive a dark theme on first load, requiring a manual theme switch. Per the user-interface principle of "respect established conventions", the OS color scheme preference should influence the initial default.

## Decision

### 1. Pre-apply `theme-black` in HTML to prevent FOUC

The `<body>` tag now carries the most-common default theme class:

```html
<body class="theme-black">
```

This ensures that the CSS rules for `theme-black` are active from first paint — before any JavaScript executes — eliminating the white-flash FOUC entirely. When `initTheme()` runs, it overwrites this class with the persisted or OS-derived theme.

**Why `theme-black`?** It is the most common default (dark TV dashboard), and it is the safest fallback for readability on a black-background TV display. Choosing `theme-amber` (the light fallback) as the HTML default would cause a FOUC in the opposite direction for dark-OS users.

### 2. Respect OS color-scheme preference on first load

`initTheme()` now checks `window.matchMedia("(prefers-color-scheme: light)")` when no stored theme exists:

```typescript
export function initTheme(): void {
  const saved = localStorage.getItem(LS_THEME);
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "amber" : "black");
  }
  // ... dropdown wiring + matchMedia change listener
}
```

The mapping is:

- **OS prefers light** → `amber` (warm cream background — best readable light theme for TV use)
- **OS prefers dark** (or no preference) → `black` (default dark TV theme)

Once a theme is applied by `initTheme()`, it is written to `localStorage` via `applyTheme()`. Subsequent loads will use the stored value and bypass the OS detection path.

### 3. matchMedia change listener remains active

A `matchMedia("(prefers-color-scheme: light)").addEventListener("change", ...)` listener continues to run after init. This listener checks `hasSaved` (i.e., whether the user has ever explicitly chosen a theme) and only auto-switches if no explicit choice has been made. Behavior is unchanged from the pre-fix implementation.

## Consequences

| Scenario | Before | After |
|---|---|---|
| No saved theme, OS dark | White flash → black (default) | Black from first paint (no flash) |
| No saved theme, OS light | White flash → black (wrong) | Amber from first paint (no flash) |
| Saved theme = purple | White flash → purple | Black flash (brief) → purple |
| Any subsequent load | Same as saved theme | Unchanged |

**Known limitation**: When a non-black theme is stored, the brief flash from `theme-black` (HTML default) to the stored theme is unavoidable without inlining the theme resolution in a blocking `<script>`. This is an accepted trade-off: inlining localStorage reads in a render-blocking script would hurt performance for the common case.

**Mitigation plan** (tracked as ADR-future): A small inline `<script>` that reads `localStorage` and sets the correct body class before first paint is a v15 candidate. It must remain under 200 bytes to avoid measurable FID impact.

## Rejected alternatives

- **Inline script to read localStorage before first paint**: Eliminates all FOUC but requires a render-blocking script. Deferred to v15 (see Consequences above).
- **CSS `color-scheme: dark` on `:root`**: Only controls UA-provided scrollbar/form colors; does not apply FamilyDashBoard's custom CSS token values. Insufficient.
- **No default class, let CSS `@media (prefers-color-scheme)` handle it**: Would require duplicating all theme token values into `@media` queries — significant CSS bloat and hard to maintain alongside the 7-theme system.

## Related

- `src/ui/theme.ts` — `initTheme()`, `applyTheme()`
- `src/index.html` — `<body class="theme-black">`
- `tests/unit/ui/theme.test.ts` — 42 tests (3 new tests for OS preference behavior)
- ADR-074 — High-Contrast Theme (7th theme)
