/**
 * fast-check property tests — src/ui/layout-drag.ts
 *
 * Properties under test:
 *  LD1. readCurrentLayout: always returns a 3-tuple of string arrays
 *  LD2. readCurrentLayout: returns empty arrays when no grid columns exist
 *  LD3. resetLayout: does not throw
 *  LD4. readCurrentLayout: card IDs from DOM are returned in each column array
 *  LD5. readCurrentLayout: result never contains empty strings
 */

import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import { readCurrentLayout, resetLayout } from "@/ui/layout-drag";

// ── LD1: readCurrentLayout returns 3-tuple of arrays ─────────────────────────

describe("layout-drag — LD1: readCurrentLayout shape", () => {
  it("returns a tuple of exactly 3 arrays", () => {
    const result = readCurrentLayout();
    expect(result).toHaveLength(3);
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
    expect(Array.isArray(result[2])).toBe(true);
  });
});

// ── LD2: readCurrentLayout empty when no columns ─────────────────────────────

describe("layout-drag — LD2: readCurrentLayout empty DOM", () => {
  it("returns three empty arrays when no grid columns exist", () => {
    const [left, mid, right] = readCurrentLayout();
    expect(left).toEqual([]);
    expect(mid).toEqual([]);
    expect(right).toEqual([]);
  });
});

// ── LD3: resetLayout does not throw ──────────────────────────────────────────

describe("layout-drag — LD3: resetLayout safe", () => {
  it("does not throw when called", () => {
    expect(() => resetLayout()).not.toThrow();
  });
});

// ── LD4: readCurrentLayout returns card IDs present in DOM columns ────────────

describe("layout-drag — LD4: readCurrentLayout reflects DOM card IDs", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the card IDs placed in .grid-col-left", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z-]+$/.test(s)),
          { minLength: 1, maxLength: 5 },
        ),
        (ids) => {
          document.body.innerHTML = "";
          const col = document.createElement("div");
          col.className = "grid-col-left";
          for (const id of ids) {
            const card = document.createElement("div");
            card.dataset["cardId"] = id;
            col.appendChild(card);
          }
          document.body.appendChild(col);

          const [left] = readCurrentLayout();
          expect(left).toEqual(ids);

          document.body.innerHTML = "";
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── LD5: readCurrentLayout never contains empty strings ───────────────────────

describe("layout-drag — LD5: readCurrentLayout omits empty/missing card IDs", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("cards without data-card-id are not included in result", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 8 }),
        (hasIdFlags) => {
          document.body.innerHTML = "";
          const col = document.createElement("div");
          col.className = "grid-col-left";
          for (let i = 0; i < hasIdFlags.length; i++) {
            const card = document.createElement("div");
            if (hasIdFlags[i]) card.dataset["cardId"] = `card-${i}`;
            col.appendChild(card);
          }
          document.body.appendChild(col);

          const [left] = readCurrentLayout();
          // No empty string should appear
          expect(left.every((id) => id.length > 0)).toBe(true);

          document.body.innerHTML = "";
        },
      ),
      { numRuns: 10 },
    );
  });
});
