import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbVideoNewsCard } from "@/cards/video-news/fdb-video-news";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/cards/video-news/video-news", () => ({
  initVideoNews: vi.fn(),
  destroyVideoNews: vi.fn(),
  switchChannel: vi.fn(),
}));

vi.mock("@/ui/maximize", () => ({
  toggleCardMaximize: vi.fn(),
}));

vi.mock("@/core/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/constants")>();
  return { ...actual };
});

describe("FdbVideoNewsCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function mountCard(cardId = "video-news"): FdbVideoNewsCard {
    const card = document.createElement("fdb-video-news") as FdbVideoNewsCard;
    card.setAttribute("data-card-id", cardId);
    document.body.appendChild(card);
    return card;
  }

  it("is registered as fdb-video-news custom element", () => {
    expect(customElements.get("fdb-video-news")).toBeDefined();
  });

  it("builds header and body on connect", () => {
    const card = mountCard();
    expect(card.querySelector(".card__header")).not.toBeNull();
    expect(card.querySelector(".card__body")).not.toBeNull();
  });

  it("adds a collapse button to the header end slot", () => {
    const card = mountCard();
    const collapseBtn = card.querySelector<HTMLButtonElement>(".card-collapse-btn");
    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn?.getAttribute("aria-label")).toBe("מזער/הרחב כרטיסית");
    expect(collapseBtn?.getAttribute("aria-expanded")).toBe("true");
    expect(collapseBtn?.textContent).toBe("▼");
  });

  it("adds a mini-info span to the header center slot", () => {
    const card = mountCard();
    const miniInfo = card.querySelector("#mini-video-news");
    expect(miniInfo).not.toBeNull();
    expect(miniInfo?.className).toBe("card-mini-info");
  });

  it("calls initVideoNews on first connect", async () => {
    mountCard();
    const videoNewsModule = await import("@/cards/video-news/video-news");
    expect(videoNewsModule.initVideoNews).toHaveBeenCalled();
  });

  it("calls destroyVideoNews on disconnect", async () => {
    const card = mountCard();
    const videoNewsModule = await import("@/cards/video-news/video-news");
    card.remove();
    expect(videoNewsModule.destroyVideoNews).toHaveBeenCalled();
  });

  it("setChannel delegates to switchChannel", async () => {
    const card = mountCard();
    const videoNewsModule = await import("@/cards/video-news/video-news");
    card.setChannel("i24" as Parameters<typeof card.setChannel>[0]);
    expect(videoNewsModule.switchChannel).toHaveBeenCalledWith("i24");
  });

  it("header click calls toggleCardMaximize", async () => {
    const card = mountCard();
    const maximizeModule = await import("@/ui/maximize");
    const header = card.querySelector<HTMLElement>(".card__header")!;
    header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(maximizeModule.toggleCardMaximize).toHaveBeenCalledWith(card);
  });

  it("collapse button click does NOT call toggleCardMaximize", async () => {
    const card = mountCard();
    const maximizeModule = await import("@/ui/maximize");
    vi.mocked(maximizeModule.toggleCardMaximize).mockClear();
    const collapseBtn = card.querySelector<HTMLButtonElement>(".card-collapse-btn")!;
    collapseBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(maximizeModule.toggleCardMaximize).not.toHaveBeenCalled();
  });

  it("restores collapsed state from localStorage", async () => {
    const { LS_COLLAPSED } = await import("@/core/constants");
    localStorage.setItem(LS_COLLAPSED, JSON.stringify(["video-news"]));
    const card = mountCard("video-news");
    expect(card.classList.contains("collapsed")).toBe(true);
    const collapseBtn = card.querySelector<HTMLButtonElement>(".card-collapse-btn")!;
    expect(collapseBtn.textContent).toBe("▶");
    expect(collapseBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("handles corrupted localStorage gracefully (_loadCollapsedIds catch)", () => {
    localStorage.setItem("fdb-collapsed-cards", "not-json");
    expect(() => mountCard()).not.toThrow();
  });

  it("does not add a second collapse button if already present", () => {
    const card = mountCard();
    // Disconnect and reconnect should not duplicate the collapse button
    document.body.removeChild(card);
    document.body.appendChild(card);
    const btns = card.querySelectorAll(".card-collapse-btn");
    expect(btns.length).toBeLessThanOrEqual(1);
  });
});
