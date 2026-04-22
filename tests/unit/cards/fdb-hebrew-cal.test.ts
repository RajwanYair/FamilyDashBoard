/**
 * Tests for FdbHebrewCalCard (Stream B2)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbHebrewCalCard } from "@/cards/hebrew-cal/fdb-hebrew-cal";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/cards/hebrew-cal/hebrew-cal", () => ({
  initHebrewCalCard: vi.fn(),
  destroyHebrewCalCard: vi.fn(),
  hebrewCalConfigSchema: [],
  renderMoonPhase: vi.fn(),
  renderNextCalEvent: vi.fn(),
  renderPsalmOfDay: vi.fn(),
  getPsalmOfDay: vi.fn(() => 24),
  getHebDateString: vi.fn(() => ""),
  _resetHebCalForTest: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountCard(): FdbHebrewCalCard {
  const card = document.createElement("fdb-hebrew-cal") as FdbHebrewCalCard;
  card.setAttribute("data-card-id", "hebrew-cal");
  document.body.appendChild(card);
  return card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbHebrewCalCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls initHebrewCalCard on connect", async () => {
    const { initHebrewCalCard } = await import("@/cards/hebrew-cal/hebrew-cal");
    mountCard();
    expect(initHebrewCalCard).toHaveBeenCalled();
  });

  it("calls destroyHebrewCalCard on disconnect", async () => {
    const { destroyHebrewCalCard } = await import("@/cards/hebrew-cal/hebrew-cal");
    const card = mountCard();
    card.remove();
    expect(destroyHebrewCalCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-hebrew-cal custom element", () => {
    expect(customElements.get("fdb-hebrew-cal")).toBeDefined();
  });
});
