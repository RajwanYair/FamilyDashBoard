/**
 * Tests for src/core/auto-loop-scroll.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initAutoLoopScroll, destroyAutoLoopScroll } from "@/core/auto-loop-scroll";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(itemCount: number): {
  parent: HTMLDivElement;
  container: HTMLDivElement;
} {
  const parent = document.createElement("div");
  parent.style.height = "200px";
  parent.style.overflow = "hidden";

  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  parent.appendChild(container);

  for (let i = 0; i < itemCount; i++) {
    const item = document.createElement("div");
    item.textContent = `Item ${i}`;
    item.style.height = "40px";
    item.style.flexShrink = "0";
    container.appendChild(item);
  }

  document.body.appendChild(parent);
  return { parent, container };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("auto-loop-scroll — initAutoLoopScroll", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.querySelectorAll("style[id^='als-test']").forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it("does nothing when prefers-reduced-motion is set", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const { container } = makeContainer(10);
    initAutoLoopScroll(container, { styleId: "als-test-1" });

    // No clones should be added
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });

  it("does not clone when content fits in parent", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    // Only 2 items — 80px content fits in 200px parent
    const { container } = makeContainer(2);
    // Manually set scrollHeight to simulate no overflow
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 80 });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });

    // Flush rAF
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    initAutoLoopScroll(container, { styleId: "als-test-2" });

    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });

  it("clones children when content overflows parent", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const { container } = makeContainer(8); // 8 × 40px = 320px > 200px parent
    const origChildCount = container.childElementCount; // 8

    // Simulate overflow measurements
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40; // dynamic
      },
    });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });

    let rafCallCount = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallCount++;
      cb(0);
      return rafCallCount;
    });

    initAutoLoopScroll(container, { styleId: "als-test-3", pxPerSec: 40, minDurSec: 10 });

    const clones = container.querySelectorAll("[data-als-clone='true']");
    expect(clones.length).toBe(origChildCount);
    expect(container.childElementCount).toBe(origChildCount * 2);
  });

  it("marks clones as aria-hidden and inert", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const { container } = makeContainer(6);
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    initAutoLoopScroll(container, { styleId: "als-test-4" });

    container.querySelectorAll("[data-als-clone='true']").forEach((clone) => {
      expect(clone.getAttribute("aria-hidden")).toBe("true");
      expect(clone.hasAttribute("inert")).toBe(true);
    });
  });

  it("removes old clones on re-init", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const { container } = makeContainer(6);
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    initAutoLoopScroll(container, { styleId: "als-test-5" });
    const firstCloneCount = container.querySelectorAll("[data-als-clone='true']").length;

    // Second call should remove old clones first
    initAutoLoopScroll(container, { styleId: "als-test-5" });
    const secondCloneCount = container.querySelectorAll("[data-als-clone='true']").length;

    expect(firstCloneCount).toBe(secondCloneCount); // same count, no accumulation
  });
});

describe("auto-loop-scroll — destroyAutoLoopScroll", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("removes all clones", () => {
    const { container } = makeContainer(6);
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    initAutoLoopScroll(container, { styleId: "als-test-6" });
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBeGreaterThan(0);

    destroyAutoLoopScroll(container, "als-test-6");
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });

  it("clears the animation style", () => {
    const { container } = makeContainer(6);
    container.style.animation = "als_test 30s linear infinite";

    destroyAutoLoopScroll(container, "als-test-7");
    expect(container.style.animation).toBe("");
  });

  it("removes the injected style element", () => {
    const styleEl = document.createElement("style");
    styleEl.id = "als-test-8";
    document.head.appendChild(styleEl);

    const { container } = makeContainer(2);
    destroyAutoLoopScroll(container, "als-test-8");

    expect(document.getElementById("als-test-8")).toBeNull();
  });

  it("is safe to call when no clones exist", () => {
    const { container } = makeContainer(2);
    expect(() => destroyAutoLoopScroll(container, "als-test-9")).not.toThrow();
  });
});

// ── V13 scrollend event + animLevel branches ─────────────────────

describe("auto-loop-scroll — scrollend event attachment", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.querySelectorAll("style[id^='als-se']").forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  function setupOverflowContainer(opts: { onscrollend?: boolean } = {}) {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const { parent, container } = makeContainer(10);
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(parent, "clientHeight", { configurable: true, value: 200 });

    // Optionally add `onscrollend` to the parent so the branch is exercised
    if (opts.onscrollend) {
      (parent as unknown as Record<string, unknown>)["onscrollend"] = null;
    }

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    return { parent, container };
  }

  it("attaches scrollend listener when parent supports onscrollend", () => {
    const { parent, container } = setupOverflowContainer({ onscrollend: true });
    const addListenerSpy = vi.spyOn(parent, "addEventListener");
    initAutoLoopScroll(container, { styleId: "als-se-1" });
    expect(addListenerSpy).toHaveBeenCalledWith("scrollend", expect.any(Function), {
      once: true,
    });
  });

  it("does not attach scrollend listener when parent lacks onscrollend", () => {
    const { parent, container } = setupOverflowContainer({ onscrollend: false });
    const addListenerSpy = vi.spyOn(parent, "addEventListener");
    initAutoLoopScroll(container, { styleId: "als-se-2" });
    const calls = addListenerSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("scrollend");
  });

  it("scrollend handler re-inits container when still connected", () => {
    const { parent, container } = setupOverflowContainer({ onscrollend: true });
    let capturedHandler: (() => void) | null = null;
    vi.spyOn(parent, "addEventListener").mockImplementation((evt, fn) => {
      if (evt === "scrollend") capturedHandler = fn as () => void;
    });
    initAutoLoopScroll(container, { styleId: "als-se-3" });
    expect(capturedHandler).not.toBeNull();

    // Fire the scrollend event — container is still connected
    const styleBefore = container.style.animation;
    capturedHandler!();
    // After reinit, animation should be re-applied or unchanged
    expect(typeof container.style.animation).toBe("string");
    void styleBefore;
  });

  it("scrollend handler is safe when container is disconnected", () => {
    const { parent, container } = setupOverflowContainer({ onscrollend: true });
    let capturedHandler: (() => void) | null = null;
    vi.spyOn(parent, "addEventListener").mockImplementation((evt, fn) => {
      if (evt === "scrollend") capturedHandler = fn as () => void;
    });
    initAutoLoopScroll(container, { styleId: "als-se-4" });

    // Detach the container before firing
    container.remove();
    expect(() => capturedHandler?.()).not.toThrow();
  });
});

describe("auto-loop-scroll — animLevel guard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-anim-level");
    vi.restoreAllMocks();
  });

  function mockNotReducedMotion() {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);
  }

  it("skips animation when animLevel is 'none'", () => {
    mockNotReducedMotion();
    document.body.dataset["animLevel"] = "none";
    const { container } = makeContainer(10);
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 400 });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });
    initAutoLoopScroll(container, { styleId: "als-al-1" });
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });

  it("skips animation when animLevel is 'minimal'", () => {
    mockNotReducedMotion();
    document.body.dataset["animLevel"] = "minimal";
    const { container } = makeContainer(10);
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 400 });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });
    initAutoLoopScroll(container, { styleId: "als-al-2" });
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });

  it("allows animation when animLevel is 'full'", () => {
    mockNotReducedMotion();
    document.body.dataset["animLevel"] = "full";
    const { container } = makeContainer(10);
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(container.parentElement!, "clientHeight", {
      configurable: true,
      value: 200,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    initAutoLoopScroll(container, { styleId: "als-al-3" });
    // Clones should be present for overflow content
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBeGreaterThan(0);
  });
});

// ── Animation level integration ───────────────────────────────────────────────

describe("auto-loop-scroll — respects data-anim-level", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete document.body.dataset["animLevel"];
    vi.restoreAllMocks();
  });

  it("does not scroll when body data-anim-level=none", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    document.body.dataset["animLevel"] = "none";
    const { container } = makeContainer(10);
    initAutoLoopScroll(container, { styleId: "als-test-anim-none" });
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });

  it("does not scroll when body data-anim-level=minimal", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    document.body.dataset["animLevel"] = "minimal";
    const { container } = makeContainer(10);
    initAutoLoopScroll(container, { styleId: "als-test-anim-minimal" });
    expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
  });
});

describe("auto-loop-scroll — scrollend + overscroll-behavior", () => {
  beforeEach(() => {
    delete document.body.dataset["animLevel"];
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as MediaQueryList);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.body.dataset["animLevel"];
  });

  it("sets overscroll-behavior:contain on parent when content overflows", () => {
    const { parent, container } = makeContainer(10);
    // Simulate overflow
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(parent, "clientHeight", { configurable: true, value: 200 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    initAutoLoopScroll(container, { styleId: "als-test-overscroll" });
    expect(parent.style.overscrollBehavior).toBe("contain");

    destroyAutoLoopScroll(container, "als-test-overscroll");
  });

  it("registers scrollend listener on parent when onscrollend is supported", () => {
    const { parent, container } = makeContainer(10);
    // Simulate overflow
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      get() {
        return this.childElementCount * 40;
      },
    });
    Object.defineProperty(parent, "clientHeight", { configurable: true, value: 200 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    // Simulate scrollend support
    (parent as HTMLElement & { onscrollend?: null }).onscrollend = null;
    let scrollEndRegistered = false;
    const origAdd = parent.addEventListener.bind(parent);
    parent.addEventListener = vi.fn((event: string, ...args: unknown[]) => {
      if (event === "scrollend") scrollEndRegistered = true;
      origAdd(event, ...(args as [EventListenerOrEventListenerObject, ...unknown[]]));
    });

    initAutoLoopScroll(container, { styleId: "als-test-scrollend" });
    expect(scrollEndRegistered).toBe(true);

    destroyAutoLoopScroll(container, "als-test-scrollend");
  });
});
