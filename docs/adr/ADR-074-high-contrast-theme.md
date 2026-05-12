# ADR-074 — High-Contrast Theme (WCAG AAA)

**Status**: Accepted · **Date**: 2026-05-12 · **Drivers**: Roadmap v3 §2.3 peer-harvest, WCAG 2.2 AAA compliance.

## Context

The dashboard shipped 6 dark themes (black, blue, matrix, amber, purple, rose) targeting WCAG AA contrast. Competitive analysis (Grafana, HASS Lovelace) showed a high-contrast / colorblind-accessible mode is best practice for observability dashboards. The CSS instructions previously prohibited a 7th theme without an ADR.

## Decision

Add a 7th theme `high-contrast` with:

- Pure black background (`#000000`) for maximum OLED contrast.
- Yellow accent (`#ffdd00`) — highest luminance contrast ratio against black (≥ 15.4:1).
- White text with `--text-muted` at `#d0d0d0` (≥ 13.6:1 against black).
- `--positive: #00ff41` / `--negative: #ff3333` / `--warning: #ffaa00` — all ≥ 4.5:1 against black.
- 2px solid card borders with 50% white opacity for maximum edge definition.
- No gradients or translucent overlays that reduce contrast.

The theme targets WCAG 2.2 Level AAA (≥ 7:1 for normal text, ≥ 4.5:1 for large text) and is suitable for users with low vision, color vision deficiency, or high-ambient-light environments.

## Consequences

- `THEMES` array in `src/core/constants.ts` grows from 6 to 7 entries.
- Theme cycle (`T` key) includes the new theme.
- Config panel dropdown gains a ♿ entry.
- Theme audit test (`tests/unit/styles/theme-audit.test.ts`) validates all required properties automatically.
- Visual regression baselines will need regeneration (21 → 21 baselines if added to VR matrix).
- CSS instructions updated to reference 7 themes.

## Alternatives Considered

- **Rely solely on `prefers-contrast: more`**: insufficient — only overrides a subset of tokens, doesn't provide a consistent branded experience.
- **Use an OS-level high-contrast stylesheet**: breaks the `@layer` token architecture.
