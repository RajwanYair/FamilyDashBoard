---
description: "Add or fix a browser compatibility test in FamilyDashBoard — Vitest browser-mode or Playwright E2E. Use when checking CSS feature support, Web API availability, or cross-browser rendering."
tools:
  [
    "read_file",
    "grep_search",
    "file_search",
    "create_file",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "run_in_terminal",
    "get_terminal_output",
    "get_errors",
    "manage_todo_list",
    "vscode_listCodeUsages",
    "tool_search",
    "view_image",
    "memory",
    "fetch_webpage",
    "runSubagent",
  ]
---

# Browser Compatibility Test

READ FIRST: review `.browserslistrc` for the target browser list.

## Choose the Right Test Type

| Test type                    | Location                              | When to use                                     |
| ---------------------------- | ------------------------------------- | ----------------------------------------------- |
| Browser unit test            | `tests/unit/` (happy-dom)             | Web API feature detection, DOM API availability |
| Playwright E2E smoke         | `tests/e2e/`                          | Cross-browser rendering, keyboard nav, a11y     |
| Playwright visual regression | `tests/e2e/visual-regression.spec.ts` | Visual rendering across themes                  |

## FamilyDashBoard Browser Targets

From `.browserslistrc`: Chrome 114+, Edge 114+, Firefox 128+, Firefox ESR, Safari 17.4+, Opera 100+, Samsung 23+, iOS 17.4+.
Playwright projects: chromium (all tests), firefox/webkit/edge/mobile-chrome/mobile-safari/tablet-safari (smoke + a11y only).

## Feature Detection Pattern

```typescript
// ✓ Correct — detect capability, not browser
const hasClipboard = typeof navigator.clipboard?.writeText === "function";
if (hasClipboard) await navigator.clipboard.writeText(text);

// ✗ Wrong — throws when API absent
await navigator.clipboard.writeText(text);
```

## Test Assertion Style

```typescript
// ✓ Test that the detection mechanism works (not that feature IS present)
expect(typeof CSS.supports("container-type", "size")).toBe("boolean");

// ✗ Wrong — asserts specific browser capability (fails on older browsers)
expect(CSS.supports("container-type", "size")).toBe(true);
```

## E2E Cross-Browser Test (smoke pattern)

```typescript
import { test, expect } from "@playwright/test";

test("page renders all 12 cards without JS errors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-card-id]").first()).toBeVisible();
});
```

E2E tests run via: `npx playwright test --project=chromium tests/e2e/{file}.spec.ts`

## Rules

- **Detect capabilities, never browser UA** — no `navigator.userAgent` sniffing that changes app behaviour
- **Always graceful degradation** — missing feature → skip enhancement, app still functions
- **No `toBe(true)` on `CSS.supports()`** — test that detection works, not specific support level
- **RTL must be tested** — Hebrew RTL layout must hold in all target browsers

## Before Writing Tests

1. Check existing tests: `grep_search` in `tests/unit/` and `tests/e2e/`
2. Read `playwright.config.ts` to understand which projects run the test
3. Identify if the feature is guarded in source with `typeof` or `in window` check

## Validation

Unit tests: `npx vitest run tests/unit/`
Playwright (chromium): `npx playwright test --project=chromium`
Playwright (all): `npx playwright test`

## User Request

{{input}}
