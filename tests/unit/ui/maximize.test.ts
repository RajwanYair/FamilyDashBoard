/**
 * Tests for src/ui/maximize.ts
 *
 * Covers: getMaximizedCard, toggleCardMaximize (expand/collapse/swap),
 * initCardMaximize (wires header click listeners).
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
  initCardMaximize: () => void;
};

async function freshMax(): Promise<MaxMod> {
  vi.resetModules();
  return import("@/ui/maximize") as Promise<MaxMod>;
}

/** Stub Element.animate so FLIP doesn't throw in happy-dom */
function stubAnimate(): void {
  Element.prototype.animate = vi
    .fn()
    .mockReturnValue({ finished: Promise.resolve() });
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
    const stored = JSON.parse(
      localStorage.getItem("dash_v2_collapsed_cards") ?? "[]",
    ) as string[];
    expect(stored).toContain("cc-3");
  });

  it("restores collapsed state from localStorage on init", async () => {
    localStorage.setItem(
      "dash_v2_collapsed_cards",
      JSON.stringify(["cc-restore"]),
    );
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
        // @ts-expect-error reset to undefined
        delete document.startViewTransition;
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
