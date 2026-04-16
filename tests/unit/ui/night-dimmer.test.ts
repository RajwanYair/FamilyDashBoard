/**
 * Tests for src/ui/night-dimmer.ts
 *
 * Covers: toggleNightDim, setDimLevel, autoDimCheck, initNightDimmer.
 * Uses vi.resetModules() per test to avoid stateful dimActive bleed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type DimmerMod = typeof import("@/ui/night-dimmer");

async function freshDimmer(): Promise<DimmerMod> {
  vi.resetModules();
  return import("@/ui/night-dimmer");
}

describe("Night Dimmer — toggleNightDim", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the overlay on first toggle", async () => {
    const { toggleNightDim } = await freshDimmer();
    toggleNightDim();
    const el = document.getElementById("night-dim");
    expect(el?.style.display).toBe("block");
  });

  it("hides overlay on second toggle", async () => {
    const { toggleNightDim } = await freshDimmer();
    toggleNightDim();
    toggleNightDim();
    const el = document.getElementById("night-dim");
    expect(el?.style.display).toBe("none");
  });

  it("applies default opacity of 0.55 when active", async () => {
    const { toggleNightDim } = await freshDimmer();
    toggleNightDim();
    const el = document.getElementById("night-dim");
    expect(parseFloat(el?.style.opacity ?? "0")).toBeCloseTo(0.55);
  });
});

describe("Night Dimmer — setDimLevel", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("clamps values above 100 to 100", async () => {
    const { toggleNightDim, setDimLevel } = await freshDimmer();
    toggleNightDim(); // activate first
    setDimLevel(150);
    const el = document.getElementById("night-dim");
    expect(parseFloat(el?.style.opacity ?? "0")).toBeCloseTo(1.0);
  });

  it("clamps values below 0 to 0", async () => {
    const { toggleNightDim, setDimLevel } = await freshDimmer();
    toggleNightDim(); // activate
    setDimLevel(-10);
    const el = document.getElementById("night-dim");
    expect(parseFloat(el?.style.opacity ?? "1")).toBeCloseTo(0);
  });

  it("sets correct opacity level", async () => {
    const { toggleNightDim, setDimLevel } = await freshDimmer();
    toggleNightDim(); // activate
    setDimLevel(80);
    const el = document.getElementById("night-dim");
    expect(parseFloat(el?.style.opacity ?? "0")).toBeCloseTo(0.8);
  });
});

describe("Night Dimmer — autoDimCheck", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw with valid hour range", async () => {
    const { autoDimCheck } = await freshDimmer();
    expect(() => autoDimCheck(23, 6)).not.toThrow();
  });

  it("handles overnight range (start > end)", async () => {
    const { autoDimCheck } = await freshDimmer();
    expect(() => autoDimCheck(22, 5)).not.toThrow();
  });

  it("handles same-day range (start < end)", async () => {
    const { autoDimCheck } = await freshDimmer();
    expect(() => autoDimCheck(8, 18)).not.toThrow();
  });
});

describe("Night Dimmer — autoDimCheck functional", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("activates dim when current hour is inside midnight range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T23:30:00"));
    const { autoDimCheck } = await freshDimmer();
    autoDimCheck(23, 6); // midnight range
    const el = document.getElementById("night-dim");
    expect(el?.style.display).toBe("block");
    vi.useRealTimers();
  });

  it("deactivates dim when current hour is outside midnight range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T14:00:00"));
    const { autoDimCheck, toggleNightDim } = await freshDimmer();
    toggleNightDim(); // force on
    autoDimCheck(23, 6); // range is 23:00–06:00, now is 14:00
    const el = document.getElementById("night-dim");
    expect(el?.style.display).toBe("none");
    vi.useRealTimers();
  });

  it("activates dim when hour is exactly at start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T23:00:00"));
    const { autoDimCheck } = await freshDimmer();
    autoDimCheck(23, 6);
    const el = document.getElementById("night-dim");
    expect(el?.style.display).toBe("block");
    vi.useRealTimers();
  });
});

describe("Night Dimmer — initNightDimmer", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("applies configured dim level on init", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T14:00:00")); // daytime — not in dim schedule
    localStorage.setItem("dash_v2_dim_start", "23");
    localStorage.setItem("dash_v2_dim_end", "6");
    const { initNightDimmer, toggleNightDim } = await freshDimmer();
    toggleNightDim(); // activate dim manually to check level
    initNightDimmer(70);
    const el = document.getElementById("night-dim");
    expect(parseFloat(el?.style.opacity ?? "0")).toBeCloseTo(0.7);
    vi.useRealTimers();
  });

  it("reads dim schedule from localStorage defaults when not set", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T14:00:00"));
    const { initNightDimmer } = await freshDimmer();
    expect(() => initNightDimmer(55)).not.toThrow();
    vi.useRealTimers();
  });

  it("starts auto-dim when current hour is in schedule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T23:30:00")); // 23:30 → inside 23–6 range
    localStorage.setItem("dash_v2_dim_start", "23");
    localStorage.setItem("dash_v2_dim_end", "6");
    const { initNightDimmer } = await freshDimmer();
    initNightDimmer(55, true); // scheduleEnabled = true
    const el = document.getElementById("night-dim");
    expect(el?.style.display).toBe("block");
    vi.useRealTimers();
  });
});

// ── isDimActive getter ──

describe("Night Dimmer — isDimActive", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false initially", async () => {
    const { isDimActive } = await freshDimmer();
    expect(isDimActive()).toBe(false);
  });

  it("returns true after toggle on", async () => {
    const { toggleNightDim, isDimActive } = await freshDimmer();
    toggleNightDim();
    expect(isDimActive()).toBe(true);
  });

  it("returns false after double toggle", async () => {
    const { toggleNightDim, isDimActive } = await freshDimmer();
    toggleNightDim();
    toggleNightDim();
    expect(isDimActive()).toBe(false);
  });
});

// ── autoDimCheck deactivation transition ──

describe("Night Dimmer — autoDimCheck deactivation (ON→OFF)", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("deactivates when transitioning from inside to outside schedule", async () => {
    vi.useFakeTimers();
    // First: 23:30 — inside the 23-6 range
    vi.setSystemTime(new Date("2024-01-15T23:30:00"));
    const { autoDimCheck, isDimActive } = await freshDimmer();
    autoDimCheck(23, 6);
    expect(isDimActive()).toBe(true);
    expect(document.getElementById("night-dim")?.style.display).toBe("block");

    // Now: 14:00 — outside the range → deactivation branch
    vi.setSystemTime(new Date("2024-01-15T14:00:00"));
    autoDimCheck(23, 6);
    expect(isDimActive()).toBe(false);
    expect(document.getElementById("night-dim")?.style.display).toBe("none");
  });

  it("does not re-activate when already outside and off", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00"));
    const { autoDimCheck, isDimActive } = await freshDimmer();
    autoDimCheck(23, 6);
    expect(isDimActive()).toBe(false);
    // Should remain off
    autoDimCheck(23, 6);
    expect(isDimActive()).toBe(false);
  });
});

// ── initNightDimmer — setInterval callback re-check ──

describe("Night Dimmer — initNightDimmer setInterval re-check", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("re-checks schedule every 60s via setInterval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T14:00:00")); // daytime
    localStorage.setItem("dash_v2_dim_start", "23");
    localStorage.setItem("dash_v2_dim_end", "6");
    const { initNightDimmer, isDimActive } = await freshDimmer();
    initNightDimmer(55, true); // scheduleEnabled = true
    expect(isDimActive()).toBe(false);

    // Advance time to 23:30 and trigger the 60s interval
    vi.setSystemTime(new Date("2024-01-15T23:30:00"));
    vi.advanceTimersByTime(60_001);
    expect(isDimActive()).toBe(true);
    expect(document.getElementById("night-dim")?.style.display).toBe("block");
  });

  it("picks up changed schedule from localStorage on interval tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T14:00:00"));
    localStorage.setItem("dash_v2_dim_start", "23");
    localStorage.setItem("dash_v2_dim_end", "6");
    const { initNightDimmer, isDimActive } = await freshDimmer();
    initNightDimmer(55, true); // scheduleEnabled = true
    expect(isDimActive()).toBe(false);

    // Change schedule to include current hour
    localStorage.setItem("dash_v2_dim_start", "10");
    localStorage.setItem("dash_v2_dim_end", "18");
    vi.advanceTimersByTime(60_001);
    expect(isDimActive()).toBe(true);
  });
});

// ── applyDim reconnect branch (L34) ──────────────────────────────────────────

describe("Night Dimmer — applyDim reconnect when element not connected", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("re-fetches #night-dim when dimEl.isConnected is false (L34)", async () => {
    // First render with element present → toggleNightDim caches dimEl reference
    document.body.innerHTML = '<div id="night-dim" style="display:none"></div>';
    const { toggleNightDim, setDimLevel } = await freshDimmer();

    // Activate to cache the element reference
    toggleNightDim();
    const el = document.getElementById("night-dim")!;
    expect(el.style.display).toBe("block");

    // Remove element from DOM → dimEl.isConnected becomes false
    el.remove();
    expect(document.getElementById("night-dim")).toBeNull();

    // Re-add a fresh element
    const fresh = document.createElement("div");
    fresh.id = "night-dim";
    document.body.appendChild(fresh);

    // setDimLevel triggers applyDim → detects !isConnected → re-queries → updates fresh element
    setDimLevel(40);
    expect(fresh.style.opacity).toBe("0.4");
  });
});

// ── applyDim line 34 TRUE branch: dimEl null after re-query ─────────────────────

describe("Night Dimmer — applyDim returns early when #night-dim absent (line 34)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns early without throwing when #night-dim is absent from DOM (line 34 TRUE branch)", async () => {
    // No #night-dim element in DOM → applyDim re-queries → still null → if(!dimEl) return
    document.body.innerHTML = "";
    const { toggleNightDim } = await freshDimmer();
    // toggleNightDim → applyDim → dimEl = null → re-query = null → line 34 return
    expect(() => toggleNightDim()).not.toThrow();
  });
});

// ── Sprint v7.13: updateDimIndicator with #dim-indicator element (lines 48-52) ──

describe("Night Dimmer — updateDimIndicator with chip element", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="night-dim" style="display:none"></div>
      <span id="dim-indicator" style="display:none"></span>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows chip and sets title when dimmer is active (line 48-49 TRUE branch)", async () => {
    const { toggleNightDim } = await freshDimmer();
    toggleNightDim(); // activate
    const chip = document.getElementById("dim-indicator");
    expect(chip?.style.display).toBe("");
    expect(chip?.title).toContain("עמעום לילה פעיל");
  });

  it("hides chip when dimmer is inactive (line 51-52 FALSE branch)", async () => {
    const { toggleNightDim } = await freshDimmer();
    toggleNightDim(); // ON
    toggleNightDim(); // OFF
    const chip = document.getElementById("dim-indicator");
    expect(chip?.style.display).toBe("none");
  });

  it("updateDimIndicator does nothing when #dim-indicator is absent", async () => {
    document.getElementById("dim-indicator")?.remove();
    const { updateDimIndicator } = await freshDimmer();
    expect(() => updateDimIndicator()).not.toThrow();
  });
});

// ── F3 (v7.2): Warm tint toggle ─────────────────────────────────────────────

describe("Night dimmer — setWarmTint / isWarmTint (F3 v7.2)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="night-dim"></div>`;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("isWarmTint returns false by default", async () => {
    vi.resetModules();
    const { isWarmTint } = await import("@/ui/night-dimmer");
    expect(isWarmTint()).toBe(false);
  });

  it("setWarmTint(true) sets isWarmTint() to true", async () => {
    vi.resetModules();
    const { setWarmTint, isWarmTint } = await import("@/ui/night-dimmer");
    setWarmTint(true);
    expect(isWarmTint()).toBe(true);
  });

  it("setWarmTint(false) sets isWarmTint() to false", async () => {
    vi.resetModules();
    const { setWarmTint, isWarmTint } = await import("@/ui/night-dimmer");
    setWarmTint(true);
    setWarmTint(false);
    expect(isWarmTint()).toBe(false);
  });
});
