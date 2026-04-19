/**
 * Sprint 168 — configSchema completeness tests for all cards.
 * Validates shape, unique keys, required fields, and type correctness.
 */

import { describe, it, expect } from "vitest";
import { newsConfigSchema } from "@/cards/news/news";
import { stocksConfigSchema } from "@/cards/stocks/stocks";
import { currencyConfigSchema } from "@/cards/currency/currency";
import { alertsConfigSchema } from "@/cards/alerts/alerts";
import { calendarConfigSchema } from "@/cards/calendar/calendar";
import { hebrewCalConfigSchema } from "@/cards/hebrew-cal/hebrew-cal";
import type { CardConfigField } from "@/types/card";

const VALID_TYPES = ["text", "number", "boolean", "select", "textarea", "url", "date", "range"];

function validateSchema(name: string, schema: CardConfigField[]): void {
  describe(`${name} configSchema`, () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
    });

    it("all fields have unique keys", () => {
      const keys = schema.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("all fields have required properties", () => {
      for (const f of schema) {
        expect(f.key).toBeTruthy();
        expect(f.labelHe).toBeTruthy();
        expect(f.labelEn).toBeTruthy();
        expect(VALID_TYPES).toContain(f.type);
        expect(f.defaultValue !== undefined).toBe(true);
      }
    });

    it("range fields have min/max", () => {
      for (const f of schema.filter((s) => s.type === "range")) {
        expect(f.min).toBeDefined();
        expect(f.max).toBeDefined();
        expect(typeof f.min).toBe("number");
        expect(typeof f.max).toBe("number");
      }
    });

    it("select fields have options", () => {
      for (const f of schema.filter((s) => s.type === "select")) {
        expect(Array.isArray(f.options)).toBe(true);
        expect(f.options!.length).toBeGreaterThan(0);
        for (const opt of f.options!) {
          expect(opt.value).toBeTruthy();
          expect(opt.label).toBeTruthy();
        }
      }
    });
  });
}

describe("Card configSchema completeness (Sprint 168)", () => {
  validateSchema("news", newsConfigSchema);
  validateSchema("stocks", stocksConfigSchema);
  validateSchema("currency", currencyConfigSchema);
  validateSchema("alerts", alertsConfigSchema);
  validateSchema("calendar", calendarConfigSchema);
  validateSchema("hebrew-cal", hebrewCalConfigSchema);
});
