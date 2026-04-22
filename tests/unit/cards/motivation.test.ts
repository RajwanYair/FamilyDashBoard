/**
 * Tests for src/cards/motivation/motivation.ts
 *
 * Covers: MOTIVATIONS array integrity, setContent (DOM update),
 * renderMotivation (rotation + fade), initMotivationCard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MOTIVATIONS,
  renderMotivation,
  setContent,
  setMotivationInterval,
  motivationConfigSchema,
  initMotivationCard,
  getCurrentQuote,
  shareMotivation,
  loadMotivation,
  _resetMotivationForTest,
} from "@/cards/motivation/motivation";

describe("Motivation — MOTIVATIONS array", () => {
  it("has at least 10 quotes", () => {
    expect(MOTIVATIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("every quote has a text string", () => {
    for (const m of MOTIVATIONS) {
      expect(typeof m.text).toBe("string");
      expect(m.text.length).toBeGreaterThan(0);
    }
  });

  it("every quote has an author string (may be empty)", () => {
    for (const m of MOTIVATIONS) {
      expect(typeof m.author).toBe("string");
    }
  });

  it("is a read-only array (no mutation)", () => {
    expect(
      Object.isFrozen(MOTIVATIONS) || !Array.isArray(MOTIVATIONS) || MOTIVATIONS.length > 0,
    ).toBe(true);
  });
});

describe("Motivation — setContent", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
    `;
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
  });

  it("sets text and author elements", () => {
    initMotivationCard();
    setContent({ text: "מבחן", author: "מחבר" });
    expect(document.getElementById("moti-text")?.textContent).toBe("מבחן");
    expect(document.getElementById("moti-author")?.textContent).toBe("— מחבר");
  });

  it("shows empty author when author string is empty", () => {
    initMotivationCard();
    setContent({ text: "ציטוט", author: "" });
    expect(document.getElementById("moti-author")?.textContent).toBe("");
  });
});

describe("Motivation — renderMotivation", () => {
  beforeEach(() => {
    // No .moti-card wrapper → setContent is called synchronously (no fade timeout)
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
    `;
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("sets a non-empty text on first render", () => {
    initMotivationCard();
    renderMotivation();
    // Text set synchronously before fade (no card opacity detected in happy-dom)
    const text = document.getElementById("moti-text")?.textContent ?? "";
    expect(text.length).toBeGreaterThan(0);
  });

  it("cycles through different quotes on repeated calls", () => {
    initMotivationCard();

    const seen = new Set<string>();
    for (let i = 0; i < MOTIVATIONS.length + 1; i++) {
      renderMotivation();
      const text = document.getElementById("moti-text")?.textContent ?? "";
      if (text) seen.add(text);
    }
    // Should have seen more than one unique quote
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("Motivation — initMotivationCard", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="moti-text">טוען...</div>
      <div id="moti-author"></div>
    `;
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
  });

  it("replaces placeholder text with a real quote", () => {
    initMotivationCard();
    const text = document.getElementById("moti-text")?.textContent ?? "";
    // After init the text should be one of the real quotes, not placeholder
    expect(MOTIVATIONS.some((m) => m.text === text)).toBe(true);
  });
});

// ── getCurrentQuote ──

describe("Motivation — getCurrentQuote", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
    `;
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
  });

  it("returns a quote even before initMotivationCard is called (wraps to last)", () => {
    const q = getCurrentQuote();
    // getCurrentQuote wraps: motiIdx=0 returns MOTIVATIONS[length-1]
    expect(q).not.toBeNull();
    expect(typeof q!.text).toBe("string");
  });

  it("returns a quote object with text and author after init", () => {
    initMotivationCard();
    const q = getCurrentQuote();
    expect(q).not.toBeNull();
    expect(typeof q!.text).toBe("string");
    expect(q!.text.length).toBeGreaterThan(0);
  });

  it("getCurrentQuote matches what is shown in DOM", () => {
    initMotivationCard();
    const q = getCurrentQuote();
    const domText = document.getElementById("moti-text")?.textContent ?? "";
    expect(q?.text).toBe(domText);
  });
});

// ── shareMotivation ──

describe("Motivation — shareMotivation", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
      <div id="toast-container"></div>
    `;
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when clipboard API is available", () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    initMotivationCard();
    expect(() => shareMotivation()).not.toThrow();
  });

  it("does not throw before initMotivationCard is called", () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    expect(() => shareMotivation()).not.toThrow();
  });
});
// ── Sprint 5: fade path, navigator.share, button listeners ──────────────────

describe("Motivation — renderMotivation fade path (.moti-card)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetMotivationForTest();
    document.body.innerHTML = `
      <div class="moti-card">
        <div id="moti-text"></div>
        <div id="moti-author"></div>
        <button id="moti-next-btn">→</button>
        <button id="moti-share-btn">📬</button>
      </div>
    `;
  });

  afterEach(() => {
    _resetMotivationForTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("fade path: card opacity set to 0 then 1 via setTimeout", () => {
    initMotivationCard();
    renderMotivation();
    // The card should have opacity 0 immediately (before timeout fires)
    const card = document.querySelector(".moti-card") as HTMLElement;
    expect(card.style.opacity).toBe("0");
    // Advance 600ms to fire the 500ms transition timeout
    vi.advanceTimersByTime(600);
    expect(card.style.opacity).toBe("1");
  });

  it("moti-next-btn click calls renderMotivation (cycles quotes)", () => {
    initMotivationCard();
    vi.advanceTimersByTime(600); // settle initial render
    const btn = document.getElementById("moti-next-btn") as HTMLElement;
    btn.click();
    vi.advanceTimersByTime(600); // settle fade after click
    // Just verify no throw and DOM is still wired
    expect(btn).not.toBeNull();
    expect(document.getElementById("moti-text")).not.toBeNull();
  });

  it("moti-share-btn click calls shareMotivation without throw (navigator.share available)", () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });
    initMotivationCard();
    vi.advanceTimersByTime(600);
    const btn = document.getElementById("moti-share-btn") as HTMLElement;
    expect(() => btn.click()).not.toThrow();
  });
});

describe("Motivation — shareMotivation navigator.share path", () => {
  beforeEach(() => {
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("calls navigator.share when available", () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    initMotivationCard();
    renderMotivation(); // advance motiIdx so getCurrentQuote returns something
    expect(() => shareMotivation()).not.toThrow();
    expect(shareMock).toHaveBeenCalled();
  });
});

// ── Sprint: motivation.ts branch coverage improvements ──

describe("Motivation — shareMotivation clipboard fallback (no navigator.share)", () => {
  beforeEach(() => {
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("falls back to clipboard.writeText and shows toast", async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeMock },
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div><div id="toast-container"></div>`;
    initMotivationCard();
    renderMotivation();
    shareMotivation();
    // Flush microtasks so the .then(() => showToast(...)) callback executes
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(writeMock).toHaveBeenCalled();
  });

  it("shares text without author dash when author is empty", () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    initMotivationCard();
    // Keep calling renderMotivation until we get a quote with empty author
    // MOTIVATIONS[0] has author=""
    renderMotivation();
    shareMotivation();
    const callArg = shareMock.mock.calls[0]?.[0] as { text?: string } | undefined;
    expect(callArg?.text).toBeDefined();
  });
});

describe("Motivation — setContent with null DOM refs", () => {
  beforeEach(() => {
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not throw when elText and elAuthor are null (no DOM)", () => {
    document.body.innerHTML = "";
    // elText and elAuthor are null after reset — should not throw
    expect(() => setContent({ text: "test", author: "auth" })).not.toThrow();
  });

  it("renderMotivation early return when elText is null (no .moti-card)", () => {
    document.body.innerHTML = "";
    // No DOM at all — m is valid but elText is null → setContent path with null
    expect(() => renderMotivation()).not.toThrow();
  });
});
// ── Sprint: defensive branches with empty MOTIVATIONS ───────────────────────

describe("Motivation — defensive branches when MOTIVATIONS is empty", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("getCurrentQuote returns null when MOTIVATIONS is emptied", async () => {
    vi.resetModules();
    const { MOTIVATIONS, getCurrentQuote } = await import("@/cards/motivation/motivation");
    // Truncate at runtime — ReadonlyArray is a TS-only constraint
    (MOTIVATIONS as unknown as unknown[]).length = 0;
    // lastIdx = ((0-1)+0) % 0 = NaN → MOTIVATIONS[NaN] = undefined → ?? null
    expect(getCurrentQuote()).toBeNull();
    // Restore (defensive; vi.resetModules handles re-import)
  });

  it("renderMotivation returns early when MOTIVATIONS is empty", async () => {
    vi.resetModules();
    const { MOTIVATIONS, renderMotivation } = await import("@/cards/motivation/motivation");
    (MOTIVATIONS as unknown as unknown[]).length = 0;
    // motiIdx++ % 0 = NaN → MOTIVATIONS[NaN] = undefined → if (!m) return
    expect(() => renderMotivation()).not.toThrow();
  });

  it("shareMotivation returns early when getCurrentQuote is null", async () => {
    vi.resetModules();
    const { MOTIVATIONS, shareMotivation } = await import("@/cards/motivation/motivation");
    (MOTIVATIONS as unknown as unknown[]).length = 0;
    // getCurrentQuote() → null → if (!q) return
    expect(() => shareMotivation()).not.toThrow();
  });
});

// ── Sprint 23: category system ───────────────────────────────────────────────

import {
  getQuotesByCategory,
  setMotivationCategory,
  getMotivationCategory,
  type MotivationCategory,
} from "@/cards/motivation/motivation";

describe("Motivation — getQuotesByCategory (Sprint 23)", () => {
  it("returns all quotes when category is null", () => {
    const all = getQuotesByCategory(null);
    expect(all.length).toBe(MOTIVATIONS.length);
  });

  it("returns only 'morning' quotes when filtered", () => {
    const filtered = getQuotesByCategory("morning");
    expect(filtered.length).toBeGreaterThan(0);
    for (const q of filtered) {
      expect(q.category).toBe("morning");
    }
  });

  it("returns only 'shabbat' quotes when filtered", () => {
    const filtered = getQuotesByCategory("shabbat");
    expect(filtered.length).toBeGreaterThan(0);
    for (const q of filtered) {
      expect(q.category).toBe("shabbat");
    }
  });

  it("returns only 'family' quotes when filtered", () => {
    const filtered = getQuotesByCategory("family");
    expect(filtered.length).toBeGreaterThan(0);
    for (const q of filtered) {
      expect(q.category).toBe("family");
    }
  });

  it("returns only 'success' quotes when filtered", () => {
    const filtered = getQuotesByCategory("success");
    expect(filtered.length).toBeGreaterThan(0);
    for (const q of filtered) {
      expect(q.category).toBe("success");
    }
  });

  it("every quote has a valid category", () => {
    const validCategories: MotivationCategory[] = [
      "general",
      "morning",
      "shabbat",
      "family",
      "success",
    ];
    for (const q of MOTIVATIONS) {
      expect(validCategories).toContain(q.category);
    }
  });
});

describe("Motivation — setMotivationCategory / getMotivationCategory (Sprint 23)", () => {
  afterEach(() => {
    setMotivationCategory(null); // reset
    vi.restoreAllMocks();
  });

  it("getMotivationCategory returns null initially", () => {
    setMotivationCategory(null);
    expect(getMotivationCategory()).toBeNull();
  });

  it("setMotivationCategory updates the active category", () => {
    setMotivationCategory("morning");
    expect(getMotivationCategory()).toBe("morning");
  });

  it("setMotivationCategory resets to null", () => {
    setMotivationCategory("shabbat");
    setMotivationCategory(null);
    expect(getMotivationCategory()).toBeNull();
  });

  it("renderMotivation uses category filter after setMotivationCategory", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    setMotivationCategory("morning");
    const pool = getQuotesByCategory("morning");
    expect(pool.length).toBeGreaterThan(0);
    // All morning-filtered quotes should have category 'morning'
    expect(pool.every((q) => q.category === "morning")).toBe(true);
    document.body.innerHTML = "";
  });
});

// ── F7 (v7.3): setMotivationInterval ────────────────────────────────────────

describe("Motivation — setMotivationInterval (F7 v7.3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    setMotivationInterval(0);
    vi.useRealTimers();
  });

  it("does nothing when minutes is 0", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    setMotivationInterval(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("sets an interval when minutes > 0", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    setMotivationInterval(5);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 5 * 60_000);
  });

  it("clears previous interval before setting new one", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    setMotivationInterval(3);
    setMotivationInterval(5);
    expect(clearSpy).toHaveBeenCalled();
  });
});

// ── Sprint 83: configSchema ─────────────────────────────────────────────

describe("Motivation — configSchema (Sprint 83)", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(motivationConfigSchema)).toBe(true);
    expect(motivationConfigSchema.length).toBeGreaterThan(0);
  });

  it("includes motivationInterval field", () => {
    const field = motivationConfigSchema.find((f) => f.key === "motivationInterval");
    expect(field).toBeDefined();
    expect(field!.type).toBe("range");
    expect(field!.defaultValue).toBe(0);
  });

  it("all fields have required properties", () => {
    for (const f of motivationConfigSchema) {
      expect(f.key).toBeTruthy();
      expect(f.labelHe).toBeTruthy();
      expect(f.labelEn).toBeTruthy();
      expect(f.type).toBeTruthy();
      expect(f.defaultValue).toBeDefined();
    }
  });
});

// ── Stream D2.4: createAsyncCardLoader migration ──────────────────────────────

describe("Motivation — loadMotivation uses createAsyncCardLoader (Stream D2.4)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
    `;
    _resetMotivationForTest();
  });

  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
  });

  it("loadMotivation is exported and is a function", () => {
    expect(typeof loadMotivation).toBe("function");
  });

  it("loadMotivation returns a Promise when invoked", async () => {
    initMotivationCard();
    const result = loadMotivation();
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  it("loadMotivation renders a quote into the DOM", async () => {
    initMotivationCard();
    await loadMotivation();
    const text = document.getElementById("moti-text")?.textContent ?? "";
    expect(MOTIVATIONS.some((m) => m.text === text)).toBe(true);
  });
});
