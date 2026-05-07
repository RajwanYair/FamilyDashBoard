/**
 * Centralised keymap utilities
 *
 * Provides `buildHelpRows()` to auto-generate the help-overlay shortcut grid
 * from the registered `KeyboardAction[]` exported by `src/ui/keyboard.ts`.
 * Cards or modules call `registerKey()` from `keyboard.ts` to add their own
 * bindings; this module handles the *display* side.
 */

import type { KeyboardAction } from "../ui/keyboard";

/** Optional group label to categorise shortcuts in the help grid. */
export interface KeyEntry extends KeyboardAction {
  group?: string;
}

/**
 * Build `.help-row` div elements for the help overlay.
 *
 * @param actions  Array of registered keyboard actions (from `getKeyboardActions()`).
 * @param lang     `"he"` (default) or `"en"` — chooses the label language when
 *                 the description contains a ` / ` bilingual separator.
 * @returns A `DocumentFragment` containing one `.help-row` per action, ready to
 *          insert into `#help-dynamic-keys` via `replaceChildren()`.
 */
export function buildHelpRows(
  actions: readonly KeyboardAction[],
  lang: "he" | "en" = "he",
): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const action of actions) {
    const row = document.createElement("div");
    row.className = "help-row";

    const descEl = document.createElement("span");
    // Bilingual descriptions are stored as "english / עברית" — pick correct side.
    const parts = action.description.split(" / ");
    descEl.textContent =
      parts.length === 2
        ? lang === "en"
          ? (parts[0] ?? action.description)
          : (parts[1] ?? action.description)
        : action.description;

    const keyEl = document.createElement("span");
    keyEl.className = "help-key";
    // Display uppercase for single-letter keys; keep special keys as-is.
    keyEl.textContent =
      action.key.length === 1 ? action.key.toUpperCase() : action.key;

    row.appendChild(descEl);
    row.appendChild(keyEl);
    frag.appendChild(row);
  }
  return frag;
}

/**
 * Returns a sorted copy of `actions` where single-char keys
 * come first (alphabetically), followed by multi-char / symbol keys.
 * Useful for rendering a predictable help table.
 */
export function sortKeyEntries(
  actions: readonly KeyboardAction[],
): KeyboardAction[] {
  return [...actions].sort((a, b) => {
    const aShort = a.key.length === 1;
    const bShort = b.key.length === 1;
    if (aShort !== bShort) return aShort ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
}
