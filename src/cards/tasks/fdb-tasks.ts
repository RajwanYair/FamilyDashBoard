import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initTasksCard, destroyTasksCard, renderTasksCard } from "./tasks";

export class FdbTasksCard extends FdbCard {
  override connect(): void {
    const { header, body } = this.buildShell("✅", "משימות", "Tasks");

    if (body.childElementCount === 0) {
      body.classList.add("tasks-body");

      const pendingBadge = document.createElement("span");
      pendingBadge.id = "tasks-pending-badge";
      pendingBadge.style.display = "none";
      pendingBadge.style.fontSize = "0.65em";
      pendingBadge.style.background = "var(--warning)";
      pendingBadge.style.color = "#000";
      pendingBadge.style.padding = "1px 5px";
      pendingBadge.style.borderRadius = "4px";
      pendingBadge.style.fontWeight = "700";
      pendingBadge.style.marginRight = "4px";
      pendingBadge.style.verticalAlign = "middle";
      header.appendChild(pendingBadge);

      const overdueBadge = document.createElement("span");
      overdueBadge.id = "tasks-overdue-badge";
      overdueBadge.style.display = "none";
      overdueBadge.style.fontSize = "0.65em";
      overdueBadge.style.background = "var(--negative,#f87171)";
      overdueBadge.style.color = "#fff";
      overdueBadge.style.padding = "1px 5px";
      overdueBadge.style.borderRadius = "4px";
      overdueBadge.style.fontWeight = "700";
      overdueBadge.style.marginRight = "4px";
      overdueBadge.style.verticalAlign = "middle";
      overdueBadge.title = "משימות באיחור";
      header.appendChild(overdueBadge);

      const actions = document.createElement("div");
      actions.className = "tasks-actions";

      const markAllButton = FdbCard.createEl("button", "tasks-action-btn", "✅ סמן הכל");
      markAllButton.type = "button";
      markAllButton.id = "tasks-mark-all-btn";
      markAllButton.title = "סמן הכל כבוצע";
      actions.appendChild(markAllButton);

      const resetButton = FdbCard.createEl("button", "tasks-action-btn tasks-action-reset", "🔄 אפס");
      resetButton.type = "button";
      resetButton.id = "tasks-reset-btn";
      resetButton.title = "אפס סימוני היום";
      actions.appendChild(resetButton);

      const removeDoneButton = FdbCard.createEl("button", "tasks-action-btn", "🗑 הסר בוצעות");
      removeDoneButton.type = "button";
      removeDoneButton.id = "tasks-remove-done-btn";
      removeDoneButton.title = "הסר משימות שבוצעו מהרשימה";
      actions.appendChild(removeDoneButton);

      body.appendChild(actions);

      const filterBar = document.createElement("div");
      filterBar.id = "tasks-filter-bar";
      filterBar.className = "tasks-filter-bar";
      body.appendChild(filterBar);

      const quickAdd = document.createElement("div");
      quickAdd.className = "tasks-quick-add";
      quickAdd.id = "tasks-quick-add";

      const quickInput = document.createElement("input");
      quickInput.type = "text";
      quickInput.id = "tasks-quick-input";
      quickInput.placeholder = "📝 משימה חדשה...";
      quickInput.autocomplete = "off";
      quickAdd.appendChild(quickInput);

      const quickPerson = document.createElement("input");
      quickPerson.type = "text";
      quickPerson.id = "tasks-quick-person";
      quickPerson.placeholder = "שם";
      quickPerson.style.width = "70px";
      quickAdd.appendChild(quickPerson);

      const quickAddButton = FdbCard.createEl("button", undefined, "➕");
      quickAddButton.type = "button";
      quickAddButton.id = "tasks-quick-add-btn";
      quickAddButton.title = "הוסף משימה";
      quickAdd.appendChild(quickAddButton);

      body.appendChild(quickAdd);

      const list = document.createElement("div");
      list.className = "tasks-list";
      list.id = "tasks-list";
      body.appendChild(list);

      const allDone = document.createElement("div");
      allDone.id = "tasks-all-done-msg";
      allDone.style.display = "none";
      allDone.style.textAlign = "center";
      allDone.style.padding = "10px 0";
      allDone.style.fontSize = "1.1em";
      allDone.style.color = "var(--success-color,#4caf50)";
      allDone.textContent = "🎉 כל המשימות הושלמו! כל הכבוד!";
      body.appendChild(allDone);
    }

    initTasksCard();
    diagLog("FDB-065: [fdb-tasks] connected");
  }

  override disconnect(): void {
    destroyTasksCard();
  }

  override refresh(): Promise<void> {
    renderTasksCard();
    return Promise.resolve();
  }
}

if (!customElements.get("fdb-tasks")) {
  customElements.define("fdb-tasks", FdbTasksCard);
}
