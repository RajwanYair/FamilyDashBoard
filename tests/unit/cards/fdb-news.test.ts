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
});
