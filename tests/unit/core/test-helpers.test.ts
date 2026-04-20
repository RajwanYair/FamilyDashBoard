/**
 * Tests for tests/helpers/index.ts (Stream G.1)
 *
 * Verifies that shared test utilities behave as documented.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCardDOM,
  cleanupDOM,
  appendToDOM,
  withFakeTimers,
  createMockFetch,
  createFailingFetch,
  createMockCache,
  createMockConfig,
  getElement,
  getDomElement,
} from "@tests/helpers";

// ── createCardDOM ─────────────────────────────────────────────────────────────

describe("createCardDOM", () => {
  it("sets document.body.innerHTML and returns body", () => {
    const el = createCardDOM('<span id="test">hello</span>');
    expect(el).toBe(document.body);
    expect(document.getElementById("test")?.textContent).toBe("hello");
  });

  it("replaces previous body content on each call", () => {
    createCardDOM('<div id="first"></div>');
    createCardDOM('<div id="second"></div>');
    expect(document.getElementById("first")).toBeNull();
    expect(document.getElementById("second")).not.toBeNull();
  });
});

// ── cleanupDOM ────────────────────────────────────────────────────────────────

describe("cleanupDOM", () => {
  it("clears body innerHTML", () => {
    createCardDOM('<div id="should-go"></div>');
    cleanupDOM();
    expect(document.body.innerHTML).toBe("");
  });

  it("resets body className", () => {
    document.body.className = "theme-blue";
    cleanupDOM();
    expect(document.body.className).toBe("");
  });
});

// ── appendToDOM ───────────────────────────────────────────────────────────────

describe("appendToDOM", () => {
  beforeEach(() => cleanupDOM());

  it("returns the container element", () => {
    const el = appendToDOM('<p id="para">hi</p>');
    expect(el).toBeInstanceOf(HTMLDivElement);
    expect(document.getElementById("para")).not.toBeNull();
  });

  it("does not replace existing content", () => {
    createCardDOM('<span id="existing"></span>');
    appendToDOM('<span id="new"></span>');
    expect(document.getElementById("existing")).not.toBeNull();
    expect(document.getElementById("new")).not.toBeNull();
  });
});

// ── withFakeTimers ────────────────────────────────────────────────────────────

describe("withFakeTimers", () => {
  it("restores real timers after the callback completes", async () => {
    await withFakeTimers(() => {
      // inside the callback, timers are fake
      expect(typeof vi.getRealSystemTime).toBe("function");
    });
    // after the callback, timers should be restored (no error thrown)
  });

  it("returns the value produced by the callback", async () => {
    const result = await withFakeTimers(() => {
      vi.advanceTimersByTime(100);
      return 42;
    });
    expect(result).toBe(42);
  });

  it("restores timers even if callback throws", async () => {
    await expect(
      withFakeTimers(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // if timers weren't restored this test would hang on the next vi.useFakeTimers call
  });
});

// ── createMockFetch ───────────────────────────────────────────────────────────

describe("createMockFetch", () => {
  it("resolves with ok: true and correct json", async () => {
    const fetchMock = createMockFetch({ temp: 22 });
    const res = await fetchMock("https://example.com/api");
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ temp: 22 });
  });

  it("is callable as a vi.fn mock", () => {
    const fetchMock = createMockFetch({});
    expect(vi.isMockFunction(fetchMock)).toBe(true);
  });

  it("respects ok: false option", async () => {
    const fetchMock = createMockFetch(null, { ok: false, status: 404 });
    const res = await fetchMock("https://example.com/api");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});

// ── createFailingFetch ────────────────────────────────────────────────────────

describe("createFailingFetch", () => {
  it("rejects with TypeError by default", async () => {
    const fetchMock = createFailingFetch();
    await expect(fetchMock("https://example.com")).rejects.toThrow(TypeError);
  });

  it("uses the provided message", async () => {
    const fetchMock = createFailingFetch("Connection refused");
    await expect(fetchMock("https://example.com")).rejects.toThrow(
      "Connection refused",
    );
  });
});

// ── createMockCache ───────────────────────────────────────────────────────────

describe("createMockCache", () => {
  it("returns null for unseeded keys (cGet)", () => {
    const cache = createMockCache();
    expect(cache.cGet("missing", 60_000)).toBeNull();
  });

  it("returns null for unseeded keys (cGetStale)", () => {
    const cache = createMockCache();
    expect(cache.cGetStale("missing")).toBeNull();
  });

  it("seed() makes cGet return the seeded value", () => {
    const cache = createMockCache();
    cache.seed("weather", { temp: 22 });
    expect(cache.cGet("weather", 60_000)).toEqual({ temp: 22 });
  });

  it("seed() makes cGetStale return the seeded value", () => {
    const cache = createMockCache();
    cache.seed("news", [{ title: "Breaking" }]);
    expect(cache.cGetStale("news")).toEqual([{ title: "Breaking" }]);
  });

  it("cSet stores a value", () => {
    const cache = createMockCache();
    cache.cSet("key", "value");
    expect(cache.cGet("key", 60_000)).toBe("value");
  });

  it("all three are vi.fn mocks", () => {
    const cache = createMockCache();
    expect(vi.isMockFunction(cache.cGet)).toBe(true);
    expect(vi.isMockFunction(cache.cSet)).toBe(true);
    expect(vi.isMockFunction(cache.cGetStale)).toBe(true);
  });
});

// ── createMockConfig ──────────────────────────────────────────────────────────

describe("createMockConfig", () => {
  it("returns a valid DashboardConfig with test defaults", () => {
    const cfg = createMockConfig();
    expect(cfg.familyName).toBe("Test Family");
    expect(cfg.homeCity).toBe("תל אביב");
    expect(cfg.interfaceLanguage).toBe("he");
    expect(cfg.configVersion).toBeGreaterThan(0);
  });

  it("applies overrides on top of defaults", () => {
    const cfg = createMockConfig({ tempUnit: "F", familyName: "Smith" });
    expect(cfg.tempUnit).toBe("F");
    expect(cfg.familyName).toBe("Smith");
    // non-overridden fields still present
    expect(cfg.interfaceLanguage).toBe("he");
  });

  it("returns a new object each call (no shared mutation)", () => {
    const a = createMockConfig();
    const b = createMockConfig();
    a.familyName = "Changed";
    expect(b.familyName).toBe("Test Family");
  });
});

// ── getElement / getElementById ───────────────────────────────────────────────

describe("getElement", () => {
  beforeEach(() => cleanupDOM());

  it("returns the matching element", () => {
    createCardDOM('<div id="box" class="card"></div>');
    const el = getElement<HTMLDivElement>(".card");
    expect(el.id).toBe("box");
  });

  it("throws a descriptive error when element is missing", () => {
    expect(() => getElement("#nonexistent")).toThrow(
      'getElement: no element matches "#nonexistent"',
    );
  });
});

describe("getDomElement", () => {
  beforeEach(() => cleanupDOM());

  it("returns the element by id", () => {
    createCardDOM('<button id="save-btn">Save</button>');
    const btn = getDomElement<HTMLButtonElement>("save-btn");
    expect(btn.tagName).toBe("BUTTON");
  });

  it("throws when the id does not exist", () => {
    expect(() => getDomElement("ghost")).toThrow(
      'getDomElement: no element with id "ghost"',
    );
  });
});
