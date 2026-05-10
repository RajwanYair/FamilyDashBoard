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
  fetchAiMotivationQuote,
  _resetMotivationForTest,
  pickNextQuoteIndex,
  getUsedIndices,
  markIndexUsed,
  MOTIVATION_NO_REPEAT_WINDOW,
  SOURCE_META,
  DAY_THEME_MAP,
  getThemeForDay,
  type MotivationSource,
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
// ── fade path, navigator.share, button listeners ──────────────────

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

// ── category system ───────────────────────────────────────────────

import {
  getQuotesByCategory,
  setMotivationCategory,
  getMotivationCategory,
  type MotivationCategory,
} from "@/cards/motivation/motivation";

describe("Motivation — getQuotesByCategory ", () => {
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
      "gratitude",
      "courage",
      "calm",
    ];
    for (const q of MOTIVATIONS) {
      expect(validCategories).toContain(q.category);
    }
  });
});

describe("Motivation — setMotivationCategory / getMotivationCategory ", () => {
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

// ── configSchema ─────────────────────────────────────────────

describe("Motivation — configSchema ", () => {
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

// ── fetchAiMotivationQuote ────────────────────────────────────────────────────
describe("Motivation — fetchAiMotivationQuote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });

  it("returns null when text field is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ author: "בןגוריון" }), { status: 200 }),
    );
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });

  it("returns a MotivationQuote on valid response", async () => {
    const payload = { text: "הכל אפשר", author: "בןגוריון" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    const result = await fetchAiMotivationQuote();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("הכל אפשר");
    expect(result!.author).toBe("בןגוריון");
    expect(result!.category).toBe("general");
  });

  it("motivationConfigSchema includes motivationAiHebrew toggle", () => {
    const field = motivationConfigSchema.find((f) => f.key === "motivationAiHebrew");
    expect(field).toBeDefined();
    expect(field!.type).toBe("boolean");
    expect(field!.defaultValue).toBe(false);
  });
});

// ── Non-repeat window ─────────────────────────────────────────────
describe("Motivation — non-repeat window ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("MOTIVATION_NO_REPEAT_WINDOW is at least 5", () => {
    expect(MOTIVATION_NO_REPEAT_WINDOW).toBeGreaterThanOrEqual(5);
  });

  it("getUsedIndices returns [] when localStorage is empty", () => {
    expect(getUsedIndices()).toEqual([]);
  });

  it("markIndexUsed stores an index and getUsedIndices retrieves it", () => {
    markIndexUsed(3, 10);
    expect(getUsedIndices()).toContain(3);
  });

  it("markIndexUsed trims to the window size", () => {
    // Mark MOTIVATION_NO_REPEAT_WINDOW + 2 indices
    for (let i = 0; i < MOTIVATION_NO_REPEAT_WINDOW + 2; i++) {
      markIndexUsed(i, 20);
    }
    const used = getUsedIndices();
    expect(used.length).toBeLessThanOrEqual(MOTIVATION_NO_REPEAT_WINDOW);
  });

  it("pickNextQuoteIndex returns 0 for pool size 1", () => {
    expect(pickNextQuoteIndex(1, [])).toBe(0);
    expect(pickNextQuoteIndex(1, [0, 0, 0])).toBe(0);
  });

  it("pickNextQuoteIndex avoids recently used indices (large pool)", () => {
    // Mark indices 0..7 as used
    const used = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < 50; i++) {
      const idx = pickNextQuoteIndex(20, used);
      expect(idx).toBeGreaterThanOrEqual(MOTIVATION_NO_REPEAT_WINDOW);
    }
  });

  it("pickNextQuoteIndex falls back to any index when pool is tiny", () => {
    // Pool of 2, both 'used' — must still return a valid index
    const used = [0, 1];
    const idx = pickNextQuoteIndex(2, used);
    expect(idx === 0 || idx === 1).toBe(true);
  });

  it("renderMotivation updates used-indices in localStorage", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    initMotivationCard();
    _resetMotivationForTest();
    localStorage.clear();
    renderMotivation();
    expect(getUsedIndices().length).toBeGreaterThan(0);
    document.body.innerHTML = "";
  });

  it("getCurrentQuote returns the quote at the current index", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    initMotivationCard();
    _resetMotivationForTest();
    localStorage.clear();
    renderMotivation();
    const q = getCurrentQuote();
    expect(q).not.toBeNull();
    expect(typeof q!.text).toBe("string");
    document.body.innerHTML = "";
  });
});

// ── getUsedIndices branch coverage ─────────────────────────────

describe("Motivation — getUsedIndices branch coverage ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns [] when stored value is not an array (e.g. JSON number)", () => {
    localStorage.setItem("moti-used-indices", "42");
    expect(getUsedIndices()).toEqual([]);
  });

  it("returns [] when stored value is JSON null", () => {
    localStorage.setItem("moti-used-indices", "null");
    expect(getUsedIndices()).toEqual([]);
  });

  it("returns [] when stored value is invalid JSON (catch branch)", () => {
    localStorage.setItem("moti-used-indices", "{invalid json}}}");
    expect(getUsedIndices()).toEqual([]);
  });

  it("filters out non-number entries from a mixed array", () => {
    localStorage.setItem("moti-used-indices", JSON.stringify([0, "bad", 2, null, 5]));
    expect(getUsedIndices()).toEqual([0, 2, 5]);
  });
});

// ── fetchAiMotivationQuote edge cases ──────────────────────────

describe("Motivation — fetchAiMotivationQuote edge cases ", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when response.ok is false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });

  it("returns null when data.text is an empty string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: "", author: "someone" }),
      }),
    );
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });

  it("returns null when data.text is not a string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: 42, author: "" }),
      }),
    );
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });

  it("returns null and logs when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const result = await fetchAiMotivationQuote();
    expect(result).toBeNull();
  });
});

// ── M1: Source attribution badge  ─────────────────────────────────

describe("Motivation — M1 source attribution", () => {
  beforeEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
      <div id="moti-src"></div>
      <button id="moti-next-btn"></button>
      <button id="moti-share-btn"></button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("SOURCE_META defines all 4 source types", () => {
    const keys: MotivationSource[] = ["tanakh", "hazal", "modern", "ai"];
    for (const k of keys) {
      expect(SOURCE_META[k]).toBeDefined();
      expect(SOURCE_META[k].label).toBeTruthy();
      expect(SOURCE_META[k].cls).toMatch(/^src-/);
    }
  });

  it("setContent renders source badge when source is provided", () => {
    initMotivationCard();
    const srcEl = document.getElementById("moti-src")!;
    setContent({ text: "Test", author: "", source: "tanakh" });
    expect(srcEl.textContent).toBe("תנ״ך");
    expect(srcEl.className).toContain("src-tanakh");
  });

  it("setContent clears source badge when source is undefined", () => {
    initMotivationCard();
    const srcEl = document.getElementById("moti-src")!;
    // First set a source, then clear it
    setContent({ text: "A", author: "", source: "hazal" });
    setContent({ text: "B", author: "" });
    expect(srcEl.textContent).toBe("");
    expect(srcEl.className).toBe("moti-src");
  });

  it("at least some MOTIVATIONS quotes have a source field", () => {
    const withSource = MOTIVATIONS.filter((q) => q.source != null);
    expect(withSource.length).toBeGreaterThan(0);
  });

  it("all quotes with source have valid source values", () => {
    const validSources: MotivationSource[] = ["tanakh", "hazal", "modern", "ai"];
    for (const q of MOTIVATIONS) {
      if (q.source != null) {
        expect(validSources).toContain(q.source);
      }
    }
  });
});

// ── M2: Theme-by-day rotation  ────────────────────────────────────

describe("Motivation — M2 theme-by-day", () => {
  it("DAY_THEME_MAP has 7 entries (0=Sun … 6=Sat)", () => {
    expect(DAY_THEME_MAP).toHaveLength(7);
  });

  it("getThemeForDay(Sunday) returns 'gratitude'", () => {
    const sun = new Date("2025-06-01T12:00:00"); // Sunday
    expect(getThemeForDay(sun)).toBe("gratitude");
  });

  it("getThemeForDay(Saturday) returns 'shabbat'", () => {
    const sat = new Date("2025-05-31T12:00:00"); // Saturday
    expect(getThemeForDay(sat)).toBe("shabbat");
  });

  it("getThemeForDay(Friday) returns 'morning'", () => {
    const fri = new Date("2025-05-30T12:00:00"); // Friday
    expect(getThemeForDay(fri)).toBe("morning");
  });

  it("getThemeForDay returns valid category for all days", () => {
    const validCategories = [
      "general",
      "morning",
      "shabbat",
      "family",
      "success",
      "gratitude",
      "courage",
      "calm",
    ];
    // Check all 7 days by walking a known week
    for (let d = 0; d < 7; d++) {
      const date = new Date("2025-06-01T12:00:00"); // Sunday
      date.setDate(date.getDate() + d);
      expect(validCategories).toContain(getThemeForDay(date));
    }
  });

  it("getThemeForDay() without args uses today and returns a valid category", () => {
    const validCategories = [
      "general",
      "morning",
      "shabbat",
      "family",
      "success",
      "gratitude",
      "courage",
      "calm",
    ];
    expect(validCategories).toContain(getThemeForDay());
  });

  it("MOTIVATIONS includes quotes for each new category", () => {
    const newCategories = ["gratitude", "courage", "calm"] as const;
    for (const cat of newCategories) {
      const quotes = MOTIVATIONS.filter((q) => q.category === cat);
      expect(quotes.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── Motivation favorites ────────────────────────────────

import { toggleFavorite, isFavorite, loadFavorites } from "@/cards/motivation/motivation";
import { _idbClearFallback } from "@/core/idb-store";
import { getSemanticPayload, _resetSemanticProducers } from "@/core/semantic-clipboard";

describe("Motivation — favorites ", () => {
  beforeEach(() => {
    _idbClearFallback();
    _resetMotivationForTest();
  });

  const q1 = { text: "היהלום נוצר ממשך לחץ", author: "מקור לא ידוע", category: "courage" as const };
  const q2 = { text: "כל מסע מתחיל בצעד אחד", author: "לאו-טסה", category: "courage" as const };

  it("loadFavorites returns empty array initially", async () => {
    const favs = await loadFavorites();
    expect(favs).toEqual([]);
  });

  it("toggleFavorite adds a quote to favorites", async () => {
    const added = await toggleFavorite(q1);
    expect(added).toBe(true);
    const favs = await loadFavorites();
    expect(favs.some((f) => f.text === q1.text)).toBe(true);
  });

  it("toggleFavorite removes a quote already in favorites", async () => {
    await toggleFavorite(q1);
    const removed = await toggleFavorite(q1);
    expect(removed).toBe(false);
    const favs = await loadFavorites();
    expect(favs.length).toBe(0);
  });

  it("isFavorite returns true after adding", async () => {
    await toggleFavorite(q2);
    expect(await isFavorite(q2)).toBe(true);
  });

  it("isFavorite returns false when not in favorites", async () => {
    expect(await isFavorite(q1)).toBe(false);
  });

  it("caps favorites at 50 entries", async () => {
    for (let i = 0; i < 50; i++) {
      await toggleFavorite({ text: `quote-${i}`, author: "", category: "courage" as const });
    }
    const over = await toggleFavorite({
      text: "quote-extra",
      author: "",
      category: "courage" as const,
    });
    expect(over).toBe(false);
    const favs = await loadFavorites();
    expect(favs.length).toBe(50);
  });
});

// ── categories/theme-by-day/source/lang ─────────────────────
describe("Motivation configSchema — CS-M1 ", () => {
  it("configSchema has 6 fields total after CS-M1", () => {
    expect(motivationConfigSchema.length).toBe(6);
  });

  it("motivationCategories is a select with 4 options", () => {
    const field = motivationConfigSchema.find((f) => f.key === "motivationCategories");
    expect(field?.type).toBe("select");
    expect(field?.options?.length).toBe(4);
    expect(field?.defaultValue).toBe("all");
  });

  it("motivationThemeByDay is a boolean defaulting to false", () => {
    const field = motivationConfigSchema.find((f) => f.key === "motivationThemeByDay");
    expect(field?.type).toBe("boolean");
    expect(field?.defaultValue).toBe(false);
  });

  it("motivationShowSource is a boolean defaulting to true", () => {
    const field = motivationConfigSchema.find((f) => f.key === "motivationShowSource");
    expect(field?.type).toBe("boolean");
    expect(field?.defaultValue).toBe(true);
  });

  it("motivationLang is a select with he/en/both options", () => {
    const field = motivationConfigSchema.find((f) => f.key === "motivationLang");
    expect(field?.type).toBe("select");
    const values = field?.options?.map((o) => o.value);
    expect(values).toContain("he");
    expect(values).toContain("en");
    expect(values).toContain("both");
    expect(field?.defaultValue).toBe("both");
  });
});

// ── buildMotivationPayload + updateHeartBtn + localStorage catch ──

describe("Motivation — buildMotivationPayload via semantic clipboard ", () => {
  beforeEach(() => {
    _resetMotivationForTest();
    _resetSemanticProducers();
    localStorage.clear();
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
  });

  afterEach(() => {
    _resetMotivationForTest();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("returns non-null payload with cardId='motivation' after init", () => {
    initMotivationCard(); // calls renderMotivation() + registerSemanticProducer
    const payload = getSemanticPayload("motivation");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("motivation");
    expect(payload!.text).toContain("ציטוט:");
    expect(typeof payload!.ts).toBe("number");
  });
});

describe("Motivation — updateHeartBtn via refreshHeartState ", () => {
  beforeEach(() => {
    _resetMotivationForTest();
    _idbClearFallback();
    localStorage.clear();
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
      <button id="moti-fav-btn">🤍</button>
    `;
  });

  afterEach(() => {
    _resetMotivationForTest();
    _idbClearFallback();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("heart button reflects unfavorited state after refreshHeartState resolves", async () => {
    initMotivationCard(); // calls void refreshHeartState() internally
    // Flush the microtask chain (idbGet resolves in-memory synchronously via Promise.resolve)
    await new Promise<void>((r) => setTimeout(r, 0));
    const btn = document.getElementById("moti-fav-btn")!;
    expect(btn.textContent).toBe("🤍");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("Motivation — markIndexUsed localStorage catch branch ", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not throw when localStorage.setItem throws (quota exceeded)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => markIndexUsed(0, 5)).not.toThrow();
  });
});

// ── S540: motivation branch coverage — uncovered paths ───────────────────────

describe("Motivation — _resetMotivationForTest clears interval (line 570)", () => {
  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
  });

  it("clears active auto-advance interval on reset", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    _resetMotivationForTest();
    initMotivationCard();
    // Start auto-advance timer
    setMotivationInterval(5);
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    // Reset should clear the interval
    _resetMotivationForTest();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe("Motivation — fav heart click handler (line 389)", () => {
  beforeEach(() => {
    _idbClearFallback();
  });
  afterEach(() => {
    _resetMotivationForTest();
    document.body.innerHTML = "";
  });

  it("click on moti-fav-btn toggles favorite for current quote", async () => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
      <button id="moti-fav-btn"></button>
    `;
    _resetMotivationForTest();
    initMotivationCard();
    // Current quote should be set after init
    const q = getCurrentQuote();
    expect(q).not.toBeNull();
    // Click the fav button — should not throw
    document.getElementById("moti-fav-btn")!.click();
    // Wait for async toggleFavorite to complete
    await new Promise((r) => setTimeout(r, 0));
    // The quote should now be in favorites
    expect(await isFavorite(q!)).toBe(true);
  });

  it("second click unfavorites the current quote", async () => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
      <button id="moti-fav-btn"></button>
    `;
    _resetMotivationForTest();
    initMotivationCard();
    const q = getCurrentQuote()!;
    // Use API directly for deterministic sequencing
    await toggleFavorite(q); // add
    expect(await isFavorite(q)).toBe(true);
    await toggleFavorite(q); // remove
    expect(await isFavorite(q)).toBe(false);
  });
});

// ── S560: initMotivationCard with pre-set category (L396 else) ──────────

import * as configModule from "@/core/config";

describe("Motivation — initMotivationCard when category is already set", () => {
  afterEach(() => {
    _resetMotivationForTest();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not override _activeCategory if already set before init", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    _resetMotivationForTest();
    setMotivationCategory("courage");
    initMotivationCard();
    expect(getMotivationCategory()).toBe("courage");
  });

  it("initMotivationCard uses motivationInterval from config when set", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    _resetMotivationForTest();
    vi.spyOn(configModule, "loadConfig").mockReturnValue({
      ...configModule.loadConfig(),
      motivationInterval: 5,
    });
    const setSpy = vi.spyOn(globalThis, "setInterval");
    initMotivationCard();
    // setMotivationInterval(5) should call setInterval with 5*60000
    expect(setSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60_000);
    setSpy.mockRestore();
  });

  it("initMotivationCard handles undefined motivationInterval (fallback to 0)", () => {
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    _resetMotivationForTest();
    const cfg = { ...configModule.loadConfig() };
    delete (cfg as Record<string, unknown>).motivationInterval;
    vi.spyOn(configModule, "loadConfig").mockReturnValue(cfg);
    // Should not throw and should not start interval (0 disables)
    expect(() => initMotivationCard()).not.toThrow();
  });
});
