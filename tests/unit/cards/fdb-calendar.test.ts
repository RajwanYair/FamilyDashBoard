/**
 * Tests for FdbCalendarCard (Stream B2)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbCalendarCard } from "@/cards/calendar/fdb-calendar";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/cards/calendar/calendar", () => ({
  initCalendarCard: vi.fn(),
  destroyCalendarCard: vi.fn(),
  calendarConfigSchema: [],
  renderCalendar: vi.fn(),
  _resetCalendarForTest: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountCard(): FdbCalendarCard {
  const card = document.createElement("fdb-calendar") as FdbCalendarCard;
  card.setAttribute("data-card-id", "calendar");
  document.body.appendChild(card);
  return card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbCalendarCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls initCalendarCard on connect", async () => {
    const { initCalendarCard } = await import("@/cards/calendar/calendar");
    mountCard();
    expect(initCalendarCard).toHaveBeenCalled();
  });

  it("calls destroyCalendarCard on disconnect", async () => {
    const { destroyCalendarCard } = await import("@/cards/calendar/calendar");
    const card = mountCard();
    card.remove();
    expect(destroyCalendarCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-calendar custom element", () => {
    expect(customElements.get("fdb-calendar")).toBeDefined();
  });
  it("does not re-register when already defined (if-FALSE branch)", async () => {
    vi.resetModules();
    await import("@/cards/calendar/fdb-calendar");
    expect(customElements.get("fdb-calendar")).toBeDefined();
  });
});
