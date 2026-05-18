/**
 * fast-check property tests — src/ui/config-panel.ts
 *
 * CP1. buildConfigAccordion with 0 fields never throws and leaves container empty
 * CP2. buildConfigAccordion creates one .cfg-row per ungrouped field
 * CP3. buildConfigAccordion creates one <details> per distinct group
 * CP4. isConfigPanelOpen returns false when overlay element is absent
 * CP5. toggleConfigPanel is a safe no-op when overlay is absent
 * CP6. switchCfgTab never throws for any tab string (with or without .cfg-section/.cfg-tab nodes)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  buildConfigAccordion,
  isConfigPanelOpen,
  toggleConfigPanel,
  switchCfgTab,
} from "@/ui/config-panel";
import type { CardConfigField } from "@/types/card";

// ── Helpers ───────────────────────────────────────────────────────────────────

function textField(key: string, group?: string): CardConfigField {
  return {
    key,
    labelHe: `שדה ${key}`,
    labelEn: `Field ${key}`,
    type: "text" as const,
    defaultValue: "",
    ...(group !== undefined ? { group } : {}),
  };
}

const safeKey = fc.stringMatching(/^[a-z][a-z0-9]{2,7}$/);
const safeGroup = fc.stringMatching(/^[A-Z][a-z]{2,8}$/);

// ── CP1 ───────────────────────────────────────────────────────────────────────

describe("config-panel — CP1: buildConfigAccordion with 0 fields is safe", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("never throws and leaves container empty", () => {
    const container = document.createElement("div");
    expect(() => buildConfigAccordion([], container)).not.toThrow();
    expect(container.childElementCount).toBe(0);
  });
});

// ── CP2 ───────────────────────────────────────────────────────────────────────

describe("config-panel — CP2: ungrouped fields produce one .cfg-row each", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates exactly N .cfg-row elements for N ungrouped fields", () => {
    fc.assert(
      fc.property(fc.array(safeKey, { minLength: 1, maxLength: 8 }), (keys) => {
        const container = document.createElement("div");
        const fields = keys.map((k) => textField(k));
        buildConfigAccordion(fields, container);
        const rows = container.querySelectorAll(".cfg-row");
        expect(rows.length).toBe(keys.length);
      }),
      { numRuns: 5 },
    );
  });
});

// ── CP3 ───────────────────────────────────────────────────────────────────────

describe("config-panel — CP3: grouped fields create one <details> per distinct group", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates exactly one <details> per unique group name", () => {
    fc.assert(
      // Generate N unique group names, then one field per group — guarantees coverage
      fc.property(fc.array(safeGroup, { minLength: 1, maxLength: 4 }), (rawGroups) => {
        const groups = [...new Set(rawGroups)];
        const container = document.createElement("div");
        // One field per group ensures all groups appear at least once
        const fields = groups.map((g, i) => textField(`key${i}`, g));
        buildConfigAccordion(fields, container);
        const details = container.querySelectorAll("details");
        expect(details.length).toBe(groups.length);
      }),
      { numRuns: 5 },
    );
  });
});

// ── CP4 ───────────────────────────────────────────────────────────────────────

describe("config-panel — CP4: isConfigPanelOpen returns false without overlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false when #config-overlay does not exist", () => {
    // Ensure no overlay in DOM
    document.getElementById("config-overlay")?.remove();
    expect(isConfigPanelOpen()).toBe(false);
  });

  it("returns false for any DOM state without overlay", () => {
    fc.assert(
      fc.property(fc.boolean(), (_hasBody) => {
        document.getElementById("config-overlay")?.remove();
        expect(isConfigPanelOpen()).toBe(false);
      }),
      { numRuns: 3 },
    );
  });
});

// ── CP5 ───────────────────────────────────────────────────────────────────────

describe("config-panel — CP5: toggleConfigPanel is safe without overlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when overlay is absent", () => {
    document.getElementById("config-overlay")?.remove();
    expect(() => toggleConfigPanel()).not.toThrow();
  });
});

// ── CP6 ───────────────────────────────────────────────────────────────────────

describe("config-panel — CP6: switchCfgTab never throws for any tab string", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is safe with no .cfg-section or .cfg-tab nodes present", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (tab) => {
        expect(() => switchCfgTab(tab)).not.toThrow();
      }),
      { numRuns: 5 },
    );
  });

  it("activates matching .cfg-section when present", () => {
    const section = document.createElement("div");
    section.className = "cfg-section";
    section.dataset["tab"] = "general";
    document.body.appendChild(section);

    switchCfgTab("general");
    expect(section.classList.contains("active")).toBe(true);

    switchCfgTab("cards");
    expect(section.classList.contains("active")).toBe(false);

    document.body.innerHTML = "";
  });
});
