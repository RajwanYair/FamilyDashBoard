/**
 * FamilyDashBoard v7 — Tasks Card
 *
 * Family chore/task board. Reads chores from the config panel's
 * cfg-chores JSON field, then overlays per-session completion state
 * in localStorage. No network dependency.
 *
 * Data model (localStorage key: dash_tasks_done):
 *   { [chorefingerprint]: boolean }
 *
 * Config field (`cfg-chores`) example JSON:
 *   [{"person":"עמרי","chore":"🧹 לנקות"},{"person":"ריבה","chore":"🛒 קניות"}]
 */

import { diagLog } from "../../core/diag";
import { loadConfig } from "../../core/config";
import type { CardDefinition } from "../../types/card";

export interface ChoreItem {
  person: string;
  chore: string;
}

const LS_DONE_KEY = "dash_tasks_done";
// RESET_HOUR default fallback (overridden by config.tasksResetHour at runtime)
const DEFAULT_RESET_HOUR = 6;

// F8 (v7.3): Person filter state
let _filterPerson: string | null = null;

// ── Persistence helpers ────────────────────────────────────────────────────

function fingerprint(item: ChoreItem): string {
  return `${item.person}::${item.chore}`;
}

function loadDoneMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_DONE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveDoneMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(LS_DONE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/** Check if the stored done-state needs a daily reset. */
function checkDailyReset(): void {
  const lastReset = localStorage.getItem("dash_tasks_reset_date");
  const today = new Date();
  const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const resetHour = loadConfig().tasksResetHour ?? DEFAULT_RESET_HOUR;
  if (lastReset !== resetKey && today.getHours() >= resetHour) {
    localStorage.removeItem(LS_DONE_KEY);
    try {
      localStorage.setItem("dash_tasks_reset_date", resetKey);
    } catch {
      /* quota */
    }
  }
}

// ── Chore loader ───────────────────────────────────────────────────────────

function loadChores(): ChoreItem[] {
  try {
    const raw = localStorage.getItem("dash_chores");
    if (!raw) return [];
    return JSON.parse(raw) as ChoreItem[];
  } catch {
    return [];
  }
}

// ── Sprint 24: Priority + Due-date helpers ─────────────────────────────────

/** Priority levels derived from a `[H]`/`[M]`/`[L]` prefix in the chore text. */
export type TaskPriority = "high" | "medium" | "low" | "none";

/** Priority color map — CSS variable names. */
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high:   "var(--danger,  #f87171)",
  medium: "var(--warning, #fbbf24)",
  low:    "var(--positive,#34d399)",
  none:   "",
};

/**
 * Extract the priority level from a chore text that starts with
 * `[H]`, `[M]`, or `[L]` (case-insensitive).
 * Returns `{ priority, cleanText }` where `cleanText` has the prefix removed.
 */
export function parseTaskPriority(chore: string): { priority: TaskPriority; cleanText: string } {
  const m = /^\[([HMLhml])\]\s*/u.exec(chore);
  if (!m) return { priority: "none", cleanText: chore };
  const letter = m[1]?.toUpperCase();
  const priority: TaskPriority =
    letter === "H" ? "high" : letter === "M" ? "medium" : "low";
  return { priority, cleanText: chore.slice(m[0].length) };
}

/**
 * Extract the due date from a chore text that ends with `@YYYY-MM-DD`.
 * Returns `{ dueDate, cleanText }`. `dueDate` is null when absent.
 */
export function parseTaskDueDate(chore: string): { dueDate: string | null; cleanText: string } {
  const m = /\s*@(\d{4}-\d{2}-\d{2})$/u.exec(chore);
  if (!m) return { dueDate: null, cleanText: chore };
  return { dueDate: m[1] ?? null, cleanText: chore.slice(0, chore.length - m[0].length) };
}

/**
 * Returns true when `dueDateStr` is before today (task is overdue).
 */
export function isOverdue(dueDateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDateStr + "T00:00:00");
  return !isNaN(d.getTime()) && d < today;
}

/**
 * Format a `YYYY-MM-DD` due-date string to a short Hebrew-locale string.
 */
export function formatTaskDueDate(dueDateStr: string): string {
  const d = new Date(dueDateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dueDateStr;
  return d.toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}

/**
 * Compute the completion ratio for a list of chores + done-map.
 * Returns `{ done, total, pct }` (pct is 0–100, rounded).
 */
export function taskCompletionRatio(
  chores: ChoreItem[],
  doneMap: Record<string, boolean>,
): { done: number; total: number; pct: number } {
  const total = chores.length;
  const done = chores.filter((c) => !!doneMap[fingerprint(c)]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

// ── Renderer ────────────────────────────────────────────────────────────────

/**
 * Return the pending (not-done) chores for today.
 * Used by the Hebrew-cal card to render the tasks strip.
 */
export function getTasksForToday(): ChoreItem[] {
  checkDailyReset();
  const chores = loadChores();
  const doneMap = loadDoneMap();
  return chores.filter((item) => !doneMap[fingerprint(item)]);
}

export function renderTasksCard(): void {
  const container = document.getElementById("tasks-list");
  if (!container) return;

  checkDailyReset();
  const chores = loadChores();
  const doneMap = loadDoneMap();

  // F8 (v7.3): Render person filter chips
  renderFilterChips(chores);

  // Apply active person filter
  const visibleChores =
    _filterPerson !== null
      ? chores.filter((c) => c.person === _filterPerson)
      : chores;

  if (!visibleChores.length) {
    container.textContent = chores.length
      ? "אין משימות לאדם זה"
      : "אין משימות – הוסף משימות בהגדרות ← מתקדם";
    return;
  }

  const fragment = document.createDocumentFragment();

  // Group by person
  const byPerson = new Map<string, ChoreItem[]>();
  for (const item of visibleChores) {
    const list = byPerson.get(item.person) ?? [];
    list.push(item);
    byPerson.set(item.person, list);
  }

  for (const [person, items] of byPerson) {
    const personHdr = document.createElement("div");
    personHdr.className = "tasks-person";
    personHdr.textContent = person;
    fragment.appendChild(personHdr);

    for (const item of items) {
      const fp = fingerprint(item);
      const row = document.createElement("div");
      row.className = "tasks-row" + (doneMap[fp] ? " done" : "");
      row.tabIndex = 0;
      row.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          const next = row.nextElementSibling as HTMLElement | null;
          next?.focus();
          e.preventDefault();
        } else if (e.key === "ArrowUp") {
          const prev = row.previousElementSibling as HTMLElement | null;
          prev?.focus();
          e.preventDefault();
        }
      });

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "tasks-cb";
      cb.checked = !!doneMap[fp];
      cb.title = cb.checked ? "סמן כלא בוצע" : "סמן כבוצע";
      cb.addEventListener("change", () => {
        const map = loadDoneMap();
        map[fp] = cb.checked;
        saveDoneMap(map);
        row.classList.toggle("done", cb.checked);
        // Refresh N/M badge count and all-done message (uses full chores list)
        const total2 = chores.length;
        const pending2 = chores.filter((c) => !map[fingerprint(c)]).length;
        const done2 = total2 - pending2;
        const badge = document.getElementById("tasks-pending-badge");
        const doneMsg = document.getElementById("tasks-all-done-msg");
        if (badge) {
          const pct2 = total2 > 0 ? Math.round((done2 / total2) * 100) : 0;
          badge.textContent = `${done2} / ${total2} ✓ (${pct2}%)`;
          badge.style.display = total2 > 0 ? "" : "none";
        }
        if (doneMsg) {
          doneMsg.style.display = pending2 === 0 ? "" : "none";
        }
        diagLog(`[tasks] ${fp} = ${String(cb.checked)}`);
      });

      const label = document.createElement("span");
      label.className = "tasks-chore";
      // Parse priority + due date from the chore text
      const { priority, cleanText: afterPri } = parseTaskPriority(item.chore);
      const { dueDate, cleanText } = parseTaskDueDate(afterPri);
      label.textContent = cleanText;

      // Priority badge
      if (priority !== "none") {
        const badge = document.createElement("span");
        badge.className = `tasks-priority tasks-pri-${priority}`;
        badge.style.color = PRIORITY_COLORS[priority];
        badge.textContent = priority === "high" ? "!!" : priority === "medium" ? "!" : "·";
        badge.title = priority === "high" ? "עדיפות גבוהה" : priority === "medium" ? "עדיפות בינונית" : "עדיפות נמוכה";
        row.appendChild(badge);
      }

      // Due date chip + overdue class
      if (dueDate) {
        const overdue = isOverdue(dueDate);
        if (overdue) row.classList.add("overdue");
        const chip = document.createElement("span");
        chip.className = `tasks-due${overdue ? " tasks-due-overdue" : ""}`;
        chip.textContent = `📅 ${formatTaskDueDate(dueDate)}`;
        row.appendChild(chip);
      }

      row.append(cb, label);
      fragment.appendChild(row);
    }
  }

  container.replaceChildren(fragment);

  // Update tasks badge: show "done / total" counter + all-done message
  const badge = document.getElementById("tasks-pending-badge");
  const doneMsg = document.getElementById("tasks-all-done-msg");
  const total = chores.length;
  const pending = chores.filter((item) => !doneMap[fingerprint(item)]).length;
  const done = total - pending;
  if (badge) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    badge.textContent = `${done} / ${total} ✓ (${pct}%)`;
    badge.style.display = total > 0 ? "" : "none";
  }
  if (doneMsg) {
    doneMsg.style.display = total > 0 && pending === 0 ? "" : "none";
  }
}

// ── Bulk actions ─────────────────────────────────────────────────────────────

/** Mark every chore as done for today. */
export function markAllDone(): void {
  const chores = loadChores();
  if (!chores.length) return;
  const map: Record<string, boolean> = {};
  for (const item of chores) map[fingerprint(item)] = true;
  saveDoneMap(map);
  renderTasksCard();
  diagLog("[tasks] All marked done");
}

/** Clear all done-flags for today (manual reset, ignores daily-reset hour). */
export function resetDoneToday(): void {
  localStorage.removeItem(LS_DONE_KEY);
  renderTasksCard();
  diagLog("[tasks] Done flags reset");
}

/**
 * F3 (v7.3): Remove tasks that are marked done from the permanent chores list.
 * Clears the done-map as a side effect.
 */
export function removeDoneTasks(): void {
  const chores = loadChores();
  const doneMap = loadDoneMap();
  const remaining = chores.filter((item) => !doneMap[fingerprint(item)]);
  const removed = chores.length - remaining.length;
  try {
    localStorage.setItem("dash_chores", JSON.stringify(remaining));
  } catch {
    /* quota */
  }
  localStorage.removeItem(LS_DONE_KEY);
  renderTasksCard();
  diagLog(`[tasks] Removed ${removed} done item(s)`);
}

/**
 * F8 (v7.3): Render person-filter chips above the task list.
 * Only renders when more than one unique person exists.
 */
function renderFilterChips(chores: ChoreItem[]): void {
  const bar = document.getElementById("tasks-filter-bar");
  if (!bar) return;
  const persons = [...new Set(chores.map((c) => c.person))].filter(Boolean);
  bar.innerHTML = "";
  if (persons.length <= 1) return;
  for (const person of persons) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tasks-person-chip" + (_filterPerson === person ? " active" : "");
    chip.textContent = person;
    chip.addEventListener("click", () => {
      _filterPerson = _filterPerson === person ? null : person;
      renderTasksCard();
    });
    bar.appendChild(chip);
  }
}

/**
 * F7 (v7.2): Add a quick chore to the stored list and re-render.
 * Appends to dash_chores without opening config panel.
 */
export function addQuickChore(person: string, chore: string): void {
  const current = loadChores();
  current.push({ person: person.trim() || "משפחה", chore: chore.trim() });
  try {
    localStorage.setItem("dash_chores", JSON.stringify(current));
  } catch {
    /* quota */
  }
  renderTasksCard();
  diagLog(`[tasks] Quick-added: "${chore}" for ${person}`);
}

// ── Init ────────────────────────────────────────────────────────────────────

let _tasksInterval: number | null = null;

export function initTasksCard(): void {
  renderTasksCard();
  if (_tasksInterval) clearInterval(_tasksInterval);
  // Re-render every hour (catches daily reset if dashboard is always on)
  _tasksInterval = window.setInterval(renderTasksCard, 60 * 60 * 1_000);

  document
    .getElementById("tasks-mark-all-btn")
    ?.addEventListener("click", markAllDone);
  document
    .getElementById("tasks-reset-btn")
    ?.addEventListener("click", resetDoneToday);
  // F3 (v7.3): Remove done tasks button
  document
    .getElementById("tasks-remove-done-btn")
    ?.addEventListener("click", removeDoneTasks);

  // F7 (v7.2): Quick-add task
  const quickInput = document.getElementById(
    "tasks-quick-input",
  ) as HTMLInputElement | null;
  const quickPerson = document.getElementById(
    "tasks-quick-person",
  ) as HTMLInputElement | null;
  const quickBtn = document.getElementById("tasks-quick-add-btn");
  if (quickBtn && quickInput) {
    quickBtn.addEventListener("click", () => {
      const chore = quickInput.value.trim();
      const person = quickPerson?.value.trim() || "משפחה";
      if (!chore) return;
      addQuickChore(person, chore);
      quickInput.value = "";
      if (quickPerson) quickPerson.value = "";
    });
    quickInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") quickBtn.click();
    });
  }
}

export function destroyTasksCard(): void {
  if (_tasksInterval) {
    clearInterval(_tasksInterval);
    _tasksInterval = null;
  }
}

// ── CardDefinition export (for registry) ─────────────────────────────────

export const tasksCard: CardDefinition = {
  id: "tasks",
  icon: "✅",
  titleHe: "משימות",
  titleEn: "Tasks",
  defaultSlot: { col: 2, order: 3, flexGrow: 18, hidden: false },
  defaultSize: "sm",
  render(): HTMLElement {
    const section = document.createElement("section");
    section.className = "card";
    section.dataset.cardId = "tasks";
    section.setAttribute("aria-label", "Tasks");
    section.innerHTML = `<div class="card-header"><span class="icon-badge green">✅</span> משימות</div><div class="tasks-body"><div class="tasks-list" id="tasks-list"></div></div>`;
    return section;
  },
  init: initTasksCard,
  destroy: destroyTasksCard,
};
