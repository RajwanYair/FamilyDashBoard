/**
 * Tests for src/core/keymap.ts
 *
 * Covers: buildHelpRows(), sortKeyEntries()
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildHelpRows, sortKeyEntries } from "@/core/keymap";
import type { KeyboardAction } from "@/ui/keyboard";

const makeAction = (key: string, description: string): KeyboardAction => ({
  key,
  description,
  handler: () => undefined,
});

// ── buildHelpRows ──────────────────────────────────────────────────────────

describe("buildHelpRows", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("returns an empty fragment for an empty actions array", () => {
    const frag = buildHelpRows([], "he");
    expect(frag.childNodes.length).toBe(0);
  });

  it("creates one .help-row per action", () => {
    const actions = [makeAction("t", "theme"), makeAction("d", "diag")];
    const frag = buildHelpRows(actions, "he");
    container.appendChild(frag);
    expect(container.querySelectorAll(".help-row").length).toBe(2);
  });

  it("renders .help-key with uppercase letter for single-char keys", () => {
    const frag = buildHelpRows([makeAction("t", "theme")], "he");
    container.appendChild(frag);
    const keyEl = container.querySelector(".help-key");
    expect(keyEl?.textContent).toBe("T");
  });

  it("renders multi-char key as-is (no uppercase coercion)", () => {
    const frag = buildHelpRows([makeAction("escape", "close")], "he");
    container.appendChild(frag);
    const keyEl = container.querySelector(".help-key");
    expect(keyEl?.textContent).toBe("escape");
  });

  it("renders Hebrew description when lang='he' and description is monolingual", () => {
    const frag = buildHelpRows([makeAction("t", "ערכת נושא")], "he");
    container.appendChild(frag);
    const descEl = container.querySelector(".help-row > span:first-child");
    expect(descEl?.textContent).toBe("ערכת נושא");
  });

  it("picks English side of bilingual 'en / he' description when lang='en'", () => {
    const frag = buildHelpRows([makeAction("t", "Theme / ערכת נושא")], "en");
    container.appendChild(frag);
    const descEl = container.querySelector(".help-row > span:first-child");
    expect(descEl?.textContent).toBe("Theme");
  });

  it("picks Hebrew side of bilingual 'en / he' description when lang='he'", () => {
    const frag = buildHelpRows([makeAction("t", "Theme / ערכת נושא")], "he");
    container.appendChild(frag);
    const descEl = container.querySelector(".help-row > span:first-child");
    expect(descEl?.textContent).toBe("ערכת נושא");
  });

  it("defaults lang to 'he' when second argument is omitted", () => {
    const frag = buildHelpRows([makeAction("t", "Theme / ערכת נושא")]);
    container.appendChild(frag);
    const descEl = container.querySelector(".help-row > span:first-child");
    expect(descEl?.textContent).toBe("ערכת נושא");
  });

  it("falls back to full description when split yields only one part", () => {
    const frag = buildHelpRows([makeAction("t", "OnlyOneLabel")], "en");
    container.appendChild(frag);
    const descEl = container.querySelector(".help-row > span:first-child");
    expect(descEl?.textContent).toBe("OnlyOneLabel");
  });

  it("each .help-row has exactly two child spans", () => {
    const frag = buildHelpRows([makeAction("h", "help")], "he");
    container.appendChild(frag);
    const row = container.querySelector(".help-row");
    expect(row?.children.length).toBe(2);
  });

  it("does not mutate the original actions array", () => {
    const actions: KeyboardAction[] = [makeAction("s", "settings")];
    const copy = [...actions];
    buildHelpRows(actions, "he");
    expect(actions.length).toBe(copy.length);
    expect(actions[0]?.key).toBe(copy[0]?.key);
  });
});

// ── sortKeyEntries ─────────────────────────────────────────────────────────

describe("sortKeyEntries", () => {
  it("returns an empty array for empty input", () => {
    expect(sortKeyEntries([])).toEqual([]);
  });

  it("sorts single-char keys before multi-char keys", () => {
    const actions = [makeAction("escape", "close"), makeAction("t", "theme")];
    const sorted = sortKeyEntries(actions);
    expect(sorted[0]?.key).toBe("t");
    expect(sorted[1]?.key).toBe("escape");
  });

  it("sorts single-char keys alphabetically among themselves", () => {
    const actions = [makeAction("t", "a"), makeAction("b", "b"), makeAction("a", "c")];
    const sorted = sortKeyEntries(actions);
    expect(sorted.map((a) => a.key)).toEqual(["a", "b", "t"]);
  });

  it("sorts multi-char keys alphabetically among themselves", () => {
    const actions = [makeAction("escape", "a"), makeAction("arrowup", "b")];
    const sorted = sortKeyEntries(actions);
    expect(sorted.map((a) => a.key)).toEqual(["arrowup", "escape"]);
  });

  it("does not mutate the original actions array", () => {
    const actions = [makeAction("z", "last"), makeAction("a", "first")];
    sortKeyEntries(actions);
    expect(actions[0]?.key).toBe("z");
  });

  it("returns a new array (not the same reference)", () => {
    const actions = [makeAction("t", "theme")];
    const result = sortKeyEntries(actions);
    expect(result).not.toBe(actions);
  });

  it("preserves all entries (no data loss)", () => {
    const actions = [makeAction("+", "plus"), makeAction("-", "minus"), makeAction("h", "help")];
    const sorted = sortKeyEntries(actions);
    expect(sorted.length).toBe(3);
    const keys = sorted.map((a) => a.key);
    expect(keys).toContain("+");
    expect(keys).toContain("-");
    expect(keys).toContain("h");
  });
});
