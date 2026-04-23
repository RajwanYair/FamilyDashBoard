/**
 * Tests for src/core/anim-level.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { applyAnimLevel, effectiveAnimLevel, applyConfigAnimLevel } from "@/core/anim-level";
import type { DashboardConfig } from "@/types/config";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockMatchMedia(prefersReduced: boolean): void {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("reduced-motion") ? prefersReduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as MediaQueryList;
}

// ── applyAnimLevel ────────────────────────────────────────────────────────────

describe("applyAnimLevel", () => {
  beforeEach(() => {
    delete document.body.dataset["animLevel"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stamps data-anim-level=none on body", () => {
    applyAnimLevel("none");
    expect(document.body.dataset["animLevel"]).toBe("none");
  });

  it("stamps data-anim-level=minimal on body", () => {
    applyAnimLevel("minimal");
    expect(document.body.dataset["animLevel"]).toBe("minimal");
  });

  it("stamps data-anim-level=normal on body", () => {
    applyAnimLevel("normal");
    expect(document.body.dataset["animLevel"]).toBe("normal");
  });

  it("stamps data-anim-level=full on body", () => {
    applyAnimLevel("full");
    expect(document.body.dataset["animLevel"]).toBe("full");
  });

  it("falls back to normal for an invalid level", () => {
    applyAnimLevel("bogus" as DashboardConfig["animLevel"]);
    expect(document.body.dataset["animLevel"]).toBe("normal");
  });
});

// ── effectiveAnimLevel ────────────────────────────────────────────────────────

describe("effectiveAnimLevel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns normal unchanged when OS has no preference", () => {
    mockMatchMedia(false);
    expect(effectiveAnimLevel("normal")).toBe("normal");
  });

  it("returns minimal when OS prefers reduced-motion and config is normal", () => {
    mockMatchMedia(true);
    expect(effectiveAnimLevel("normal")).toBe("minimal");
  });

  it("returns full unchanged even when OS prefers reduced-motion", () => {
    mockMatchMedia(true);
    expect(effectiveAnimLevel("full")).toBe("full");
  });

  it("returns none unchanged when OS has no preference", () => {
    mockMatchMedia(false);
    expect(effectiveAnimLevel("none")).toBe("none");
  });

  it("returns minimal unchanged when OS prefers reduced-motion and config is already minimal", () => {
    mockMatchMedia(true);
    expect(effectiveAnimLevel("minimal")).toBe("minimal");
  });

  it("returns none unchanged when OS prefers reduced-motion and config is none", () => {
    mockMatchMedia(true);
    expect(effectiveAnimLevel("none")).toBe("none");
  });
});

// ── applyConfigAnimLevel ─────────────────────────────────────────────────────

describe("applyConfigAnimLevel", () => {
  beforeEach(() => {
    delete document.body.dataset["animLevel"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies the config level when OS has no preference", () => {
    mockMatchMedia(false);
    const cfg = { animLevel: "full" } as DashboardConfig;
    applyConfigAnimLevel(cfg);
    expect(document.body.dataset["animLevel"]).toBe("full");
  });

  it("clamps to minimal when OS prefers reduced-motion and config is normal", () => {
    mockMatchMedia(true);
    const cfg = { animLevel: "normal" } as DashboardConfig;
    applyConfigAnimLevel(cfg);
    expect(document.body.dataset["animLevel"]).toBe("minimal");
  });

  it("keeps full even when OS prefers reduced-motion", () => {
    mockMatchMedia(true);
    const cfg = { animLevel: "full" } as DashboardConfig;
    applyConfigAnimLevel(cfg);
    expect(document.body.dataset["animLevel"]).toBe("full");
  });
});
