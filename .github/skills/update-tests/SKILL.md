---
name: update-tests
description: "Add or update tests in the FamilyDashBoard test suite. Use when: adding a new card or API (need new test coverage), changing a CSS/JS constant, adding a new HTML element, fixing broken test assertions, or running and triaging test failures. Covers Vitest 4 + happy-dom, per-file test suites in tests/unit/."
argument-hint: "Describe what changed: new card name, changed CSS property, updated constant, broken test name, etc."
---

# Update Tests — FamilyDashBoard

## Infrastructure

- **Runner**: Vitest 4 + happy-dom (zero real browser)
- **Location**: `tests/unit/` — one file per source file
- **Current baseline**: read `.github/instructions/workspace.instructions.md` or the latest CI report before hardcoding counts in docs
- **Baseline command**: `npx vitest run` (must exit 0, 0 failures)
- **Coverage**: `npx vitest run --coverage` → repo thresholds 93.7 / 85.0 / 94.1 / 95.1 (statements / branches / functions / lines), canonical source `vitest.config.ts`. Target ≥95% per file when adding new modules.

## How to Run

```powershell
npx vitest run                                    # all tests
npx vitest run tests/unit/cards/weather.test.ts  # single file
npx vitest run --coverage                         # with coverage report
npx vitest run --reporter=verbose                 # see each test name
```

## Floor Rules (NEVER violate)

1. All tests use `vi.mock()` for external deps — no real network, no real timers by default
2. `vi.resetModules()` per test only when module-level state bleeds between tests
3. After every `vi.useFakeTimers()` → `vi.useRealTimers()` in afterEach
4. `vi.setSystemTime()` required when testing time-sensitive functions (greetings, birthday, today-strip)
5. Module state bleed: **never** assert `toBeNull()` on shared module-level variables if prior tests may set them
6. `cGet()`/`cGetStale()` return `null` (not `undefined`) — check `!== null`
7. `for (let i = 0; i < 50; i++) await Promise.resolve()` flushes async ticker/loader operations
8. Append new suites at end of file; do not reorder existing suites
9. Prefer extracting repeated DOM builders and fixtures before adding more inline `document.body.innerHTML` blocks in large files

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

## Adding Coverage Tests for Uncovered Lines

1. Run `npx vitest run --coverage` to identify uncovered lines
2. Read the source lines to understand the branch
3. Append a new `describe` block at the end of the existing test file
4. Key patterns:

### Stale-while-revalidate cache path

```typescript
// Write expired data to localStorage; cGetStale reads it even past TTL
cClear();
localStorage.setItem("dash_v2_<key>", JSON.stringify({ data: FIXTURE, ts: 0 }));
vi.mocked(cGet).mockReturnValue(null); // force cache miss
```

### Proxy !r.ok branch

```typescript
vi.mocked(fetchWithTimeout).mockResolvedValue({ ok: false, json: vi.fn() } as unknown as Response);
// Verify no throw and function returns gracefully
```

### allorigins proxy unwrapping

```typescript
vi.mocked(fetchWithTimeout).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ contents: JSON.stringify(FIXTURE) }),
} as unknown as Response);
```

### Time-sensitive functions (greeting, birthday, today-strip)

```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date("2024-06-15T08:00:00")); // morning = greet with name
// ... test ...
vi.useRealTimers();
```

## Performance Guidance

When updating an existing large test file, look for these smells before adding more assertions:

- repeated `document.body.innerHTML` scaffolds
- repeated `vi.resetModules()` that can be limited to stateful suites only
- repeated `vi.useFakeTimers()` that can be grouped in a single `describe`
- duplicated fixtures that belong in `tests/unit/helpers/`

Prefer reducing churn in the big suites rather than adding another one-off fixture block.

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
