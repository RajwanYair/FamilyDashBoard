/**
 * fast-check property tests — src/ui/card-settings-dialog.ts
 *
 * Properties under test:
 *  CSD1. openCardSettings(id) never throws for any string when card is absent.
 *  CSD2. initCardSettingsButtons() is safe to call N times.
 *  CSD3. The singleton dialog is created at most once across repeated opens.
 *  CSD4. openCardSettings with any card id string always resolves (no unhandled rejection).
 *  CSD5. initCardSettingsButtons() never throws when the DOM is empty.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/card-registry", () => ({
  loadCard: vi.fn().mockResolvedValue(undefined),
  getCard: vi.fn().mockReturnValue(null),
}));
vi.mock("@/core/config", () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/ui/config-auto-render", () => ({
  renderConfigFields: vi.fn().mockReturnValue(document.createDocumentFragment()),
  readConfigValues: vi.fn().mockReturnValue({}),
}));
vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/core/i18n", () => ({ t: (k: string) => k }));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

afterEach(() => {
  document.body.innerHTML = "";
  vi.resetModules();
});

// ── CSD1: openCardSettings safe with unknown card ─────────────────────────────

describe("card-settings-dialog — CSD1: openCardSettings() safe for any card id", () => {
  it("resolves without throwing for any string card id when card is missing", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 30 }), async (cardId) => {
        vi.resetModules();
        document.body.innerHTML = "";
        const { openCardSettings } = await import("@/ui/card-settings-dialog");
        await expect(openCardSettings(cardId)).resolves.toBeUndefined();
      }),
      { numRuns: 8 },
    );
  });
});

// ── CSD2: initCardSettingsButtons safe to call N times ───────────────────────

describe("card-settings-dialog — CSD2: initCardSettingsButtons() is idempotent", () => {
  it("N successive calls never throw", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        vi.resetModules();
        document.body.innerHTML = "";
        const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
        for (let i = 0; i < n; i++) {
          await expect(initCardSettingsButtons()).resolves.toBeUndefined();
        }
      }),
      { numRuns: 8 },
    );
  });
});

// ── CSD3: singleton dialog created at most once ───────────────────────────────

describe("card-settings-dialog — CSD3: singleton dialog is created once", () => {
  it("repeated openCardSettings calls do not add duplicate #card-settings-dialog elements", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 4 }), async (calls) => {
        vi.resetModules();
        document.body.innerHTML = "";
        const { openCardSettings } = await import("@/ui/card-settings-dialog");
        for (let i = 0; i < calls; i++) {
          await openCardSettings("test-card");
        }
        const count = document.querySelectorAll("#card-settings-dialog").length;
        expect(count).toBeLessThanOrEqual(1);
      }),
      { numRuns: 6 },
    );
  });
});

// ── CSD4: openCardSettings always resolves ────────────────────────────────────

describe("card-settings-dialog — CSD4: openCardSettings always resolves", () => {
  it("never rejects for alphanumeric card ids", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/), async (cardId) => {
        vi.resetModules();
        document.body.innerHTML = "";
        const { openCardSettings } = await import("@/ui/card-settings-dialog");
        await expect(openCardSettings(cardId)).resolves.not.toThrow();
      }),
      { numRuns: 8 },
    );
  });
});

// ── CSD5: initCardSettingsButtons safe with empty DOM ────────────────────────

describe("card-settings-dialog — CSD5: initCardSettingsButtons() safe with empty DOM", () => {
  it("does not throw when no card elements are present", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        document.body.innerHTML = "";
        const { initCardSettingsButtons } = await import("@/ui/card-settings-dialog");
        await expect(initCardSettingsButtons()).resolves.toBeUndefined();
      }),
      { numRuns: 5 },
    );
  });
});
