import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbNewsCard } from "@/cards/news/fdb-news";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/cards/news/news", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/cards/news/news")>();
  return {
    ...actual,
    initNewsCard: vi.fn(),
    destroyNewsCard: vi.fn(),
    loadNews: vi.fn().mockResolvedValue(undefined),
  };
});

describe("FdbNewsCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function mountCard(): FdbNewsCard {
    const card = document.createElement("fdb-news") as FdbNewsCard;
    card.setAttribute("data-card-id", "news");
    document.body.appendChild(card);
    return card;
  }

  it("builds the news shell on connect", () => {
    const card = mountCard();

    expect(card.querySelector("#news-body")).not.toBeNull();
    expect(card.querySelector("#news-count")).not.toBeNull();
    expect(card.querySelector("#news-bkm-pill")).not.toBeNull();
    expect(card.querySelector("#news-search")).not.toBeNull();
    expect(card.querySelector("#rss-scroll")).not.toBeNull();
  });

  it("refresh delegates to loadNews", async () => {
    const card = mountCard();
    const newsModule = await import("@/cards/news/news");

    await card.refresh();

    expect(newsModule.loadNews).toHaveBeenCalled();
  });

  it("disconnect delegates teardown to destroyNewsCard", async () => {
    const card = mountCard();
    const newsModule = await import("@/cards/news/news");

    card.remove();

    expect(newsModule.destroyNewsCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-news custom element", () => {
    expect(customElements.get("fdb-news")).toBeDefined();
  });

  it("does not re-register when already defined (if-FALSE branch)", async () => {
    vi.resetModules();
    await import("@/cards/news/fdb-news");
    expect(customElements.get("fdb-news")).toBeDefined();
  });

  it("skips body init when body already has children (line 9 FALSE branch)", () => {
    const card = mountCard();
    // Pre-populate the body so reconnect skips initialization
    const body = card.querySelector(".card__body")!;
    const sentinel = document.createElement("div");
    sentinel.id = "news-skip-sentinel";
    body.appendChild(sentinel);
    card.remove();
    document.body.appendChild(card);
    // The sentinel should still be there (body not rebuilt)
    expect(document.getElementById("news-skip-sentinel")).not.toBeNull();
  });
});
