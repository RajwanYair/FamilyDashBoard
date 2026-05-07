/**
 * fast-check property tests for src/core/i18n.ts 
 *
 * Verifies invariants of `t()` and `getLocalizedCardTitle()` over a wide
 * input space. These functions are pure (given a language argument) so
 * they are ideal property-test targets.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { t, getLocalizedCardTitle, getInterfaceDirection } from "@/core/i18n";

describe("i18n — fast-check properties (IP1-IP5 )", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("IP1: t() returns a non-empty string for every key in both languages", () => {
    const keys = [
      "dashboardTitle",
      "save",
      "close",
      "marketOpen",
      "goodMorning",
      "themeBlack",
      "languageEnglish",
    ] as const;
    fc.assert(
      fc.property(fc.constantFrom(...keys), fc.constantFrom("he", "en"), (key, lang) => {
        const out = t(key, undefined, lang as "he" | "en");
        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
      }),
      { numRuns: 60 },
    );
  });

  it("IP2: t() with placeholder params substitutes every {key} occurrence", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.constantFrom("he", "en"),
        (count, lang) => {
          const out = t("settingsImported", { count }, lang as "he" | "en");
          expect(out).toContain(String(count));
          // After substitution there should be no literal `{count}` left.
          expect(out.includes("{count}")).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("IP3: t() leaves no unresolved {placeholder} when params are absent", () => {
    // For keys that DO contain placeholders, missing params should resolve to ""
    // (formatTemplate replaces with empty string for undefined values). For keys
    // without placeholders the output must equal the template verbatim.
    fc.assert(
      fc.property(fc.constantFrom("save", "close", "themeMatrix"), (key) => {
        const heOut = t(key as "save", undefined, "he");
        const enOut = t(key as "save", undefined, "en");
        expect(heOut).not.toMatch(/\{\w+\}/);
        expect(enOut).not.toMatch(/\{\w+\}/);
      }),
      { numRuns: 30 },
    );
  });

  it("IP4: getLocalizedCardTitle returns titleEn for en, titleHe for he, with optional icon prefix", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.option(fc.string({ minLength: 1, maxLength: 4 }), { nil: undefined }),
        fc.boolean(),
        fc.constantFrom("he", "en"),
        (titleHe, titleEn, icon, includeIcon, lang) => {
          const item = icon === undefined ? { titleHe, titleEn } : { titleHe, titleEn, icon };
          const expectedTitle = lang === "en" ? titleEn : titleHe;
          const out = getLocalizedCardTitle(item, lang as "he" | "en", includeIcon);
          if (includeIcon && icon) {
            expect(out).toBe(`${icon} ${expectedTitle}`);
          } else {
            expect(out).toBe(expectedTitle);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("IP5: getInterfaceDirection is 'ltr' iff language is 'en'", () => {
    fc.assert(
      fc.property(fc.constantFrom("he", "en"), (lang) => {
        const dir = getInterfaceDirection(lang as "he" | "en");
        expect(dir).toBe(lang === "en" ? "ltr" : "rtl");
      }),
      { numRuns: 20 },
    );
  });
});
