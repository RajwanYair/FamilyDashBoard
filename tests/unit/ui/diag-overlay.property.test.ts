/**
 * fast-check property tests — src/ui/diag-overlay.ts
 *
 * Properties under test:
 *  DO1. providerStatusIcon: always returns a non-empty string for any input
 *  DO2. providerStatusIcon: "ok" → 🟢, "degraded" → 🟡, anything else → 🔴
 *  DO3. isDiagOverlayOpen: initially false
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { providerStatusIcon, isDiagOverlayOpen } from "@/ui/diag-overlay";

// ── DO1: providerStatusIcon returns non-empty for any string ─────────────────

describe("diag-overlay — DO1: providerStatusIcon returns non-empty", () => {
  it("always returns a non-empty string", () => {
    fc.assert(
      fc.property(fc.string(), (status) => {
        const icon = providerStatusIcon(status);
        expect(icon.length).toBeGreaterThan(0);
      }),
      { numRuns: 30 },
    );
  });
});

// ── DO2: providerStatusIcon known mappings ───────────────────────────────────

describe("diag-overlay — DO2: providerStatusIcon known values", () => {
  it('"ok" maps to green circle', () => {
    expect(providerStatusIcon("ok")).toBe("🟢");
  });

  it('"degraded" maps to yellow circle', () => {
    expect(providerStatusIcon("degraded")).toBe("🟡");
  });

  it("any other value maps to red circle", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== "ok" && s !== "degraded"),
        (status) => {
          expect(providerStatusIcon(status)).toBe("🔴");
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── DO3: isDiagOverlayOpen initially false ───────────────────────────────────

describe("diag-overlay — DO3: isDiagOverlayOpen initial", () => {
  it("returns false when overlay has not been opened", () => {
    expect(isDiagOverlayOpen()).toBe(false);
  });
});
