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
import type { CardDefinition } from "../../types/card";

export interface ChoreItem {
  person: string;
  chore: string;
}

const LS_DONE_KEY = "dash_tasks_done";
const RESET_HOUR = 6; // Reset at 6:00 AM daily

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
  if (lastReset !== resetKey && today.getHours() >= RESET_HOUR) {
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

  if (!chores.length) {
    container.textContent = "אין משימות – הוסף משימות בהגדרות ← מתקדם";
    return;
  }

  const fragment = document.createDocumentFragment();

  // Group by person
  const byPerson = new Map<string, ChoreItem[]>();
  for (const item of chores) {
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
        diagLog(`[tasks] ${fp} = ${String(cb.checked)}`);
      });

      const label = document.createElement("span");
      label.className = "tasks-chore";
      label.textContent = item.chore;

      row.append(cb, label);
      fragment.appendChild(row);
    }
  }

  container.replaceChildren(fragment);
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

// ── Init ────────────────────────────────────────────────────────────────────

let _tasksInterval: number | null = null;

export function initTasksCard(): void {
  renderTasksCard();
  if (_tasksInterval) clearInterval(_tasksInterval);
  // Re-render every hour (catches daily reset if dashboard is always on)
  _tasksInterval = window.setInterval(renderTasksCard, 60 * 60 * 1_000);

  document.getElementById("tasks-mark-all-btn")?.addEventListener("click", markAllDone);
  document.getElementById("tasks-reset-btn")?.addEventListener("click", resetDoneToday);
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
