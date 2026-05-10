/**
 * Tests for src/core/app-signals.ts
 *
 * tempUnit signal, appTheme signal, syncAppSignal bridge function.
 * : motivationInterval signal + bridge case.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  tempUnit,
  appTheme,
  motivationInterval,
  screenMode,
  alertsEnabled,
  syncAppSignal,
} from "@/core/app-signals";

// Reset signals to known defaults before each test.
beforeEach(() => {
  tempUnit.value = "C";
  appTheme.value = "black";
  motivationInterval.value = 0;
  screenMode.value = "tv";
  alertsEnabled.value = true;
});

// ── tempUnit signal ───────────────────────────────────────────────────────────

describe("tempUnit signal", () => {
  it("has default value 'C'", () => {
    expect(tempUnit.value).toBe("C");
  });

  it("can be set to 'F'", () => {
    tempUnit.value = "F";
    expect(tempUnit.value).toBe("F");
  });

  it("can be set back to 'C'", () => {
    tempUnit.value = "F";
    tempUnit.value = "C";
    expect(tempUnit.value).toBe("C");
  });
});

// ── appTheme signal ───────────────────────────────────────────────────────────

describe("appTheme signal", () => {
  it("has default value 'black'", () => {
    expect(appTheme.value).toBe("black");
  });

  it("can be set to 'blue'", () => {
    appTheme.value = "blue";
    expect(appTheme.value).toBe("blue");
  });

  it("can be set to each of the 6 theme values", () => {
    const themes = ["black", "blue", "matrix", "amber", "purple", "rose"] as const;
    for (const t of themes) {
      appTheme.value = t;
      expect(appTheme.value).toBe(t);
    }
  });
});

// ── syncAppSignal ─────────────────────────────────────────────────────────────

describe("syncAppSignal", () => {
  it("updates tempUnit signal when key is 'config.tempUnit' and value is 'F'", () => {
    syncAppSignal("config.tempUnit", "F");
    expect(tempUnit.value).toBe("F");
  });

  it("updates tempUnit signal when key is 'config.tempUnit' and value is 'C'", () => {
    tempUnit.value = "F"; // pre-set
    syncAppSignal("config.tempUnit", "C");
    expect(tempUnit.value).toBe("C");
  });

  it("does NOT update tempUnit for invalid value (only 'C'/'F' accepted)", () => {
    tempUnit.value = "C";
    syncAppSignal("config.tempUnit", "K"); // invalid — not 'C' or 'F'
    expect(tempUnit.value).toBe("C"); // unchanged
  });

  it("updates appTheme signal when key is 'config.theme'", () => {
    syncAppSignal("config.theme", "amber");
    expect(appTheme.value).toBe("amber");
  });

  it("sets appTheme to 'black' when theme value is null/undefined", () => {
    appTheme.value = "rose";
    syncAppSignal("config.theme", null);
    expect(appTheme.value).toBe("black");
  });

  it("updates appTheme to each valid theme name", () => {
    const themes = ["black", "blue", "matrix", "amber", "purple", "rose"] as const;
    for (const t of themes) {
      syncAppSignal("config.theme", t);
      expect(appTheme.value).toBe(t);
    }
  });

  it("ignores unknown keys (default case) without throwing", () => {
    expect(() => syncAppSignal("config.unknown", "anything")).not.toThrow();
    expect(() => syncAppSignal("cache.foo", 42)).not.toThrow();
    expect(() => syncAppSignal("ui.maximized", true)).not.toThrow();
    // signals unchanged
    expect(tempUnit.value).toBe("C");
    expect(appTheme.value).toBe("black");
  });

  it("is callable multiple times without side-effects", () => {
    syncAppSignal("config.tempUnit", "F");
    syncAppSignal("config.tempUnit", "F");
    expect(tempUnit.value).toBe("F");
  });
});

// ── motivationInterval signal ─────────────────────────────────────────────────

describe("motivationInterval signal", () => {
  it("has default value 0", () => {
    expect(motivationInterval.value).toBe(0);
  });

  it("can be set to a positive integer", () => {
    motivationInterval.value = 5;
    expect(motivationInterval.value).toBe(5);
  });

  it("can be set back to 0 (disabled)", () => {
    motivationInterval.value = 3;
    motivationInterval.value = 0;
    expect(motivationInterval.value).toBe(0);
  });
});

// ── syncAppSignal — motivationInterval branch ─────────────────────────────────

describe("syncAppSignal — motivationInterval", () => {
  it("updates motivationInterval when key is 'config.motivationInterval' with a number", () => {
    syncAppSignal("config.motivationInterval", 10);
    expect(motivationInterval.value).toBe(10);
  });

  it("resets motivationInterval to 0 when value is not a number", () => {
    motivationInterval.value = 5;
    syncAppSignal("config.motivationInterval", "not-a-number");
    expect(motivationInterval.value).toBe(0);
  });

  it("resets motivationInterval to 0 when value is null", () => {
    motivationInterval.value = 3;
    syncAppSignal("config.motivationInterval", null);
    expect(motivationInterval.value).toBe(0);
  });

  it("sets motivationInterval to 0 explicitly", () => {
    motivationInterval.value = 7;
    syncAppSignal("config.motivationInterval", 0);
    expect(motivationInterval.value).toBe(0);
  });
});

// ── screenMode signal ─────────────────────────────────────────────────────────

describe("screenMode signal", () => {
  it("has default value 'tv'", () => {
    expect(screenMode.value).toBe("tv");
  });

  it("can be set to 'tablet'", () => {
    screenMode.value = "tablet";
    expect(screenMode.value).toBe("tablet");
  });

  it("can be set to 'phone'", () => {
    screenMode.value = "phone";
    expect(screenMode.value).toBe("phone");
  });
});

// ── alertsEnabled signal ──────────────────────────────────────────────────────

describe("alertsEnabled signal", () => {
  it("has default value true", () => {
    expect(alertsEnabled.value).toBe(true);
  });

  it("can be set to false", () => {
    alertsEnabled.value = false;
    expect(alertsEnabled.value).toBe(false);
  });

  it("can be toggled back to true", () => {
    alertsEnabled.value = false;
    alertsEnabled.value = true;
    expect(alertsEnabled.value).toBe(true);
  });
});

// ── syncAppSignal — screenMode + alertsEnabled branches ─────────────────────

describe("syncAppSignal — screenMode", () => {
  it("updates screenMode when key is 'config.screenMode' and value is 'tablet'", () => {
    syncAppSignal("config.screenMode", "tablet");
    expect(screenMode.value).toBe("tablet");
  });

  it("updates screenMode when value is 'phone'", () => {
    syncAppSignal("config.screenMode", "phone");
    expect(screenMode.value).toBe("phone");
  });

  it("updates screenMode when value is 'tv'", () => {
    screenMode.value = "phone";
    syncAppSignal("config.screenMode", "tv");
    expect(screenMode.value).toBe("tv");
  });

  it("ignores invalid screenMode value (no change)", () => {
    syncAppSignal("config.screenMode", "desktop");
    expect(screenMode.value).toBe("tv"); // unchanged
  });
});

describe("syncAppSignal — alertsEnabled", () => {
  it("sets alertsEnabled to false when value is false", () => {
    syncAppSignal("config.alertsEnabled", false);
    expect(alertsEnabled.value).toBe(false);
  });

  it("sets alertsEnabled to true when value is true", () => {
    alertsEnabled.value = false;
    syncAppSignal("config.alertsEnabled", true);
    expect(alertsEnabled.value).toBe(true);
  });

  it("coerces truthy values to true", () => {
    alertsEnabled.value = false;
    syncAppSignal("config.alertsEnabled", 1);
    expect(alertsEnabled.value).toBe(true);
  });

  it("coerces falsy values to false", () => {
    syncAppSignal("config.alertsEnabled", 0);
    expect(alertsEnabled.value).toBe(false);
  });
});
