/**
 * Tests for src/ui/card-auto-scroll.ts
 *
 * Covers: findScrollBody, evaluateAll (wire/unwire/skip), initCardAutoScroll,
 *         wheel-event pause, rAF tick scroll, collapsed/maximized guards.
 *
 * Uses vi.resetModules() per registry-state describe to prevent cross-test
 * pollution from the module-level Map<HTMLElement, Ticker>.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Global stubs (set before any module load) ──────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

// Capture rAF callbacks so tests can invoke them manually
let _rafCbs: FrameRequestCallback[] = [];
global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  _rafCbs.push(cb);
  return _rafCbs.length;
});
global.cancelAnimationFrame = vi.fn();
global.ResizeObserver = vi.fn(function MockRO() {
  return { observe: vi.fn(), disconnect: vi.fn() };
});

import { findScrollBody } from "@/ui/card-auto-scroll";

// ── Helpers ────────────────────────────────────────────────────────────────

type Mod = typeof import("@/ui/card-auto-scroll");

async function freshMod(): Promise<Mod> {
  vi.resetModules();
  return import("@/ui/card-auto-scroll") as Promise<Mod>;
}

interface CardFixture {
  card: HTMLElement;
  body: HTMLElement;
}

function makeCard(cardId = "test", overflow = 0, state?: "collapsed" | "maximized"): CardFixture {
  const card = document.createElement("section");
  card.className = "card";
  if (state) card.classList.add(state);
  card.dataset["cardId"] = cardId;

  const header = document.createElement("div");
  header.className = "card-header";

  const body = document.createElement("div");
  body.className = "card-body";
  // happy-dom does not compute layout; mock scrollHeight / clientHeight
  Object.defineProperty(body, "scrollHeight", { value: 200 + overflow, configurable: true });
  Object.defineProperty(body, "clientHeight", { value: 200, configurable: true });

  card.appendChild(header);
  card.appendChild(body);
  document.body.appendChild(card);
  return { card, body };
}

// ── findScrollBody ─────────────────────────────────────────────────────────

describe("CardAutoScroll — findScrollBody", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the first non-header child", () => {
    const { card, body } = makeCard();
    expect(findScrollBody(card)).toBe(body);
  });

  it("skips card-header and returns the next sibling", () => {
    const card = document.createElement("section");
    card.className = "card";
    const header = document.createElement("div");
    header.className = "card-header";
    const body = document.createElement("div");
    body.className = "weather-body";
    card.appendChild(header);
    card.appendChild(body);
    document.body.appendChild(card);
    expect(findScrollBody(card)).toBe(body);
  });

  it("returns null when card has only a header", () => {
    const card = document.createElement("section");
    card.className = "card";
    const header = document.createElement("div");
    header.className = "card-header";
    card.appendChild(header);
    document.body.appendChild(card);
    expect(findScrollBody(card)).toBeNull();
  });

  it("returns null for an empty card", () => {
    const card = document.createElement("section");
    document.body.appendChild(card);
    expect(findScrollBody(card)).toBeNull();
  });
});

// ── evaluateAll — wire on overflow ─────────────────────────────────────────

describe("CardAutoScroll — evaluateAll wires overflowing body", () => {
  let mod: Mod;

  beforeEach(async () => {
    _rafCbs = [];
    mod = await freshMod();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("adds .card-body-auto-scroll class when body overflows", () => {
    const { body } = makeCard("weather", 100);
    mod.evaluateAll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(true);
  });

  it("sets overflow-y to auto on the body when overflowing", () => {
    const { body } = makeCard("calendar", 100);
    mod.evaluateAll();
    expect(body.style.overflowY).toBe("auto");
  });

  it("starts a rAF loop when body overflows", () => {
    makeCard("tasks", 100);
    mod.evaluateAll();
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it("does NOT wire body when overflow is below threshold (24 px)", () => {
    const { body } = makeCard("tasks", 10); // 10px < 24px threshold
    mod.evaluateAll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(false);
  });

  it("does NOT wire body when no overflow", () => {
    const { body } = makeCard("tasks", 0);
    mod.evaluateAll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(false);
  });
});

// ── evaluateAll — skip self-scroll cards ───────────────────────────────────

describe("CardAutoScroll — evaluateAll skips self-scroll cards", () => {
  let mod: Mod;

  beforeEach(async () => {
    _rafCbs = [];
    mod = await freshMod();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it.each(["news", "alerts", "stocks"])("skips card with data-card-id=%s", (id) => {
    const { body } = makeCard(id, 200);
    mod.evaluateAll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(false);
  });
});

// ── evaluateAll — idempotent / unwire ──────────────────────────────────────

describe("CardAutoScroll — evaluateAll idempotent and unwire", () => {
  let mod: Mod;

  beforeEach(async () => {
    _rafCbs = [];
    mod = await freshMod();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("does not double-wire on repeated evaluateAll calls", () => {
    makeCard("weather", 100);
    const callsBefore = (requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length;
    mod.evaluateAll();
    mod.evaluateAll();
    const callsAfter = (requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length;
    // Only 1 rAF call for wire, not 2
    expect(callsAfter - callsBefore).toBe(1);
  });

  it("unwires body when overflow is resolved on second evaluateAll", () => {
    const { body } = makeCard("weather", 100);
    mod.evaluateAll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(true);

    // Now make body fit (no overflow)
    Object.defineProperty(body, "scrollHeight", { value: 200, configurable: true });
    mod.evaluateAll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(false);
  });

  it("restores overflow-y when unwired", () => {
    const { body } = makeCard("weather", 100);
    mod.evaluateAll();
    Object.defineProperty(body, "scrollHeight", { value: 200, configurable: true });
    mod.evaluateAll();
    expect(body.style.overflowY).toBe("");
  });
});

// ── rAF tick: scrolls body ─────────────────────────────────────────────────

describe("CardAutoScroll — rAF tick advances scrollTop", () => {
  let mod: Mod;

  beforeEach(async () => {
    _rafCbs = [];
    mod = await freshMod();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("increments scrollTop after two rAF frames", () => {
    const { body } = makeCard("weather", 200);
    mod.evaluateAll();

    // Frame 0: sets lastTs, dt=0 → no scroll
    _rafCbs[0]?.(1000);
    // Frame 1: dt = 100ms → scrolls 35 * 0.1 = 3.5 px
    _rafCbs[1]?.(1100);

    expect(body.scrollTop).toBeGreaterThan(0);
  });

  it("does not scroll when card is collapsed", () => {
    const { card, body } = makeCard("weather", 200);
    mod.evaluateAll();

    card.classList.add("collapsed");

    _rafCbs[0]?.(1000);
    _rafCbs[1]?.(1100);

    expect(body.scrollTop).toBe(0);
  });

  it("does not scroll when card is maximized", () => {
    const { card, body } = makeCard("weather", 200);
    mod.evaluateAll();

    card.classList.add("maximized");

    _rafCbs[0]?.(1000);
    _rafCbs[1]?.(1100);

    expect(body.scrollTop).toBe(0);
  });
});

// ── Wheel event pauses ─────────────────────────────────────────────────────

describe("CardAutoScroll — wheel event pauses scroll", () => {
  let mod: Mod;

  beforeEach(async () => {
    vi.useFakeTimers();
    _rafCbs = [];
    mod = await freshMod();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("wheel event halts scrollTop advance", () => {
    const { body } = makeCard("weather", 200);
    mod.evaluateAll();

    // Fire wheel event
    body.dispatchEvent(new Event("wheel", { bubbles: true }));

    // Advance frames — paused ticker should not scroll
    _rafCbs[0]?.(1000);
    _rafCbs[1]?.(1100);

    expect(body.scrollTop).toBe(0);
  });

  it("resumes auto-scroll after RESUME_DELAY_MS", () => {
    const { body } = makeCard("weather", 200);
    mod.evaluateAll();

    body.dispatchEvent(new Event("wheel", { bubbles: true }));

    // Advance past resume delay (3 000 ms)
    vi.advanceTimersByTime(3_100);

    // Now frames should scroll again
    _rafCbs[0]?.(1000);
    _rafCbs[1]?.(1100);

    expect(body.scrollTop).toBeGreaterThan(0);
  });
});

// ── initCardAutoScroll ─────────────────────────────────────────────────────

describe("CardAutoScroll — initCardAutoScroll", () => {
  let mod: Mod;

  beforeEach(async () => {
    vi.useFakeTimers();
    _rafCbs = [];
    // Re-initialise constructor mock in case a previous afterEach cleared it
    global.ResizeObserver = vi.fn(function MockRO() {
      return { observe: vi.fn(), disconnect: vi.fn() };
    });
    mod = await freshMod();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("does not throw", () => {
    expect(() => mod.initCardAutoScroll()).not.toThrow();
  });

  it("wires overflowing cards after initial delay (2 500 ms)", () => {
    const { body } = makeCard("weather", 100);
    mod.initCardAutoScroll();
    expect(body.classList.contains("card-body-auto-scroll")).toBe(false); // not yet

    vi.advanceTimersByTime(2_500);
    expect(body.classList.contains("card-body-auto-scroll")).toBe(true);
  });

  it("attaches ResizeObserver to each card", () => {
    makeCard("weather", 100);
    makeCard("calendar", 100);
    mod.initCardAutoScroll();
    const roInstance = (global.ResizeObserver as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(roInstance?.observe).toHaveBeenCalledTimes(2);
  });
});
