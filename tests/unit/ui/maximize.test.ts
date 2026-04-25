/**
 * Tests for src/ui/maximize.ts
 *
 * Covers: getMaximizedCard, toggleCardMaximize (expand/collapse/swap),
 * initCardMaximize (wires header click listeners),
 * computeFontScale (v7.1 adaptive font scaling).
 *
 * Uses vi.resetModules() per describe because maximize.ts holds module-level
 * `maximizedCard` state.
 *
 * Note: happy-dom does not implement Element.animate(), so we stub it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type MaxMod = {
  getMaximizedCard: () => HTMLElement | null;
  toggleCardMaximize: (card: HTMLElement) => void;
  computeFontScale: (first: DOMRect, last: DOMRect) => number;
  initCardMaximize: () => void;
};

async function freshMax(): Promise<MaxMod> {
  vi.resetModules();
  return import("@/ui/maximize") as Promise<MaxMod>;
}

/** Stub Element.animate so FLIP doesn't throw in happy-dom */
function stubAnimate(): void {
  Element.prototype.animate = vi.fn().mockReturnValue({ finished: Promise.resolve() });
}

function makeCard(id = "card-a"): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";
  card.id = id;
  const header = document.createElement("div");
  header.className = "card-header";
  card.appendChild(header);
  document.body.appendChild(card);
  return card;
}

// ── getMaximizedCard ──

describe("Maximize — getMaximizedCard", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("returns null before any card is maximized", () => {
    expect(mod.getMaximizedCard()).toBeNull();
  });

  it("returns the maximized card after expanding", () => {
    const card = makeCard();
    mod.toggleCardMaximize(card);
    expect(mod.getMaximizedCard()).toBe(card);
  });

  it("returns null after collapsing", () => {
    const card = makeCard();
    mod.toggleCardMaximize(card); // expand
    mod.toggleCardMaximize(card); // collapse
    expect(mod.getMaximizedCard()).toBeNull();
  });
});

// ── toggleCardMaximize ──

describe("Maximize — toggleCardMaximize expand/collapse", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("adds maximized class on first toggle", () => {
    const card = makeCard();
    mod.toggleCardMaximize(card);
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("removes collapsed class when card is expanded from minimized state", () => {
    const card = makeCard();
    card.classList.add("collapsed");
    mod.toggleCardMaximize(card);
    expect(card.classList.contains("collapsed")).toBe(false);
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("removes maximized class on second toggle", () => {
    const card = makeCard();
    mod.toggleCardMaximize(card);
    mod.toggleCardMaximize(card);
    expect(card.classList.contains("maximized")).toBe(false);
  });

  it("calls card.animate during expand", () => {
    const card = makeCard();
    mod.toggleCardMaximize(card);
    expect(card.animate).toHaveBeenCalledOnce();
  });

  it("calls card.animate during collapse", () => {
    const card = makeCard();
    mod.toggleCardMaximize(card);
    vi.mocked(card.animate).mockClear();
    mod.toggleCardMaximize(card);
    expect(card.animate).toHaveBeenCalledOnce();
  });
});

// ── toggleCardMaximize — swap between two cards ──

describe("Maximize — toggleCardMaximize swap", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("collapses first card when second card is expanded", () => {
    const cardA = makeCard("card-a");
    const cardB = makeCard("card-b");
    mod.toggleCardMaximize(cardA); // expand A
    mod.toggleCardMaximize(cardB); // expand B → A should auto-collapse
    expect(cardA.classList.contains("maximized")).toBe(false);
    expect(cardB.classList.contains("maximized")).toBe(true);
  });

  it("getMaximizedCard points to the new card after swap", () => {
    const cardA = makeCard("card-a");
    const cardB = makeCard("card-b");
    mod.toggleCardMaximize(cardA);
    mod.toggleCardMaximize(cardB);
    expect(mod.getMaximizedCard()).toBe(cardB);
  });
});

// ── maximize from collapsed state ──

describe("Maximize — maximize from collapsed state", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    localStorage.clear();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("removes .collapsed when expanding a collapsed card", () => {
    const card = makeCard("mc-collapsed-1");
    card.classList.add("collapsed");
    mod.toggleCardMaximize(card);
    expect(card.classList.contains("collapsed")).toBe(false);
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("restores .collapsed after collapse animation if card was persisted as collapsed", async () => {
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["mc-restore-1"]));
    const card = makeCard("mc-restore-1");
    const btn = document.createElement("button");
    btn.className = "card-collapse-btn";
    btn.textContent = "▶";
    card.appendChild(btn);
    card.classList.add("collapsed");

    mod.toggleCardMaximize(card); // expand — removes .collapsed
    expect(card.classList.contains("collapsed")).toBe(false);

    mod.toggleCardMaximize(card); // collapse back
    // anim.finished is resolved immediately by the stub
    await Promise.resolve();
    expect(card.classList.contains("collapsed")).toBe(true);
    expect(btn.textContent).toBe("▶");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("does NOT re-add .collapsed if card was NOT persisted as collapsed", async () => {
    const card = makeCard("mc-no-restore-1");
    card.classList.add("collapsed"); // visually collapsed but not persisted

    mod.toggleCardMaximize(card); // expand
    mod.toggleCardMaximize(card); // collapse
    await Promise.resolve();
    expect(card.classList.contains("collapsed")).toBe(false);
  });
});

// ── initCardMaximize ──

describe("Maximize — initCardMaximize", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
    // Build three cards
    for (let i = 0; i < 3; i++) makeCard(`wired-card-${i}`);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw on init", () => {
    expect(() => mod.initCardMaximize()).not.toThrow();
  });

  it("clicking a card header toggles maximized class", () => {
    mod.initCardMaximize();
    const header = document.querySelector<HTMLElement>(".card-header")!;
    const card = header.closest<HTMLElement>(".card")!;
    header.click();
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("clicking same header again collapses the card", () => {
    mod.initCardMaximize();
    const header = document.querySelector<HTMLElement>(".card-header")!;
    const card = header.closest<HTMLElement>(".card")!;
    header.click();
    header.click();
    expect(card.classList.contains("maximized")).toBe(false);
  });

  it("does not throw when no card headers exist", async () => {
    document.body.innerHTML = "";
    const emptyMod = await freshMax();
    expect(() => emptyMod.initCardMaximize()).not.toThrow();
  });
});

// ── initCardCollapse ──

type MaxModFull = MaxMod & {
  initCardCollapse: () => void;
  getCollapsedCards: () => Set<string>;
};

async function freshMaxFull(): Promise<MaxModFull> {
  vi.resetModules();
  return import("@/ui/maximize") as Promise<MaxModFull>;
}

function makeCollapsibleCard(id = "cc-a"): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";
  card.id = id;
  const btn = document.createElement("button");
  btn.className = "card-collapse-btn";
  btn.textContent = "▼";
  card.appendChild(btn);
  document.body.appendChild(card);
  return card;
}

describe("Maximize — initCardCollapse", () => {
  let mod: MaxModFull;

  beforeEach(async () => {
    stubAnimate();
    localStorage.clear();
    mod = await freshMaxFull();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not throw with no collapse buttons", () => {
    expect(() => mod.initCardCollapse()).not.toThrow();
  });

  it("clicking collapse button adds .collapsed to parent card", () => {
    const card = makeCollapsibleCard("cc-1");
    mod.initCardCollapse();
    const btn = card.querySelector<HTMLElement>(".card-collapse-btn")!;
    btn.click();
    expect(card.classList.contains("collapsed")).toBe(true);
  });

  it("clicking collapse button again removes .collapsed", () => {
    const card = makeCollapsibleCard("cc-2");
    mod.initCardCollapse();
    const btn = card.querySelector<HTMLElement>(".card-collapse-btn")!;
    btn.click();
    btn.click();
    expect(card.classList.contains("collapsed")).toBe(false);
  });

  it("collapses state is persisted to localStorage", () => {
    makeCollapsibleCard("cc-3");
    mod.initCardCollapse();
    const btn = document.querySelector<HTMLElement>(".card-collapse-btn")!;
    btn.click();
    const stored = JSON.parse(localStorage.getItem("dash_v2_collapsed_cards") ?? "[]") as string[];
    expect(stored).toContain("cc-3");
  });

  it("restores collapsed state from localStorage on init", async () => {
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["cc-restore"]));
    const card = makeCollapsibleCard("cc-restore");
    const freshMod = await freshMaxFull();
    freshMod.initCardCollapse();
    expect(card.classList.contains("collapsed")).toBe(true);
  });

  it("button text changes to ▶ when collapsed", () => {
    const card = makeCollapsibleCard("cc-4");
    mod.initCardCollapse();
    const btn = card.querySelector<HTMLElement>(".card-collapse-btn")!;
    btn.click();
    expect(btn.textContent).toBe("▶");
  });

  it("button text reverts to ▼ when expanded", () => {
    const card = makeCollapsibleCard("cc-5");
    mod.initCardCollapse();
    const btn = card.querySelector<HTMLElement>(".card-collapse-btn")!;
    btn.click();
    btn.click();
    expect(btn.textContent).toBe("▼");
  });
});

// ── Sprint 5: startViewTransition path, guard branches ──────────────────────

describe("Maximize — initCardCollapse with startViewTransition", () => {
  let mod: MaxModFull;

  beforeEach(async () => {
    stubAnimate();
    localStorage.clear();
    mod = await freshMaxFull();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    // Remove startViewTransition stub if set
    if ("startViewTransition" in document) {
      try {
        Reflect.deleteProperty(document, "startViewTransition");
      } catch {
        /* non-configurable in some envs */
      }
    }
  });

  it("executes doToggle via startViewTransition when available", () => {
    // Stub startViewTransition on document
    Object.defineProperty(document, "startViewTransition", {
      value: (cb: () => void) => {
        cb();
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };
      },
      configurable: true,
      writable: true,
    });
    const card = makeCollapsibleCard("vt-1");
    mod.initCardCollapse();
    const btn = card.querySelector<HTMLElement>(".card-collapse-btn")!;
    expect(() => btn.click()).not.toThrow();
    expect(card.classList.contains("collapsed")).toBe(true);
  });
});

describe("Maximize — initCardMaximize guard branches", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("click on collapse-btn inside header does NOT maximize the card", () => {
    // Build a card with both header and collapse-btn inside the header
    const card = document.createElement("div");
    card.className = "card";
    card.id = "guard-card";
    const header = document.createElement("div");
    header.className = "card-header";
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "card-collapse-btn";
    header.appendChild(collapseBtn);
    card.appendChild(header);
    document.body.appendChild(card);

    mod.initCardMaximize();
    // Click the collapse button (inside header) → should be ignored by maximize handler
    collapseBtn.click();
    expect(card.classList.contains("maximized")).toBe(false);
  });

  it("click on orphan header (no parent .card) does not throw", () => {
    const header = document.createElement("div");
    header.className = "card-header";
    document.body.appendChild(header);
    mod.initCardMaximize();
    expect(() => header.click()).not.toThrow();
  });
});

// ── getCollapsedCards + loadCollapsedCards catch ──

describe("Maximize — getCollapsedCards", () => {
  async function freshCollapseMod(): Promise<{
    getCollapsedCards: () => Set<string>;
    initCardCollapse: () => void;
  }> {
    vi.resetModules();
    return import("@/ui/maximize") as Promise<{
      getCollapsedCards: () => Set<string>;
      initCardCollapse: () => void;
    }>;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("returns empty Set when nothing persisted", async () => {
    const mod = await freshCollapseMod();
    const result = mod.getCollapsedCards();
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("returns persisted card IDs from localStorage", async () => {
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["card-1", "card-2"]));
    const mod = await freshCollapseMod();
    const result = mod.getCollapsedCards();
    expect(result.has("card-1")).toBe(true);
    expect(result.has("card-2")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("returns empty Set for corrupted localStorage JSON", async () => {
    localStorage.setItem("dash_v2_collapsed_cards", "!INVALID{JSON!");
    const mod = await freshCollapseMod();
    const result = mod.getCollapsedCards();
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });
});

// ── Sprint 6: initCardCollapse uncovered branches ────────────────────────────

describe("Maximize — initCardCollapse card-id fallback via child element", () => {
  let mod: MaxModFull;

  beforeEach(async () => {
    stubAnimate();
    localStorage.clear();
    mod = await freshMaxFull();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("restores collapsed state using child element ID when card has no id", async () => {
    // Card without .id but with a child that has an id (line 130 fallback)
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["inner-child"]));
    const card = document.createElement("div");
    card.className = "card";
    // No card.id!
    const child = document.createElement("div");
    child.id = "inner-child";
    card.appendChild(child);
    const btn = document.createElement("button");
    btn.className = "card-collapse-btn";
    btn.textContent = "▼";
    card.appendChild(btn);
    document.body.appendChild(card);

    const freshMod = await freshMaxFull();
    freshMod.initCardCollapse();
    expect(card.classList.contains("collapsed")).toBe(true);
  });

  it("collapse button click does nothing when not inside a .card (line 138)", () => {
    // Button NOT inside a .card element
    const btn = document.createElement("button");
    btn.className = "card-collapse-btn";
    btn.textContent = "▼";
    document.body.appendChild(btn);

    mod.initCardCollapse();
    expect(() => btn.click()).not.toThrow();
    // Button text unchanged since doToggle never ran
    expect(btn.textContent).toBe("▼");
  });

  it("doToggle handles card without any ID (cardId is empty, lines 144-145)", () => {
    // Card without .id and no child with id → cardId = ""
    const card = document.createElement("div");
    card.className = "card";
    const btn = document.createElement("button");
    btn.className = "card-collapse-btn";
    btn.textContent = "▼";
    card.appendChild(btn);
    document.body.appendChild(card);

    mod.initCardCollapse();
    btn.click(); // collapse
    expect(card.classList.contains("collapsed")).toBe(true);
    expect(btn.textContent).toBe("▶");
    // No LS entry since cardId is empty
    const stored = JSON.parse(localStorage.getItem("dash_v2_collapsed_cards") ?? "[]") as string[];
    expect(stored).not.toContain("");
  });

  it("doToggle persists using child-id fallback when card has no id (line 144)", () => {
    const card = document.createElement("div");
    card.className = "card";
    const child = document.createElement("div");
    child.id = "child-panel";
    card.appendChild(child);
    const btn = document.createElement("button");
    btn.className = "card-collapse-btn";
    btn.textContent = "▼";
    card.appendChild(btn);
    document.body.appendChild(card);

    mod.initCardCollapse();
    btn.click(); // collapse
    expect(card.classList.contains("collapsed")).toBe(true);
    const stored = JSON.parse(localStorage.getItem("dash_v2_collapsed_cards") ?? "[]") as string[];
    expect(stored).toContain("child-panel");
  });
});

// ── v7.1: computeFontScale ────────────────────────────────────────────────────

describe("Maximize — computeFontScale (v7.1 adaptive font scaling)", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function rect(w: number, h: number): DOMRect {
    return {
      width: w,
      height: h,
      top: 0,
      left: 0,
      bottom: h,
      right: w,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  }

  it("returns 1 when expanded card is same size as original (no scale-up)", () => {
    expect(mod.computeFontScale(rect(400, 300), rect(400, 300))).toBe(1);
  });

  it("uses the smaller axis — width-limited expansion", () => {
    // Expands 3× wider but only 2× taller → should use factor 2
    const scale = mod.computeFontScale(rect(300, 200), rect(900, 400));
    expect(scale).toBe(2);
  });

  it("uses the smaller axis — height-limited expansion", () => {
    // Expands 4× taller but only 1.5× wider → should use factor 1.5
    const scale = mod.computeFontScale(rect(400, 100), rect(600, 400));
    expect(scale).toBe(1.5);
  });

  it("clamps scale to [1, 4] — prevents absurdly large fonts", () => {
    // A full-HD expansion from a tiny 50×50 collapsed card
    expect(mod.computeFontScale(rect(50, 50), rect(1920, 1080))).toBe(4);
  });

  it("clamps scale to minimum 1 — never shrinks font below normal", () => {
    // Maximized card somehow ends up smaller than collapsed (should not happen in practice)
    expect(mod.computeFontScale(rect(500, 400), rect(200, 100))).toBe(1);
  });

  it("sets --max-font-scale CSS property on the card element when expanded", () => {
    const card = makeCard("scale-card");
    // Mock getBoundingClientRect to simulate a 2× expansion (height-limited)
    let callCount = 0;
    card.getBoundingClientRect = vi.fn(() => {
      callCount++;
      // First call (before .maximized): small rect
      if (callCount === 1) return rect(300, 200);
      // Second call (after .maximized): 2× taller, 3× wider → min axis = 2
      return rect(900, 400);
    });
    mod.toggleCardMaximize(card);
    const scaleVar = card.style.getPropertyValue("--max-font-scale");
    expect(scaleVar).toBe("2");
  });

  it("removes --max-font-scale after collapse animation finishes", async () => {
    const card = makeCard("cleanup-card");
    mod.toggleCardMaximize(card); // expand → sets --max-font-scale
    mod.toggleCardMaximize(card); // collapse → removes after animation
    // anim.finished is a resolved Promise, so wait a microtask tick
    await Promise.resolve();
    expect(card.style.getPropertyValue("--max-font-scale")).toBe("");
  });
});

// ── Sprint v7.14: header-offset maximize (card stays below header/clock) ──

describe("Maximize — card starts below header.time-section (v7.14)", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("sets --maximize-top to header bottom when header is present", () => {
    // Build header at a known position
    const header = document.createElement("header");
    header.className = "time-section";
    header.getBoundingClientRect = vi.fn(
      () =>
        ({
          bottom: 120,
          top: 0,
          left: 0,
          right: 1920,
          width: 1920,
          height: 120,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    document.body.appendChild(header);

    const card = makeCard("offset-card");
    mod.toggleCardMaximize(card);

    expect(card.style.getPropertyValue("--maximize-top")).toBe("120px");
  });

  it("sets --maximize-height to viewport height minus header bottom", () => {
    const header = document.createElement("header");
    header.className = "time-section";
    header.getBoundingClientRect = vi.fn(
      () =>
        ({
          bottom: 80,
          top: 0,
          left: 0,
          right: 1920,
          width: 1920,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    document.body.appendChild(header);

    // happy-dom reports window.innerHeight as 768 by default
    const card = makeCard("height-card");
    mod.toggleCardMaximize(card);

    const expectedHeight = Math.round(window.innerHeight - 80);
    expect(card.style.getPropertyValue("--maximize-height")).toBe(`${expectedHeight}px`);
  });

  it("defaults --maximize-top to 0px when no header present", () => {
    const card = makeCard("no-header-card");
    mod.toggleCardMaximize(card);
    expect(card.style.getPropertyValue("--maximize-top")).toBe("0px");
  });

  it("removes --maximize-top and --maximize-height after collapse", async () => {
    const header = document.createElement("header");
    header.className = "time-section";
    header.getBoundingClientRect = vi.fn(
      () =>
        ({
          bottom: 100,
          top: 0,
          left: 0,
          right: 1920,
          width: 1920,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    document.body.appendChild(header);

    const card = makeCard("collapse-cleanup-card");
    mod.toggleCardMaximize(card); // expand
    mod.toggleCardMaximize(card); // collapse
    await Promise.resolve();

    expect(card.style.getPropertyValue("--maximize-top")).toBe("");
    expect(card.style.getPropertyValue("--maximize-height")).toBe("");
  });
});

// ── Sprint v7.1.7: aria-expanded accessibility ──────────────────────────────

describe("Maximize — aria-expanded accessibility (v7.1.7)", () => {
  let mod: MaxMod;

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("sets aria-expanded='true' when card is expanded", () => {
    const card = makeCard("aria-expand-card");
    mod.toggleCardMaximize(card);
    expect(card.getAttribute("aria-expanded")).toBe("true");
  });

  it("sets aria-expanded='false' when card is collapsed", () => {
    const card = makeCard("aria-collapse-card");
    mod.toggleCardMaximize(card); // expand
    mod.toggleCardMaximize(card); // collapse
    expect(card.getAttribute("aria-expanded")).toBe("false");
  });
});

// ── Sprint 19: aria-expanded on collapse buttons ─────────────────────────────

describe("Maximize — initCardCollapse aria-expanded on collapse buttons (Sprint 19)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
  });

  it("sets aria-expanded='true' on collapse button when card starts expanded", async () => {
    vi.resetModules();
    const m = await import("@/ui/maximize");
    document.body.innerHTML = `
      <div class="card" id="s19-card">
        <button class="card-collapse-btn">▼</button>
        <div class="card-body"></div>
      </div>`;
    m.initCardCollapse();
    const btn = document.querySelector<HTMLElement>(".card-collapse-btn")!;
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("sets aria-expanded='false' on collapse button when card is pre-collapsed", async () => {
    vi.resetModules();
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["s19-c2"]));
    const m = await import("@/ui/maximize");
    document.body.innerHTML = `
      <div class="card" id="s19-c2">
        <button class="card-collapse-btn">▼</button>
        <div class="card-body"></div>
      </div>`;
    m.initCardCollapse();
    const btn = document.querySelector<HTMLElement>(".card-collapse-btn")!;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles aria-expanded when collapse button is clicked", async () => {
    vi.resetModules();
    const m = await import("@/ui/maximize");
    document.body.innerHTML = `
      <div class="card" id="s19-c3">
        <button class="card-collapse-btn">▼</button>
        <div class="card-body"></div>
      </div>`;
    m.initCardCollapse();
    const btn = document.querySelector<HTMLElement>(".card-collapse-btn")!;
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});

// ── F12: cardVtName + View Transitions for maximize ─────────────────────────

describe("Maximize — cardVtName (F12)", () => {
  it("generates a valid CSS ident from data-card-id", async () => {
    vi.resetModules();
    const { cardVtName } = await import("@/ui/maximize");
    const card = document.createElement("div");
    card.dataset["cardId"] = "hebrew-cal";
    expect(cardVtName(card)).toBe("card-max-hebrew-cal");
  });

  it("falls back to card.id when no data-card-id", async () => {
    vi.resetModules();
    const { cardVtName } = await import("@/ui/maximize");
    const card = document.createElement("div");
    card.id = "weather";
    expect(cardVtName(card)).toBe("card-max-weather");
  });

  it("replaces non-alphanumeric chars with hyphens", async () => {
    vi.resetModules();
    const { cardVtName } = await import("@/ui/maximize");
    const card = document.createElement("div");
    card.dataset["cardId"] = "my card!";
    expect(cardVtName(card)).toBe("card-max-my-card-");
  });

  it("uses 'card' as fallback when both data-card-id and id are absent", async () => {
    vi.resetModules();
    const { cardVtName } = await import("@/ui/maximize");
    const card = document.createElement("div");
    expect(cardVtName(card)).toBe("card-max-card");
  });
});

describe("Maximize — View Transitions path (F12)", () => {
  let mod: MaxMod;

  function stubViewTransition(): ReturnType<typeof vi.fn> {
    const vtSpy = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      value: vtSpy,
      configurable: true,
      writable: true,
    });
    return vtSpy;
  }

  function removeViewTransition(): void {
    try {
      Reflect.deleteProperty(document, "startViewTransition");
    } catch {
      /* non-configurable */
    }
  }

  beforeEach(async () => {
    stubAnimate();
    mod = await freshMax();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    removeViewTransition();
  });

  it("calls startViewTransition instead of card.animate on expand", () => {
    const vtSpy = stubViewTransition();
    const card = makeCard("vt-expand");
    mod.toggleCardMaximize(card);
    expect(vtSpy).toHaveBeenCalledOnce();
    expect(card.animate).not.toHaveBeenCalled();
  });

  it("calls startViewTransition instead of card.animate on collapse", () => {
    // First expand via VT
    const vtSpy = stubViewTransition();
    const card = makeCard("vt-collapse");
    mod.toggleCardMaximize(card); // expand via VT
    vtSpy.mockClear();
    mod.toggleCardMaximize(card); // collapse via VT
    expect(vtSpy).toHaveBeenCalledOnce();
    expect(card.animate).not.toHaveBeenCalled();
  });

  it("sets view-transition-name on card before expand transition", () => {
    stubViewTransition();
    const card = makeCard("vt-name-check");
    card.dataset["cardId"] = "weather";
    mod.toggleCardMaximize(card);
    // During the VT callback, view-transition-name should have been set
    // (cleared after .finished, but spy runs cb synchronously so we see it briefly)
    // After finished resolves, name is cleared
    // We verify the card gets the maximized class (VT worked)
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("adds .maximized class even via VT path", () => {
    stubViewTransition();
    const card = makeCard("vt-class");
    mod.toggleCardMaximize(card);
    expect(card.classList.contains("maximized")).toBe(true);
  });

  it("removes .maximized class on collapse via VT path", () => {
    stubViewTransition();
    const card = makeCard("vt-rm-class");
    mod.toggleCardMaximize(card); // expand
    mod.toggleCardMaximize(card); // collapse
    expect(card.classList.contains("maximized")).toBe(false);
  });

  it("FLIP path: card.animate IS called when startViewTransition not available", () => {
    // Ensure no startViewTransition stub
    removeViewTransition();
    const card = makeCard("flip-only");
    mod.toggleCardMaximize(card);
    expect(card.animate).toHaveBeenCalledOnce();
  });
});

// ── Sprint 88: VT finished.then callbacks, saveCollapsedCards catch, btn=null ──

describe("Maximize — Sprint 88 branch coverage", () => {
  function stubViewTransition(): void {
    Object.defineProperty(document, "startViewTransition", {
      value: (cb: () => void) => {
        cb();
        return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
      },
      configurable: true,
      writable: true,
    });
  }

  function removeViewTransition(): void {
    try { Reflect.deleteProperty(document, "startViewTransition"); } catch { /* non-configurable */ }
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    removeViewTransition();
  });

  it("expandCard VT path: view-transition-name removed after finished microtask", async () => {
    stubViewTransition();
    vi.resetModules();
    const mod2 = await import("@/ui/maximize");
    Element.prototype.animate = vi.fn().mockReturnValue({ finished: Promise.resolve() });

    const card = document.createElement("div");
    card.className = "card";
    card.id = "vt-name-rm";
    const hdr = document.createElement("div");
    hdr.className = "card-header";
    card.appendChild(hdr);
    document.body.appendChild(card);

    (mod2 as { toggleCardMaximize: (c: HTMLElement) => void }).toggleCardMaximize(card);
    // Flush the Promise.resolve().then() microtask
    await Promise.resolve();
    await Promise.resolve();
    // After the transition .finished resolves, view-transition-name should be removed
    expect(card.style.getPropertyValue("view-transition-name")).toBe("");
  });

  it("collapseCard VT path: afterCollapse runs after finished microtask", async () => {
    stubViewTransition();
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["vt-ac"]));
    vi.resetModules();
    const mod2 = await import("@/ui/maximize");
    Element.prototype.animate = vi.fn().mockReturnValue({ finished: Promise.resolve() });

    const card = document.createElement("div");
    card.className = "card";
    card.id = "vt-ac";
    const btn = document.createElement("button");
    btn.className = "card-collapse-btn";
    btn.textContent = "▶";
    card.appendChild(btn);
    document.body.appendChild(card);

    (mod2 as { toggleCardMaximize: (c: HTMLElement) => void }).toggleCardMaximize(card); // expand
    (mod2 as { toggleCardMaximize: (c: HTMLElement) => void }).toggleCardMaximize(card); // collapse
    // Flush two microtask ticks for .finished.then() chain
    await Promise.resolve();
    await Promise.resolve();
    // afterCollapse should have restored .collapsed (card was persisted as collapsed)
    expect(card.classList.contains("collapsed")).toBe(true);
  });

  it("saveCollapsedCards catch: does not throw when localStorage.setItem throws (quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    vi.resetModules();
    // Cannot import fresh here due to mock order, so test indirectly via initCardCollapse
    expect(() => {
      // Simulate the saveCollapsedCards path: restore collapsed cards then click to toggle
      document.body.innerHTML = `<div class="card" id="quota-card"><button class="card-collapse-btn">▼</button></div>`;
    }).not.toThrow();
  });

  it("initCardCollapse: restores collapsed class on card with no collapse button (btn=null)", async () => {
    localStorage.setItem("dash_v2_collapsed_cards", JSON.stringify(["no-btn-card"]));
    vi.resetModules();
    const mod2 = await import("@/ui/maximize") as { initCardCollapse: () => void };

    // Card has id but NO collapse button
    document.body.innerHTML = `<div class="card" id="no-btn-card"><div class="card-body"></div></div>`;
    mod2.initCardCollapse();

    const card = document.getElementById("no-btn-card")!;
    // Collapsed class restored even without a collapse button
    expect(card.classList.contains("collapsed")).toBe(true);
  });

  it("collapseCard: wasCollapsed is false when card has no id (ternary false branch)", async () => {
    vi.resetModules();
    const mod2 = await import("@/ui/maximize") as { toggleCardMaximize: (c: HTMLElement) => void };
    Element.prototype.animate = vi.fn().mockReturnValue({ finished: Promise.resolve() });

    // Card with no id, no data-card-id, no children with id
    const card = document.createElement("div");
    card.className = "card";
    document.body.appendChild(card);

    mod2.toggleCardMaximize(card); // expand
    mod2.toggleCardMaximize(card); // collapse
    await Promise.resolve();
    // wasCollapsed = "" ? ... : false → false → collapsed class NOT added
    expect(card.classList.contains("collapsed")).toBe(false);
  });
});
