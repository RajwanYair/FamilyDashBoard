/**
 * Property-based tests for config-panel collectForm.
 *
 * Uses fast-check to fuzz arbitrary form input values and verify
 * that collectForm never throws and always produces a valid config object.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { setupConfigPanelTestDOM } from "../helpers/config-panel-dom";

type CfgMod = {
  initConfigPanel: () => void;
};

async function freshCfg(): Promise<CfgMod> {
  return import("@/ui/config-panel") as Promise<CfgMod>;
}

describe("Config Panel — property: collectForm never throws", () => {
  beforeEach(() => {
    localStorage.clear();
    setupConfigPanelTestDOM();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("arbitrary string values in all text inputs produce valid config", async () => {
    const mod = await freshCfg();
    mod.initConfigPanel();

    fc.assert(
      fc.property(
        fc.record({
          familyName: fc.string(),
          members: fc.string(),
          alertZone: fc.string(),
          bgUrl: fc.string(),
          dimStart: fc.string(),
          dimEnd: fc.string(),
          newsFont: fc.string(),
          homeCity: fc.string(),
        }),
        (vals) => {
          const set = (id: string, val: string) => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
            if (el) el.value = val;
          };
          set("cfg-family-name", vals.familyName);
          set("cfg-members", vals.members);
          set("cfg-alert-zone", vals.alertZone);
          set("cfg-bg-url", vals.bgUrl);
          set("cfg-dim-start", vals.dimStart);
          set("cfg-dim-end", vals.dimEnd);
          set("cfg-news-fontsize", vals.newsFont);
          set("cfg-home-city", vals.homeCity);

          const btn = document.getElementById("cfg-save-btn");
          expect(() => btn?.click()).not.toThrow();

          const raw = localStorage.getItem("dash_v2_config");
          if (raw) {
            const cfg = JSON.parse(raw) as Record<string, unknown>;
            expect(typeof cfg).toBe("object");
            expect(cfg).toHaveProperty("theme");
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("arbitrary numeric values for range inputs stay within bounds", async () => {
    const mod = await freshCfg();
    mod.initConfigPanel();

    fc.assert(
      fc.property(
        fc.record({
          dimLevel: fc.integer({ min: -100, max: 200 }),
          fontScale: fc.integer({ min: -50, max: 300 }),
          tickerSpeed: fc.integer({ min: -10, max: 50 }),
          tasksResetHour: fc.integer({ min: -5, max: 30 }),
          motivationInterval: fc.integer({ min: 0, max: 600 }),
          newsMaxItems: fc.integer({ min: -5, max: 100 }),
        }),
        (vals) => {
          const set = (id: string, val: number) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            if (el) el.value = String(val);
          };
          set("cfg-dim-level", vals.dimLevel);
          set("cfg-font-scale", vals.fontScale);
          set("cfg-ticker-speed", vals.tickerSpeed);
          set("cfg-tasks-reset-hour", vals.tasksResetHour);
          set("cfg-motivation-interval", vals.motivationInterval);
          set("cfg-news-max-items", vals.newsMaxItems);

          const btn = document.getElementById("cfg-save-btn");
          expect(() => btn?.click()).not.toThrow();

          const raw = localStorage.getItem("dash_v2_config");
          if (raw) {
            const cfg = JSON.parse(raw) as Record<string, unknown>;
            // nightDimLevel must be clamped [10, 95]
            if (typeof cfg["nightDimLevel"] === "number") {
              expect(cfg["nightDimLevel"]).toBeGreaterThanOrEqual(10);
              expect(cfg["nightDimLevel"]).toBeLessThanOrEqual(95);
            }
            // fontScale must be clamped [0.7, 1.5]
            if (typeof cfg["fontScale"] === "number") {
              expect(cfg["fontScale"]).toBeGreaterThanOrEqual(0.7);
              expect(cfg["fontScale"]).toBeLessThanOrEqual(1.5);
            }
            // tickerSpeed must be clamped [1, 5]
            if (typeof cfg["tickerSpeed"] === "number") {
              expect(cfg["tickerSpeed"]).toBeGreaterThanOrEqual(1);
              expect(cfg["tickerSpeed"]).toBeLessThanOrEqual(5);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("arbitrary select values never crash collectForm", async () => {
    const mod = await freshCfg();
    mod.initConfigPanel();

    fc.assert(
      fc.property(
        fc.record({
          theme: fc.oneof(
            fc.constant("black"),
            fc.constant("blue"),
            fc.constant("matrix"),
            fc.constant("amber"),
            fc.constant("purple"),
            fc.constant("rose"),
            fc.string(), // garbage value
          ),
          screenMode: fc.oneof(
            fc.constant("tv"),
            fc.constant("tablet"),
            fc.constant("mobile"),
            fc.string(),
          ),
          tempUnit: fc.oneof(fc.constant("C"), fc.constant("F"), fc.string()),
          interfaceLanguage: fc.oneof(fc.constant("he"), fc.constant("en"), fc.string()),
        }),
        (vals) => {
          const set = (id: string, val: string) => {
            const el = document.getElementById(id) as HTMLSelectElement | null;
            if (el && el.options) {
              // Add option if not present
              const exists = Array.from(el.options).some((o) => o.value === val);
              if (!exists) {
                const opt = document.createElement("option");
                opt.value = val;
                el.appendChild(opt);
              }
              el.value = val;
            }
          };
          set("theme-select", vals.theme);
          set("screen-mode-select", vals.screenMode);
          set("cfg-temp-unit", vals.tempUnit);
          set("cfg-interface-language", vals.interfaceLanguage);

          const btn = document.getElementById("cfg-save-btn");
          expect(() => btn?.click()).not.toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});
