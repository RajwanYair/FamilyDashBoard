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
});
