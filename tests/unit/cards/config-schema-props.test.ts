/**
 * CS-FC8 — configSchema structural property tests
 *
 * Property-based invariant checks over all 12 card configSchema arrays.
 * Uses fast-check to generate arbitrary valid indices and verifies that
 * every field in every schema satisfies the structural contract.
 *
 * CS-FC1  every schema has ≥ 2 fields
 * CS-FC2  every field.key is a non-empty string
 * CS-FC3  every field.labelHe is a non-empty string
 * CS-FC4  every field.labelEn is a non-empty string
 * CS-FC5  all keys within a schema are unique
 * CS-FC6  "select" fields have an options array with ≥ 2 entries
 * CS-FC7  "range" fields with both min & max satisfy min ≤ max
 * CS-FC8  "boolean" fields have defaultValue === true | false
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import type { CardConfigField } from "@/types/card";

// ── Shared mocks (all card modules pull from these) ───────────────────────
vi.mock("@/core/config", () => ({ loadConfig: vi.fn(() => ({})), saveConfig: vi.fn() }));
vi.mock("@/core/constants", () => ({
  MS_PER_DAY: 86_400_000,
  MS_PER_HOUR: 3_600_000,
  MS_PER_MIN: 60_000,
  INTERVALS: { DAY: 86_400_000, HOUR: 3_600_000 },
  STOCK_SYMBOLS: [],
  STOCK_META: {},
  API: {},
  LS_STOCK_ALERTS: "stk-alerts",
  LS_PORTFOLIO: "stk-portfolio",
  WORKER_BASE_URL: "https://worker.test",
  isWorkerEnabled: () => false,
  LS_PREFIX: "dash_v2_",
  LS_MAX_AGE: 7 * 86_400_000,
  PROXIES: [],
}));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn(() => null),
  cGetStale: vi.fn(() => null),
  cGetAsync: vi.fn(() => Promise.resolve(null)),
  cGetStaleAsync: vi.fn(() => Promise.resolve(null)),
  cSet: vi.fn(),
  cSetAsync: vi.fn(() => Promise.resolve()),
  cEvict: vi.fn(),
}));
vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
  syncBurst: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock("@/core/fetch", () => ({
  fetchJSONWithWorker: vi.fn(),
  fetchWithTimeout: vi.fn(),
  runConcurrent: vi.fn(),
  acquireLock: vi.fn(() => true),
  releaseLock: vi.fn(),
}));
vi.mock("@/core/i18n", () => ({ t: vi.fn((k: string) => k) }));
vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/core/history", () => ({
  historyAppend: vi.fn(),
  historyGet: vi.fn(() => []),
  sparklineSvg: vi.fn(() => "<svg/>"),
}));
vi.mock("@/core/trusted-types", () => ({
  trustedHTML: vi.fn((s: string) => s),
}));
vi.mock("@/core/auto-loop-scroll", () => ({ initAutoLoopScroll: vi.fn() }));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/idle", () => ({ isPageVisible: vi.fn(() => true) }));
vi.mock("@/core/idb-store", () => ({
  idbGet: vi.fn(() => null),
  idbSet: vi.fn(),
  idbDelete: vi.fn(),
}));
vi.mock("@/core/signals", () => ({
  signal: vi.fn(() => ({ value: undefined })),
  effect: vi.fn(),
}));
vi.mock("@/core/app-signals", () => ({
  tempUnit: { value: "C" },
  signal: vi.fn(),
}));
vi.mock("@/core/event-bus", () => ({
  globalAlertChannel: { value: null },
  globalThemeChannel: { value: null },
  globalSync: { value: null },
  globalOffline: { value: false },
  broadcastSync: vi.fn(),
  broadcastAlert: vi.fn(),
  broadcastTheme: vi.fn(),
}));
vi.mock("@/core/utils", () => ({
  decomposeDuration: vi.fn(() => ({ hours: 0, minutes: 0, seconds: 0 })),
  pad2: vi.fn((n: number) => String(n).padStart(2, "0")),
  computeMoonPhase: vi.fn(),
}));
vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createAsyncCardLoader: vi.fn(),
  createCardLoader: vi.fn(),
}));
// CSS modules
vi.mock("@/cards/weather/weather.css", () => ({}));
vi.mock("@/cards/stocks/stocks.css", () => ({}));
vi.mock("@/cards/news/news.css", () => ({}));
vi.mock("@/cards/tasks/tasks.css", () => ({}));
vi.mock("@/cards/countdown/countdown.css", () => ({}));
vi.mock("@/cards/calendar/calendar.css", () => ({}));
vi.mock("@/cards/hebrew-cal/hebrew-cal.css", () => ({}));
vi.mock("@/cards/motivation/motivation.css", () => ({}));
vi.mock("@/cards/video-news/video-news.css", () => ({}));
vi.mock("@/cards/alerts/alerts.css", () => ({}));
vi.mock("@/cards/currency/currency.css", () => ({}));
vi.mock("@/cards/system-info/system-info.css", () => ({}));
vi.mock("@/cards/ai-synthesis/ai-synthesis.css", () => ({}));
// Card-specific adapter mocks
vi.mock("@/cards/weather/nws-adapter", () => ({ fetchNWS: vi.fn() }));
vi.mock("@/cards/video-news/video-news-adapter", () => ({
  getStreamDescriptor: vi.fn(),
  listChannels: vi.fn(() => []),
}));
// Partial mock for currency: keep real exports (including currencyConfigSchema)
// but stub the cross-card function used by stocks.ts
vi.mock("@/cards/currency/currency", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    getLastCurrencyRates: vi.fn(() => null),
    initCurrencyCard: vi.fn(),
    destroyCurrencyCard: vi.fn(),
  };
});

// ── Lazy schema imports (after all vi.mock calls) ─────────────────────────
import { weatherConfigSchema } from "@/cards/weather/weather";
import { stocksConfigSchema } from "@/cards/stocks/stocks";
import { newsConfigSchema } from "@/cards/news/news";
import { tasksConfigSchema } from "@/cards/tasks/tasks";
import { countdownConfigSchema } from "@/cards/countdown/countdown";
import { calendarConfigSchema } from "@/cards/calendar/calendar";
import { hebrewCalConfigSchema } from "@/cards/hebrew-cal/hebrew-cal";
import { motivationConfigSchema } from "@/cards/motivation/motivation";
import { videoNewsConfigSchema } from "@/cards/video-news/video-news";
import { alertsConfigSchema } from "@/cards/alerts/alerts";
import { currencyConfigSchema } from "@/cards/currency/currency";
import { systemInfoConfigSchema } from "@/cards/system-info/system-info";

// ── Registry of all 12 schemas ────────────────────────────────────────────
const ALL_SCHEMAS: Record<string, CardConfigField[]> = {
  weather: weatherConfigSchema,
  stocks: stocksConfigSchema,
  news: newsConfigSchema,
  tasks: tasksConfigSchema,
  countdown: countdownConfigSchema,
  calendar: calendarConfigSchema,
  "hebrew-cal": hebrewCalConfigSchema,
  motivation: motivationConfigSchema,
  "video-news": videoNewsConfigSchema,
  alerts: alertsConfigSchema,
  currency: currencyConfigSchema,
  "system-info": systemInfoConfigSchema,
};

// ── Helper ─────────────────────────────────────────────────────────────────
/**
 * Use fast-check to pick an arbitrary index into `schema` and call `check`.
 */
function forAnyField(
  schema: CardConfigField[],
  check: (f: CardConfigField) => boolean,
  numRuns = 300,
): void {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: schema.length - 1 }), (idx) =>
      check(schema[idx] as CardConfigField),
    ),
    { numRuns },
  );
}

// ── CS-FC1: Every schema has ≥ 2 fields ───────────────────────────────────
describe("CS-FC1: every configSchema has at least 2 fields", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    it(`${name}: length ≥ 2`, () => {
      expect(schema.length).toBeGreaterThanOrEqual(2);
    });
  }
});

// ── CS-FC2: field.key is always a non-empty string ────────────────────────
describe("CS-FC2: every field.key is a non-empty string", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    it(`${name}: any index → non-empty key`, () => {
      forAnyField(schema, (f) => typeof f.key === "string" && f.key.length > 0);
    });
  }
});

// ── CS-FC3: field.labelHe is always a non-empty string ───────────────────
describe("CS-FC3: every field.labelHe is a non-empty string", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    it(`${name}: any index → non-empty labelHe`, () => {
      forAnyField(schema, (f) => typeof f.labelHe === "string" && f.labelHe.length > 0);
    });
  }
});

// ── CS-FC4: field.labelEn is always a non-empty string ───────────────────
describe("CS-FC4: every field.labelEn is a non-empty string", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    it(`${name}: any index → non-empty labelEn`, () => {
      forAnyField(schema, (f) => typeof f.labelEn === "string" && f.labelEn.length > 0);
    });
  }
});

// ── CS-FC5: all keys within a schema are unique ───────────────────────────
describe("CS-FC5: all keys within each schema are unique", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    it(`${name}: no duplicate keys`, () => {
      const keys = schema.map((f) => f.key);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  }
});

// ── CS-FC6: "select" fields have ≥ 2 options ─────────────────────────────
describe('CS-FC6: "select" fields always have ≥ 2 options', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const selectFields = schema.filter((f) => f.type === "select");
    if (selectFields.length === 0) continue;
    it(`${name}: every select field has ≥ 2 options`, () => {
      forAnyField(selectFields, (f) => Array.isArray(f.options) && (f.options?.length ?? 0) >= 2);
    });
  }
});

// ── CS-FC7: "range" fields with min & max satisfy min ≤ max ──────────────
describe('CS-FC7: "range" fields satisfy min ≤ max when both are defined', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const rangeFields = schema.filter(
      (f) => f.type === "range" && f.min !== undefined && f.max !== undefined,
    );
    if (rangeFields.length === 0) continue;
    it(`${name}: min ≤ max on every bounded range field`, () => {
      forAnyField(rangeFields, (f) => (f.min ?? 0) <= (f.max ?? 0));
    });
  }
});

// ── CS-FC8: "boolean" fields have boolean defaultValue ────────────────────
describe('CS-FC8: "boolean" fields always have defaultValue true or false', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const boolFields = schema.filter((f) => f.type === "boolean");
    if (boolFields.length === 0) continue;
    it(`${name}: every boolean field defaultValue is strictly boolean`, () => {
      forAnyField(boolFields, (f) => f.defaultValue === true || f.defaultValue === false);
    });
  }
});

// ── CS-FC9: "range" step is positive when defined ─────────────────────────
describe('CS-FC9: "range" fields with step defined always have step > 0', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const steppedRangeFields = schema.filter((f) => f.type === "range" && f.step !== undefined);
    if (steppedRangeFields.length === 0) continue;
    it(`${name}: step > 0 on every stepped range field`, () => {
      forAnyField(steppedRangeFields, (f) => (f.step ?? 0) > 0);
    });
  }
});

// ── CS-FC10: "select" defaultValue is a member of options ─────────────────
describe('CS-FC10: "select" field defaultValue is always in options[*].value', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const selectFields = schema.filter((f) => f.type === "select");
    if (selectFields.length === 0) continue;
    it(`${name}: defaultValue always present in options`, () => {
      forAnyField(selectFields, (f) => {
        const values = (f.options ?? []).map((o) => o.value);
        return values.includes(String(f.defaultValue));
      });
    });
  }
});

// ── CS-FC11: "boolean" fields have no options/min/max ─────────────────────
describe('CS-FC11: "boolean" fields have options === undefined and no min/max', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const boolFields = schema.filter((f) => f.type === "boolean");
    if (boolFields.length === 0) continue;
    it(`${name}: boolean fields are free of options, min, max`, () => {
      forAnyField(
        boolFields,
        (f) => f.options === undefined && f.min === undefined && f.max === undefined,
      );
    });
  }
});

// ── CS-FC12: only "select" fields carry an options array ──────────────────
describe("CS-FC12: non-select fields always have options === undefined", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const nonSelectFields = schema.filter((f) => f.type !== "select");
    if (nonSelectFields.length === 0) continue;
    it(`${name}: no options on non-select fields`, () => {
      forAnyField(nonSelectFields, (f) => f.options === undefined);
    });
  }
});

// ── CS-FC13: tab values are from the allowed set when present ─────────────
const VALID_TABS = new Set(["display", "feeds", "alerts", "calendar", "advanced"]);
describe("CS-FC13: field tab (when defined) is always a valid tab name", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const tabbedFields = schema.filter((f) => f.tab !== undefined);
    if (tabbedFields.length === 0) continue;
    it(`${name}: every tab value is in {display|feeds|alerts|calendar|advanced}`, () => {
      forAnyField(tabbedFields, (f) => VALID_TABS.has(f.tab as string));
    });
  }
});

// ── CS-FC14: range/number fields have a numeric defaultValue ─────────────
describe('CS-FC14: "range"/"number" fields always have a numeric defaultValue', () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const numericFields = schema.filter((f) => f.type === "range" || f.type === "number");
    if (numericFields.length === 0) continue;
    it(`${name}: defaultValue is a finite number`, () => {
      forAnyField(
        numericFields,
        (f) => typeof f.defaultValue === "number" && Number.isFinite(f.defaultValue),
      );
    });
  }
});

// ── CS-FC15: all keys across all schemas are globally unique ──────────────
describe("CS-FC15: all field keys across all 12 schemas are globally unique", () => {
  it("no key appears in more than one card schema", () => {
    const allKeys: string[] = [];
    for (const schema of Object.values(ALL_SCHEMAS)) {
      allKeys.push(...schema.map((f) => f.key));
    }
    const uniqueKeys = new Set(allKeys);
    expect(uniqueKeys.size).toBe(allKeys.length);
  });
});

// ── CS-FC16: groupOpenByDefault requires group to be set ──────────────────
describe("CS-FC16: fields with groupOpenByDefault always have a group name", () => {
  for (const [name, schema] of Object.entries(ALL_SCHEMAS)) {
    const openByDefaultFields = schema.filter((f) => f.groupOpenByDefault === true);
    if (openByDefaultFields.length === 0) continue;
    it(`${name}: groupOpenByDefault fields always have group defined`, () => {
      forAnyField(openByDefaultFields, (f) => typeof f.group === "string" && f.group.length > 0);
    });
  }
});
