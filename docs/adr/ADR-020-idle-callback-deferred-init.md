# ADR-020: Deferred Card Init via `requestIdleCallback`

**Date:** 2026-07-05
**Status:** Accepted
**Deciders:** Project maintainer
**Relates to:** ADR-003 (Worker-first API), ADR-015 (env type isolation)

---

## Context

FamilyDashBoard initialises 11 cards synchronously in `main.ts` on every page
load. Profiling showed that all 11 `initXxxCard()` calls were dispatched on the
same microtask tick, competing for the main thread during the critical render path
and delaying Time to Interactive (TTI).

Three cards — **Motivation**, **System-Info**, and the **Ticker** — are purely
ambient/decorative:

- They display no time-sensitive data.
- They have no dependency on other cards' DOM state.
- A 200–2000 ms delay before they appear is imperceptible to users on a TV dashboard.

Calling them at startup on equal priority with weather, news, and alerts was
wasteful.

---

## Decision

### Priority tiers

Cards are split into three init tiers:

| Tier   | Cards                                       | Dispatch method                     |
| ------ | ------------------------------------------- | ----------------------------------- |
| HIGH   | Weather, News, Alerts, Hebrew-cal, Calendar | Synchronous, immediately            |
| NORMAL | Stocks, Currency, Tasks, Countdown          | Synchronous, immediately after HIGH |
| LOW    | Motivation, System-info, Ticker             | Deferred via `requestIdleCallback`  |

### Implementation pattern

```typescript
const _lowPriorityInit = (): void => {
  timedInit("motivation", initMotivationCard);
  timedInit("system-info", initSystemInfoCard);
  initTicker();
};

if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(_lowPriorityInit, { timeout: 2000 });
} else {
  setTimeout(_lowPriorityInit, 200); // Safari / older Firefox fallback
}
```

- **`timeout: 2000`** — guarantees execution within 2 s even if the browser
  never idles (e.g. a locked 60 fps animation loop).
- **`setTimeout(200)` fallback** — used on browsers that do not implement
  `requestIdleCallback` (Safari < 16.4, Firefox < 99).
- The same pattern is applied to the auto-theme interval setup
  (`requestIdleCallback` with `timeout: 3000`).

### Auto-theme deferred similarly

The periodic `checkAutoTheme` interval is also deferred:

```typescript
const _setupAutoTheme = (): void => {
  checkAutoTheme();
  setInterval(checkAutoTheme, AUTO_THEME_CHECK_MS);
};

if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(_setupAutoTheme, { timeout: 3000 });
} else {
  setTimeout(_setupAutoTheme, 300);
}
```

---

## Consequences

### Positive

- **TTI improvement**: The main-thread burst at startup is shortened; HIGH/NORMAL
  cards render before the browser is asked to do anything else.
- **No observable UX regression**: The motivation quote and system info appear
  ~200–500 ms later than before — unnoticeable on a 55" TV at 1.5 m distance.
- **Safe fallback**: The `setTimeout` path ensures correctness on all browsers,
  including those without `requestIdleCallback`.

### Negative / Trade-offs

- **Test complexity**: Unit tests that assert LOW-priority cards were initialised
  must stub `requestIdleCallback` to execute the callback synchronously.
  Pattern used in `tests/unit/main.test.ts`:

  ```typescript
  vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => {
    cb({ didTimeout: false, timeRemaining: () => 50 });
    return 0;
  });
  ```

- **Non-deterministic in E2E tests**: Playwright tests that check for motivation
  or system-info card content must wait for the element rather than assuming
  synchronous availability.

---

## Alternatives Rejected

| Alternative                            | Reason rejected                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `IntersectionObserver` lazy-init       | Cards are always in the viewport on a TV dashboard — no meaningful lazy trigger    |
| Dynamic `import()` code-split per tier | Increases network waterfall; bundle is already a single IIFE for `file://` support |
| Web Worker offload for init logic      | Card init touches DOM; Web Workers have no DOM access                              |
| Preserving fully synchronous init      | Measured 220 ms TTI improvement is worth the marginal test complexity cost         |

---

## See Also

- `src/main.ts` — implementation (`_lowPriorityInit`, `_setupAutoTheme`)
- `tests/unit/main.test.ts` — `requestIdleCallback` stub pattern
- [MDN: `requestIdleCallback`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)
