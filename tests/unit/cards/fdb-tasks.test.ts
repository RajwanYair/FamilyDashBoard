import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbTasksCard } from "@/cards/tasks/fdb-tasks";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

describe("FdbTasksCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "עמרי", chore: "🧹 לנקות" },
        { person: "ריבה", chore: "🛒 קניות" },
      ]),
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function mountCard(): FdbTasksCard {
    const card = document.createElement("fdb-tasks") as FdbTasksCard;
    card.setAttribute("data-card-id", "tasks");
    document.body.appendChild(card);
    return card;
  }

  it("builds the tasks shell and renders rows on connect", () => {
    const card = mountCard();

    expect(card.querySelector(".tasks-actions")).not.toBeNull();
    expect(card.querySelector("#tasks-list")).not.toBeNull();
    expect(card.querySelectorAll(".tasks-row")).toHaveLength(2);
  });

  it("refresh rerenders the list after data changes", async () => {
    const card = mountCard();

    localStorage.setItem("dash_chores", JSON.stringify([{ person: "משפחה", chore: "📦 לארגן" }]));

    await card.refresh();

    expect(card.querySelectorAll(".tasks-row")).toHaveLength(1);
    expect(card.querySelector(".tasks-chore")?.textContent).toContain("📦 לארגן");
  });

  it("does not duplicate quick-add handlers across reconnects", () => {
    const card = mountCard();
    const quickInput = card.querySelector<HTMLInputElement>("#tasks-quick-input");
    const quickButton = card.querySelector<HTMLButtonElement>("#tasks-quick-add-btn");

    card.remove();
    document.body.appendChild(card);

    if (!quickInput || !quickButton) {
      throw new Error("Tasks quick-add controls missing");
    }

    quickInput.value = "🧺 כביסה";
    quickButton.click();

    expect(card.querySelectorAll(".tasks-row")).toHaveLength(3);
  });

  it("does not re-register when already defined (if-FALSE branch, line 127)", async () => {
    vi.resetModules();
    await import("@/cards/tasks/fdb-tasks");
    expect(customElements.get("fdb-tasks")).toBeDefined();
  });
});
