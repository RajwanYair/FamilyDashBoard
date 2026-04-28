import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbStocksCard } from "@/cards/stocks/fdb-stocks";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/cards/stocks/stocks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/cards/stocks/stocks")>();
  return {
    ...actual,
    initStocksCard: vi.fn(),
    destroyStocksCard: vi.fn(),
    loadAllStocks: vi.fn().mockResolvedValue(undefined),
    renderStocksShell: vi.fn(),
    applyHiddenStocks: vi.fn(),
    updateMarketBadge: vi.fn(),
    updateMarketCountdown: vi.fn(),
  };
});

describe("FdbStocksCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function mountCard(): FdbStocksCard {
    const card = document.createElement("fdb-stocks") as FdbStocksCard;
    card.setAttribute("data-card-id", "stocks");
    document.body.appendChild(card);
    return card;
  }

  it("builds the stocks shell on connect", () => {
    const card = mountCard();

    expect(card.querySelector("#stocks-body")).not.toBeNull();
    expect(card.querySelector("#market-badge")).not.toBeNull();
    expect(card.querySelector("#stk-summary")).not.toBeNull();
    expect(card.querySelector("#stk-total-row")).not.toBeNull();
    expect(card.querySelector("#stk-mkt-countdown")).not.toBeNull();
  });

  it("refresh delegates to stock reload", async () => {
    const card = mountCard();
    const stocksModule = await import("@/cards/stocks/stocks");

    await card.refresh();

    expect(stocksModule.loadAllStocks).toHaveBeenCalled();
    expect(stocksModule.updateMarketBadge).toHaveBeenCalled();
    expect(stocksModule.updateMarketCountdown).toHaveBeenCalled();
  });

  it("disconnect delegates teardown to destroyStocksCard", async () => {
    const card = mountCard();
    const stocksModule = await import("@/cards/stocks/stocks");

    card.remove();

    expect(stocksModule.destroyStocksCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-stocks custom element", () => {
    expect(customElements.get("fdb-stocks")).toBeDefined();
  });

  it("does not re-register when already defined (if-FALSE branch)", async () => {
    vi.resetModules();
    await import("@/cards/stocks/fdb-stocks");
    expect(customElements.get("fdb-stocks")).toBeDefined();
  });

  it("skips body init when body already has children (line 17 FALSE branch)", () => {
    const card = mountCard();
    // Pre-populate the body so reconnect skips initialization
    const body = card.querySelector(".card__body")!;
    const sentinel = document.createElement("div");
    sentinel.id = "stocks-skip-sentinel";
    body.appendChild(sentinel);
    card.remove();
    document.body.appendChild(card);
    // The sentinel should still be there (body not rebuilt)
    expect(document.getElementById("stocks-skip-sentinel")).not.toBeNull();
  });
});
