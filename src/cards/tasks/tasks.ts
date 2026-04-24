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
import { trustedHTML } from "../../core/trusted-types";
import { loadConfig } from "../../core/config";
import { initAutoLoopScroll } from "../../core/auto-loop-scroll";
import { LS_TASKS_DONE, LS_TASKS_RESET, LS_CHORES } from "../../core/constants";
import type { CardDefinition, CardConfigField } from "../../types/card";

export interface ChoreItem {
  person: string;
  chore: string;
  /** Optional recurrence — if set, the task auto-resets after each cycle. */
  recurrence?: "daily" | "weekly" | "monthly" | "yearly";
}

// LS_TASKS_DONE and LS_CHORES imported from constants
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
    const raw = localStorage.getItem(LS_TASKS_DONE);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveDoneMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(LS_TASKS_DONE, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/** Check if the stored done-state needs a daily reset. */
function checkDailyReset(): void {
  const lastReset = localStorage.getItem(LS_TASKS_RESET);
  const today = new Date();
  const resetKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const resetHour = loadConfig().tasksResetHour ?? DEFAULT_RESET_HOUR;
  if (lastReset !== resetKey && today.getHours() >= resetHour) {
    localStorage.removeItem(LS_TASKS_DONE);
    try {
      localStorage.setItem(LS_TASKS_RESET, resetKey);
    } catch {
      /* quota */
    }
  }
}

/**
 * Return a reset-key string for a recurring task at the given date.
 * - daily:   "YYYY-MM-DD"
 * - weekly:  "YYYY-WW"  (ISO week number)
 * - monthly: "YYYY-MM"
 */
export function recurrenceResetKey(
  recurrence: ChoreItem["recurrence"],
  now: Date = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  if (recurrence === "yearly") return `${y}`;
  if (recurrence === "monthly") return `${y}-${m}`;
  if (recurrence === "weekly") {
    // ISO week: day 4 (Thursday) of the week sets the year
    const jan1 = new Date(y, 0, 1);
    const week = Math.ceil(
      ((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7,
    );
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  return `${y}-${m}-${d}`;
}

/**
 * Check if a recurring chore's done-state should be cleared for the new cycle.
 * Uses a per-task LS key: `tasks-reset::<fingerprint>`.
 */
export function checkRecurringReset(item: ChoreItem): void {
  if (!item.recurrence) return;
  const fp = fingerprint(item);
  const lsKey = `tasks-reset::${fp}`;
  const resetHour = loadConfig().tasksResetHour ?? DEFAULT_RESET_HOUR;
  const now = new Date();
  if (now.getHours() < resetHour) return; // not yet reset time
  const currentKey = recurrenceResetKey(item.recurrence, now);
  const lastKey = localStorage.getItem(lsKey);
  if (lastKey === currentKey) return; // already reset this cycle
  // Clear done state for this task
  const doneMap = loadDoneMap();
  delete doneMap[fp];
  saveDoneMap(doneMap);
  try {
    localStorage.setItem(lsKey, currentKey);
  } catch {
    /* quota */
  }
}

// ── Chore loader ───────────────────────────────────────────────────────────

function loadChores(): ChoreItem[] {
  try {
    const raw = localStorage.getItem(LS_CHORES);
    if (!raw) return [];
    const chores = JSON.parse(raw) as ChoreItem[];
    // Apply per-task recurring reset for weekly/monthly chores
    chores.forEach((item) => checkRecurringReset(item));
    return chores;
  } catch {
    return [];
  }
}

// ── Sprint 24: Priority + Due-date helpers ─────────────────────────────────

/** Priority levels derived from a `[H]`/`[M]`/`[L]` prefix in the chore text. */
export type TaskPriority = "high" | "medium" | "low" | "none";

/** Priority color map — CSS variable names. */
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "var(--danger,  #f87171)",
  medium: "var(--warning, #fbbf24)",
  low: "var(--positive,#34d399)",
  none: "",
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
  const priority: TaskPriority = letter === "H" ? "high" : letter === "M" ? "medium" : "low";
  return { priority, cleanText: chore.slice(m[0].length) };
}

/**
 * Sprint 30: Return a color emoji icon for a task priority level.
 * high → 🔴 · medium → 🟡 · low → 🔵 · none → ""
 */
export function taskPriorityIcon(priority: TaskPriority): string {
  if (priority === "high") return "🔴";
  if (priority === "medium") return "🟡";
  if (priority === "low") return "🔵";
  return "";
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
 * Sprint 47: Returns true when `dueDateStr` is exactly today.
 */
export function isDueToday(dueDateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dueDateStr === todayStr;
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
 * Sprint 33: Count chores that have an overdue due-date (@YYYY-MM-DD before today).
 * Chores without a due-date are not counted.
 */
export function countOverdueTasks(chores: ChoreItem[]): number {
  let count = 0;
  for (const item of chores) {
    const { dueDate } = parseTaskDueDate(item.chore);
    if (dueDate && isOverdue(dueDate)) count++;
  }
  return count;
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
  const cfg = loadConfig();

  // F8 (v7.3): Render person filter chips
  renderFilterChips(chores);

  // Apply active person filter
  const visibleChores =
    _filterPerson !== null ? chores.filter((c) => c.person === _filterPerson) : chores;

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
    // Sprint 47: person headers gated by tasksShowCategories config
    if (cfg.tasksShowCategories) {
      const personHdr = document.createElement("div");
      personHdr.className = "tasks-person";
      personHdr.textContent = person;
      fragment.appendChild(personHdr);
    }

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
        diagLog(`FDB-048: [tasks] ${fp} = ${String(cb.checked)}`);
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
        // Sprint 30: emoji icons for better TV readability
        badge.textContent = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🔵";
        badge.title =
          priority === "high"
            ? "עדיפות גבוהה"
            : priority === "medium"
              ? "עדיפות בינונית"
              : "עדיפות נמוכה";
        row.appendChild(badge);
      }

      // Due date chip + overdue / due-today class
      if (dueDate) {
        const overdue = isOverdue(dueDate);
        const dueToday = !overdue && isDueToday(dueDate);
        if (overdue) row.classList.add("overdue");
        if (dueToday) row.classList.add("due-today");
        const chip = document.createElement("span");
        chip.className = `tasks-due${overdue ? " tasks-due-overdue" : dueToday ? " tasks-due-today" : ""}`;
        chip.textContent = `📅 ${formatTaskDueDate(dueDate)}`;
        row.appendChild(chip);
      }

      // V13-DATA: Recurrence badge (daily/weekly/monthly)
      if (item.recurrence) {
        const recBadge = document.createElement("span");
        recBadge.className = `tasks-recurrence tasks-recur-${item.recurrence}`;
        const RECUR_ICONS: Record<string, string> = {
          daily: "🔄 יומי",
          weekly: "📅 שבועי",
          monthly: "📆 חודשי",
          yearly: "📅 שנתי",
        };
        recBadge.textContent = RECUR_ICONS[item.recurrence] ?? "🔄";
        recBadge.title = `משימה חוזרת: ${item.recurrence}`;
        row.appendChild(recBadge);
      }

      row.append(cb, label);
      fragment.appendChild(row);
    }
  }

  container.replaceChildren(fragment);

  // Update tasks badge: show "done / total" counter + all-done message
  const badge = document.getElementById("tasks-pending-badge");
  const doneMsg = document.getElementById("tasks-all-done-msg");
  const overdueBadge = document.getElementById("tasks-overdue-badge");
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
  // Sprint 33: Overdue badge
  if (overdueBadge) {
    const overdueCount = countOverdueTasks(chores);
    if (overdueCount > 0) {
      overdueBadge.textContent = `⚠️ ${overdueCount} באיחור`;
      overdueBadge.style.display = "";
    } else {
      overdueBadge.style.display = "none";
    }
  }

  // Start loop scroll if task list overflows its visible area
  const listEl = document.getElementById("tasks-list");
  if (listEl instanceof HTMLElement) {
    initAutoLoopScroll(listEl, { styleId: "tasks-list-scroll-style", pxPerSec: 35 });
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
  diagLog("FDB-049: [tasks] All marked done");
}

/** Clear all done-flags for today (manual reset, ignores daily-reset hour). */
export function resetDoneToday(): void {
  localStorage.removeItem(LS_TASKS_DONE);
  renderTasksCard();
  diagLog("FDB-050: [tasks] Done flags reset");
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
    localStorage.setItem(LS_CHORES, JSON.stringify(remaining));
  } catch {
    /* quota */
  }
  localStorage.removeItem(LS_TASKS_DONE);
  renderTasksCard();
  diagLog(`FDB-051: [tasks] Removed ${removed} done item(s)`);
}

/**
 * F8 (v7.3): Render person-filter chips above the task list.
 * Only renders when more than one unique person exists.
 */
function renderFilterChips(chores: ChoreItem[]): void {
  const bar = document.getElementById("tasks-filter-bar");
  if (!bar) return;
  const persons = [...new Set(chores.map((c) => c.person))].filter(Boolean);
  bar.replaceChildren();
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
    localStorage.setItem(LS_CHORES, JSON.stringify(current));
  } catch {
    /* quota */
  }
  renderTasksCard();
  diagLog(`FDB-052: [tasks] Quick-added: "${chore}" for ${person}`);
}

// ── Init ────────────────────────────────────────────────────────────────────

let _tasksInterval: number | null = null;

function bindOnce(
  element: HTMLElement | null,
  eventName: string,
  marker: string,
  handler: EventListener,
): void {
  if (!element || element.dataset[marker] === "1") return;
  element.addEventListener(eventName, handler);
  element.dataset[marker] = "1";
}

export function initTasksCard(): void {
  renderTasksCard();
  if (_tasksInterval) clearInterval(_tasksInterval);
  // Re-render every hour (catches daily reset if dashboard is always on)
  _tasksInterval = window.setInterval(renderTasksCard, 60 * 60 * 1_000);

  bindOnce(
    document.getElementById("tasks-mark-all-btn"),
    "click",
    "fdbTasksClickBound",
    markAllDone as EventListener,
  );
  bindOnce(
    document.getElementById("tasks-reset-btn"),
    "click",
    "fdbTasksClickBound",
    resetDoneToday as EventListener,
  );
  // F3 (v7.3): Remove done tasks button
  bindOnce(
    document.getElementById("tasks-remove-done-btn"),
    "click",
    "fdbTasksClickBound",
    removeDoneTasks as EventListener,
  );

  // F7 (v7.2): Quick-add task
  const quickInput = document.getElementById("tasks-quick-input") as HTMLInputElement | null;
  const quickPerson = document.getElementById("tasks-quick-person") as HTMLInputElement | null;
  const quickBtn = document.getElementById("tasks-quick-add-btn");
  if (quickBtn && quickInput) {
    bindOnce(quickBtn, "click", "fdbTasksClickBound", (() => {
      const chore = quickInput.value.trim();
      const person = quickPerson?.value.trim() || "משפחה";
      if (!chore) return;
      addQuickChore(person, chore);
      quickInput.value = "";
      if (quickPerson) quickPerson.value = "";
    }) as EventListener);
    bindOnce(quickInput, "keydown", "fdbTasksKeydownBound", ((e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") quickBtn.click();
    }) as EventListener);
  }
}

export function destroyTasksCard(): void {
  if (_tasksInterval) {
    clearInterval(_tasksInterval);
    _tasksInterval = null;
  }
}

// ── Stream E.1: configSchema ─────────────────────────────────────────────────

export const tasksConfigSchema: CardConfigField[] = [
  {
    key: "tasksResetHour",
    labelHe: "שעת איפוס יומי (0–23)",
    labelEn: "Daily reset hour (0–23)",
    type: "number",
    defaultValue: 6,
    min: 0,
    max: 23,
    step: 1,
    tab: "display",
    group: "tasks",
  },
  {
    key: "tasksShowDone",
    labelHe: "הצג משימות שבוצעו",
    labelEn: "Show completed tasks",
    type: "boolean",
    defaultValue: true,
    tab: "display",
    group: "tasks",
  },
  {
    key: "tasksShowCategories",
    labelHe: "הצג קטגוריות",
    labelEn: "Show task categories",
    type: "boolean",
    defaultValue: false,
    tab: "display",
    group: "tasks",
  },
  {
    key: "dash_chores",
    labelHe: "רשימת משימות (JSON)",
    labelEn: "Chores list (JSON)",
    type: "textarea",
    defaultValue: "[]",
    placeholder: '[{"person":"משפחה","chore":"🧹 לנקות"}]',
    tab: "advanced",
    group: "tasks",
  },
];

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
    section.innerHTML = trustedHTML(`<div class="card-header"><span class="icon-badge green">✅</span> משימות</div><div class="tasks-body"><div class="tasks-list" id="tasks-list"></div></div>`);
    return section;
  },
  init: initTasksCard,
  destroy: destroyTasksCard,
  configSchema: tasksConfigSchema,
};
