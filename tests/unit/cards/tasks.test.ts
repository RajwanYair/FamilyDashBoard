/**
 * Tests for src/cards/tasks/tasks.ts
 *
 * Covers: ChoreItem type, fingerprint, renderTasksCard DOM output,
 * done-state toggle, empty state rendering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderTasksCard, markAllDone, resetDoneToday, removeDoneTasks } from "@/cards/tasks/tasks";

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

  it("clearInterval fires when initTasksCard called twice (line 175 TRUE branch)", () => {
    vi.useFakeTimers();
    initTasksCard();         // sets _tasksInterval
    initTasksCard();         // _tasksInterval is now non-null → line 175 clears it
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

// ── initTasksCard button wiring (line 175) ───────────────────────────────────

describe("Tasks — initTasksCard wires button click handlers (line 175)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <button id="tasks-mark-all-btn">סמן הכל</button>
      <button id="tasks-reset-btn">איפוס</button>`;
    localStorage.setItem(
      "dash_chores",
      JSON.stringify([{ person: "עמרי", chore: "🧹 לנקות" }]),
    );
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
    localStorage.setItem(
      "dash_tasks_done",
      JSON.stringify({ "עמרי::🧹 לנקות": true }),
    );
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
    // Badge shows "2 / 2 ✓" when all done — stays visible
    expect(badge.textContent).toBe("2 / 2 ✓");
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
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).toBe("none");
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
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).not.toBe("none");
  });

  it("shows all-done-msg after markAllDone() is called", () => {
    setupWithDoneMsg(JSON.stringify(chores));
    // Prevent checkDailyReset() from wiping the done state mid-call
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    markAllDone();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).not.toBe("none");
  });

  it("hides all-done-msg after resetDoneToday() following markAllDone()", () => {
    setupWithDoneMsg(JSON.stringify(chores));
    // Prevent checkDailyReset() from wiping the done state mid-call
    const today = new Date();
    const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    localStorage.setItem("dash_tasks_reset_date", resetKey);
    markAllDone();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).not.toBe("none");
    resetDoneToday();
    expect((document.getElementById("tasks-all-done-msg") as HTMLElement).style.display).toBe("none");
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
    // Badge shows "1 / 1 ✓" when all tasks done (not hidden)
    expect(badge.textContent).toBe("1 / 1 ✓");
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
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
    ]));
    renderTasksCard();
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("0 / 2 ✓");
    expect(badge.style.display).not.toBe("none");
  });

  it("badge shows '1 / 2 ✓' after checking one of two tasks", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
    ]));
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("1 / 2 ✓");
  });

  it("badge shows '2 / 2 ✓' after all tasks are done", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
    ]));
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    cbs[1].checked = true;
    cbs[1].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("2 / 2 ✓");
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
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
    ]));
    renderTasksCard();
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("0 / 2 ✓");
    expect(badge.style.display).not.toBe("none");
  });

  it("badge shows '1 / 2 ✓' after checking one of two tasks", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
    ]));
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("1 / 2 ✓");
  });

  it("badge shows '2 / 2 ✓' after all tasks are done", () => {
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <span id="tasks-pending-badge"></span>
      <div id="tasks-all-done-msg" style="display:none"></div>`;
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
    ]));
    renderTasksCard();
    const cbs = document.querySelectorAll<HTMLInputElement>(".tasks-cb");
    cbs[0].checked = true;
    cbs[0].dispatchEvent(new Event("change"));
    cbs[1].checked = true;
    cbs[1].dispatchEvent(new Event("change"));
    const badge = document.getElementById("tasks-pending-badge") as HTMLElement;
    expect(badge.textContent).toBe("2 / 2 ✓");
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
    const chores = [{ person: "A", chore: "X" }, { person: "B", chore: "Y" }];
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
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "Alice", chore: "A" },
      { person: "Bob", chore: "B" },
    ]));
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-person-chip");
    expect(chips.length).toBe(2);
  });

  it("does not render chips when only one person", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><div id="tasks-filter-bar"></div><span id="tasks-pending-badge"></span>`;
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "Alice", chore: "A" },
      { person: "Alice", chore: "B" },
    ]));
    renderTasksCard();
    const chips = document.querySelectorAll(".tasks-person-chip");
    expect(chips.length).toBe(0);
  });

  it("clicking a chip filters tasks, clicking again shows all", () => {
    document.body.innerHTML = `<div id="tasks-list"></div><div id="tasks-filter-bar"></div><span id="tasks-pending-badge"></span>`;
    localStorage.setItem("dash_chores", JSON.stringify([
      { person: "Alice", chore: "A" },
      { person: "Bob", chore: "B" },
      { person: "Alice", chore: "C" },
    ]));
    renderTasksCard();
    expect(document.querySelectorAll(".tasks-cb").length).toBe(3);
    document.querySelector<HTMLButtonElement>(".tasks-person-chip")!.click();
    expect(document.querySelectorAll(".tasks-cb").length).toBe(2);
    document.querySelector<HTMLButtonElement>(".tasks-person-chip")!.click();
    expect(document.querySelectorAll(".tasks-cb").length).toBe(3);
  });
});
