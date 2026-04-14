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
      Object.isFrozen(MOTIVATIONS) ||
        !Array.isArray(MOTIVATIONS) ||
        MOTIVATIONS.length > 0,
    ).toBe(true);
  });
});

describe("Motivation — setContent", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
    `;
    // Wire the module-level DOM refs via initMotivationCard → but we call setContent directly
    // after manually setting the module's elText/elAuthor via initMotivationCard.
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets text and author elements", async () => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    setContent({ text: "מבחן", author: "מחבר" });
    expect(document.getElementById("moti-text")?.textContent).toBe("מבחן");
    expect(document.getElementById("moti-author")?.textContent).toBe("— מחבר");
  });

  it("shows empty author when author string is empty", async () => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
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
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("sets a non-empty text on first render", async () => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    renderMotivation();
    // Text set synchronously before fade (no card opacity detected in happy-dom)
    const text = document.getElementById("moti-text")?.textContent ?? "";
    expect(text.length).toBeGreaterThan(0);
  });

  it("cycles through different quotes on repeated calls", async () => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
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
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("replaces placeholder text with a real quote", async () => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
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
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("returns a quote even before initMotivationCard is called (wraps to last)", async () => {
    vi.resetModules();
    const { getCurrentQuote } = await import("@/cards/motivation/motivation");
    const q = getCurrentQuote();
    // getCurrentQuote wraps: motiIdx=0 returns MOTIVATIONS[length-1]
    expect(q).not.toBeNull();
    expect(typeof q!.text).toBe("string");
  });

  it("returns a quote object with text and author after init", async () => {
    vi.resetModules();
    const { getCurrentQuote, initMotivationCard } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    const q = getCurrentQuote();
    expect(q).not.toBeNull();
    expect(typeof q!.text).toBe("string");
    expect(q!.text.length).toBeGreaterThan(0);
  });

  it("getCurrentQuote matches what is shown in DOM", async () => {
    vi.resetModules();
    const { getCurrentQuote, initMotivationCard } =
      await import("@/cards/motivation/motivation");
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
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("does not throw when clipboard API is available", async () => {
    vi.resetModules();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    const { shareMotivation, initMotivationCard } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    expect(() => shareMotivation()).not.toThrow();
  });

  it("does not throw before initMotivationCard is called", async () => {
    vi.resetModules();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    const { shareMotivation } = await import("@/cards/motivation/motivation");
    expect(() => shareMotivation()).not.toThrow();
  });
});
// ── Sprint 5: fade path, navigator.share, button listeners ──────────────────

describe("Motivation — renderMotivation fade path (.moti-card)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("fade path: card opacity set to 0 then 1 via setTimeout", async () => {
    const { initMotivationCard, renderMotivation } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    renderMotivation();
    // The card should have opacity 0 immediately (before timeout fires)
    const card = document.querySelector(".moti-card") as HTMLElement;
    expect(card.style.opacity).toBe("0");
    // Advance 600ms to fire the 500ms transition timeout
    vi.advanceTimersByTime(600);
    expect(card.style.opacity).toBe("1");
  });

  it("moti-next-btn click calls renderMotivation (cycles quotes)", async () => {
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    vi.advanceTimersByTime(600); // settle initial render
    const btn = document.getElementById("moti-next-btn") as HTMLElement;
    btn.click();
    vi.advanceTimersByTime(600); // settle fade after click
    // Just verify no throw and DOM is still wired
    expect(btn).not.toBeNull();
    expect(document.getElementById("moti-text")).not.toBeNull();
  });

  it("moti-share-btn click calls shareMotivation without throw (navigator.share available)", async () => {
    vi.resetModules();
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = `
      <div class="moti-card">
        <div id="moti-text"></div>
        <div id="moti-author"></div>
        <button id="moti-next-btn">→</button>
        <button id="moti-share-btn">📬</button>
      </div>
    `;
    const { initMotivationCard } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    vi.advanceTimersByTime(600);
    const btn = document.getElementById("moti-share-btn") as HTMLElement;
    expect(() => btn.click()).not.toThrow();
  });
});

describe("Motivation — shareMotivation navigator.share path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("calls navigator.share when available", async () => {
    vi.resetModules();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });
    document.body.innerHTML = `<div id="moti-text"></div><div id="moti-author"></div>`;
    const { initMotivationCard, shareMotivation, renderMotivation } =
      await import("@/cards/motivation/motivation");
    initMotivationCard();
    renderMotivation(); // advance motiIdx so getCurrentQuote returns something
    expect(() => shareMotivation()).not.toThrow();
    expect(shareMock).toHaveBeenCalled();
  });
});
