# Keyboard & Accessibility Guide — FamilyDashBoard

> Covers keyboard shortcuts, focus-order design, and screen-reader operation.

---

## Keyboard Shortcuts

All shortcuts are single-key (no modifier required) and fire from the global
`keydown` handler in `src/ui/keyboard.ts`. Shortcuts are silenced when focus
is inside an `<input>`, `<textarea>`, or `<select>`.

| Key       | Action                       | Notes                                                         |
| --------- | ---------------------------- | ------------------------------------------------------------- |
| `T`       | Cycle theme                  | Cycles through 7 themes: black→blue→matrix→amber→purple→rose→high-contrast  |
| `D`       | Toggle diagnostics overlay   | Shows provider health, error log, version                     |
| `A`       | Toggle alerts pane           | Flashes the Tzeva Adom alert card                             |
| `S`       | Open Settings / Config panel | `<dialog>` opened via `showModal()`                           |
| `N`       | Toggle night dimmer          | Overlay that reduces screen brightness                        |
| `M`       | Toggle video mute            | Mute / unmute the video-news card audio                       |
| `V`       | Cycle video channel          | Cycle through news channels (C14 → i24 → …)                   |
| `+` / `=` | Increase font size           | Step +1px on `<html>` font-size                               |
| `-`       | Decrease font size           | Step -1px on `<html>` font-size                               |
| `P`       | Print                        | Opens browser print dialog                                    |
| `B`       | Toggle bookmarks sidebar     | Quick-access bookmark panel                                   |
| `Y`       | Yank focused card content    | X15: copies `text/plain` + `application/ld+json` to clipboard |
| `H` / `?` | Help overlay                 | Shows this key table in a `<dialog>`                          |
| `Esc`     | Close active overlay         | Closes config, help, diag, dimmer                             |

> **TV remote / smart display**: Most Samsung/LG smart TVs map the color buttons
> and D-pad to standard keyboard events. `Enter`/`OK` activates focused elements;
> arrow keys move focus between cards.

---

## Focus Order

The tab order follows the natural DOM order in `src/index.html`. Interactive
elements and their tab order are:

1. **Skip-to-content link** (visually hidden, first in DOM) — jumps focus to
   `#main-content` landmark
2. **Header controls** — notification bell (`#notif-bell`), settings button
3. **Card grid** — each card's `<article>` has `tabindex="0"` so it can receive
   keyboard focus for scrolling / inspection
4. **System info pane** (`#sysinfo-body`) — `tabindex="0"`, readable by screen reader
   via `aria-live="polite"`
5. **Config overlay** (`<dialog id="config-overlay">`) — traps focus when open;
   cycles through all interactive controls; `Esc` or the close button exits
6. **Help overlay** (`<dialog id="help-overlay">`) — same focus-trap pattern
7. **Diagnostics overlay** (`<dialog id="diag-overlay">`) — same focus-trap pattern

All `<dialog>` overlays use the native `showModal()` / `close()` API, which
provides built-in focus-trap and `Esc`-to-close behavior without any custom code.

---

## ARIA Landmarks

| Landmark         | Element                       | Role / label                       |
| ---------------- | ----------------------------- | ---------------------------------- |
| `<header>`       | Top bar                       | `banner`                           |
| `<main>`         | Card grid area                | `main` — `aria-label="לוח"`        |
| `<nav>` (header) | Keyboard shortcut hints strip | `navigation`                       |
| `<footer>`       | Version / status row          | `contentinfo`                      |
| Cards            | `<article>` elements          | `region` + `aria-labelledby`       |
| Overlays         | `<dialog>` elements           | `dialog` (implicit) + `aria-label` |

---

## Screen Reader Operation (NVDA / VoiceOver)

### Recommended settings

| Setting          | Value                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Browse/read mode | **Forms/Application mode** — use Tab to navigate interactive elements                                  |
| Language         | Hebrew (`he`) — the page is `lang="he" dir="rtl"`. NVDA reads RTL text correctly in Hebrew locale mode |
| Verbosity        | Medium — `aria-live` regions announce card refreshes; High verbosity will be noisy                     |

### Key landmarks to jump to

- **`H`** (heading navigation): "לוח משפחתי" (page title, `<h1>`) then each
  card heading (`<h2>` inside each `<article>`)
- **`R`** (region navigation): jumps between card `<article>` regions
- **`D`** (landmark navigation): jumps between `banner` → `main` → `contentinfo`
- **`B`** (button navigation): settings, notification bell, card-action buttons

### Live regions

| Region          | Element         | Verbosity                                                |
| --------------- | --------------- | -------------------------------------------------------- |
| Alert ticker    | `#alerts-body`  | `aria-live="assertive"` — announced immediately          |
| System info     | `#sysinfo-body` | `aria-live="polite"` — announced after current speech    |
| Clock           | `#clock`        | `aria-live="off"` — not announced (updates every second) |
| Stock prices    | `#stocks-body`  | `aria-live="off"` — not announced automatically          |
| Weather summary | `#wx-summary`   | `aria-live="polite"`                                     |

### Known limitations

- **Clock updates**: The clock updates every second. `aria-live="off"` is intentional;
  enabling live announcements would create unacceptable noise. A screen-reader user
  can navigate to the `#clock` element manually to hear the current time.
- **Stock ticker**: Price changes are not announced automatically. Navigate to the
  stocks card to hear current values.
- **Reduced motion**: All CSS animations and View Transitions respect
  `@media (prefers-reduced-motion: reduce)`. The theme-switch animation is
  completely suppressed when reduced motion is preferred.

---

## Touch / Pointer Accessibility

All interactive touch targets meet WCAG 2.5.8 (minimum 24 × 24 px).
News source chips have `min-height: 24px; min-width: 24px` explicitly set.

The dashboard is primarily designed for **TV / large-screen display** (1920 × 1080).
For tablet and phone screen modes, touch targets are automatically enlarged via
the `screen-tablet` and `screen-phone` CSS layers.

---

## Color Contrast

All 7 themes satisfy WCAG 2.1 AA (contrast ratio ≥ 4.5:1 for normal text,
≥ 3:1 for large text) against the respective dark background:

| Theme  | Background | Foreground | Ratio  |
| ------ | ---------- | ---------- | ------ |
| black  | `#0a0a0a`  | `#e2e8f0`  | 15.3:1 |
| blue   | `#0d1b2a`  | `#e2e8f0`  | 13.8:1 |
| matrix | `#000d00`  | `#00ff41`  | 15.1:1 |
| amber  | `#100800`  | `#ffd700`  | 12.4:1 |
| purple | `#0d0818`  | `#e2d9f3`  | 13.1:1 |
| rose   | `#120008`  | `#fde8f0`  | 14.9:1 |

Verified with the Lighthouse accessibility audit (target: ≥ 0.98, see `.lighthouserc.json`).

---

## Automated Accessibility Tests

Playwright runs axe-core on all 3 screen modes in `tests/e2e/accessibility.spec.ts`:

```sh
npx playwright test tests/e2e/accessibility.spec.ts
```

The test uses the `wcag22aa` ruleset and fails the suite on any violation.

---

## See Also

- [`src/ui/keyboard.ts`](../src/ui/keyboard.ts) — keyboard registry & dispatcher
- [`tests/e2e/accessibility.spec.ts`](../tests/e2e/accessibility.spec.ts) — axe-core tests
- [`docs/screen-reader.md`](screen-reader.md) — NVDA + VoiceOver manual test protocol & findings
- [ADR-018: CSP + COOP/COEP](adr/ADR-018-csp-coop-coep.md) — security headers
