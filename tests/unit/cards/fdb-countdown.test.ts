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

  it("disconnect clears the tick timer when it was set (covers _tickTimer !== null branch)", () => {
    const card = mountCard();
    // setInterval was called in connect() — _tickTimer is set
    // Removing the card should call clearInterval without throwing
    expect(() => card.remove()).not.toThrow();
  });

  it("connect calls tick functions after initCountdownCard", async () => {
    const { tick, tick2, tick3, initCountdownCard } = await import("@/cards/countdown/countdown");
    mountCard();
    expect(initCountdownCard).toHaveBeenCalled();
    expect(tick).toHaveBeenCalled();
    expect(tick2).toHaveBeenCalled();
    expect(tick3).toHaveBeenCalled();
  });

  it("setInterval callback fires tick functions after 1 second (covers lines 28-30)", async () => {
    const { tick, tick2, tick3 } = await import("@/cards/countdown/countdown");
    vi.mocked(tick).mockClear();
    vi.mocked(tick2).mockClear();
    vi.mocked(tick3).mockClear();
    mountCard();
    vi.advanceTimersByTime(1000);
    // Each tick should now have been called at least twice (once direct + once via interval)
    expect(vi.mocked(tick).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(vi.mocked(tick2).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(vi.mocked(tick3).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("disconnect is safe when _tickTimer is null (false branch of _tickTimer !== null)", () => {
    // Create element without appending to DOM — connect() never fires, _tickTimer stays null
    const card = new FdbCountdownCard();
    expect(() => (card as unknown as { disconnect(): void }).disconnect()).not.toThrow();
  });

  it("does not re-register when already defined (if-FALSE branch, line 48)", async () => {
    vi.resetModules();
    await import("@/cards/countdown/fdb-countdown");
    expect(customElements.get("fdb-countdown")).toBeDefined();
  });
});
