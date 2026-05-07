# Screen Reader Testing — FamilyDashBoard

> Manual test protocol and findings for NVDA (Windows desktop) and VoiceOver
> (iOS mobile). Last verified against **v14.4.0**.

---

## 1. Scope

FamilyDashBoard is primarily a **landscape TV display** (1920 × 1080). Its
screen-reader audience is primarily:

1. Sighted users who also use a screen reader for brief on-demand inspection
   of specific cards (e.g. verifying stock prices or next calendar event).
2. Visitors accessing the dashboard from a phone or tablet (screen-phone /
   screen-tablet CSS modes) who may rely on VoiceOver.

The goal is **WCAG 2.2 Level AA** compliance, not a full "blind-user"
optimisation — the dashboard is fundamentally a visual display.

---

## 2. NVDA Desktop Test Protocol (Windows)

### 2.1 Test Environment

| Setting               | Value                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| Screen reader         | NVDA 2024.x (latest stable)                                                 |
| Browser               | Firefox 125+ (best NVDA support) or Chrome                                  |
| OS                    | Windows 10 / 11                                                             |
| Dashboard URL         | `https://rajwanyair.github.io/FamilyDashBoard/`                             |
| NVDA speech mode      | Talk (not sleep)                                                            |
| NVDA interaction mode | **Application mode** (press `Ins+Space` once if NVDA starts in Browse mode) |

### 2.2 Pre-test Setup

1. Open NVDA Speech Viewer (`NVDA → Tools → Speech Viewer`) to capture announcements.
2. Set language to Hebrew if testing Hebrew card titles: NVDA Preferences →
   Speech → Language override → Hebrew.
3. Load dashboard with one browser tab.

### 2.3 Test Cases — Page Structure

| #   | Test                                  | Expected NVDA Announcement                                            | Pass/Fail |
| --- | ------------------------------------- | --------------------------------------------------------------------- | --------- |
| P1  | Press `Ctrl+Home` to go to page start | "Skip to main content, link"                                          | ✅ Pass   |
| P2  | Press `Enter` on skip link            | Focus moves to `#main-content` landmark; NVDA announces landmark name | ✅ Pass   |
| P3  | `Ins+F7` (elements list, headings)    | Lists "לוח משפחתי" as H1, then 11 card H2s                            | ✅ Pass   |
| P4  | `Ins+F7` (elements list, landmarks)   | Shows banner, navigation, main, contentinfo                           | ✅ Pass   |
| P5  | `H` key (heading navigation)          | Steps through H1 then each card H2 in DOM order                       | ✅ Pass   |
| P6  | `R` key (region navigation)           | Steps through 11 card article regions                                 | ✅ Pass   |

### 2.4 Test Cases — Card Navigation

| #   | Test                                       | Expected                                                            | Pass/Fail |
| --- | ------------------------------------------ | ------------------------------------------------------------------- | --------- |
| C1  | Tab to Weather card                        | "מזג אוויר, region" announced                                       | ✅ Pass   |
| C2  | Tab to Alerts card                         | "התראות פיקוד העורף, region"                                        | ✅ Pass   |
| C3  | Up/Down arrows inside card                 | Card text read sequentially                                         | ✅ Pass   |
| C4  | Active alert fires `aria-live="assertive"` | Announcement interrupts current speech within ~500 ms               | ✅ Pass   |
| C5  | System info card                           | `aria-live="polite"` updates read after current speech              | ✅ Pass   |
| C6  | Clock element (`#clock`)                   | Not auto-announced (aria-live="off"); readable on manual navigation | ✅ Pass   |

### 2.5 Test Cases — Overlays and Dialogs

| #   | Test                        | Expected                                                         | Pass/Fail |
| --- | --------------------------- | ---------------------------------------------------------------- | --------- |
| D1  | Press `S` key               | Config `<dialog>` opens; NVDA announces "הגדרות, dialog"         | ✅ Pass   |
| D2  | Tab inside config dialog    | Focus cycles only within dialog (focus trap)                     | ✅ Pass   |
| D3  | Press `Esc`                 | Dialog closes; focus returns to trigger element                  | ✅ Pass   |
| D4  | Press `H` / `?`             | Help dialog opens; key table read as grid/table                  | ✅ Pass   |
| D5  | Press `D`                   | Diagnostics dialog opens; provider health announced              | ✅ Pass   |
| D6  | Tour overlay on first visit | Tour `<dialog>` announced on page load; dismiss button reachable | ✅ Pass   |

### 2.6 Test Cases — Keyboard Shortcuts

All shortcuts are documented in [`docs/keyboard.md`](keyboard.md).

| #   | Test                                         | Expected                                                       | Pass/Fail |
| --- | -------------------------------------------- | -------------------------------------------------------------- | --------- |
| K1  | `T` (theme cycle)                            | Theme changes silently; no NVDA noise                          | ✅ Pass   |
| K2  | `N` (night dimmer)                           | Dim overlay applied; no NVDA announcement (visual-only change) | ✅ Pass   |
| K3  | `+` / `-` (font size)                        | Font-size changes; NVDA adjusts text rendering                 | ✅ Pass   |
| K4  | Single-key shortcuts suppressed in `<input>` | `S` inside a config input does not trigger shortcut            | ✅ Pass   |

### 2.7 Known Limitations (NVDA)

- **Hebrew RTL**: NVDA reads Hebrew text right-to-left within each line, which
  is correct. Mixed Hebrew-English sentences (e.g. stock tickers) are read
  in logical order, though punctuation direction may be inconsistent — this
  is a known NVDA Hebrew RTL limitation, not a dashboard bug.
- **Stocks card auto-refresh**: When stocks refresh every 5 minutes, the DOM
  updates silently (no `aria-live` on the table rows) to avoid continuous
  announcement noise. Users wanting updated values should navigate to the
  stocks card.
- **Video news card** (when enabled): The `<video>` element has
  `aria-label="C14 שידור חי — מושתק"`. Mute toggle button (`<button
aria-pressed="true/false">`) announces state change correctly.

---

## 3. VoiceOver iOS Test Protocol

### 3.1 Test Environment

| Setting       | Value                                                 |
| ------------- | ----------------------------------------------------- |
| Screen reader | VoiceOver (built-in) — iOS 16+ / iPadOS 16+           |
| Browser       | Safari (only browser that supports full PWA on iOS)   |
| Install mode  | Standalone PWA ("Add to Home Screen") — **preferred** |
| Dashboard URL | `https://rajwanyair.github.io/FamilyDashBoard/`       |

### 3.2 VoiceOver Navigation Gestures

| Gesture                 | Action                        |
| ----------------------- | ----------------------------- |
| Swipe right / left      | Next / previous element       |
| Two-finger swipe down   | Read from current element     |
| Double-tap              | Activate element              |
| Swipe up with 3 fingers | Scroll page down              |
| Rotor: Headings         | Jump between card H2 headings |
| Rotor: Landmarks        | Jump between page landmarks   |

### 3.3 Test Cases — iOS VoiceOver

| #   | Test                               | Expected                                                     | Pass/Fail |
| --- | ---------------------------------- | ------------------------------------------------------------ | --------- |
| V1  | Open page; wait for load           | VoiceOver reads page title "רגואן Family Dashboard"          | ✅ Pass   |
| V2  | Swipe to first interactive element | "Skip to main content, link"                                 | ✅ Pass   |
| V3  | Rotor → Headings → swipe up        | Navigates card headings in order                             | ✅ Pass   |
| V4  | Rotor → Landmarks → swipe up       | Cycles: banner → main → contentinfo                          | ✅ Pass   |
| V5  | Double-tap Settings button         | Config dialog opens; VoiceOver announces "הגדרות, dialog"    | ✅ Pass   |
| V6  | Swipe right inside dialog          | Cycles through dialog controls only (native iOS focus trap)  | ✅ Pass   |
| V7  | PWA standalone launch              | Splash screen visible; app title read on launch              | ✅ Pass   |
| V8  | `aria-live="assertive"` alert      | Alert text announced within ~1 s                             | ✅ Pass   |
| V9  | Offline banner appears             | "אין חיבור לאינטרנט — מציג נתונים מהמטמון, status" announced | ✅ Pass   |

### 3.4 Known Limitations (VoiceOver iOS)

- **Keyboard shortcuts**: VoiceOver intercepts most keyboard events. Single-key
  shortcuts (`T`, `S`, etc.) are inaccessible when VoiceOver is active. This is
  by design — the shortcuts are a sighted-user convenience feature.
- **Night dimmer**: The dimmer overlay (`#night-dim`) is `aria-hidden="true"` to
  prevent VoiceOver from reading it as content.
- **Orientation lock**: The app is locked to `landscape` in the manifest. On
  iPhone, VoiceOver users may find the landscape layout difficult to navigate
  without rotating the device. The screen-phone CSS mode provides a portrait
  layout at 390 px width.

---

## 4. Automated Coverage Complement

Manual tests are complemented by automated axe-core checks in CI:

```sh
npx playwright test tests/e2e/accessibility.spec.ts
```

The automated suite covers:

| Check type                  | Tool       | Threshold                |
| --------------------------- | ---------- | ------------------------ |
| axe-core WCAG 2.2 AA        | Playwright | Zero violations          |
| Lighthouse accessibility    | LHCI       | Score ≥ 0.98             |
| Colour contrast             | axe-core   | All themes ≥ 4.5:1 AA    |
| Focus visible               | axe-core   | All interactive elements |
| ARIA landmarks present      | axe-core   | Required regions present |
| Heading hierarchy           | axe-core   | No skipped levels        |
| Form labels                 | axe-core   | All inputs labelled      |
| `aria-live` region validity | axe-core   | Valid roles only         |

---

## 5. Remediation History

| Version | Issue                                                      | Fix                                                  |
| ------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| v11.0   | Clock `aria-live="polite"` announced every second          | Changed to `aria-live="off"`                         |
| v11.0   | Config `<div>` overlay had no focus trap                   | Migrated to `<dialog showModal()>`                   |
| v11.0   | Card `<div>` containers had no landmark role               | Added `<article>` with `aria-labelledby` per card    |
| v11.0   | Skip-link not visible on focus                             | Added `.skip-link:focus` visible style               |
| v11.2   | News chips `min-height < 24px`                             | Set `min-height: 24px; min-width: 24px` (WCAG 2.5.8) |
| v11.4   | Tour `<dialog>` dismiss button not announced on first open | Added `aria-live="polite"` to tour container         |

---

## 6. See Also

- [`docs/keyboard.md`](keyboard.md) — full keyboard shortcut reference + ARIA landmark map
- [`tests/e2e/accessibility.spec.ts`](../tests/e2e/accessibility.spec.ts) — axe-core Playwright suite
- [`.lighthouserc.json`](../.lighthouserc.json) — Lighthouse accessibility threshold (≥ 0.98)
- [ADR-018](adr/ADR-018-csp-coop-coep.md) — CSP / security headers context
