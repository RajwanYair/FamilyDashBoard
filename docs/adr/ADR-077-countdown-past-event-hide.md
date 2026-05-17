# ADR-077 — Countdown Card: Hide Past Events and Clear Default Config

**Status**: Accepted · **Date**: 2026-05-17 · **Drivers**: UX clarity, generic-dashboard neutrality, no stale wedding/birthday data shown on unset dashboards.

## Context

The countdown card in FamilyDashBoard previously hardcoded wedding-specific default values in `DEFAULT_CONFIG`:

```typescript
// before
countdownCardTitle: "החתונה שלנו",
countdownCardDate:  "2027-09-05",
countdownCardDoneMsg: "🎉 מזל טוב!",
```

This caused two problems:

1. **Stale past-event display**: If the configured date passed, the card continued ticking into negative numbers (e.g., "−3 ימים") with no visual indication that the event had ended. There was no recurrence logic and no reset mechanism, so the card permanently displayed an incorrect countdown.

2. **Wedding-specific defaults**: Users who never configured the card saw countdown data implying a specific couple's wedding date, making the dashboard appear personalised to a specific family rather than being a generic, family-neutral tool.

### Behaviour before this change

- `tick()` always rendered the main countdown section regardless of whether the target date was in the past.
- `getCountdownTargetDate()` parsed any non-empty stored date and could return a past `Date`.
- Default config contained `"החתונה שלנו"` (Our Wedding) as the card title.
- No visual affordance existed for a countdown that had already expired.

## Decision

### 1. Hide countdown sections when no date is configured or when the event is in the past

`getCountdownTargetDate()` now returns `new Date(0)` (Unix epoch) whenever the stored date string is empty or unparseable. `tick()` gates display:

```typescript
// tick() gating logic
const target = getCountdownTargetDate();
if (target.getTime() <= 0 || target <= nowDate) {
  mainSecShow.style.display = "none";
  return;
}
mainSecShow.style.display = "";
```

The three countdown sections (`cd-main-section`, `cd2-section`, `cd3-section`) all start hidden via `style="display:none"` in `index.html`. A section only becomes visible when its configured future date is live.

### 2. Clear wedding-specific defaults

`DEFAULT_CONFIG` is updated to blank strings for all countdown fields:

```typescript
countdownCardTitle:   "",
countdownCardDate:    "",
countdownCardDoneMsg: "🎉 מזל טוב!",
```

An unset card now shows a blank / hidden section rather than a past countdown to a specific wedding.

### 3. `countdownCardDoneMsg` retained as shared default

The completion message `"🎉 מזל טוב!"` is kept as a generic celebration message that applies to any event type. Users who want a custom message can override it via the settings overlay.

## Consequences

| Aspect                       | Before                              | After                      |
| ---------------------------- | ----------------------------------- | -------------------------- |
| Past event                   | Ticks into negative numbers forever | Section hidden immediately |
| Empty date                   | Shows countdown to 2027-09-05       | Section hidden             |
| Default title                | "החתונה שלנו" (wedding-specific)    | "" (operator fills in)     |
| User-configured future event | Visible countdown                   | Unchanged — still visible  |
| User-configured past event   | Stale countdown                     | Hidden on next `tick()`    |

## Rejected alternatives

- **Show "אירוע הסתיים" message when past**: Considered, but adds DOM/CSS overhead with no clear value for a TV dashboard where past events simply stop mattering.
- **Auto-advance to next anniversary**: Out of scope for a generic countdown card; would require knowing the recurrence interval (yearly / custom), which is a new config field.
- **Keep wedding defaults, add override note**: Rejected — conflicts with the vendor-neutrality principle (ADR-031) which mandates generic, operator-configurable defaults.

## Related

- `src/cards/countdown/countdown.ts` — `tick()`, `getCountdownTargetDate()`
- `src/types/config.ts` — `DEFAULT_CONFIG`
- `src/index.html` — countdown sections start `display:none`
- ADR-076 — temporal.ts scaffold (date parsing for countdown uses `parsePlainDateMs`)
