/**
 * fast-check property tests — src/core/i18n.ts (Sprint 480)
 *
 * Properties under test:
 *  I18N1. t() always returns a non-empty string for every known key in both languages.
 *  I18N2. formatTemplate is idempotent when no placeholders exist.
 *  I18N3. t() with params replaces all {key} placeholders — no leftover braces.
 *  I18N4. getInterfaceDirection returns "rtl" for "he" and "ltr" for "en".
 *  I18N5. getLocalizedCardTitle returns titleHe for "he" and titleEn for "en".
 *  I18N6. getLocalizedCardTitle with includeIcon=true prepends icon.
 *  I18N7. t() with unknown params yields no leftover {param} in output.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";

// Mock loadConfig to control interfaceLanguage
vi.mock("@/core/config", () => ({
  loadConfig: () => ({ interfaceLanguage: "he" }),
}));

import { t, getInterfaceDirection, getLocalizedCardTitle } from "@/core/i18n";
import type { InterfaceLanguage } from "@/core/constants";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const langArb = fc.constantFrom<InterfaceLanguage>("he", "en");

const templateKeysWithoutParams = [
  "dashboardTitle",
  "pwaInstall",
  "refreshing",
  "offlineBanner",
  "save",
  "close",
  "exportSettings",
  "importSettings",
  "shareLink",
  "resetAll",
  "resetLayout",
  "quoteCopied",
  "alertsEnabled",
  "alertsDisabled",
  "offlineToast",
  "onlineRefreshing",
  "goodNoon",
  "goodNight",
  "helpTitle",
  "cardSizeLabel",
  "marketClosed",
  "languageHebrew",
  "languageEnglish",
] as const;

const keysWithoutParamsArb = fc.constantFrom(...templateKeysWithoutParams);

const cardItemArb = fc.record({
  titleHe: fc.string({ minLength: 1, maxLength: 30 }),
  titleEn: fc.string({ minLength: 1, maxLength: 30 }),
  icon: fc.option(fc.string({ minLength: 1, maxLength: 3 }), { nil: undefined }),
});

// ── I18N1: t() returns non-empty for known keys ─────────────────────────────

describe("i18n — I18N1: t() returns non-empty string for keys without params", () => {
  it("any known key in any language yields non-empty string", () => {
    fc.assert(
      fc.property(keysWithoutParamsArb, langArb, (key, lang) => {
        const result = t(key, undefined, lang);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ── I18N2: t() without params is idempotent ──────────────────────────────────

describe("i18n — I18N2: t() without params produces stable output", () => {
  it("calling t() twice with same args yields identical result", () => {
    fc.assert(
      fc.property(keysWithoutParamsArb, langArb, (key, lang) => {
        const first = t(key, undefined, lang);
        const second = t(key, undefined, lang);
        expect(first).toBe(second);
      }),
      { numRuns: 50 },
    );
  });
});

// ── I18N3: t() with params replaces placeholders ────────────────────────────

describe("i18n — I18N3: t() replaces all placeholders", () => {
  it("birthdayInDays with name+days has no leftover {}", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 365 }),
        langArb,
        (name, days, lang) => {
          const result = t("birthdayInDays", { name, days }, lang);
          expect(result).not.toContain("{name}");
          expect(result).not.toContain("{days}");
          expect(result).toContain(name);
          expect(result).toContain(String(days));
        },
      ),
      { numRuns: 60 },
    );
  });

  it("countdownInDays with label+days replaces all", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 999 }),
        langArb,
        (label, days, lang) => {
          const result = t("countdownInDays", { label, days }, lang);
          expect(result).not.toContain("{label}");
          expect(result).not.toContain("{days}");
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── I18N4: getInterfaceDirection ─────────────────────────────────────────────

describe("i18n — I18N4: getInterfaceDirection", () => {
  it("he → rtl, en → ltr", () => {
    fc.assert(
      fc.property(langArb, (lang) => {
        const dir = getInterfaceDirection(lang);
        if (lang === "he") expect(dir).toBe("rtl");
        else expect(dir).toBe("ltr");
      }),
      { numRuns: 20 },
    );
  });
});

// ── I18N5: getLocalizedCardTitle picks correct language ──────────────────────

describe("i18n — I18N5: getLocalizedCardTitle picks correct language field", () => {
  it("returns titleEn for en and titleHe for he", () => {
    fc.assert(
      fc.property(cardItemArb, langArb, (item, lang) => {
        const result = getLocalizedCardTitle(item, lang, false);
        if (lang === "en") expect(result).toBe(item.titleEn);
        else expect(result).toBe(item.titleHe);
      }),
      { numRuns: 80 },
    );
  });
});

// ── I18N6: getLocalizedCardTitle with icon ───────────────────────────────────

describe("i18n — I18N6: getLocalizedCardTitle with includeIcon prepends icon", () => {
  it("when icon exists and includeIcon=true, result starts with icon", () => {
    fc.assert(
      fc.property(
        cardItemArb.filter((item) => item.icon !== undefined),
        langArb,
        (item, lang) => {
          const result = getLocalizedCardTitle(item, lang, true);
          expect(result).toContain(item.icon!);
          expect(result.startsWith(item.icon!)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("when icon is undefined, includeIcon=true does not prepend", () => {
    fc.assert(
      fc.property(
        cardItemArb.filter((item) => item.icon === undefined),
        langArb,
        (item, lang) => {
          const withIcon = getLocalizedCardTitle(item, lang, true);
          const without = getLocalizedCardTitle(item, lang, false);
          expect(withIcon).toBe(without);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── I18N7: t() with extra params produces no leftover braces ─────────────────

describe("i18n — I18N7: t() with extra params no leftover braces", () => {
  it("passing unrelated params does not inject leftover {}", () => {
    fc.assert(
      fc.property(
        keysWithoutParamsArb,
        langArb,
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^\w+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 10 }),
          { minKeys: 1, maxKeys: 3 },
        ),
        (key, lang, params) => {
          const result = t(key, params, lang);
          // Should not have leftover {placeholder} patterns
          expect(result).not.toMatch(/\{[a-zA-Z_]\w*\}/);
        },
      ),
      { numRuns: 50 },
    );
  });
});
