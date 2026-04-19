# ADR-004: Per-Card Config Namespacing Strategy

**Date:** 2026-05-30
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard v7 grew from 4 cards (weather, news, stocks, currency) to 11 cards. Each card can have its own settings (e.g., `newsMaxItems`, `stocksShowPortfolio`, `calendarDaysAhead`). In v7.0–v7.17, all card settings were stored as flat top-level fields in `DashboardConfig`, leading to:

1. **Namespace collisions** — Risk of two cards using the same key name
2. **Configuration sprawl** — A single flat object with 40+ fields is hard to reason about
3. **Migration complexity** — Adding a new card requires modifying the central config type

---

## Decision

**Adopt a per-card config namespace under `DashboardConfig.cards`.**

```typescript
interface DashboardConfig {
  // ... existing top-level fields ...
  cards: CardConfigMap;
}

type CardConfigMap = {
  weather?: WeatherCardConfig;
  news?: NewsCardConfig;
  stocks?: StocksCardConfig;
  // ... one per card ...
};

interface CardConfig {
  size?: CardSize;
  hidden?: boolean;
  settings?: Record<string, unknown>;
}
```

Each card's typed settings interface extends `CardConfig.settings`. The `CardConfigField[]` schema array (exported by each card module) drives the config panel auto-renderer.

---

## Rationale

1. **Isolation** — Each card owns its own settings namespace. `cards.alerts.settings.alertSound` cannot collide with `cards.news.settings.showSource`.
2. **Auto-renderer** — The `configSchema` export from each card module provides `key`, `type`, `defaultValue`, and labels. The config panel uses `buildConfigAccordion()` to generate UI automatically — no manual form wiring per card.
3. **Migration path** — `CONFIG_VERSION` bump (6 → 7) migrates legacy flat keys into the new `cards` namespace. Old configs are silently upgraded on first load.
4. **Typed safety** — `CardConfigMap` gives TypeScript full type checking for each card's settings, including `min`/`max` for range fields and `options` for select fields.

---

## Migration

Sprint 143 added a v6 → v7 migration in `loadConfig()`:

- `alertsEnabled`, `alertSound`, `realtimeAlerts`, `alertVolume` → `cards.alerts.settings`
- `calendarDaysAhead` → `cards.calendar.settings`

Future cards follow the same pattern: add typed interface, add `configSchema` export, register in `CardConfigMap`.

---

## Consequences

- **Positive**: Clean separation of concerns, auto-generated config UI, type-safe config access
- **Negative**: Slight boilerplate per card (typed interface + schema array + migration block)
- **Neutral**: Legacy flat fields remain in `DashboardConfig` for backward compatibility until they can be fully deprecated
