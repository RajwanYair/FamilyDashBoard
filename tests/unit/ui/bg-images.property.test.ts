/**
 * fast-check property tests — src/ui/bg-images.ts
 *
 * Properties under test:
 *  BG1. isValidBgUrl: valid https URL → true
 *  BG2. isValidBgUrl: http URL → false
 *  BG3. isValidBgUrl: empty/invalid string → false
 *  BG4. isValidBgUrl: data: URL → false
 *  BG5. isValidBgUrl: ftp URL → false
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isValidBgUrl } from "@/ui/bg-images";

// ── BG1: valid https → true ──────────────────────────────────────────────────

describe("bg-images — BG1: https URL is valid", () => {
  it("any well-formed https URL returns true", () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ["https"] }), (url) => {
        expect(isValidBgUrl(url)).toBe(true);
      }),
    );
  });
});

// ── BG2: http → false ────────────────────────────────────────────────────────

describe("bg-images — BG2: http URL is invalid", () => {
  it("http URLs are rejected", () => {
    fc.assert(
      fc.property(fc.webUrl({ validSchemes: ["http"] }), (url) => {
        expect(isValidBgUrl(url)).toBe(false);
      }),
    );
  });
});

// ── BG3: random non-URL string → false ───────────────────────────────────────

describe("bg-images — BG3: non-URL string", () => {
  it("arbitrary non-URL strings return false", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter((s) => {
          try {
            new URL(s);
            return false;
          } catch {
            return true;
          }
        }),
        (str) => {
          expect(isValidBgUrl(str)).toBe(false);
        },
      ),
    );
  });
});

// ── BG4: data: URL → false ───────────────────────────────────────────────────

describe("bg-images — BG4: data URL is invalid", () => {
  it("data: URLs are rejected", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 4, maxLength: 20 }), (payload) => {
        expect(isValidBgUrl(`data:text/plain;base64,${payload}`)).toBe(false);
      }),
    );
  });
});

// ── BG5: ftp URL → false ─────────────────────────────────────────────────────

describe("bg-images — BG5: ftp URL is invalid", () => {
  it("ftp: URLs are rejected", () => {
    fc.assert(
      fc.property(fc.domain(), (domain) => {
        expect(isValidBgUrl(`ftp://${domain}/file.jpg`)).toBe(false);
      }),
    );
  });
});
