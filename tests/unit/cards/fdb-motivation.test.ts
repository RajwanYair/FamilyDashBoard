import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "@/core/state";
import { FdbMotivationCard } from "@/cards/motivation/fdb-motivation";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/ui/toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("@/core/i18n", () => ({
  getInterfaceLanguage: () => "he",
  t: (key: string) => key,
}));

vi.mock("@/cards/motivation/motivation", () => ({
  getQuotesByCategory: vi.fn(() => [
    { text: "Quote A", author: "Author A" },
    { text: "Quote B", author: "Author B" },
  ]),
}));

describe("FdbMotivationCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    state.set("config.motivationInterval", 0);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  function mountCard(): FdbMotivationCard {
    const card = document.createElement("fdb-motivation") as FdbMotivationCard;
    card.setAttribute("data-card-id", "motivation");
    document.body.appendChild(card);
    return card;
  }

  it("builds the standard shell and renders the first quote on connect", () => {
    const card = mountCard();

    expect(card.querySelector(".card__header")).not.toBeNull();
    expect(card.querySelector("[data-card-title]")?.textContent).toContain("מוטיבציה");
    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote A");
    expect(card.querySelector(".moti-author")?.textContent).toBe("— Author A");
  });

  it("refresh advances to the next quote", async () => {
    const card = mountCard();

    await card.refresh();

    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote B");
    expect(card.querySelector(".moti-author")?.textContent).toBe("— Author B");
  });

  it("reacts to motivationInterval config updates via the state store", async () => {
    const card = mountCard();

    state.set("config.motivationInterval", 1);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote B");
  });

  it("clears the auto-advance timer on disconnect", async () => {
    const card = mountCard();

    state.set("config.motivationInterval", 1);
    card.remove();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote A");
  });

  it("setCategory changes the pool and resets to first quote", () => {
    const card = mountCard();
    card.setCategory("work");
    expect(card.getCategory()).toBe("work");
    // After setCategory, _idx is reset so next quote is from pool[0]
    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote A");
  });

  it("getCategory returns null by default", () => {
    const card = mountCard();
    // Category starts as null
    expect(card.getCategory()).toBeNull();
  });

  it("shareQuote — uses navigator.clipboard when navigator.share is absent", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    });

    const card = mountCard();
    await card.refresh(); // advance to Quote B
    card.shareQuote();

    expect(writeText).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("shareQuote — uses navigator.share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      share,
    });

    const card = mountCard();
    card.shareQuote();

    expect(share).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("re-connecting skips rebuilding the card body (early-return guard at line 26)", () => {
    const card = mountCard();
    // Card body is now built. Remove and re-add — second connect() hits 'childElementCount > 0' guard
    document.body.removeChild(card);
    document.body.appendChild(card);
    // Card should still function normally after re-connect early-return
    expect(card.querySelector(".moti-text")).not.toBeNull();
  });

  it("_setAutoInterval clears previous timer when called a second time (lines 137-138)", async () => {
    const card = mountCard();
    // First call: sets the auto timer to 1 minute
    state.set("config.motivationInterval", 1);
    // Second call with 0: _autoTimer !== null, so clearInterval branch (lines 137-138) fires
    state.set("config.motivationInterval", 0);
    // After clearing, advancing 60s should NOT advance the quote
    await vi.advanceTimersByTimeAsync(60_000);
    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote A");
  });

  it("scheduleRefresh callback fires nextQuote after 2-min MOTIVATION interval (line 70)", async () => {
    const card = mountCard();
    // INTERVALS.MOTIVATION = 2 * 60000 ms; _autoTimer is not set (motivationInterval = 0)
    await vi.advanceTimersByTimeAsync(120_000);
    expect(card.querySelector(".moti-text")?.textContent).toBe("Quote B");
  });

  it("renders English button labels when document lang is 'en' (covers lines 46-54)", () => {
    const origLang = document.documentElement.lang;
    document.documentElement.lang = "en";
    try {
      const card = mountCard();
      const btns = [...card.querySelectorAll(".moti-btn")];
      expect(btns.some((b) => b.textContent?.includes("Next"))).toBe(true);
      expect(btns.some((b) => b.textContent?.includes("Share"))).toBe(true);
    } finally {
      document.documentElement.lang = origLang;
      document.body.innerHTML = "";
    }
  });

  it("nextQuote is a no-op when pool is empty (if !pool.length branch)", async () => {
    const { getQuotesByCategory } = await import("@/cards/motivation/motivation");
    vi.mocked(getQuotesByCategory).mockReturnValue([]);
    const card = mountCard();
    // connect() called nextQuote() with empty pool — moti-text stays at t('refreshing') = 'refreshing'
    expect(card.querySelector(".moti-text")?.textContent).toBe("refreshing");
    // Restore default mock
    vi.mocked(getQuotesByCategory).mockReturnValue([
      { text: "Quote A", author: "Author A" },
      { text: "Quote B", author: "Author B" },
    ]);
  });

  it("nextQuote is a no-op when pool[idx] is undefined (if !q branch)", async () => {
    const { getQuotesByCategory } = await import("@/cards/motivation/motivation");
    vi.mocked(getQuotesByCategory).mockReturnValue(
      [undefined] as unknown as { text: string; author?: string }[],
    );
    const card = mountCard();
    // pool has length 1 but pool[0] is undefined — nextQuote returns early
    expect(card.querySelector(".moti-text")?.textContent).toBe("refreshing");
    // Restore
    vi.mocked(getQuotesByCategory).mockReturnValue([
      { text: "Quote A", author: "Author A" },
      { text: "Quote B", author: "Author B" },
    ]);
  });

  it("shareQuote — formats text without author when author is absent", async () => {
    const { getQuotesByCategory } = await import("@/cards/motivation/motivation");
    vi.mocked(getQuotesByCategory).mockReturnValue([
      { text: "No-author quote", author: undefined },
    ]);

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    });

    const card = mountCard();
    card.shareQuote();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("No-author quote"));
    expect(writeText.mock.calls[0]?.[0]).not.toContain("—");

    vi.unstubAllGlobals();
    vi.mocked(getQuotesByCategory).mockReturnValue([
      { text: "Quote A", author: "Author A" },
      { text: "Quote B", author: "Author B" },
    ]);
  });
});
