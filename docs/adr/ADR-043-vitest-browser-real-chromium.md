# ADR-043 — @vitest/browser with Real Chromium via Playwright Provider

- **Status**: Accepted
- **Date**: 2026-04-29
- **Sprint**: 145 (activated), 146 (layout-drag spec), 152 (documented)
- **Supersedes**: happy-dom for DOM-heavy FLIP / View Transition tests

## Context

FamilyDashBoard unit tests run under Vitest with a happy-dom environment.
happy-dom accurately models most browser APIs, but two features require a
real browser runtime:

1. **FLIP animations** — `element.getBoundingClientRect()` returns all-zero
   geometry in happy-dom; card maximize/restore logic relies on real layout.
2. **View Transitions API** — `document.startViewTransition()` is absent in
   happy-dom v13, causing tests that exercise `src/ui/maximize.ts` or
   `src/ui/theme.ts` brightness-flash to be skipped or patched.

The `@vitest/browser` package (Vitest 4+) embeds a Playwright provider that
launches a real Chromium instance for selected test files, while the rest of
the suite continues to use happy-dom for speed.

## Decision

Activate `@vitest/browser` with the Playwright provider for DOM-heavy specs:

- `tests/browser/maximize.spec.ts` — FLIP layout card maximize/restore
- `tests/browser/layout-drag.spec.ts` — drag-and-drop card reordering

All other test files (`tests/unit/**`) continue to run under happy-dom via
the existing `vitest.config.ts`.

A separate `vitest.browser.config.ts` drives the browser suite; CI runs
both configs in the same workflow step via
`npx vitest run --config vitest.config.ts ; npx vitest run --config vitest.browser.config.ts`.

## Consequences

### Positive

- Real layout geometry unlocks `getBoundingClientRect()` assertions.
- View Transitions API available natively.
- No mocking of `document.startViewTransition`.
- Chromium matches the target TV browser (Chromium-based).

### Negative

- Playwright download (~180 MB) added to CI cache.
- Browser tests run ~5–8 s each vs ~0.03 s for happy-dom equivalents.
- Browser test count kept small (target ≤ 50 specs) to avoid CI time bloat.

### Neutral

- Snapshot failures require `--update-snapshots` from a real Chromium run.
- `vitest.browser.config.ts` must declare its own `setupFiles` if it needs
  global mocks unavailable in a real browser context.

## Alternatives Considered

| Option | Outcome |
| --- | --- |
| Polyfill `getBoundingClientRect` in happy-dom | Fragile; geometry still static; doesn't help VT |
| Puppeteer | Heavier setup; Playwright already a dependency for E2E |
| Playwright test (`@playwright/test`) for unit specs | Loses Vitest DX (expect matchers, coverage) |

## Status history

| Date       | Status   | Note                                      |
| ---------- | -------- | ----------------------------------------- |
| 2026-04-26 | Draft    | initial activation           |
| 2026-04-26 | Accepted | layout-drag spec added (27 total browser tests) |
| 2026-04-29 | Accepted | ADR written and committed    |
