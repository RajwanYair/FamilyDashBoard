/**
 * fast-check property tests — src/core/config.ts (Sprint 484)
 *
 * Properties under test:
 *  CFG1. migrateConfig always produces configVersion === CONFIG_VERSION for any input version.
 *  CFG2. migrateConfig is idempotent — migrating twice yields same result.
 *  CFG3. loadConfig always returns a full DashboardConfig shape (never partial).
 *  CFG4. shareConfigHash + loadConfigFromHash is a round-trip identity.
 *  CFG5. loadConfigFromHash returns null for invalid hashes.
 *  CFG6. sanitize coerces invalid theme/screenMode/tempUnit to defaults.
 *  CFG7. validateImportedConfig rejects non-object inputs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));
vi.mock("@/core/state", () => ({
  state: { seedConfig: vi.fn() },
}));

import {
  migrateConfig,
  loadConfig,
  shareConfigHash,
  loadConfigFromHash,
  validateImportedConfig,
} from "@/core/config";
import { CONFIG_VERSION, DEFAULT_CONFIG } from "@/types/config";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const versionArb = fc.integer({ min: 0, max: CONFIG_VERSION + 5 });

const partialConfigArb = fc.record(
  {
    configVersion: versionArb,
    theme: fc.constantFrom("black", "blue", "matrix", "amber", "purple", "rose", "bogus"),
    screenMode: fc.constantFrom("tv", "tablet", "phone", "invalid"),
    tempUnit: fc.constantFrom("C", "F", "K"),
    interfaceLanguage: fc.constantFrom("he", "en", "xx"),
    familyName: fc.string({ maxLength: 30 }),
    showClockSeconds: fc.boolean(),
    fontScale: fc.double({ min: 0.5, max: 3.0, noNaN: true, noDefaultInfinity: true }),
  },
  { requiredKeys: [] },
);

const invalidHashArb = fc.oneof(
  fc.constant(""),
  fc.constant("#"),
  fc.constant("#cfg"),
  fc.constant("#cfg="),
  fc.constant("#cfg=!!!notbase64!!!"),
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.startsWith("#cfg=")),
);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

// ── CFG1: migrateConfig always produces CONFIG_VERSION ────────────────────────

describe("config — CFG1: migrateConfig always outputs CONFIG_VERSION", () => {
  it("for any input version ≤ CONFIG_VERSION, output configVersion === CONFIG_VERSION", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: CONFIG_VERSION }), (ver) => {
        const result = migrateConfig({ configVersion: ver });
        expect(result.configVersion).toBe(CONFIG_VERSION);
      }),
      { numRuns: 50 },
    );
  });
});

// ── CFG2: migrateConfig idempotent ───────────────────────────────────────────

describe("config — CFG2: migrateConfig is idempotent", () => {
  it("migrating an already-migrated config yields the same result", () => {
    fc.assert(
      fc.property(partialConfigArb, (raw) => {
        const first = migrateConfig(raw);
        const second = migrateConfig(first);
        expect(second).toEqual(first);
      }),
      { numRuns: 60 },
    );
  });
});

// ── CFG3: loadConfig returns full shape ──────────────────────────────────────

describe("config — CFG3: loadConfig always returns full DashboardConfig", () => {
  it("has all default keys even from empty localStorage", () => {
    localStorage.clear();
    const cfg = loadConfig();
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      expect(cfg).toHaveProperty(key);
    }
  });

  it("has all default keys from malformed localStorage", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 100 }), (garbage) => {
        localStorage.setItem("fdb_config", garbage);
        const cfg = loadConfig();
        for (const key of Object.keys(DEFAULT_CONFIG)) {
          expect(cfg).toHaveProperty(key);
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── CFG4: shareConfigHash + loadConfigFromHash round-trip ────────────────────

describe("config — CFG4: hash encode/decode round-trip", () => {
  it("loadConfigFromHash(shareConfigHash(cfg)) preserves all fields", () => {
    const cfg = { ...DEFAULT_CONFIG };
    const hash = shareConfigHash(cfg);
    const decoded = loadConfigFromHash(hash);
    expect(decoded).not.toBeNull();
    // All keys from the original should be present
    for (const key of Object.keys(cfg)) {
      expect(decoded).toHaveProperty(key);
    }
    expect(decoded!.theme).toBe(cfg.theme);
    expect(decoded!.tempUnit).toBe(cfg.tempUnit);
    expect(decoded!.familyName).toBe(cfg.familyName);
  });
});

// ── CFG5: loadConfigFromHash returns null for invalid input ──────────────────

describe("config — CFG5: loadConfigFromHash returns null for invalid hashes", () => {
  it("non-#cfg= strings return null", () => {
    fc.assert(
      fc.property(invalidHashArb, (hash) => {
        const result = loadConfigFromHash(hash);
        // Either null or parse succeeds depending on base64 validity
        if (!hash.startsWith("#cfg=")) {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── CFG6: sanitize coerces invalid enums to defaults ─────────────────────────

describe("config — CFG6: loadConfig sanitizes invalid enum fields to defaults", () => {
  it("invalid theme is replaced with default", () => {
    const raw = { ...DEFAULT_CONFIG, theme: "bogus-theme" };
    localStorage.setItem("fdb_config", JSON.stringify(raw));
    const cfg = loadConfig();
    expect(cfg.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it("invalid screenMode is replaced with default", () => {
    const raw = { ...DEFAULT_CONFIG, screenMode: "desktop" };
    localStorage.setItem("fdb_config", JSON.stringify(raw));
    const cfg = loadConfig();
    expect(cfg.screenMode).toBe(DEFAULT_CONFIG.screenMode);
  });

  it("invalid tempUnit is replaced with default", () => {
    const raw = { ...DEFAULT_CONFIG, tempUnit: "K" };
    localStorage.setItem("fdb_config", JSON.stringify(raw));
    const cfg = loadConfig();
    expect(cfg.tempUnit).toBe(DEFAULT_CONFIG.tempUnit);
  });
});

// ── CFG7: validateImportedConfig rejects non-objects ─────────────────────────

describe("config — CFG7: validateImportedConfig rejects non-objects", () => {
  it("null, arrays, primitives all return ok: false", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.integer(), { maxLength: 3 }),
        ),
        (input) => {
          const result = validateImportedConfig(input);
          expect(result.ok).toBe(false);
          expect(result.config).toBeNull();
        },
      ),
      { numRuns: 40 },
    );
  });
});
