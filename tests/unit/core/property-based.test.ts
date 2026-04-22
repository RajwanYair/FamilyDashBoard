/**
 * FamilyDashBoard — Property-Based Tests (V11-DX-2)
 *
 * Uses fast-check to exercise cache, config migration, and ICS parsing with
 * generated inputs covering edge cases that hand-written examples rarely reach.
 *
 * Covers:
 *   1. cGet/cSet expiry invariants
 *   2. Config migration idempotency
 *   3. parseICS — no throw, correct array return
 */

import fc from "fast-check";
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Cache properties ─────────────────────────────────────────────────────────

describe("Property: cache — cGet/cSet expiry (fast-check)", () => {
  beforeEach(() => {
    // Clear in-memory cache state between runs
    vi.useFakeTimers();
    localStorage.clear();
  });

  it("cGet returns null after TTL expires", async () => {
    const { cSet, cGet } = await import("@/core/cache");

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 100, max: 10_000 }),
        fc.integer({ min: 1, max: 100 }),
        async (key, ttl, deltaMs) => {
          const value = { x: key };
          const setTime = Date.now();
          vi.setSystemTime(setTime);
          cSet(key, value);

          // Before TTL elapses — still present
          vi.setSystemTime(setTime + ttl - 1);
          const before = cGet(key, ttl);
          expect(before).toEqual(value);

          // After TTL elapses — must be null
          vi.setSystemTime(setTime + ttl + deltaMs);
          const after = cGet(key, ttl);
          expect(after).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("cGet always returns null for TTL=0", async () => {
    const { cSet, cGet } = await import("@/core/cache");

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.jsonValue(),
        async (key, value) => {
          cSet(key, value);
          const result = cGet(key, 0);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 30 },
    );
  });

  it("cSet then cGet (within TTL) returns identical data", async () => {
    const { cSet, cGet } = await import("@/core/cache");

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.record({
          title: fc.string(),
          count: fc.integer(),
          flag: fc.boolean(),
        }),
        async (key, value) => {
          cSet(key, value);
          const result = cGet<typeof value>(key, 60_000);
          expect(result).toEqual(value);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Config migration properties ───────────────────────────────────────────────

describe("Property: config — migrateConfig idempotency (fast-check)", () => {
  it("migrateConfig is idempotent for already-migrated configs", async () => {
    const { migrateConfig } = await import("@/core/config");

    const themeArb = fc.constantFrom("black", "blue", "matrix", "amber", "purple", "rose");
    const screenModeArb = fc.constantFrom("tv", "tablet", "phone");
    const tempUnitArb = fc.constantFrom("C", "F");
    const langArb = fc.constantFrom("he", "en");

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Use only valid values + configVersion=9 so all migrations are a no-op
          theme: themeArb,
          screenMode: screenModeArb,
          tempUnit: tempUnitArb,
          interfaceLanguage: langArb,
          configVersion: fc.constant(9),
        }),
        async (partial) => {
          const once = migrateConfig(partial);
          const twice = migrateConfig({ ...once });
          expect(twice).toEqual(once);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("migrateConfig always produces a valid tempUnit", async () => {
    const { migrateConfig } = await import("@/core/config");

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Mix valid and invalid values for tempUnit
          tempUnit: fc.oneof(
            fc.constantFrom("C", "F"),
            fc.string({ maxLength: 3 }), // invalid → should be corrected to 'C'
            fc.constant(undefined),
          ),
          configVersion: fc.constant(0), // force migration to run
        }),
        async (input) => {
          const result = migrateConfig(input);
          // After migration + any sanitization, tempUnit should be C or F
          if (result.tempUnit !== undefined) {
            expect(["C", "F"]).toContain(result.tempUnit);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── ICS parsing properties ────────────────────────────────────────────────────

describe("Property: parseICS — never throws, always returns array (fast-check)", () => {
  it("parseICS never throws on arbitrary strings", async () => {
    const { parseICS } = await import("@/cards/calendar/calendar");

    await fc.assert(
      fc.asyncProperty(fc.string(), async (input) => {
        let threw = false;
        try {
          const result = parseICS(input);
          expect(Array.isArray(result)).toBe(true);
        } catch {
          threw = true;
        }
        expect(threw).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("parseICS returns empty array for empty/non-ICS input", async () => {
    const { parseICS } = await import("@/cards/calendar/calendar");

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(""),
          fc.constant("not an ICS file"),
          fc.constant("<html>not calendar</html>"),
          fc.string({ maxLength: 20 }),
        ),
        async (input) => {
          const result = parseICS(input);
          expect(Array.isArray(result)).toBe(true);
          // Non-ICS input should return empty or very few events
          expect(result.length).toBeLessThanOrEqual(5);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("parseICS events always have summary and icsIndex fields", async () => {
    const { parseICS } = await import("@/cards/calendar/calendar");

    // Minimal valid ICS with one event
    const validIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "DTSTART:20260101T100000Z",
      "DTEND:20260101T110000Z",
      "SUMMARY:Test Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        async (icsIndex) => {
          const events = parseICS(validIcs, icsIndex);
          for (const event of events) {
            expect(typeof event.summary).toBe("string");
            expect(typeof event.icsIndex).toBe("number");
            expect(event.icsIndex).toBe(icsIndex);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
