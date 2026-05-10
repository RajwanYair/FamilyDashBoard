---
name: update-tests
description: "Add or update tests in the FamilyDashBoard test suite. Use when: adding a new card or API (need new test coverage), changing a CSS/JS constant, adding a new HTML element, fixing broken test assertions, or running and triaging test failures. Covers Vitest 4 + happy-dom, per-file test suites in tests/unit/."
argument-hint: "Describe what changed: new card name, changed CSS property, updated constant, broken test name, etc."
---

# Update Tests — FamilyDashBoard

> **Before acting**, read `.github/instructions/tests.instructions.md` for full conventions (helpers, mocking, cache rules, timer patterns, DOM tests, coverage thresholds). This skill covers only the **step-by-step workflow** and **templates** not in the instructions file.

## Quick Commands

```powershell
npx vitest run                                    # all tests
npx vitest run tests/unit/cards/weather.test.ts  # single file
npx vitest run --coverage                         # with coverage report
```

## File Map

| Source file                            | Test file                                |
| -------------------------------------- | ---------------------------------------- |
| `src/main.ts`                          | `tests/unit/main.test.ts`                |
| `src/cards/weather/weather.ts`         | `tests/unit/cards/weather.test.ts`       |
| `src/cards/news/news.ts`               | `tests/unit/cards/news.test.ts`          |
| `src/cards/calendar/calendar.ts`       | `tests/unit/cards/calendar.test.ts`      |
| `src/cards/alerts/alerts.ts`           | `tests/unit/cards/alerts.test.ts`        |
| `src/cards/stocks/stocks.ts`           | `tests/unit/cards/stocks.test.ts`        |
| `src/cards/hebrew-cal/hebrew-cal.ts`   | `tests/unit/cards/hebrew-cal.test.ts`    |
| `src/cards/currency/currency.ts`       | `tests/unit/cards/currency.test.ts`      |
| `src/cards/motivation/motivation.ts`   | `tests/unit/cards/motivation.test.ts`    |
| `src/cards/tasks/tasks.ts`             | `tests/unit/cards/tasks.test.ts`         |
| `src/cards/countdown/countdown.ts`     | `tests/unit/cards/countdown.test.ts`     |
| `src/cards/video-news/video-news.ts`   | `tests/unit/cards/video-news.test.ts`    |
| `src/cards/system-info/system-info.ts` | `tests/unit/cards/system-info.test.ts`   |
| `src/cards/base-card.ts`               | `tests/unit/cards/base-card.test.ts`     |
| `src/ui/ticker.ts`                     | `tests/unit/ui/ticker.test.ts`           |
| `src/ui/header.ts`                     | `tests/unit/ui/header.test.ts`           |
| `src/ui/config-panel.ts`               | `tests/unit/ui/config-panel.test.ts`     |
| `src/ui/maximize.ts`                   | `tests/unit/ui/maximize.test.ts`         |
| `src/ui/night-dimmer.ts`               | `tests/unit/ui/night-dimmer.test.ts`     |
| `src/ui/theme.ts`                      | `tests/unit/ui/theme.test.ts`            |
| `src/ui/toast.ts`                      | `tests/unit/ui/toast.test.ts`            |
| `src/ui/bg-images.ts`                  | `tests/unit/ui/bg-images.test.ts`        |
| `src/ui/keyboard.ts`                   | `tests/unit/ui/keyboard.test.ts`         |
| `src/ui/scroll.ts`                     | `tests/unit/ui/scroll.test.ts`           |
| `src/ui/screen-mode.ts`                | `tests/unit/ui/screen-mode.test.ts`      |
| `src/ui/status-bar.ts`                 | `tests/unit/ui/status-bar.test.ts`       |
| `src/ui/layout-drag.ts`                | `tests/unit/ui/layout-drag.test.ts`      |
| `src/ui/diag-overlay.ts`               | `tests/unit/ui/diag-overlay.test.ts`     |
| `src/core/cache.ts`                    | `tests/unit/core/cache.test.ts`          |
| `src/core/idb-cache.ts`                | `tests/unit/core/idb-cache.test.ts`      |
| `src/core/config.ts`                   | `tests/unit/core/config.test.ts`         |
| `src/core/fetch.ts`                    | `tests/unit/core/fetch.test.ts`          |
| `src/core/card-registry.ts`            | `tests/unit/core/card-registry.test.ts`  |
| `src/core/constants.ts`                | `tests/unit/core/constants.test.ts`      |
| `src/core/diag.ts`                     | `tests/unit/core/diag.test.ts`           |
| `src/core/sync.ts`                     | `tests/unit/core/sync.test.ts`           |
| `src/core/state.ts`                    | `tests/unit/core/state.test.ts`          |
| `src/core/hardware.ts`                 | `tests/unit/core/hardware.test.ts`       |
| `src/core/idle.ts`                     | `tests/unit/core/idle.test.ts`           |
| `src/core/perf.ts`                     | `tests/unit/core/perf.test.ts`           |
| `src/core/provider.ts`                 | `tests/unit/core/provider.test.ts`       |
| `src/core/utils.ts`                    | `tests/unit/core/utils.test.ts`          |
| `src/core/error-reporter.ts`           | `tests/unit/core/error-reporter.test.ts` |
| `src/core/error-tracker.ts`            | `tests/unit/core/error-tracker.test.ts`  |
| `src/core/fdb-card.ts`                 | `tests/unit/core/fdb-card.test.ts`       |
| `src/core/sw-constants.ts`             | `tests/unit/core/sw-constants.test.ts`   |
| `src/index.html`                       | `tests/unit/html/dom-contract.test.ts`   |
| `worker/src/`                          | `tests/unit/worker/worker.test.ts`       |

## Adding Tests for a New Card

Create `tests/unit/cards/<name>.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initCard, renderCard } from "@/cards/<name>/<name>";

vi.mock("@/core/fetch", () => ({
  fetchWithTimeout: vi.fn().mockRejectedValue(new Error("mocked")),
  acquireLock: vi.fn().mockReturnValue(false),
  releaseLock: vi.fn(),
}));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));
vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createCardLoader: vi.fn(),
}));

describe("<Name> — init()", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="<name>-body"></div>`;
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("does not throw on init", () => {
    expect(() => initCard()).not.toThrow();
  });
});
```

Then add `"tests/unit/cards/<name>.test.ts"` reference to `vitest.config.ts` include glob if needed (usually auto-detected).

## Coverage & Patterns

For cache-path, proxy, timer, and DOM testing patterns, see `.github/instructions/tests.instructions.md` §Cache Test Rules / §Timer Tests / §DOM Tests.

## Fixing Broken Tests

| Symptom                              | Cause                            | Fix                                                                         |
| ------------------------------------ | -------------------------------- | --------------------------------------------------------------------------- |
| `mockReturnValue is not a function`  | Used `vi.mocked()` on a non-mock | Use `vi.spyOn(module, "fn").mockReturnValue(...)` instead                   |
| Test passes alone but fails in suite | Module state bleed               | Add `vi.resetModules()` in beforeEach                                       |
| Time-sensitive test fails at night   | Missing `vi.setSystemTime`       | Add `vi.useFakeTimers(); vi.setSystemTime(new Date("2024-06-15T08:00:00"))` |
| Calendar event not in agenda         | Date is outside 21-day window    | Use `vi.setSystemTime` to pin clock near fixture date                       |
| `};)` syntax error                   | Wrong closing brace              | Change `};)` → `});`                                                        |

## Session Commit Rule

After each Copilot session that adds/fixes tests:

```powershell
git add -A && git commit -m "test(<scope>): <description> — <N> tests, <M> suites"
```

## Verification

Run these commands; all must exit 0 before merging or committing:

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run
```

Check targeted file first to get fast feedback:

```powershell
npx vitest run tests/unit/cards/<name>.test.ts --reporter=verbose
```

Coverage gate (after adding new tests):

```powershell
npx vitest run --coverage
```

Expected: ≥90% statements · ≥81% branches · ≥90% functions · ≥92% lines per file.
Zero `vi.resetModules()` calls except in files that actually need module-level
state reset (see file count in `.github/instructions/workspace.instructions.md`).
