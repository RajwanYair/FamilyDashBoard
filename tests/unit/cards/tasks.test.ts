/**
 * Tests for src/cards/tasks/tasks.ts
 *
 * Covers: ChoreItem type, fingerprint, renderTasksCard DOM output,
 * done-state toggle, empty state rendering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  renderTasksCard,
  markAllDone,
  resetDoneToday,
  removeDoneTasks,
  initTasksCard,
  destroyTasksCard,
  tasksCard,
  getTasksForToday,
  countOverdueTasks,
  parseTaskPriority,
  parseTaskDueDate,
  isOverdue,
  isDueToday,
  isDueThisWeek,
  formatTaskDueDate,
  taskCompletionRatio,
  taskPriorityIcon,
  recurrenceResetKey,
  checkRecurringReset,
  addQuickChore,
  advanceRecurringDueDate,
} from "@/cards/tasks/tasks";
import type { ChoreItem } from "@/cards/tasks/tasks";

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
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [doneKey]: true }));
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

  it("does NOT reset when current hour is below tasksResetHour config", () => {
    // Set reset hour to 22 (10 PM), but fake time to 8 AM
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 8, 0, 0)); // 8 AM
    setupDOM();
    localStorage.setItem("dash_v2_config", JSON.stringify({ tasksResetHour: 22 }));
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "a::b": true }));
    localStorage.setItem("dash_tasks_reset_date", "1970-0-1"); // old date
    renderTasksCard();
    vi.useRealTimers();
    const doneMap = localStorage.getItem("dash_tasks_done");
    // Should NOT reset because 8 AM < tasksResetHour 22
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
    const map = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
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
    const map = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
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

  it("clearInterval fires when initTasksCard called twice (line 175 TRUE branch)", () => {
    vi.useFakeTimers();
    initTasksCard(); // sets _tasksInterval
    initTasksCard(); // _tasksInterval is now non-null → line 175 clears it
    // No throw expected
    expect(document.getElementById("tasks-list")).not.toBeNull();
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
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
    localStorage.setItem("dash_tasks_done", "{invalid}");
    expect(() => renderTasksCard()).not.toThrow();
  });
});

// ── getTasksForToday ─────────────────────────────────────────────────────────

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
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "עמרי::🧹 לנקות": true }));
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
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
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
    const checkboxes = list!.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
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
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
    // Pre-seed done map
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "עמרי::🧹 לנקות": true }));
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
    const checkboxes = list!.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
    // After reset all chores should be unchecked
    checkboxes.forEach((cb) => expect(cb.checked).toBe(false));
  });

  it("does not throw when done map is already empty", () => {
    localStorage.removeItem("dash_tasks_done");
    expect(() => resetDoneToday()).not.toThrow();
  });
});

// ── initTasksCard button wiring (line 175) ───────────────────────────────────

describe("Tasks — initTasksCard wires button click handlers (line 175)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <button id="tasks-mark-all-btn">סמן הכל</button>
      <button id="tasks-reset-btn">איפוס</button>`;
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
    destroyTasksCard();
  });

  it("clicking tasks-mark-all-btn triggers markAllDone", () => {
    vi.useFakeTimers();
    initTasksCard();
    document.getElementById("tasks-mark-all-btn")!.click();
    const raw = localStorage.getItem("dash_tasks_done");
    expect(raw).not.toBeNull();
  });

  it("clicking tasks-reset-btn triggers resetDoneToday", () => {
    vi.useFakeTimers();
    // Pre-mark all done
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "עמרי::🧹 לנקות": true }));
    initTasksCard();
    document.getElementById("tasks-reset-btn")!.click();
    expect(localStorage.getItem("dash_tasks_done")).toBeNull();
  });
});

// ── tasks-pending-badge ───────────────────────────────────────────────────────

describe("Tasks — tasks-pending-badge", () => {
  const chores = [
    { person: "עמרי", chore: "🧹 לנקות" },
    { person: "ריבה", chore: "🍳 בישול" },
  ];

  function setupWithBadge(choreDef?: string): void {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge" style="display:none"></span>`;
    if (choreDef !== undefined) {
      localStorage.setItem("dash_chores", choreDef);
    } else {
      localStorage.removeItem("dash_chores");
    }
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows badge with pending count when chores are pending", () => {
    setupWithBadge(JSON.stringify(chores));
    renderTasksCard();
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.style.display).not.toBe("none");
    expect(badge.textContent).toContain("2");
  });

  it("shows '2 / 2 ✓' badge (not hidden) when all chores are done", () => {
    setupWithBadge(JSON.stringify(chores));
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    localStorage.setItem(
      "dash_tasks_done",
      JSON.stringify({ "עמרי::🧹 לנקות": true, "ריבה::🍳 בישול": true }),
    );
    renderTasksCard();
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    // Badge shows '2 / 2 ✓ (100%)' when all done — stays visible
    expect(badge.textContent).toBe("2 / 2 ✓ (100%)");
    expect(badge.style.display).not.toBe("none");
  });

  it("badge hides when no tasks-pending-badge element in DOM", () => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    expect(() => renderTasksCard()).not.toThrow();
  });

  it("updates badge to 1 when one of two chores is checked via checkbox", () => {
    setupWithBadge(JSON.stringify(chores));
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0]!.checked = true;
    cbs[0]!.dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.style.display).not.toBe("none");
    expect(badge.textContent).toContain("1");
  });
});

// ── Sprint v7.12: tasks-all-done-msg ─────────────────────────────────────────

describe("Tasks — tasks-all-done-msg visibility (Sprint v7.12)", () => {
  const chores = [
    { person: "עמרי", chore: "🧹 לנקות" },
    { person: "ריבה", chore: "🍳 בישול" },
  ];

  function setupWithDoneMsg(choreDef?: string): void {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <div id="tasks-all-done-msg" style="display:none"></div>
      <span id="tasks-pending-badge" style="display:none"></span>`;
    if (choreDef !== undefined) {
      localStorage.setItem("dash_chores", choreDef);
    } else {
      localStorage.removeItem("dash_chores");
    }
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("hides all-done-msg when no chores are configured", () => {
    setupWithDoneMsg(); // no chores
    renderTasksCard();
    expect(document.getElementById("tasks-all-done-msg")?.style.display).toBe("none");
  });

  it("hides all-done-msg when tasks are pending", () => {
    setupWithDoneMsg(JSON.stringify(chores));
    renderTasksCard();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).toBe(
      "none",
    );
  });

  it("shows all-done-msg when all chores are pre-marked done", () => {
    setupWithDoneMsg(JSON.stringify(chores));
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    localStorage.setItem(
      "dash_tasks_done",
      JSON.stringify({ "עמרי::🧹 לנקות": true, "ריבה::🍳 בישול": true }),
    );
    renderTasksCard();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).not.toBe(
      "none",
    );
  });

  it("shows all-done-msg after markAllDone() is called", () => {
    setupWithDoneMsg(JSON.stringify(chores));
    // Prevent checkDailyReset() from wiping the done state mid-call
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    markAllDone();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).not.toBe(
      "none",
    );
  });

  it("hides all-done-msg after resetDoneToday() following markAllDone()", () => {
    setupWithDoneMsg(JSON.stringify(chores));
    // Prevent checkDailyReset() from wiping the done state mid-call
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    markAllDone();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).not.toBe(
      "none",
    );
    resetDoneToday();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).toBe(
      "none",
    );
  });
});

// ── Sprint v7.13: checkbox change handler — badge.style.display="none" + doneMsg (lines 146, 150) ──

describe("Tasks — badge hides + doneMsg shows when last task checked via checkbox (lines 146, 150)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("shows '1 / 1 ✓' badge (not hidden) when last task checked (line 146)", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    // Badge shows "1 / 1 ✓ (100%)" when all tasks done (not hidden)
    expect(badge.textContent).toBe("1 / 1 ✓ (100%)");
    expect(badge.style.display).not.toBe("none");
  });

  it("shows #tasks-all-done-msg when last task checked (line 150)", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]));
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).toBe("");
  });
});

// ── Sprint v7.1.7: N/M badge counter ─────────────────────────────────────────

describe("Tasks — N/M done counter badge (v7.1.7)", () => {
  beforeEach(() => {
    localStorage.removeItem("dash_chores");
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("badge shows '0 / 2 ✓' when no tasks are done", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "A", chore: "task1" },
        { person: "A", chore: "task2" },
      ]),
    );
    renderTasksCard();
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("0 / 2 ✓ (0%)");
    expect(badge.style.display).not.toBe("none");
  });

  it("badge shows '1 / 2 ✓ (50%)' after checking one of two tasks", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "A", chore: "task1" },
        { person: "A", chore: "task2" },
      ]),
    );
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("1 / 2 ✓ (50%)");
  });

  it("badge shows '2 / 2 ✓ (100%)' after all tasks are done", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "A", chore: "task1" },
        { person: "A", chore: "task2" },
      ]),
    );
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    cbs[1].checked = true;
    cbs[1].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("2 / 2 ✓ (100%)");
  });
});

// ── Sprint v7.1.7: N/M badge counter ─────────────────────────────────────────

describe("Tasks — N/M done counter badge (v7.1.7)", () => {
  beforeEach(() => {
    localStorage.removeItem("dash_chores");
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("badge shows '0 / 2 ✓' when no tasks are done", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "A", chore: "task1" },
        { person: "A", chore: "task2" },
      ]),
    );
    renderTasksCard();
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("0 / 2 ✓ (0%)");
    expect(badge.style.display).not.toBe("none");
  });

  it("badge shows '1 / 2 ✓ (50%)' after checking one of two tasks", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "A", chore: "task1" },
        { person: "A", chore: "task2" },
      ]),
    );
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("1 / 2 ✓ (50%)");
  });

  it("badge shows '2 / 2 ✓ (100%)' after all tasks are done", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "A", chore: "task1" },
        { person: "A", chore: "task2" },
      ]),
    );
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    cbs[1].checked = true;
    cbs[1].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("2 / 2 ✓ (100%)");
  });
});

// ── F3 (v7.3): removeDoneTasks ──────────────────────────────────────────────

describe("Tasks — removeDoneTasks (F3 v7.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("removes done items and keeps undone ones", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><span id="tasks-pending-badge"></span>`;
    const chores = [
      { person: "Alice", chore: "Laundry" },
      { person: "Bob", chore: "Dishes" },
    ];
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    removeDoneTasks();
    const remaining = JSON.parse(localStorage.getItem("dash_chores") ?? "[]") as unknown[];
    expect(remaining).toHaveLength(1);
  });

  it("clears done map after removing", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><span id="tasks-pending-badge"></span>`;
    const chores = [{ person: "A", chore: "X" }];
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    renderTasksCard();
    const cb = document.querySelector<HTMLInputElement>(".tasks-cb")!;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    removeDoneTasks();
    expect(localStorage.getItem("dash_tasks_done")).toBeNull();
  });

  it("does nothing when no tasks are done", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><span id="tasks-pending-badge"></span>`;
    const chores = [
      { person: "A", chore: "X" },
      { person: "B", chore: "Y" },
    ];
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    renderTasksCard();
    removeDoneTasks();
    const remaining = JSON.parse(localStorage.getItem("dash_chores") ?? "[]") as unknown[];
    expect(remaining).toHaveLength(2);
  });
});

// ── F8 (v7.3): Person filter chips ───────────────────────────────────────────

describe("Tasks — person filter chips (F8 v7.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders filter chips when multiple persons exist", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><div id="tasks-filter-bar"></div><span id="tasks-pending-badge"></span>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "Alice", chore: "A" },
        { person: "Bob", chore: "B" },
      ]),
    );
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-person-chip");
    expect(chips.length).toBe(2);
  });

  it("does not render chips when only one person", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><div id="tasks-filter-bar"></div><span id="tasks-pending-badge"></span>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "Alice", chore: "A" },
        { person: "Alice", chore: "B" },
      ]),
    );
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-person-chip");
    expect(chips.length).toBe(0);
  });

  it("clicking a chip filters tasks, clicking again shows all", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><div id="tasks-filter-bar"></div><span id="tasks-pending-badge"></span>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([
        { person: "Alice", chore: "A" },
        { person: "Bob", chore: "B" },
        { person: "Alice", chore: "C" },
      ]),
    );
    renderTasksCard();
    expect(document.querySelectorAll(".tasks-cb").length).toBe(3);
    document.querySelector<HTMLButtonElement>(".tasks-person-chip")!.click();
    expect(document.querySelectorAll(".tasks-cb").length).toBe(2);
    document.querySelector<HTMLButtonElement>(".tasks-person-chip")!.click();
    expect(document.querySelectorAll(".tasks-cb").length).toBe(3);
  });
});
// ── Sprint 24: parseTaskPriority ─────────────────────────────────────────────

describe("Tasks — parseTaskPriority", () => {
  it("returns high priority for [H] prefix", () => {
    const r = parseTaskPriority("[H] vaccuum");
    expect(r.priority).toBe("high");
    expect(r.cleanText).toBe("vaccuum");
  });

  it("returns medium priority for [M] prefix", () => {
    const r = parseTaskPriority("[M]dishes");
    expect(r.priority).toBe("medium");
    expect(r.cleanText).toBe("dishes");
  });

  it("returns low priority for [L] prefix", () => {
    const r = parseTaskPriority("[l] water plants");
    expect(r.priority).toBe("low");
    expect(r.cleanText).toBe("water plants");
  });

  it("returns none when no prefix", () => {
    const r = parseTaskPriority("buy milk");
    expect(r.priority).toBe("none");
    expect(r.cleanText).toBe("buy milk");
  });

  it("handles [H] case-insensitively", () => {
    expect(parseTaskPriority("[h] task").priority).toBe("high");
  });
});

// ── Sprint 24: parseTaskDueDate ──────────────────────────────────────────────

describe("Tasks — parseTaskDueDate", () => {
  it("extracts @YYYY-MM-DD suffix", () => {
    const r = parseTaskDueDate("buy milk @2025-12-31");
    expect(r.dueDate).toBe("2025-12-31");
    expect(r.cleanText).toBe("buy milk");
  });

  it("returns null dueDate when no suffix", () => {
    const r = parseTaskDueDate("no date here");
    expect(r.dueDate).toBeNull();
    expect(r.cleanText).toBe("no date here");
  });

  it("handles suffix with no space before @", () => {
    const r = parseTaskDueDate("task@2025-01-01");
    expect(r.dueDate).toBe("2025-01-01");
  });
});

// ── Sprint 24: isOverdue ─────────────────────────────────────────────────────

describe("Tasks — isOverdue", () => {
  it("returns true for a past date", () => {
    expect(isOverdue("2000-01-01")).toBe(true);
  });

  it("returns false for a future date", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
  });

  it("returns false for an invalid string", () => {
    expect(isOverdue("not-a-date")).toBe(false);
  });
});

// ── Sprint 24: formatTaskDueDate ─────────────────────────────────────────────

describe("Tasks — formatTaskDueDate", () => {
  it("returns a formatted string for a valid date", () => {
    const s = formatTaskDueDate("2024-06-15");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  it("returns the input unchanged for an invalid date", () => {
    expect(formatTaskDueDate("bad-date")).toBe("bad-date");
  });
});

// ── Sprint 24: taskCompletionRatio ────────────────────────────────────────────

describe("Tasks — taskCompletionRatio", () => {
  const chores = [
    { person: "עמרי", chore: "מטאטא" },
    { person: "עמרי", chore: "שואב אבק" },
    { person: "ריבה", chore: "כביסה" },
  ];

  it("returns 0/3 with empty done map", () => {
    const r = taskCompletionRatio(chores, {});
    expect(r.total).toBe(3);
    expect(r.done).toBe(0);
    expect(r.pct).toBe(0);
  });

  it("returns 1/3 with one task done", () => {
    const r = taskCompletionRatio(chores, { "עמרי::מטאטא": true });
    expect(r.done).toBe(1);
    expect(r.pct).toBe(33);
  });

  it("returns 3/3 with all done", () => {
    const map = { "עמרי::מטאטא": true, "עמרי::שואב אבק": true, "ריבה::כביסה": true };
    const r = taskCompletionRatio(chores, map);
    expect(r.done).toBe(3);
    expect(r.pct).toBe(100);
  });

  it("returns 0/0 with empty chores", () => {
    const r = taskCompletionRatio([], {});
    expect(r.total).toBe(0);
    expect(r.pct).toBe(0);
  });
});

// ── Sprint 47: isDueToday ───────────────────────────────────────────────────

describe("Tasks — isDueToday (Sprint 47)", () => {
  it("returns true for today's date string", () => {
    const today = new Date();
    const s = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(isDueToday(s)).toBe(true);
  });

  it("returns false for a past date", () => {
    expect(isDueToday("2000-01-01")).toBe(false);
  });

  it("returns false for a future date", () => {
    expect(isDueToday("2099-12-31")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isDueToday("")).toBe(false);
  });
});

// ── Sprint 47: due-today CSS class ──────────────────────────────────────────

describe("Tasks — due-today class on row (Sprint 47)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("adds due-today class to row when chore is due today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 12, 0, 0)); // 2025-06-15
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "מטאטא @2025-06-15" }]),
    );
    localStorage.setItem(
      "dash_tasks_reset_date",
      `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`,
    );
    renderTasksCard();
    const row = document.querySelector(".tasks-row");
    expect(row?.classList.contains("due-today")).toBe(true);
    expect(row?.classList.contains("overdue")).toBe(false);
  });

  it("adds overdue class (not due-today) to row when chore was yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 16, 12, 0, 0)); // 2025-06-16, chore due 2025-06-15
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "מטאטא @2025-06-15" }]),
    );
    localStorage.setItem(
      "dash_tasks_reset_date",
      `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`,
    );
    renderTasksCard();
    const row = document.querySelector(".tasks-row");
    expect(row?.classList.contains("overdue")).toBe(true);
    expect(row?.classList.contains("due-today")).toBe(false);
  });

  it("chip has tasks-due-today class when due today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 12, 0, 0));
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "מטאטא @2025-06-15" }]),
    );
    localStorage.setItem(
      "dash_tasks_reset_date",
      `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`,
    );
    renderTasksCard();
    const chip = document.querySelector(".tasks-due");
    expect(chip?.classList.contains("tasks-due-today")).toBe(true);
    expect(chip?.classList.contains("tasks-due-overdue")).toBe(false);
  });
});

// ── Sprint 47: tasksShowCategories config gate ──────────────────────────────

describe("Tasks — tasksShowCategories config gate (Sprint 47)", () => {
  const chores = [
    { person: "עמרי", chore: "מטאטא" },
    { person: "ריבה", chore: "בישול" },
  ];

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("hides person headers when tasksShowCategories is false", () => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ tasksShowCategories: false, configVersion: 3 }),
    );
    renderTasksCard();
    const headers = document.querySelectorAll(".tasks-person");
    expect(headers.length).toBe(0);
  });

  it("shows person headers when tasksShowCategories is true", () => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ tasksShowCategories: true, configVersion: 3 }),
    );
    renderTasksCard();
    const headers = document.querySelectorAll(".tasks-person");
    expect(headers.length).toBe(2);
  });
});

// ── Sprint 30: taskPriorityIcon + emoji badge in render ──────────────────────

describe("Tasks — taskPriorityIcon (Sprint 30)", () => {
  it("returns 🔴 for high", () => {
    expect(taskPriorityIcon("high")).toBe("🔴");
  });

  it("returns 🟡 for medium", () => {
    expect(taskPriorityIcon("medium")).toBe("🟡");
  });

  it("returns 🔵 for low", () => {
    expect(taskPriorityIcon("low")).toBe("🔵");
  });

  it("returns '' for none", () => {
    expect(taskPriorityIcon("none")).toBe("");
  });
});

describe("Tasks — priority emoji badge in renderTasksCard (Sprint 30)", () => {
  beforeEach(() => {
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "טל", chore: "[H] עבודה דחופה" }]),
    );
    document.body.innerHTML = '<div id="tasks-list"></div><div id="tasks-filter-chips"></div>';
  });

  afterEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("renders 🔴 emoji badge for [H] high-priority task", () => {
    renderTasksCard();
    const badge = document.querySelector(".tasks-priority.tasks-pri-high");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("🔴");
  });
});

// ── Sprint 33: countOverdueTasks ──────────────────────────────────────────

describe("Tasks — countOverdueTasks (Sprint 33)", () => {
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  it("returns 0 when no chores have due dates", () => {
    const chores: ChoreItem[] = [
      { person: "עמרי", chore: "🧹 לנקות" },
      { person: "ריבה", chore: "🛒 קניות" },
    ];
    expect(countOverdueTasks(chores)).toBe(0);
  });

  it("returns 1 when one chore has a past due date", () => {
    const chores: ChoreItem[] = [
      { person: "עמרי", chore: `[H] לנקות @${yesterday}` },
      { person: "ריבה", chore: "🛒 קניות" },
    ];
    expect(countOverdueTasks(chores)).toBe(1);
  });

  it("returns 0 when due date is in the future", () => {
    const chores: ChoreItem[] = [{ person: "עמרי", chore: `לנקות @${tomorrow}` }];
    expect(countOverdueTasks(chores)).toBe(0);
  });

  it("counts multiple overdue chores correctly", () => {
    const chores: ChoreItem[] = [
      { person: "עמרי", chore: `לנקות @${yesterday}` },
      { person: "ריבה", chore: `קניות @${yesterday}` },
      { person: "עמרי", chore: "ללא תאריך" },
    ];
    expect(countOverdueTasks(chores)).toBe(2);
  });

  it("returns 0 for an empty chore list", () => {
    expect(countOverdueTasks([])).toBe(0);
  });

  it("does not count chores with only a priority prefix (no due date)", () => {
    const chores: ChoreItem[] = [{ person: "עמרי", chore: "[H] משימה דחופה" }];
    expect(countOverdueTasks(chores)).toBe(0);
  });
});

// ── Recurrence helpers ────────────────────────────────────────────────────
describe("recurrenceResetKey", () => {
  it("returns YYYY-MM-DD for daily recurrence", () => {
    const date = new Date("2025-03-15T10:00:00");
    expect(recurrenceResetKey("daily", date)).toBe("2025-03-15");
  });

  it("returns YYYY-MM for monthly recurrence", () => {
    const date = new Date("2025-03-15T10:00:00");
    expect(recurrenceResetKey("monthly", date)).toBe("2025-03");
  });

  it("returns YYYY-WNN for weekly recurrence", () => {
    const date = new Date("2025-03-15T10:00:00"); // week 11 of 2025
    const key = recurrenceResetKey("weekly", date);
    expect(key).toMatch(/^\d{4}-W\d{2}$/u);
  });

  it("returns undefined recurrence as daily key", () => {
    const date = new Date("2025-03-15T10:00:00");
    expect(recurrenceResetKey(undefined, date)).toBe("2025-03-15");
  });

  it("returns YYYY for yearly recurrence", () => {
    const date = new Date("2025-03-15T10:00:00");
    expect(recurrenceResetKey("yearly", date)).toBe("2025");
  });

  it("returns YYYY for yearly recurrence at year end", () => {
    const date = new Date("2025-12-31T23:59:00");
    expect(recurrenceResetKey("yearly", date)).toBe("2025");
  });

  it("returns new YYYY for yearly recurrence on Jan 1", () => {
    const date = new Date("2026-01-01T00:00:00");
    expect(recurrenceResetKey("yearly", date)).toBe("2026");
  });
});

describe("checkRecurringReset", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("does nothing for a non-recurring chore", () => {
    const item: ChoreItem = { person: "דנה", chore: "ניקיון" };
    // set done state
    localStorage.setItem("dash_tasks_done", JSON.stringify({ "דנה::ניקיון": true }));
    checkRecurringReset(item);
    const done = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
    expect(done["דנה::ניקיון"]).toBe(true);
  });

  it("clears done state for weekly chore after new week starts (past reset hour)", () => {
    vi.setSystemTime(new Date("2025-03-15T08:00:00")); // hour 8, past default reset 6
    const item: ChoreItem = { person: "עמרי", chore: "קניות שבועיות", recurrence: "weekly" };
    const fp = "עמרי::קניות שבועיות";
    const lsResetKey = `tasks-reset::${fp}`;
    // Simulate: last reset was in a different week
    localStorage.setItem(lsResetKey, "2025-W10");
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    checkRecurringReset(item);
    const done = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
    expect(done[fp]).toBeUndefined();
  });

  it("does not clear done state when still in the same recurrence cycle", () => {
    vi.setSystemTime(new Date("2025-03-15T08:00:00")); // hour 8
    const item: ChoreItem = { person: "עמרי", chore: "קניות חודשיות", recurrence: "monthly" };
    const fp = "עמרי::קניות חודשיות";
    const lsResetKey = `tasks-reset::${fp}`;
    // Same month as now
    localStorage.setItem(lsResetKey, "2025-03");
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    checkRecurringReset(item);
    const done = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
    expect(done[fp]).toBe(true);
  });
});

// ── V13-DATA: recurrence badge rendering ─────────────────────────────────────

describe("Tasks — recurrence badge (V13-DATA)", () => {
  function setup(recurrence?: ChoreItem["recurrence"]) {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>`;
    const chores: ChoreItem[] = [
      { person: "עמרי", chore: "🧹 ניקיון", ...(recurrence ? { recurrence } : {}) },
    ];
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
    renderTasksCard();
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders tasks-recurrence badge for daily chore", () => {
    setup("daily");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("יומי");
  });

  it("renders tasks-recurrence badge for weekly chore", () => {
    setup("weekly");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("שבועי");
  });

  it("renders tasks-recurrence badge for monthly chore", () => {
    setup("monthly");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("חודשי");
  });

  it("does not render tasks-recurrence badge when no recurrence is set", () => {
    setup(undefined);
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge).toBeNull();
  });

  it("recurrence badge has tasks-recur-daily class for daily recurrence", () => {
    setup("daily");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge?.classList.contains("tasks-recur-daily")).toBe(true);
  });

  it("recurrence badge has title attribute describing the recurrence", () => {
    setup("weekly");
    const badge = document.querySelector(".tasks-recurrence") as HTMLElement | null;
    expect(badge?.title).toContain("weekly");
  });

  it("renders yearly recurrence badge with שנתי text", () => {
    setup("yearly");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("שנתי");
  });

  it("recurrence badge has tasks-recur-monthly class for monthly recurrence", () => {
    setup("monthly");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge?.classList.contains("tasks-recur-monthly")).toBe(true);
  });

  it("recurrence badge has tasks-recur-yearly class for yearly recurrence", () => {
    setup("yearly");
    const badge = document.querySelector(".tasks-recurrence");
    expect(badge?.classList.contains("tasks-recur-yearly")).toBe(true);
  });
});

// ── Sprint 62: Monthly recurrence edge cases ───────────────────────────────

describe("recurrenceResetKey — monthly edge cases", () => {
  it("returns zero-padded month for January", () => {
    const date = new Date("2026-01-15T10:00:00");
    expect(recurrenceResetKey("monthly", date)).toBe("2026-01");
  });

  it("returns zero-padded month for September", () => {
    const date = new Date("2026-09-01T00:00:00");
    expect(recurrenceResetKey("monthly", date)).toBe("2026-09");
  });

  it("returns December correctly", () => {
    const date = new Date("2026-12-31T23:59:59");
    expect(recurrenceResetKey("monthly", date)).toBe("2026-12");
  });

  it("returns new month key on the 1st (month boundary: Dec 31 → Jan 1)", () => {
    const dec31 = new Date("2026-12-31T12:00:00");
    const jan1 = new Date("2027-01-01T12:00:00");
    expect(recurrenceResetKey("monthly", dec31)).toBe("2026-12");
    expect(recurrenceResetKey("monthly", jan1)).toBe("2027-01");
    // Keys differ → monthly reset should fire
    expect(recurrenceResetKey("monthly", dec31)).not.toBe(recurrenceResetKey("monthly", jan1));
  });

  it("returns same key for two dates in the same month", () => {
    const d1 = new Date("2026-06-01T06:00:00");
    const d2 = new Date("2026-06-30T23:59:59");
    expect(recurrenceResetKey("monthly", d1)).toBe(recurrenceResetKey("monthly", d2));
  });

  it("differs across consecutive months (Apr → May)", () => {
    const apr = new Date("2026-04-30T12:00:00");
    const may = new Date("2026-05-01T12:00:00");
    expect(recurrenceResetKey("monthly", apr)).toBe("2026-04");
    expect(recurrenceResetKey("monthly", may)).toBe("2026-05");
  });
});

describe("checkRecurringReset — monthly cross-month", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("clears done state for monthly chore when new month starts", () => {
    // Simulate: it is now March 1 at 8am (past reset hour 6)
    vi.setSystemTime(new Date("2026-03-01T08:00:00"));
    const item: ChoreItem = { person: "עמרי", chore: "קניות חודשיות", recurrence: "monthly" };
    const fp = "עמרי::קניות חודשיות";
    const lsResetKey = `tasks-reset::${fp}`;
    // Last reset was in February
    localStorage.setItem(lsResetKey, "2026-02");
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    checkRecurringReset(item);
    const done = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
    expect(done[fp]).toBeUndefined(); // cleared by new month
  });

  it("does not clear done state when still in the same month", () => {
    vi.setSystemTime(new Date("2026-03-15T08:00:00"));
    const item: ChoreItem = { person: "עמרי", chore: "קניות חודשיות", recurrence: "monthly" };
    const fp = "עמרי::קניות חודשיות";
    const lsResetKey = `tasks-reset::${fp}`;
    localStorage.setItem(lsResetKey, "2026-03"); // same month
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    checkRecurringReset(item);
    const done = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
    expect(done[fp]).toBe(true); // preserved
  });

  it("does not clear done state before reset hour for monthly chore", () => {
    // 5am — before default reset hour (6am)
    vi.setSystemTime(new Date("2026-04-01T05:00:00"));
    const item: ChoreItem = { person: "דנה", chore: "כביסה חודשית", recurrence: "monthly" };
    const fp = "דנה::כביסה חודשית";
    const lsResetKey = `tasks-reset::${fp}`;
    localStorage.setItem(lsResetKey, "2026-03"); // old month
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    checkRecurringReset(item);
    const done = JSON.parse(localStorage.getItem("dash_tasks_done") ?? "{}") as Record<
      string,
      boolean
    >;
    expect(done[fp]).toBe(true); // not cleared yet (before reset hour)
  });

  it("updates the LS reset key to the current month after reset", () => {
    vi.setSystemTime(new Date("2026-05-01T07:00:00"));
    const item: ChoreItem = { person: "יאיר", chore: "גיבוי חודשי", recurrence: "monthly" };
    const fp = "יאיר::גיבוי חודשי";
    const lsResetKey = `tasks-reset::${fp}`;
    localStorage.setItem(lsResetKey, "2026-04"); // previous month
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    checkRecurringReset(item);
    // After reset, the LS key should reflect the current month
    expect(localStorage.getItem(lsResetKey)).toBe("2026-05");
  });

  it("handles missing LS reset key (first-ever reset) for monthly chore", () => {
    vi.setSystemTime(new Date("2026-06-01T08:00:00"));
    const item: ChoreItem = { person: "מיכל", chore: "סידור ארגזים", recurrence: "monthly" };
    const fp = "מיכל::סידור ארגזים";
    // No previous reset key in LS
    localStorage.setItem("dash_tasks_done", JSON.stringify({ [fp]: true }));
    expect(() => checkRecurringReset(item)).not.toThrow();
    // After first run, LS reset key should be set to current month
    expect(localStorage.getItem(`tasks-reset::${fp}`)).toBe("2026-06");
  });
});

// ── Sprint 83: addQuickChore edge cases ───────────────────────────────────

describe("Tasks — addQuickChore (Sprint 83)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("adds a chore to localStorage and renders", () => {
    addQuickChore("דנה", "לשטוף כלים");
    const stored = JSON.parse(localStorage.getItem("dash_chores") ?? "[]") as ChoreItem[];
    expect(stored.some((c) => c.chore === "לשטוף כלים" && c.person === "דנה")).toBe(true);
  });

  it("trims whitespace from person and chore", () => {
    addQuickChore("  דנה  ", "  כביסה  ");
    const stored = JSON.parse(localStorage.getItem("dash_chores") ?? "[]") as ChoreItem[];
    expect(stored.some((c) => c.person === "דנה" && c.chore === "כביסה")).toBe(true);
  });

  it("defaults person to 'משפחה' when person is empty string", () => {
    addQuickChore("", "נקיון כללי");
    const stored = JSON.parse(localStorage.getItem("dash_chores") ?? "[]") as ChoreItem[];
    expect(stored.some((c) => c.person === "משפחה")).toBe(true);
  });

  it("appends to existing chores (does not overwrite)", () => {
    const existing: ChoreItem[] = [{ person: "יאיר", chore: "אשפה" }];
    localStorage.setItem("dash_chores", JSON.stringify(existing));
    addQuickChore("מיכל", "קניות");
    const stored = JSON.parse(localStorage.getItem("dash_chores") ?? "[]") as ChoreItem[];
    expect(stored).toHaveLength(2);
    expect(stored[0]!.chore).toBe("אשפה");
    expect(stored[1]!.chore).toBe("קניות");
  });

  it("does not throw when tasks-list element is absent", () => {
    document.body.innerHTML = "";
    expect(() => addQuickChore("יאיר", "בדיקה")).not.toThrow();
  });
});

// ── updateTasksBadges: overdueBadge DOM branches (lines 414-422) ─────────────

describe("Tasks — overdueBadge display when overdue tasks exist (lines 414-422)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("shows overdueBadge with count when overdue tasks exist (lines 416-418)", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueYest = yesterday.toISOString().split("T")[0]!;
    const chores: ChoreItem[] = [
      { person: "יאיר", chore: `להוריד אשפה @${dueYest}` },
    ];
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>
      <div id="tasks-overdue-badge" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    renderTasksCard();
    const badge = document.getElementById("tasks-overdue-badge") as HTMLElement;
    expect(badge.style.display).toBe("");
    expect(badge.textContent).toContain("באיחור");
  });

  it("hides overdueBadge when no overdue tasks (line 420)", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueTomorrow = tomorrow.toISOString().split("T")[0]!;
    const chores: ChoreItem[] = [
      { person: "יאיר", chore: `🟡 [due:${dueTomorrow}] קניות` },
    ];
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>
      <div id="tasks-overdue-badge" style="display:"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    renderTasksCard();
    const badge = document.getElementById("tasks-overdue-badge") as HTMLElement;
    expect(badge.style.display).toBe("none");
  });

  it("skips overdueBadge update when element absent (line 414 FALSE branch)", () => {
    // No tasks-overdue-badge element in DOM → line 414 if(overdueBadge) is FALSE
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([{ person: "יאיר", chore: "עבודה" }]));
    expect(() => renderTasksCard()).not.toThrow();
  });
});

// ── Quick-add keydown Enter handler (line 564) ────────────────────────────────

describe("Tasks — quickInput keydown Enter triggers quickBtn.click (line 564)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Enter key on quickInput fires quickBtn click (line 564 TRUE branch)", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>
      <input id="tasks-quick-input" type="text" value="כביסה" />
      <input id="tasks-quick-person" type="text" value="דנה" />
      <button id="tasks-quick-add-btn">הוסף</button>`;
    initTasksCard();
    const clickSpy = vi.fn();
    const btn = document.getElementById("tasks-quick-add-btn") as HTMLButtonElement;
    btn.addEventListener("click", clickSpy);
    const input = document.getElementById("tasks-quick-input") as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("non-Enter key on quickInput does NOT fire quickBtn click (line 564 FALSE branch)", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>
      <input id="tasks-quick-input" type="text" value="כביסה" />
      <input id="tasks-quick-person" type="text" value="דנה" />
      <button id="tasks-quick-add-btn">הוסף</button>`;
    initTasksCard();
    const clickSpy = vi.fn();
    const btn = document.getElementById("tasks-quick-add-btn") as HTMLButtonElement;
    btn.addEventListener("click", clickSpy);
    const input = document.getElementById("tasks-quick-input") as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

// ── Task row ArrowDown / ArrowUp keyboard navigation ─────────────────────────

describe("Tasks — row ArrowDown/ArrowUp keyboard navigation (Sprint 167)", () => {
  const chores = [
    { person: "עמרי", chore: "🧹 לנקות" },
    { person: "עמרי", chore: "🛒 קניות" },
    { person: "עמרי", chore: "🍳 בישול" },
  ];

  beforeEach(() => {
    document.body.innerHTML = `<div id="tasks-list"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("ArrowDown focuses the next sibling row", () => {
    renderTasksCard();
    const rows = document.querySelectorAll<HTMLElement>(".tasks-row");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const focusSpy = vi.spyOn(rows[1]!, "focus");
    rows[0]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
    );
    expect(focusSpy).toHaveBeenCalled();
  });

  it("ArrowUp focuses the previous sibling row", () => {
    renderTasksCard();
    const rows = document.querySelectorAll<HTMLElement>(".tasks-row");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const focusSpy = vi.spyOn(rows[0]!, "focus");
    rows[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })
    );
    expect(focusSpy).toHaveBeenCalled();
  });

  it("ArrowDown on last row does not throw (no next sibling)", () => {
    renderTasksCard();
    const rows = document.querySelectorAll<HTMLElement>(".tasks-row");
    const last = rows[rows.length - 1]!;
    expect(() =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
      )
    ).not.toThrow();
  });

  it("ArrowUp on first row does not throw (no previous sibling)", () => {
    renderTasksCard();
    const rows = document.querySelectorAll<HTMLElement>(".tasks-row");
    const first = rows[0]!;
    expect(() =>
      first.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })
      )
    ).not.toThrow();
  });

  it("other key (Tab) is not handled by the row keydown listener", () => {
    renderTasksCard();
    const rows = document.querySelectorAll<HTMLElement>(".tasks-row");
    // Should not throw and should not call focus on adjacent rows
    const focusSpy = vi.spyOn(rows[1]!, "focus");
    rows[0]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
    );
    expect(focusSpy).not.toHaveBeenCalled();
  });
});

// ── Sprint 177 / T1: isDueThisWeek ────────────────────────────────────────

describe("Tasks — isDueThisWeek (Sprint 177)", () => {
  it("returns false for a past date (overdue)", () => {
    expect(isDueThisWeek("2000-01-01")).toBe(false);
  });

  it("returns false for today (not strictly future)", () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(isDueThisWeek(todayStr)).toBe(false);
  });

  it("returns true for tomorrow", () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(isDueThisWeek(s)).toBe(true);
  });

  it("returns true for 7 days from now", () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(isDueThisWeek(s)).toBe(true);
  });

  it("returns false for 8 days from now", () => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(isDueThisWeek(s)).toBe(false);
  });

  it("returns false for invalid date string", () => {
    expect(isDueThisWeek("not-a-date")).toBe(false);
  });
});

// ── Sprint 177 / T3: Tag chips rendering ─────────────────────────────────

describe("Tasks — tag chips rendering (Sprint 177 T3)", () => {
  function setupDom(): void {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <div id="tasks-pending-badge"></div>
      <div id="tasks-all-done-msg" style="display:none"></div>
      <div id="tasks-filter-bar"></div>
    `;
  }
  function setChores(chores: ChoreItem[]): void {
    localStorage.setItem("dash_chores", JSON.stringify(chores));
  }

  beforeEach(() => {
    localStorage.clear();
    setupDom();
  });
  afterEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("renders tag chips when tags are present", () => {
    setChores([{ person: "אלי", chore: "לנקות", tags: ["בית", "ניקיון"] }]);
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-tag");
    expect(chips.length).toBe(2);
    expect(chips[0]?.textContent).toBe("בית");
    expect(chips[1]?.textContent).toBe("ניקיון");
  });

  it("renders at most 6 tag chips", () => {
    setChores([{ person: "רון", chore: "עבודה", tags: ["א", "ב", "ג", "ד", "ה", "ו", "ז"] }]);
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-tag");
    expect(chips.length).toBe(6);
  });

  it("renders no chips when tags are absent", () => {
    setChores([{ person: "דנה", chore: "ספרים" }]);
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-tag");
    expect(chips.length).toBe(0);
  });

  it("renders no chips when tags is empty array", () => {
    setChores([{ person: "דנה", chore: "ספרים", tags: [] }]);
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-tag");
    expect(chips.length).toBe(0);
  });

  it("applies tasks-tags wrapper class", () => {
    setChores([{ person: "אלי", chore: "כביסה", tags: ["ניקיון"] }]);
    renderTasksCard();
    expect(document.querySelector(".tasks-tags")).not.toBeNull();
  });
});

// ── Sprint 203 / T2: advanceRecurringDueDate ──────────────────────────────
describe("advanceRecurringDueDate", () => {
  it("returns null for non-recurring item", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון @2025-03-10" };
    expect(advanceRecurringDueDate(item)).toBeNull();
  });

  it("returns null when no due date is embedded", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון", recurrence: "weekly" };
    expect(advanceRecurringDueDate(item)).toBeNull();
  });

  it("advances a daily task by 1 day from the due date", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון @2025-03-10", recurrence: "daily" };
    const result = advanceRecurringDueDate(item, new Date("2025-03-09"));
    expect(result).toBe("2025-03-11");
  });

  it("advances a weekly task by 7 days", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון @2025-03-10", recurrence: "weekly" };
    const result = advanceRecurringDueDate(item, new Date("2025-03-09"));
    expect(result).toBe("2025-03-17");
  });

  it("advances a monthly task by 1 month", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון @2025-03-15", recurrence: "monthly" };
    const result = advanceRecurringDueDate(item, new Date("2025-03-10"));
    expect(result).toBe("2025-04-15");
  });

  it("advances a yearly task by 1 year", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון @2025-01-01", recurrence: "yearly" };
    const result = advanceRecurringDueDate(item, new Date("2025-01-01"));
    expect(result).toBe("2026-01-01");
  });

  it("advances from today when due date is in the past", () => {
    const item: ChoreItem = { person: "אלי", chore: "ניקיון @2025-01-01", recurrence: "weekly" };
    const now = new Date("2025-03-10");
    const result = advanceRecurringDueDate(item, now);
    expect(result).toBe("2025-03-17");
  });
});
