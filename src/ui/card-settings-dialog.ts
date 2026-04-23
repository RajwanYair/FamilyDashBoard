/**
 * FamilyDashBoard — Per-Card Settings Dialog
 *
 * Adds a ⚙ settings button to each card header.
 * Clicking the button opens a <dialog> with the card's configSchema fields.
 * Only cards with a non-empty configSchema receive a settings button.
 */

import type { CardConfigField } from "@/types/card";
import { loadCard, getCard } from "@/core/card-registry";
import { loadConfig, saveConfig } from "@/core/config";
import { renderConfigFields, readConfigValues } from "@/ui/config-auto-render";
import { showToast } from "@/ui/toast";
import { t } from "@/core/i18n";
import { diagLog } from "@/core/diag";
import "./card-settings-dialog.css";

// ── Singleton dialog ───────────────────────────────────────────────────────

let _dialog: HTMLDialogElement | null = null;
let _currentCardId: string | null = null;

/** Build and return the singleton card-settings `<dialog>`, creating it once. */
function getOrCreateDialog(): HTMLDialogElement {
  if (_dialog) return _dialog;

  const dlg = document.createElement("dialog");
  dlg.id = "card-settings-dialog";
  dlg.className = "card-settings-dialog";
  dlg.setAttribute("aria-labelledby", "csd-title");

  // ── Header ──
  const header = document.createElement("header");
  header.className = "csd__header";

  const titleEl = document.createElement("h2");
  titleEl.id = "csd-title";
  titleEl.className = "csd__title";
  header.appendChild(titleEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "csd__close-btn";
  closeBtn.setAttribute("aria-label", "סגור");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => dlg.close());
  header.appendChild(closeBtn);

  dlg.appendChild(header);

  // ── Body: schema fields injected per card ──
  const body = document.createElement("div");
  body.className = "csd__body";
  dlg.appendChild(body);

  // ── Footer: Save / Cancel ──
  const footer = document.createElement("footer");
  footer.className = "csd__footer";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "csd__save-btn";
  saveBtn.textContent = "שמור";
  saveBtn.addEventListener("click", () => {
    if (!_currentCardId) {
      dlg.close();
      return;
    }
    const bodyEl = dlg.querySelector<HTMLElement>(".csd__body");
    if (!bodyEl) {
      dlg.close();
      return;
    }

    const values = readConfigValues(bodyEl);
    const cfg = loadConfig();

    // Write to flat config props (what most cards read from)
    const flatCfg = cfg as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(values)) {
      flatCfg[key] = value;
    }

    // Also write to the per-card namespace (ADR-004)
    cfg.cards ??= {};
    cfg.cards[_currentCardId] ??= {};
    const cardCfg = cfg.cards[_currentCardId];
    if (cardCfg) {
      cardCfg.settings ??= {};
      const settings = cardCfg.settings as Record<string, unknown>;
      for (const [key, value] of Object.entries(values)) {
        settings[key] = value;
      }
    }

    saveConfig(cfg);
    diagLog(`[card-settings] saved settings for "${_currentCardId}"`);
    showToast(t("settingsSaved"));
    dlg.close();
  });
  footer.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "csd__cancel-btn";
  cancelBtn.textContent = "ביטול";
  cancelBtn.addEventListener("click", () => dlg.close());
  footer.appendChild(cancelBtn);

  dlg.appendChild(footer);

  // Close when clicking the backdrop
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });

  dlg.addEventListener("close", () => {
    _currentCardId = null;
  });

  document.body.appendChild(dlg);
  _dialog = dlg;
  return dlg;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Open the per-card settings dialog for the given card.
 * Loads the card's configSchema and renders its current values.
 * No-op if the card is not registered or has no configSchema.
 */
export async function openCardSettings(cardId: string): Promise<void> {
  let fields: CardConfigField[];
  try {
    const def = await loadCard(cardId);
    fields = def.configSchema ?? [];
  } catch {
    diagLog(`[card-settings] could not load card "${cardId}"`);
    return;
  }
  if (!fields.length) return;

  const dlg = getOrCreateDialog();
  _currentCardId = cardId;

  // Set dialog title to card icon + name
  const titleEl = dlg.querySelector<HTMLElement>("#csd-title");
  if (titleEl) {
    const entry = getCard(cardId);
    titleEl.textContent = `${entry?.icon ?? "⚙"} ${entry?.titleHe ?? cardId}`;
  }

  // Populate fields with current saved values
  const cfg = loadConfig();
  const flatCfg = cfg as unknown as Record<string, unknown>;
  const values: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    const v = flatCfg[f.key];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      values[f.key] = v;
    }
  }

  const bodyEl = dlg.querySelector<HTMLElement>(".csd__body");
  if (bodyEl) renderConfigFields(fields, values, bodyEl);

  dlg.showModal();
}

/**
 * Add a ⚙ settings button to every card header in the DOM that has
 * a non-empty configSchema. Safe to call multiple times (idempotent).
 */
export async function initCardSettingsButtons(): Promise<void> {
  const cardEls = document.querySelectorAll<HTMLElement>("[data-card-id]");

  await Promise.all(
    [...cardEls].map(async (cardEl) => {
      const id = cardEl.dataset["cardId"] ?? "";
      if (!id) return;

      // Only add button if the card has configSchema fields
      let hasSettings: boolean;
      try {
        const def = await loadCard(id);
        hasSettings = (def.configSchema ?? []).length > 0;
      } catch {
        return;
      }
      if (!hasSettings) return;

      const header = cardEl.querySelector<HTMLElement>(".card__header, .card-header");
      if (!header) return;

      // Idempotent — skip if button already present
      if (header.querySelector(".card__settings-btn")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card__settings-btn";
      btn.setAttribute("aria-label", "הגדרות כרטיסית");
      btn.title = "הגדרות כרטיסית";
      btn.textContent = "⚙";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        void openCardSettings(id);
      });
      // Prefer the end slot; fall back to appending directly to header
      const endSlot = header.querySelector<HTMLElement>(".card__hd-end");
      (endSlot ?? header).appendChild(btn);
    }),
  );
}
