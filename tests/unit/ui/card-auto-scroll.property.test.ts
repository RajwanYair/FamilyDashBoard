/**
 * fast-check property tests — src/ui/card-auto-scroll.ts
 *
 * Properties under test:
 *  CAS1. findScrollBody: returns null for empty elements
 *  CAS2. findScrollBody: skips children with "card-header" class
 *  CAS3. findScrollBody: returns first non-header child
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { findScrollBody } from "@/ui/card-auto-scroll";

// ── CAS1: findScrollBody returns null for empty parent ───────────────────────

describe("card-auto-scroll — CAS1: findScrollBody empty", () => {
  it("returns null when card has no children", () => {
    const card = document.createElement("section");
    expect(findScrollBody(card)).toBeNull();
  });
});

// ── CAS2: findScrollBody skips card-header ───────────────────────────────────

describe("card-auto-scroll — CAS2: findScrollBody skips header", () => {
  it("returns null when only child is card-header", () => {
    const card = document.createElement("section");
    const header = document.createElement("div");
    header.classList.add("card-header");
    card.appendChild(header);
    expect(findScrollBody(card)).toBeNull();
  });
});

// ── CAS3: findScrollBody returns first non-header child ──────────────────────

describe("card-auto-scroll — CAS3: findScrollBody first non-header", () => {
  it("returns the first non-header child element", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 5 }),
        (headerCount, bodyCount) => {
          const card = document.createElement("section");
          for (let i = 0; i < headerCount; i++) {
            const h = document.createElement("div");
            h.classList.add("card-header");
            card.appendChild(h);
          }
          const firstBody = document.createElement("div");
          firstBody.id = "expected-body";
          card.appendChild(firstBody);
          for (let i = 1; i < bodyCount; i++) {
            card.appendChild(document.createElement("div"));
          }
          const result = findScrollBody(card);
          expect(result).toBe(firstBody);
        },
      ),
      { numRuns: 15 },
    );
  });
});
