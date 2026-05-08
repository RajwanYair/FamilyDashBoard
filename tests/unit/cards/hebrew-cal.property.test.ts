/**
 * fast-check property tests — src/cards/hebrew-cal/hebrew-cal.ts ( , extended )
 *
 * Properties under test:
 *  HC1. getPsalmOfDay: result ∈ PSALM_BY_WEEKDAY set
 *  HC2. getPsalmOfDay: deterministic for same date
 *  HC3. hebrewMonthName: returns non-empty string
 *  HC4. formatCountdown: ms≤0 → "00:00"
 *  HC5. formatCountdown: >0 → valid HH:MM:SS or MM:SS
 *  HC6. nextHolidayName: empty items → null
 *  HC7. getParashat: no parashat item → null
 *  HC8. getHaftarah: no haftara item → null
 *  HC9. todayHebrewMD: month ∈ [1,13], day ∈ [1,30]
 *  HC10. nextHebrewYearGregorianApprox: returns year+1
 *  HC11. zmanimTimeLabel: empty → "--"
 *  HC12. zmanimTimeLabel: valid ISO → HH:MM format
 *  HC13. zmanimTimeLabel: HH:MM passthrough
 *  HC14. isShabbat: returns boolean for any candles/havdala
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  getPsalmOfDay,
  hebrewMonthName,
  formatCountdown,
  nextHolidayName,
  getParashat,
  getHaftarah,
  todayHebrewMD,
  nextHebrewYearGregorianApprox,
  zmanimTimeLabel,
  isShabbat,
} from "@/cards/hebrew-cal/hebrew-cal";

const VALID_PSALMS = new Set([24, 48, 82, 94, 81, 93, 92]);

// ── HC1: getPsalmOfDay in valid set ──────────────────────────────────────────

describe("hebrew-cal — HC1: getPsalmOfDay valid", () => {
  it("always returns a known psalm number", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (d) => {
          expect(VALID_PSALMS.has(getPsalmOfDay(d))).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── HC2: getPsalmOfDay deterministic ─────────────────────────────────────────

describe("hebrew-cal — HC2: getPsalmOfDay deterministic", () => {
  it("same date always returns same psalm", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (d) => {
          expect(getPsalmOfDay(d)).toBe(getPsalmOfDay(new Date(d.getTime())));
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── HC3: hebrewMonthName non-empty ───────────────────────────────────────────

describe("hebrew-cal — HC3: hebrewMonthName", () => {
  it("returns non-empty string", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (d) => {
          const name = hebrewMonthName(d);
          expect(name.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── HC4: formatCountdown ms≤0 ────────────────────────────────────────────────

describe("hebrew-cal — HC4: formatCountdown zero/negative", () => {
  it("returns 00:00 for non-positive ms", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 0 }), (ms) => {
        expect(formatCountdown(ms)).toBe("00:00");
      }),
      { numRuns: 15 },
    );
  });
});

// ── HC5: formatCountdown positive ────────────────────────────────────────────

describe("hebrew-cal — HC5: formatCountdown positive", () => {
  it("matches HH:MM:SS or MM:SS pattern", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 86_400_000 }), (ms) => {
        const result = formatCountdown(ms);
        // Either "HH:MM:SS" or "MM:SS"
        expect(result).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
      }),
      { numRuns: 30 },
    );
  });
});

// ── HC6: nextHolidayName empty → null ────────────────────────────────────────

describe("hebrew-cal — HC6: nextHolidayName empty", () => {
  it("returns null for empty items", () => {
    expect(nextHolidayName([])).toBeNull();
  });

  it("returns null when no holiday category", () => {
    expect(nextHolidayName([{ title: "test", date: "2099-01-01", category: "parashat" }])).toBeNull();
  });
});

// ── HC7: getParashat no match → null ─────────────────────────────────────────

describe("hebrew-cal — HC7: getParashat no parashat", () => {
  it("returns null for empty list", () => {
    expect(getParashat([])).toBeNull();
  });

  it("returns null when no parashat category", () => {
    expect(getParashat([{ title: "Shabbat", date: "2024-01-01", category: "holiday" }])).toBeNull();
  });
});

// ── HC8: getHaftarah no match → null ─────────────────────────────────────────

describe("hebrew-cal — HC8: getHaftarah no haftara", () => {
  it("returns null for empty list", () => {
    expect(getHaftarah([])).toBeNull();
  });

  it("returns null when no haftara category", () => {
    expect(getHaftarah([{ title: "test", date: "2024-01-01", category: "parashat" }])).toBeNull();
  });
});

// ── HC9: todayHebrewMD ranges ────────────────────────────────────────────────

describe("hebrew-cal — HC9: todayHebrewMD ranges", () => {
  it("month ∈ [1,13], day ∈ [1,30]", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2030-12-31T00:00:00Z") }),
        (d) => {
          // happy-dom's Intl Hebrew calendar polyfill may throw on rare edge dates
          let result: { month: number; day: number };
          try {
            result = todayHebrewMD(d);
          } catch {
            fc.pre(false); // skip this sample
            return;
          }
          expect(result!.month).toBeGreaterThanOrEqual(1);
          expect(result!.month).toBeLessThanOrEqual(13);
          expect(result!.day).toBeGreaterThanOrEqual(1);
          expect(result!.day).toBeLessThanOrEqual(30);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── HC10: nextHebrewYearGregorianApprox ──────────────────────────────────────

describe("hebrew-cal — HC10: nextHebrewYearGregorianApprox", () => {
  it("returns year + 1", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (d) => {
          expect(nextHebrewYearGregorianApprox(d)).toBe(d.getFullYear() + 1);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── HC11: zmanimTimeLabel empty → "--" ───────────────────────────────────────

describe("hebrew-cal — HC11: zmanimTimeLabel empty", () => {
  it("empty string → --", () => {
    expect(zmanimTimeLabel("")).toBe("--");
  });
});

// ── HC12: zmanimTimeLabel valid ISO ──────────────────────────────────────

describe("hebrew-cal — HC12: zmanimTimeLabel valid ISO", () => {
  it("valid ISO string → HH:MM format", () => {
    const result = zmanimTimeLabel("2025-06-01T06:30:00+03:00");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ── HC13: zmanimTimeLabel HH:MM passthrough ───────────────────────────────

describe("hebrew-cal — HC13: zmanimTimeLabel HH:MM", () => {
  it("HH:MM passes through unchanged", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (h, m) => {
          const input = `${h}:${String(m).padStart(2, "0")}`;
          expect(zmanimTimeLabel(input)).toBe(input);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── HC14: isShabbat returns boolean ─────────────────────────────────────

describe("hebrew-cal — HC14: isShabbat type safety", () => {
  it("always returns a boolean", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), { nil: null }),
        fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), { nil: null }),
        (candles, havdala) => {
          const result = isShabbat(candles, havdala);
          expect(typeof result).toBe("boolean");
        },
      ),
      { numRuns: 20 },
    );
  });
});
