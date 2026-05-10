/**
 * Tests for FdbCurrencyCard (Stream B2)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbCurrencyCard } from "@/cards/currency/fdb-currency";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/cards/currency/currency", () => ({
  initCurrencyCard: vi.fn(),
  destroyCurrencyCard: vi.fn(),
  currencyConfigSchema: [],
  loadCurrencyHistory: vi.fn(() => []),
  storeCurrencyHistory: vi.fn(),
  get7DayTrend: vi.fn(() => null),
  formatRelativeTime: vi.fn(() => ""),
  _resetCurrencyForTest: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountCard(): FdbCurrencyCard {
  const card = document.createElement("fdb-currency") as FdbCurrencyCard;
  card.setAttribute("data-card-id", "currency");
  document.body.appendChild(card);
  return card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbCurrencyCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls initCurrencyCard on connect", async () => {
    const { initCurrencyCard } = await import("@/cards/currency/currency");
    mountCard();
    expect(initCurrencyCard).toHaveBeenCalled();
  });

  it("calls destroyCurrencyCard on disconnect", async () => {
    const { destroyCurrencyCard } = await import("@/cards/currency/currency");
    const card = mountCard();
    card.remove();
    expect(destroyCurrencyCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-currency custom element", () => {
    expect(customElements.get("fdb-currency")).toBeDefined();
  });
  it("does not re-register when already defined (if-FALSE branch)", async () => {
    vi.resetModules();
    await import("@/cards/currency/fdb-currency");
    expect(customElements.get("fdb-currency")).toBeDefined();
  });
});
