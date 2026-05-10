/**
 * fast-check property tests — worker/src/utils/ecb-adapter.ts
 *
 * Properties under test:
 *  ECB1. Valid XML with ILS → returns non-null with ILS=1.0.
 *  ECB2. EUR cross-rate is 1/ILS_per_EUR.
 *  ECB3. Other currencies: X_per_ILS = X_per_EUR / ILS_per_EUR.
 *  ECB4. Missing ILS → returns null.
 *  ECB5. Malformed XML (no Cube elements) → returns null.
 *  ECB6. Zero/negative rates are skipped.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseEcbXml } from "../../../worker/src/utils/ecb-adapter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEcbXml(entries: Array<{ currency: string; rate: number }>): string {
  const cubes = entries.map((e) => `<Cube currency="${e.currency}" rate="${e.rate}"/>`).join("\n");
  return `<Cube time="2026-01-01">\n${cubes}\n</Cube>`;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const currencyCodeArb = fc.stringMatching(/^[A-Z]{3}$/).filter((c) => c !== "ILS" && c !== "EUR");
const positiveRate = fc.double({ min: 0.01, max: 999, noNaN: true });

// ── ECB1: Valid XML with ILS → ILS=1.0 in output ────────────────────────────

describe("ecb-adapter — ECB1: valid XML returns ILS=1", () => {
  it("ILS is always 1.0", () => {
    fc.assert(
      fc.property(positiveRate, (ilsRate) => {
        const xml = buildEcbXml([
          { currency: "ILS", rate: ilsRate },
          { currency: "USD", rate: 1.1 },
        ]);
        const result = parseEcbXml(xml);
        expect(result).not.toBeNull();
        expect(result!.rates["ILS"]).toBe(1.0);
      }),
      { numRuns: 20 },
    );
  });
});

// ── ECB2: EUR cross-rate is 1/ILS_per_EUR ────────────────────────────────────

describe("ecb-adapter — ECB2: EUR = 1/ILS_per_EUR", () => {
  it("EUR rate is reciprocal of ILS/EUR", () => {
    fc.assert(
      fc.property(positiveRate, (ilsRate) => {
        const xml = buildEcbXml([{ currency: "ILS", rate: ilsRate }]);
        const result = parseEcbXml(xml);
        expect(result).not.toBeNull();
        expect(result!.rates["EUR"]).toBeCloseTo(1 / ilsRate, 8);
      }),
      { numRuns: 20 },
    );
  });
});

// ── ECB3: Cross-rate formula ─────────────────────────────────────────────────

describe("ecb-adapter — ECB3: X_per_ILS = X_per_EUR / ILS_per_EUR", () => {
  it("computed correctly for any currency", () => {
    fc.assert(
      fc.property(positiveRate, positiveRate, currencyCodeArb, (ilsRate, xRate, code) => {
        const xml = buildEcbXml([
          { currency: "ILS", rate: ilsRate },
          { currency: code, rate: xRate },
        ]);
        const result = parseEcbXml(xml);
        expect(result).not.toBeNull();
        expect(result!.rates[code]).toBeCloseTo(xRate / ilsRate, 8);
      }),
      { numRuns: 30 },
    );
  });
});

// ── ECB4: Missing ILS → null ─────────────────────────────────────────────────

describe("ecb-adapter — ECB4: missing ILS returns null", () => {
  it("null when ILS is absent", () => {
    const xml = buildEcbXml([
      { currency: "USD", rate: 1.1 },
      { currency: "EUR", rate: 1.0 },
    ]);
    expect(parseEcbXml(xml)).toBeNull();
  });
});

// ── ECB5: Malformed XML → null ───────────────────────────────────────────────

describe("ecb-adapter — ECB5: malformed XML returns null", () => {
  it("garbage string returns null", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("currency")),
        (junk) => {
          expect(parseEcbXml(junk)).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── ECB6: Zero/negative rates skipped ────────────────────────────────────────

describe("ecb-adapter — ECB6: zero/negative rates ignored", () => {
  it("rate <= 0 currencies excluded from output", () => {
    fc.assert(
      fc.property(
        positiveRate,
        fc.double({ min: -100, max: 0, noNaN: true }),
        currencyCodeArb,
        (ilsRate, badRate, code) => {
          const xml = buildEcbXml([
            { currency: "ILS", rate: ilsRate },
            { currency: code, rate: badRate },
          ]);
          const result = parseEcbXml(xml);
          expect(result).not.toBeNull();
          // The bad-rate currency should not appear (or if rate=0, it's skipped)
          expect(result!.rates[code]).toBeUndefined();
        },
      ),
      { numRuns: 20 },
    );
  });
});
