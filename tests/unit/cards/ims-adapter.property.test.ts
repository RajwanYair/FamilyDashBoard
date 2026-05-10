/**
 * fast-check property tests — src/cards/weather/ims-adapter.ts
 *
 * Properties under test:
 *  IMS1. haversineKm: same point → 0
 *  IMS2. haversineKm: always ≥ 0 (non-negative)
 *  IMS3. haversineKm: symmetric (d(A,B) ≈ d(B,A))
 *  IMS4. imsToWmoCode: always returns one of the defined codes
 *  IMS5. imsToWmoCode: rain > 10 → 65
 *  IMS6. msToKmh: integer result (always rounded)
 *  IMS7. findNearestStation: empty array → null
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  haversineKm,
  imsToWmoCode,
  msToKmh,
  findNearestStation,
} from "@/cards/weather/ims-adapter";

// ── IMS1: same point → 0 ────────────────────────────────────────────────────

describe("ims-adapter — IMS1: haversineKm same point", () => {
  it("distance from any point to itself is 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (lat, lon) => {
          expect(haversineKm(lat, lon, lat, lon)).toBe(0);
        },
      ),
    );
  });
});

// ── IMS2: non-negative ───────────────────────────────────────────────────────

describe("ims-adapter — IMS2: haversineKm non-negative", () => {
  it("distance is always ≥ 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (lat1, lon1, lat2, lon2) => {
          expect(haversineKm(lat1, lon1, lat2, lon2)).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

// ── IMS3: symmetric ──────────────────────────────────────────────────────────

describe("ims-adapter — IMS3: haversineKm symmetric", () => {
  it("d(A,B) ≈ d(B,A)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (lat1, lon1, lat2, lon2) => {
          const ab = haversineKm(lat1, lon1, lat2, lon2);
          const ba = haversineKm(lat2, lon2, lat1, lon1);
          expect(Math.abs(ab - ba)).toBeLessThan(1e-9);
        },
      ),
    );
  });
});

// ── IMS4: imsToWmoCode valid code ────────────────────────────────────────────

describe("ims-adapter — IMS4: imsToWmoCode valid code", () => {
  const VALID_CODES = [1, 2, 3, 45, 51, 61, 65];

  it("always returns one of the defined WMO codes", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (rain, humidity) => {
          expect(VALID_CODES).toContain(imsToWmoCode(rain, humidity));
        },
      ),
    );
  });
});

// ── IMS5: rain > 10 → 65 ────────────────────────────────────────────────────

describe("ims-adapter — IMS5: imsToWmoCode heavy rain", () => {
  it("rain > 10 always produces code 65", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10.01, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (rain, humidity) => {
          expect(imsToWmoCode(rain, humidity)).toBe(65);
        },
      ),
    );
  });
});

// ── IMS6: msToKmh integer result ─────────────────────────────────────────────

describe("ims-adapter — IMS6: msToKmh integer", () => {
  it("result is always an integer", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), (ms) => {
        const result = msToKmh(ms);
        expect(Number.isInteger(result)).toBe(true);
      }),
    );
  });
});

// ── IMS7: findNearestStation empty → null ────────────────────────────────────

describe("ims-adapter — IMS7: findNearestStation empty array", () => {
  it("empty stations array returns null", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (lat, lon) => {
          expect(findNearestStation([], lat, lon)).toBeNull();
        },
      ),
    );
  });
});
