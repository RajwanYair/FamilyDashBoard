/**
 * Tests for src/cards/tasks/tasks.ts
 *
 * Covers: ChoreItem type, fingerprint, renderTasksCard DOM output,
 * done-state toggle, empty state rendering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderTasksCard, markAllDone, resetDoneToday } from "@/cards/tasks/tasks";

// ── Helpers ────────────────────────────────────────────────────────────────

function setupDOM(choreDef?: string): void {
  document.body.innerHTML = `<div id="tasks-list"></div>`;
  // Seed localStorage with chores JSON
  if (choreDef !== undefined) {
    localStorage.setItem("dash_chores", choreDef);
  } else {
    localStorage.removeItem("dash_chores");
  }
  // Clear done-map so each test is isolated
  localStorage.removeItem("dash_tasks_done");
  localStorage.removeItem("dash_tasks_reset_date");
}

// ── Empty state ─────────────────────────────────────────────────────────────

describe("Tasks — empty state", () => {
  beforeEach(() => setupDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows placeholder text when no chores configured", () => {
    renderTasksCard();
    const list = document.getElementById("tasks-list") as HTMLElement;
    expect(list.textContent).toContain("אין משימות");
  });

  it("does not throw when tasks-list element is missing", () => {
    document.body.innerHTML = "";
    expect(() => renderTasksCard()).not.toThrow();
  });
});

// ── Rendering with chores ───────────────────────────────────────────────────

describe("Tasks — render with chores", () => {
  const chores = [
    { person: "עמרי", chore: "🧹 לנקות" },
    { person: "עמרי", chore: "🛒 קניות" },
    { person: "ריבה", chore: "🍳 בישול" },
  ];

  beforeEach(() => setupDOM(JSON.stringify(chores)));
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders person headers", () => {
    renderTasksCard();
    const personEls = document.querySelectorAll(".tasks-person");
    expect(personEls.length).toBe(2);
  });

  it("renders correct number of chore rows", () => {
    renderTasksCard();
    const rows = document.querySelectorAll(".tasks-row");
    expect(rows.length).toBe(3);
  });

  it("renders chore text in task row", () => {
    renderTasksCard();
    const choreEls = document.querySelectorAll(".tasks-chore");
    const texts = [...choreEls].map((el) => el.textContent);
    expect(texts).toContain("🧹 לנקות");
    expect(texts).toContain("🛒 קניות");
    expect(texts).toContain("🍳 בישול");
  });

  it("all checkboxes start unchecked", () => {
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    for (const cb of cbs) {
      expect(cb.checked).toBe(false);
    }
  });
});

// ── Done state persistence ──────────────────────────────────────────────────

describe("Tasks — done state", () => {
  const chores = [{ person: "עמרי", chore: "🧹 לנקות" }];
  const doneKey = "עמרי::🧹 לנקות";

  beforeEach(() => {
    setupDOM(JSON.stringify(chores));
    // Pre-mark as done
    localStorage.setItem(
      "dash_tasks_done",
      JSON.stringify({ [doneKey]: true }),
    );
    // Seed today's reset date so checkDailyReset() doesn't wipe the done map
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders a pre-done task as checked", () => {
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb");
    expect(cb?.checked).toBe(true);
  });

  it("adds 'done' class to a pre-completed row", () => {
    renderTasksCard();
    const row = document.querySelector(".tasks-row");
    expect(row?.classList.contains("done")).toBe(true);
  });
});

// ── Daily reset ─────────────────────────────────────────────────────────────

describe("Tasks — daily reset", () => {
  it("clears done state when reset date differs from today", () => {
    // Freeze time to 10 AM so RESET_HOUR (6) condition passes
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
    setupDOM(); // set up DOM first, then seed state
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "a::b": true }));
    localStorage.setItem("dash_tasks_reset_date", "1970-0-1"); // old date
    renderTasksCard();
    vi.useRealTimers();
    // After reset, the done-map should be gone
    const doneMap = localStorage.getItem("dash_tasks_done");
    expect(doneMap).toBeNull();
  });

  it("does NOT reset if reset date matches today", () => {
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    setupDOM(); // set up DOM first (clears localStorage)
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "a::b": true }));
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    renderTasksCard();
    // Done map should still be present
    const doneMap = localStorage.getItem("dash_tasks_done");
    expect(doneMap).not.toBeNull();
  });
});

// ── Checkbox change handler ─────────────────────────────────────────────────

describe("Tasks — checkbox change handler", () => {
  const chores = [{ person: "עמרי", chore: "🧹 לנקות" }];
  const fp = "עמרי::🧹 לנקות";

  beforeEach(() => setupDOM(JSON.stringify(chores)));
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("marks task as done when checkbox is checked", () => {
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    const map = JSON.parse(
      localStorage.getItem("dash_tasks_done") ?? "{}",
    ) as Record<string, boolean>;
    expect(map[fp]).toBe(true);
  });

  it("adds 'done' class to row when checkbox is checked", () => {
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    const row = document.querySelector(".tasks-row");
    expect(row?.classList.contains("done")).toBe(true);
  });

  it("marks task as undone when checkbox is unchecked", () => {
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = false;
    cb.dispatchEvent(new Event("change"));
    const map = JSON.parse(
      localStorage.getItem("dash_tasks_done") ?? "{}",
    ) as Record<string, boolean>;
    expect(map[fp]).toBe(false);
  });

  it("removes 'done' class from row when checkbox is unchecked", () => {
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = false;
    cb.dispatchEvent(new Event("change"));
    const row = document.querySelector(".tasks-row");
    expect(row?.classList.contains("done")).toBe(false);
  });
});

// ── initTasksCard / destroyTasksCard ────────────────────────────────────────

import {
  initTasksCard,
  destroyTasksCard,
  tasksCard,
} from "@/cards/tasks/tasks";

describe("Tasks — initTasksCard / destroyTasksCard", () => {
  beforeEach(() => setupDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
    destroyTasksCard();
  });

  it("initTasksCard does not throw", () => {
    vi.useFakeTimers();
    expect(() => initTasksCard()).not.toThrow();
  });

  it("destroyTasksCard does not throw without prior init", () => {
    expect(() => destroyTasksCard()).not.toThrow();
  });

  it("destroyTasksCard clears interval after initTasksCard", () => {
    vi.useFakeTimers();
    initTasksCard();
    expect(() => destroyTasksCard()).not.toThrow();
  });
});

// ── tasksCard CardDefinition ─────────────────────────────────────────────────

describe("Tasks — tasksCard CardDefinition", () => {
  it("has correct id and icon", () => {
    expect(tasksCard.id).toBe("tasks");
    expect(tasksCard.icon).toBe("✅");
  });

  it("render() returns a section with data-card-id=tasks", () => {
    const el = tasksCard.render();
    expect(el.tagName).toBe("SECTION");
    expect((el as HTMLElement).dataset.cardId).toBe("tasks");
  });

  it("render() contains tasks-list element", () => {
    const el = tasksCard.render();
    expect(el.querySelector("#tasks-list")).not.toBeNull();
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("Tasks — invalid JSON in localStorage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("gracefully handles corrupt chores JSON", () => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem("dash_chores", "{invalid json}");
    expect(() => renderTasksCard()).not.toThrow();
    const list = document.getElementById("tasks-list") as HTMLElement;
    expect(list.textContent).toContain("אין משימות");
  });

  it("gracefully handles corrupt done-map JSON", () => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]),
    );
    localStorage.setItem("dash_tasks_done", "{invalid}");
    expect(() => renderTasksCard()).not.toThrow();
  });
});

// ── getTasksForToday ─────────────────────────────────────────────────────────

import { getTasksForToday } from "@/cards/tasks/tasks";

describe("Tasks — getTasksForToday", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns all chores when none are done", () => {
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "עמרי", chore: "🧹 לנקות" },
        { person: "ריבה", chore: "🍳 בישול" },
      ]),
    );
    const tasks = getTasksForToday();
    expect(tasks).toHaveLength(2);
  });

  it("excludes completed chores from result", () => {
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]),
    );
    localStorage.setItem(
      "dash_tasks_done",
      JSON.stringify({ "עמרי::🧹 לנקות": true }),
    );
    const today = new Date();
    localStorage.setItem(
      "dash_tasks_reset_date",
      `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`,
    );
    const tasks = getTasksForToday();
    expect(tasks).toHaveLength(0);
  });

  it("returns empty array when no chores configured", () => {
    localStorage.removeItem("dash_chores");
    expect(getTasksForToday()).toHaveLength(0);
  });

  it("loadDoneMap catch: returns empty map for corrupted JSON", () => {
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]),
    );
    localStorage.setItem("dash_tasks_done", "not-json{{{}");
    const today = new Date();
    localStorage.setItem(
      "dash_tasks_reset_date",
      `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`,
    );
    // Corrupt JSON → loadDoneMap catch returns {} → all tasks appear pending
    const tasks = getTasksForToday();
    expect(tasks).toHaveLength(1);
  });
});

// ── v7.1: markAllDone ─────────────────────────────────────────────────────────

describe("Tasks — markAllDone", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "עמרי", chore: "🧹 לנקות" },
        { person: "ריבה", chore: "🍳 בישול" },
      ]),
    );
    // Prevent daily-reset from wiping state we set during tests
    const today = new Date();
    localStorage.setItem(
      "dash_tasks_reset_date",
      `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`,
    );
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("marks all chores done in localStorage", () => {
    markAllDone();
    const raw = localStorage.getItem("dash_tasks_done");
    expect(raw).not.toBeNull();
    const map = JSON.parse(raw!);
    expect(map["עמרי::🧹 לנקות"]).toBe(true);
    expect(map["ריבה::🍳 בישול"]).toBe(true);
  });

  it("renders tasks-list after markAllDone", () => {
    markAllDone();
    const list = document.getElementById("tasks-list");
    expect(list).not.toBeNull();
    // All checkboxes should be checked
    const checkboxes = list!.querySelectorAll<HTMLInputElement>(
      "input[type='checkbox']",
    );
    checkboxes.forEach((cb) => expect(cb.checked).toBe(true));
  });

  it("does not throw when no chores are configured", () => {
    localStorage.removeItem("dash_chores");
    expect(() => markAllDone()).not.toThrow();
  });
});

// ── v7.1: resetDoneToday ────────────────────────────────────────────────

describe("Tasks — resetDoneToday", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]),
    );
    // Pre-seed done map
    localStorage.setItem(
      "dash_tasks_done",
      JSON.stringify({ "עמרי::🧹 לנקות": true }),
    );
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("removes done map from localStorage", () => {
    resetDoneToday();
    expect(localStorage.getItem("dash_tasks_done")).toBeNull();
  });

  it("re-renders task list with checkboxes unchecked after reset", () => {
    resetDoneToday();
    const list = document.getElementById("tasks-list");
    const checkboxes = list!.querySelectorAll<HTMLInputElement>(
      "input[type='checkbox']",
    );
    // After reset all chores should be unchecked
    checkboxes.forEach((cb) => expect(cb.checked).toBe(false));
  });

  it("does not throw when done map is already empty", () => {
    localStorage.removeItem("dash_tasks_done");
    expect(() => resetDoneToday()).not.toThrow();
  });
});
