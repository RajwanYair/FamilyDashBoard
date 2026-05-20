/**
 * Per-card quick-toggle surface (P4-S19).
 *
 * Adds a small "hide" button to every card header's `.card__hd-end` zone.
 * When clicked, the card is hidden immediately and `hiddenCards` is persisted.
 * A floating "restore" pill appears when any card is hidden, allowing
 * one-click restoration without opening settings.
 */

import { loadConfig, saveConfig } from "../core/config";
import "./card-quick-toggle.css";

const RESTORE_ID = "card-quick-restore-btn";

/** Inject quick-toggle buttons into all card headers. */
export function initCardQuickToggle(): void {
  const cards = document.querySelectorAll<HTMLElement>("[data-card-id]");
  for (const card of cards) {
    const hdEnd = card.querySelector<HTMLElement>(".card__hd-end");
    if (!hdEnd) continue;
    // Skip if already injected
    if (hdEnd.querySelector(".card-quick-hide-btn")) continue;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-quick-hide-btn";
    btn.title = "הסתר כרטיסייה — Hide card";
    btn.ariaLabel = "הסתר כרטיסייה";
    btn.textContent = "👁‍🗨";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardId = card.dataset["cardId"];
      if (cardId) hideCard(cardId);
    });
    // Insert before the collapse button
    const collapseBtn = hdEnd.querySelector(".card-collapse-btn");
    if (collapseBtn) {
      hdEnd.insertBefore(btn, collapseBtn);
    } else {
      hdEnd.appendChild(btn);
    }
  }
  updateRestorePill();
}

/** Hide a card immediately and persist to config. */
function hideCard(cardId: string): void {
  const cfg = loadConfig();
  if (!cfg.hiddenCards.includes(cardId)) {
    cfg.hiddenCards.push(cardId);
    saveConfig(cfg);
  }
  const el = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
  if (el) el.style.display = "none";
  updateRestorePill();
}

/** Show the floating restore pill when cards are hidden. */
function updateRestorePill(): void {
  const cfg = loadConfig();
  let pill = document.getElementById(RESTORE_ID) as HTMLButtonElement | null;

  if (cfg.hiddenCards.length === 0) {
    pill?.remove();
    return;
  }

  if (!pill) {
    pill = document.createElement("button");
    pill.id = RESTORE_ID;
    pill.type = "button";
    pill.className = "card-quick-restore-pill";
    pill.addEventListener("click", restoreAll);
    document.body.appendChild(pill);
  }
  pill.textContent = `👁 ${cfg.hiddenCards.length} הוסתרו — הצג הכל`;
  pill.title = "Restore all hidden cards";
}

/** Restore all hidden cards and persist. */
function restoreAll(): void {
  const cfg = loadConfig();
  cfg.hiddenCards = [];
  saveConfig(cfg);
  document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
    el.style.display = "";
  });
  updateRestorePill();
}
