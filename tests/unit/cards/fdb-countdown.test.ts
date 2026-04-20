/**
 * Tests for FdbCountdownCard (Stream B2)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbCountdownCard } from "@/cards/countdown/fdb-countdown";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/cards/countdown/countdown", () => ({
  initCountdownCard: vi.fn(),
  destroyCountdownCard: vi.fn(),
  tick: vi.fn(),
  tick2: vi.fn(),
  tick3: vi.fn(),
  countdownConfigSchema: [],
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountCard(): FdbCountdownCard {
  const card = document.createElement("fdb-countdown") as FdbCountdownCard;
  card.setAttribute("data-card-id", "countdown");
  document.body.appendChild(card);
  return card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbCountdownCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("calls initCountdownCard on connect", async () => {
    const { initCountdownCard } = await import("@/cards/countdown/countdown");
    mountCard();
    expect(initCountdownCard).toHaveBeenCalled();
  });

  it("calls destroyCountdownCard on disconnect", async () => {
    const { destroyCountdownCard } = await import("@/cards/countdown/countdown");
    const card = mountCard();
    card.remove();
    expect(destroyCountdownCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-countdown custom element", () => {
    expect(customElements.get("fdb-countdown")).toBeDefined();
  });
});
