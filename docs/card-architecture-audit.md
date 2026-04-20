# Card Architecture Audit — FamilyDashBoard v8.5.0

> **Date**: 2026-04-20
> **Scope**: All 11 registered cards in `src/cards/`
> **Goal**: Track migration from `initX()` file-scoped pattern → `FdbCard` Web Component subclass

## Architecture Patterns

| Pattern | Description | Location |
|---------|-------------|----------|
| **FdbCard subclass** (new) | Extends `FdbCard` (`src/core/fdb-card.ts`) · registered as a custom element via `customElements.define()` · lifecycle in `connect()` / `disconnect()` · uses `scheduleRefresh()`, `setLoading()`, `setError()` | `fdb-*.ts` |
| **initX() file-scoped** (legacy) | Module-level state + exported `initXCard()` called from `main.ts` · no lifecycle hooks · manual DOM queries | `*.ts` (non-fdb) |

## Status Per Card

| Card | Registry ID | initX() file | FdbCard file | Status |
|------|-------------|--------------|--------------|--------|
| Alerts | `alerts` | `alerts/alerts.ts` | `alerts/fdb-alerts.ts` | ✅ Migrated |
| Calendar | `calendar` | `calendar/calendar.ts` | `calendar/fdb-calendar.ts` | ✅ Migrated |
| Countdown | `countdown` | `countdown/countdown.ts` | `countdown/fdb-countdown.ts` | ✅ Migrated |
| Currency | `currency` | `currency/currency.ts` | `currency/fdb-currency.ts` | ✅ Migrated |
| Hebrew Calendar | `hebrew-cal` | `hebrew-cal/hebrew-cal.ts` | `hebrew-cal/fdb-hebrew-cal.ts` | ✅ Migrated |
| Motivation | `motivation` | `motivation/motivation.ts` | `motivation/fdb-motivation.ts` | ✅ Migrated |
| News | `news` | `news/news.ts` | `news/fdb-news.ts` | ✅ Migrated |
| Stocks | `stocks` | `stocks/stocks.ts` | `stocks/fdb-stocks.ts` | ✅ Migrated |
| System Info | `system-info` | `system-info/system-info.ts` | `system-info/fdb-system-info.ts` | ✅ Migrated |
| Tasks | `tasks` | `tasks/tasks.ts` | `tasks/fdb-tasks.ts` | ✅ Migrated |
| Weather | `weather` | `weather/weather.ts` | `weather/fdb-weather.ts` | ✅ Migrated |

**11 / 11 migrated** · **Stream B2 ✅ COMPLETE**

## Migration Priority

Cards are prioritised by migration complexity (lines of code, external deps, adapter count):

| Priority | Card | Reason |
|----------|------|--------|
| 1 | **Countdown** | No network dep, simple timer logic, single file — easiest migration |
| 2 | **System Info** | No external API, hardware polling only, self-contained |
| 3 | **Currency** | One adapter (`currency-adapter.ts`), clean data path |
| 4 | **Hebrew Calendar** | One adapter (`hebcal-adapter.ts`), no real-time events |
| 5 | **Calendar** | ICS parsing complexity, iframe fallback — moderate |
| 6 | **Alerts** | Real-time polling, complex zone logic, streaming — most complex |

## Migration Checklist (per card)

When migrating a card from `initX()` to `FdbCard`:

- [ ] Create `fdb-<name>.ts` that `extends FdbCard`
- [ ] Move module-level state into class private fields (`#state`)
- [ ] Replace `document.getElementById()` calls with `this.querySelector()`
- [ ] Replace `setSync()` calls with `this.setLoading()` + `this.setError()`
- [ ] Wire `connect()` → initial load + `scheduleRefresh(TTL)`
- [ ] Wire `disconnect()` → clear timers / abort fetch
- [ ] Register with `customElements.define('fdb-<name>', Fdb<Name>Card)`
- [ ] Update `src/core/card-registry.ts` entry: add `customElement: 'fdb-<name>'`
- [ ] Keep legacy `<name>.ts` for shared helpers / adapters — do not delete
- [ ] Add `tests/unit/cards/fdb-<name>.test.ts` with at least 3 tests
- [ ] Verify `data-card-id` in `index.html` matches registry ID exactly
- [ ] Run `npx vitest run` — 0 failures

## Adapter Files (unaffected by migration)

These adapter files contain pure data mapping functions and do NOT need migration — they are consumed by both old and new patterns:

| File | Purpose |
|------|---------|
| `alerts/alerts-adapter.ts` | `AlertEvent[]` → `AlertsDomain` |
| `calendar/calendar-adapter.ts` | `CalendarEvent[]` → `CalendarDomainEvent[]` |
| `currency/currency-adapter.ts` | `CurrencyResponse` → `CurrencyDomain` |
| `hebrew-cal/hebcal-adapter.ts` | `HebcalResponse` → `HebcalDomain` |
| `news/news-adapter.ts` | `NewsItem[]` → `NewsDomainItem[]` |
| `stocks/stocks-adapter.ts` | `YahooChartResponse` → `StockDomain` |
| `weather/open-meteo-adapter.ts` | `WeatherResponse` → `WeatherDomain` |

## References

- `src/core/fdb-card.ts` — FdbCard base class
- `src/core/card-registry.ts` — `registerCard()` / `getCard()` registry
- `src/cards/motivation/fdb-motivation.ts` — canonical migration example
- `src/cards/weather/fdb-weather.ts` — example with network dep + adapter
- ADR-001: Shadow DOM decision (no Shadow DOM — global CSS for TV theming)
