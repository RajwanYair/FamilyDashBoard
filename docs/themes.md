# Theme Gallery

> FamilyDashBoard ships 7 dark themes — all CSS custom-property-driven, zero
> runtime dependencies. Switch via **Settings ⚙ → Theme** or keyboard `T`.

## Themes

| #   | Name                  | CSS Class             | Accent               | Background             | Best For                                     |
| --- | --------------------- | --------------------- | -------------------- | ---------------------- | -------------------------------------------- |
| 1   | **True Black (OLED)** | `theme-black`         | Warm gold `#c8a87a`  | Pure black `#000`      | OLED TVs — deep blacks, zero backlight bleed |
| 2   | **Ocean Blue**        | `theme-blue`          | Sky blue `#82b8d8`   | Deep navy `#0c1824`    | Default — calm, easy on the eyes             |
| 3   | **Forest Green**      | `theme-matrix`        | Soft green `#86c490` | Dark forest `#0e1a10`  | Nature vibe, hacker aesthetic                |
| 4   | **Amber Glow**        | `theme-amber`         | Warm amber `#c8a07c` | Dark brown `#18120a`   | Night mode, warm tint, retro feel            |
| 5   | **Purple Dusk**       | `theme-purple`        | Lavender `#b8aad4`   | Deep purple `#140e1e`  | Evening vibes, creative setup                |
| 6   | **Rose Night**        | `theme-rose`          | Soft rose `#c08898`  | Dark crimson `#180a0e` | Romantic aesthetic, warm accent              |
| 7   | **High Contrast**     | `theme-high-contrast` | Yellow `#ffdd00`     | Pure black `#000`      | Accessibility (WCAG AAA), vision impairments |

## Design Principles

- **All themes are dark** — the dashboard is designed for always-on TV/monitor
  display where light themes cause eye strain and backlight bleed
- **No hardcoded colors** — every color uses CSS custom properties (`--accent`,
  `--bg-card`, `--positive`, `--negative`, etc.)
- **Semantic tokens** — `--positive` (green), `--negative` (red), `--warning`
  (yellow/amber) are theme-aware for stocks, alerts, and status indicators
- **View Transitions** — theme switching uses the View Transitions L2 API for
  smooth cross-fade when supported

## CSS Architecture

Themes live in `@layer themes` inside `src/styles/themes.css`. Each theme sets
these custom properties on `body.theme-{name}`:

```text
--bg-primary        Main background
--bg-card           Card body background
--bg-card-header    Card header background
--bg-card-inner     Inner tile/cell background
--bg-card-hover     Card hover state
--accent            Primary accent color
--accent-bright     Lighter accent variant
--accent-glow       Glow/shadow accent (translucent)
--accent-border     Border accent (translucent)
--card-border       Full border declaration (width + style + color)
--card-shadow       Box shadow declaration
--bg-gradient-1/2/3 Subtle background gradient overlays
--text-muted        Secondary text color
--positive          Success/gain color (green family)
--negative          Error/loss color (red family)
--warning           Warning/caution color (yellow/amber family)
```

## Auto-Theme

When **Auto-Theme** is enabled in settings, the dashboard switches between a
configured day theme and night theme based on sunrise/sunset times for the
user's location. This prevents a bright theme during dark hours.

## OS High-Contrast Override

In addition to the explicit high-contrast theme, the dashboard respects
`@media (prefers-contrast: more)` — boosting borders, muting backgrounds, and
increasing text contrast regardless of the selected theme.

## Adding a New Theme

1. Add the theme name to the `THEMES` array in `src/core/constants.ts`
2. Add the CSS block in `src/styles/themes.css` inside `@layer themes`
3. Add a `<option>` to `#theme-select` in `src/index.html`
4. Update tests that iterate `THEMES` (they auto-detect via the array)
5. Update this document

See [ADR-074](adr/ADR-074-high-contrast-theme.md) for the high-contrast theme
decision record.
