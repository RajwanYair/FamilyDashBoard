/**
 * fast-check property tests — src/cards/weather/weather.ts ( , extended )
 *
 * Properties under test:
 *  WX1. parseCityEntry: valid "name|lat|lon" → CityEntry
 *  WX2. parseCityEntry: fewer than 3 parts → null
 *  WX3. aqiLabel: returns correct tier for any integer
 *  WX4. compassGustArc: produces a valid SVG path starting with "M"
 *  WX5. getSkyCategory: any code ∈ [0..99] → non-empty label + cls
 *  WX6. deg2arrow: any degree → one of 8 arrow chars
 *  WX7. deg2hebrewDir: any degree → one of 8 direction strings
 *  WX8. humidityLabel: any 0–100 → one of 4 labels
 *  WX9. precipSummaryLabel: any 0–100 → non-empty Hebrew string
 *  WX10. formatCloudCover: any 0–100 → includes percentage
 *  WX11. moonPhase: always returns [emoji, non-empty label]
 *  WX12. getMoonPhaseSummary: crossLinkTarget is "hebrew-cal"
 *  WX13. computeGoldenHour: valid ISO → HH:MM format
 *  WX14. computeGoldenHour: invalid ISO → "--:--"
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseCityEntry,
  aqiLabel,
  compassGustArc,
  getSkyCategory,
  deg2arrow,
  deg2hebrewDir,
  humidityLabel,
  precipSummaryLabel,
  formatCloudCover,
  moonPhase,
  getMoonPhaseSummary,
  computeGoldenHour,
} from "@/cards/weather/weather";

// ── WX1: parseCityEntry valid ────────────────────────────────────────────────

describe("weather — WX1: parseCityEntry valid", () => {
  it("parses 'name|lat|lon' correctly", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("|")),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (name, lat, lon) => {
          const raw = `${name}|${lat}|${lon}`;
          const result = parseCityEntry(raw);
          expect(result).not.toBeNull();
          expect(result!.name).toBe(name);
          expect(result!.lat).toBeCloseTo(lat, 5);
          expect(result!.lon).toBeCloseTo(lon, 5);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── WX2: parseCityEntry invalid ──────────────────────────────────────────────

describe("weather — WX2: parseCityEntry invalid", () => {
  it("fewer than 3 pipe-separated parts → null", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter((s) => s.split("|").length < 3),
        (raw) => {
          expect(parseCityEntry(raw)).toBeNull();
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── WX3: aqiLabel tiers ──────────────────────────────────────────────────────

describe("weather — WX3: aqiLabel tiers", () => {
  it("≤20 → aqi-good", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (aqi) => {
        expect(aqiLabel(aqi).cls).toBe("aqi-good");
      }),
      { numRuns: 15 },
    );
  });

  it("21–40 → aqi-fair", () => {
    fc.assert(
      fc.property(fc.integer({ min: 21, max: 40 }), (aqi) => {
        expect(aqiLabel(aqi).cls).toBe("aqi-fair");
      }),
      { numRuns: 15 },
    );
  });

  it(">100 → aqi-extreme", () => {
    fc.assert(
      fc.property(fc.integer({ min: 101, max: 500 }), (aqi) => {
        expect(aqiLabel(aqi).cls).toBe("aqi-extreme");
      }),
      { numRuns: 15 },
    );
  });
});

// ── WX4: compassGustArc → valid SVG path ────────────────────────────────────

describe("weather — WX4: compassGustArc SVG path", () => {
  it("starts with 'M' and contains 'A'", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 360, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 359, noNaN: true, noDefaultInfinity: true }),
        (start, sweep) => {
          const path = compassGustArc(start, sweep);
          expect(path).toMatch(/^M /);
          expect(path).toContain(" A ");
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── WX5: getSkyCategory ──────────────────────────────────────────────────────

describe("weather — WX5: getSkyCategory", () => {
  it("any code 0–99 → non-empty label and cls", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), (code) => {
        const { label, cls } = getSkyCategory(code);
        expect(label.length).toBeGreaterThan(0);
        expect(cls).toMatch(/^sky-/);
      }),
      { numRuns: 30 },
    );
  });
});

// ── WX6: deg2arrow ───────────────────────────────────────────────────────────

describe("weather — WX6: deg2arrow", () => {
  const validArrows = new Set(["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"]);
  it("any degree → valid arrow", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 359 }), (deg) => {
        expect(validArrows.has(deg2arrow(deg))).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ── WX7: deg2hebrewDir ───────────────────────────────────────────────────────

describe("weather — WX7: deg2hebrewDir", () => {
  const validDirs = new Set(["ד׳", "ד׳-מ׳", "מ׳", "צ׳-מ׳", "צ׳", "צ׳-מ׳ב׳", "מ׳ב׳", "ד׳-מ׳ב׳"]);
  it("any degree → valid direction", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 359 }), (deg) => {
        expect(validDirs.has(deg2hebrewDir(deg))).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ── WX8: humidityLabel ───────────────────────────────────────────────────────

describe("weather — WX8: humidityLabel", () => {
  const validLabels = new Set(["יבש", "נוח", "לח", "מאוד לח"]);
  it("any 0–100 → valid label", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (rh) => {
        expect(validLabels.has(humidityLabel(rh))).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ── WX9: precipSummaryLabel ──────────────────────────────────────────────────

describe("weather — WX9: precipSummaryLabel", () => {
  it("any 0–100 → non-empty string", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (pp) => {
        expect(precipSummaryLabel(pp).length).toBeGreaterThan(0);
      }),
      { numRuns: 30 },
    );
  });
});

// ── WX10: formatCloudCover ───────────────────────────────────────────────────

describe("weather — WX10: formatCloudCover", () => {
  it("any 0–100 → includes percentage", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (cc) => {
        const result = formatCloudCover(cc);
        expect(result).toContain(`${cc}%`);
      }),
      { numRuns: 30 },
    );
  });
});

// ── WX11: moonPhase returns [emoji, label] ──────────────────────────────────

describe("weather — WX11: moonPhase tuple", () => {
  it("always returns [emoji, non-empty label]", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1) }),
        (d) => {
          const [emoji, label] = moonPhase(d);
          expect(emoji.length).toBeGreaterThan(0);
          expect(label.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── WX12: getMoonPhaseSummary crossLinkTarget ────────────────────────────

describe("weather — WX12: getMoonPhaseSummary target", () => {
  it("crossLinkTarget is always hebrew-cal", () => {
    const result = getMoonPhaseSummary(new Date(2025, 3, 10));
    expect(result.crossLinkTarget).toBe("hebrew-cal");
    expect(result.emoji.length).toBeGreaterThan(0);
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ── WX13: computeGoldenHour valid ISO ───────────────────────────────────

describe("weather — WX13: computeGoldenHour valid", () => {
  it("valid ISO strings → HH:MM format", () => {
    const result = computeGoldenHour("2025-06-01T05:43", "2025-06-01T19:52");
    expect(result.morningEnd).toMatch(/^\d{2}:\d{2}$/);
    expect(result.eveningStart).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ── WX14: computeGoldenHour invalid ISO ──────────────────────────────────

describe("weather — WX14: computeGoldenHour invalid", () => {
  it("invalid strings → --:--", () => {
    const result = computeGoldenHour("not-a-date", "also-bad");
    expect(result.morningEnd).toBe("--:--");
    expect(result.eveningStart).toBe("--:--");
  });
});
