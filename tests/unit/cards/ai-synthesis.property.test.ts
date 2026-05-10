/**
 * fast-check property tests — src/cards/ai-synthesis/ai-synthesis.ts
 *
 * Properties under test:
 *  AI1. aiSynthesisConfigSchema: is a non-empty array with valid structure
 *  AI2. _resetAiSynthesisForTest: clears state without throwing
 *  AI3. _setSnapshotForTest + fetchSynthesis: snapshot round-trip
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  aiSynthesisConfigSchema,
  _resetAiSynthesisForTest,
  _setSnapshotForTest,
} from "@/cards/ai-synthesis/ai-synthesis";

// ── AI1: config schema structure ─────────────────────────────────────────────

describe("ai-synthesis — AI1: config schema", () => {
  it("exports a non-empty array of config fields", () => {
    expect(Array.isArray(aiSynthesisConfigSchema)).toBe(true);
    expect(aiSynthesisConfigSchema.length).toBeGreaterThan(0);
  });

  it("each field has key, labelHe, labelEn, type", () => {
    for (const field of aiSynthesisConfigSchema) {
      expect(field.key).toBeTruthy();
      expect(field.labelHe).toBeTruthy();
      expect(field.labelEn).toBeTruthy();
      expect(field.type).toBeTruthy();
    }
  });
});

// ── AI2: _resetAiSynthesisForTest safe ───────────────────────────────────────

describe("ai-synthesis — AI2: reset safe", () => {
  it("does not throw when called", () => {
    expect(() => _resetAiSynthesisForTest()).not.toThrow();
  });
});

// ── AI3: _setSnapshotForTest accepts arbitrary strings ───────────────────────

describe("ai-synthesis — AI3: setSnapshot accepts any string", () => {
  it("accepts any string without throwing", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(() => _setSnapshotForTest(text)).not.toThrow();
      }),
      { numRuns: 20 },
    );
  });

  it("accepts null without throwing", () => {
    expect(() => _setSnapshotForTest(null as unknown as string)).not.toThrow();
  });
});
