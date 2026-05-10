/**
 * Card pure-function fast-check property tests
 *
 * Property-based tests for deterministic pure helpers across card modules.
 * Uses fast-check arbitraries to exercise invariants over large input spaces.
 *
 * Functions under test:
 *   CP1  ageFreshness(pubDate)      — news.ts   — always returns one of 4 bucket strings
 *   CP2  recurrenceResetKey(…)     — tasks.ts  — same date always yields same key (idempotent)
 *   CP3  portfolioChange(quotes)   — stocks.ts — result is a finite number or null
 *   CP4  fmtPrice(price, sym)      — stocks.ts — never returns empty string for finite prices
 *   CP5  advanceAnnualDate(str)    — countdown — always returns a date strictly after today
 *   CP6  priceInRange52w(…)        — stocks.ts — result is always in [0, 1]
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// ── Mocks required by module-level side effects ───────────────────────────
vi.mock("@/core/config", () => ({ loadConfig: vi.fn(() => ({})) }));
vi.mock("@/core/constants", () => ({
  MS_PER_DAY: 86_400_000,
  INTERVALS: {},
  STOCK_SYMBOLS: [],
  STOCK_META: {},
  API: {},
  LS_STOCK_ALERTS: "stk-alerts",
  LS_PORTFOLIO: "stk-portfolio",
  WORKER_BASE_URL: "https://worker.test",
  isWorkerEnabled: () => false,
  LS_PREFIX: "dash_v2_",
  LS_MAX_AGE: 7 * 86_400_000,
  MS_PER_MIN: 60_000,
  PROXIES: [],
}));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn(() => null),
  cGetStale: vi.fn(() => null),
  cSet: vi.fn(),
  cSetAsync: vi.fn(),
}));
vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
  syncBurst: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock("@/core/fetch", () => ({
  fetchJSONWithWorker: vi.fn(),
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
vi.mock("@/core/auto-loop-scroll", () => ({
  initAutoLoopScroll: vi.fn(),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/idle", () => ({ isPageVisible: vi.fn(() => true) }));
vi.mock("@/core/idb-store", () => ({
  idbGet: vi.fn(() => null),
  idbSet: vi.fn(),
  idbDelete: vi.fn(),
}));
vi.mock("@/cards/currency/currency", () => ({
  getLastCurrencyRates: vi.fn(() => null),
}));
vi.mock("@/core/signals", () => ({ signal: vi.fn() }));
vi.mock("@/cards/stocks/stocks.css", () => ({}));
vi.mock("@/cards/news/news.css", () => ({}));
vi.mock("@/cards/tasks/tasks.css", () => ({}));
vi.mock("@/cards/countdown/countdown.css", () => ({}));

import { ageFreshness } from "@/cards/news/news";
import { recurrenceResetKey } from "@/cards/tasks/tasks";
import { portfolioChange, fmtPrice, priceInRange52w } from "@/cards/stocks/stocks";
import { advanceAnnualDate } from "@/cards/countdown/countdown";

// ── CP1: ageFreshness always returns one of 4 buckets ─────────────────────
describe("CP1: ageFreshness(pubDate) — always returns a valid bucket", () => {
  const VALID_BUCKETS = new Set(["fresh2m", "fresh1h", "fresh1d", "old"]);

  it("arbitrary ISO date strings always map to one of the 4 freshness buckets", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }), (d) => {
        fc.pre(isFinite(d.getTime())); // skip NaN dates
        const result = ageFreshness(d.toISOString());
        return VALID_BUCKETS.has(result);
      }),
      { numRuns: 100 },
    );
  });

  it("very old date always returns 'old'", () => {
    expect(ageFreshness("2000-01-01T00:00:00Z")).toBe("old");
  });

  it("empty string (invalid date) returns 'old'", () => {
    expect(ageFreshness("")).toBe("old");
  });
});

// ── CP2: recurrenceResetKey — same date always yields same key ─────────────
describe("CP2: recurrenceResetKey — idempotent for same date", () => {
  const RECURRENCES = ["daily", "weekly", "monthly", "yearly"] as const;

  it("same date + same recurrence always produces the same key (no randomness)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RECURRENCES),
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (recurrence, date) => {
          fc.pre(isFinite(date.getTime())); // skip NaN dates
          const key1 = recurrenceResetKey(recurrence, date);
          const key2 = recurrenceResetKey(recurrence, date);
          return key1 === key2;
        },
      ),
      { numRuns: 80 },
    );
  });

  it("always returns a non-empty string for any recurrence", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RECURRENCES),
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (recurrence, date) => {
          fc.pre(isFinite(date.getTime())); // skip NaN dates
          const key = recurrenceResetKey(recurrence, date);
          return typeof key === "string" && key.length > 0;
        },
      ),
      { numRuns: 80 },
    );
  });

  it("yearly key is always a 4-digit year string", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }), (date) => {
        fc.pre(isFinite(date.getTime())); // skip NaN dates
        const key = recurrenceResetKey("yearly", date);
        return /^\d{4}$/.test(key);
      }),
      { numRuns: 60 },
    );
  });
});

// ── CP3: portfolioChange — always finite or null ───────────────────────────
describe("CP3: portfolioChange(quotes) — always finite number or null", () => {
  it("result is always null or a finite number", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            prev: fc.float({ min: 0, max: 1e6, noNaN: true }),
            cur: fc.float({ min: 0, max: 1e6, noNaN: true }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (quotes) => {
          const result = portfolioChange(quotes);
          return result === null || (typeof result === "number" && isFinite(result));
        },
      ),
      { numRuns: 80 },
    );
  });

  it("returns null for empty array", () => {
    expect(portfolioChange([])).toBeNull();
  });

  it("returns null when all prev prices are zero", () => {
    const result = portfolioChange([
      { prev: 0, cur: 100 },
      { prev: 0, cur: 200 },
    ]);
    expect(result).toBeNull();
  });
});

// ── CP4: fmtPrice — never returns empty string for finite prices ───────────
describe("CP4: fmtPrice(price, sym) — always returns non-empty string", () => {
  it("any finite positive price always produces a non-empty string", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1e6, noNaN: true }),
        fc.string({ minLength: 1, maxLength: 6 }),
        (price, sym) => {
          const result = fmtPrice(price, sym);
          return typeof result === "string" && result.length > 0;
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── CP5: advanceAnnualDate — always returns a date strictly after today ────
describe("CP5: advanceAnnualDate(dateStr) — result is always in the future", () => {
  it("any YYYY-MM-DD past or present is advanced to a strictly future date", () => {
    const today = Date.now();
    fc.assert(
      fc.property(
        // Past dates only (we want to test the "needs advancing" case)
        fc.date({ min: new Date("2000-01-01"), max: new Date() }),
        (d) => {
          fc.pre(isFinite(d.getTime())); // skip NaN dates
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const dateStr = `${y}-${m}-${day}`;
          const result = advanceAnnualDate(dateStr);
          const resultMs = new Date(result).getTime();
          return resultMs > today;
        },
      ),
      { numRuns: 60 },
    );
  });

  it("a future date is returned unchanged (already in the future)", () => {
    const result = advanceAnnualDate("2099-06-15");
    expect(result).toBe("2099-06-15");
  });

  it("invalid date string does not throw (returns a string)", () => {
    // 'not-a-date' splits to 3 parts but parseInt('not',10)=NaN → year becomes NaN
    // The function returns a string (does not throw)
    expect(typeof advanceAnnualDate("not-a-date")).toBe("string");
  });
});

// ── CP6: priceInRange52w — result always in [0, 1] ────────────────────────
describe("CP6: priceInRange52w(price, low52, high52) — always in [0, 1]", () => {
  it("result is always clamped to [0, 1] or null for any numeric inputs", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        (price, a, b) => {
          const low52 = Math.min(a, b);
          const high52 = Math.max(a, b) + 0.01; // ensure high > low
          const result = priceInRange52w(price, low52, high52);
          return result === null || (result >= 0 && result <= 1);
        },
      ),
      { numRuns: 80 },
    );
  });
});
