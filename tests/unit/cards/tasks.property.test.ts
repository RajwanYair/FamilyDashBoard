/**
 * fast-check property tests — src/cards/tasks/tasks.ts (Sprint 528, extended Sprint 560)
 *
 * Properties under test:
 *  TK1. parseTaskPriority: no prefix → "none" + unchanged text
 *  TK2. parseTaskPriority: [H] → "high", [M] → "medium", [L] → "low"
 *  TK3. taskPriorityIcon: known priorities → non-empty except "none"
 *  TK4. parseTaskDueDate: no @date → null + unchanged text
 *  TK5. parseTaskDueDate: @YYYY-MM-DD → extracts date
 *  TK6. recurrenceResetKey: daily → "YYYY-MM-DD"
 *  TK7. recurrenceResetKey: monthly → "YYYY-MM"
 *  TK8. recurrenceResetKey: yearly → "YYYY"
 *  TK9. taskCompletionRatio: empty → {0,0,0}
 *  TK10. taskCompletionRatio: pct ∈ [0,100]
 *  TK11. addSubtask: result length = input length + 1
 *  TK12. addSubtask: new item has correct parentId
 *  TK13. getSubtasks: filters only children of parentId
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseTaskPriority,
  taskPriorityIcon,
  parseTaskDueDate,
  recurrenceResetKey,
  taskCompletionRatio,
  addSubtask,
  getSubtasks,
} from "@/cards/tasks/tasks";

// ── TK1: no prefix → "none" ─────────────────────────────────────────────────

describe("tasks — TK1: parseTaskPriority no prefix", () => {
  it("returns 'none' for arbitrary text without [H/M/L]", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter((s) => !/^\[[HMLhml]\]/u.test(s)),
        (text) => {
          const { priority, cleanText } = parseTaskPriority(text);
          expect(priority).toBe("none");
          expect(cleanText).toBe(text);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── TK2: [H/M/L] → correct priority ────────────────────────────────────────

describe("tasks — TK2: parseTaskPriority with prefix", () => {
  it("[H] → high", () => {
    expect(parseTaskPriority("[H] Do laundry").priority).toBe("high");
    expect(parseTaskPriority("[H] Do laundry").cleanText).toBe("Do laundry");
  });
  it("[M] → medium", () => {
    expect(parseTaskPriority("[M] Buy groceries").priority).toBe("medium");
  });
  it("[L] → low", () => {
    expect(parseTaskPriority("[L] Water plants").priority).toBe("low");
  });
  it("case-insensitive", () => {
    expect(parseTaskPriority("[h] test").priority).toBe("high");
    expect(parseTaskPriority("[m] test").priority).toBe("medium");
    expect(parseTaskPriority("[l] test").priority).toBe("low");
  });
});

// ── TK3: taskPriorityIcon ────────────────────────────────────────────────────

describe("tasks — TK3: taskPriorityIcon", () => {
  it("high → 🔴, medium → 🟡, low → 🔵, none → ''", () => {
    expect(taskPriorityIcon("high")).toBe("🔴");
    expect(taskPriorityIcon("medium")).toBe("🟡");
    expect(taskPriorityIcon("low")).toBe("🔵");
    expect(taskPriorityIcon("none")).toBe("");
  });
});

// ── TK4: parseTaskDueDate no @date ───────────────────────────────────────────

describe("tasks — TK4: parseTaskDueDate no date", () => {
  it("returns null for text without @YYYY-MM-DD suffix", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).filter((s) => !/\s*@\d{4}-\d{2}-\d{2}$/.test(s)),
        (text) => {
          const { dueDate, cleanText } = parseTaskDueDate(text);
          expect(dueDate).toBeNull();
          expect(cleanText).toBe(text);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── TK5: parseTaskDueDate with @date ─────────────────────────────────────────

describe("tasks — TK5: parseTaskDueDate with date", () => {
  it("extracts the date and strips it from text", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (y, m, d) => {
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const input = `Buy milk @${dateStr}`;
          const result = parseTaskDueDate(input);
          expect(result.dueDate).toBe(dateStr);
          expect(result.cleanText).toBe("Buy milk");
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── TK6: recurrenceResetKey daily ────────────────────────────────────────────

describe("tasks — TK6: recurrenceResetKey daily", () => {
  it("returns YYYY-MM-DD", () => {
    const d = new Date(2025, 2, 15); // March 15, 2025
    expect(recurrenceResetKey("daily", d)).toBe("2025-03-15");
  });
});

// ── TK7: recurrenceResetKey monthly ──────────────────────────────────────────

describe("tasks — TK7: recurrenceResetKey monthly", () => {
  it("returns YYYY-MM", () => {
    const d = new Date(2025, 0, 1); // Jan 1, 2025
    expect(recurrenceResetKey("monthly", d)).toBe("2025-01");
  });
});

// ── TK8: recurrenceResetKey yearly ───────────────────────────────────────────

describe("tasks — TK8: recurrenceResetKey yearly", () => {
  it("returns YYYY", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (d) => {
          expect(recurrenceResetKey("yearly", d)).toBe(String(d.getFullYear()));
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── TK9: taskCompletionRatio empty ───────────────────────────────────────────

describe("tasks — TK9: taskCompletionRatio empty", () => {
  it("empty list → {0,0,0}", () => {
    expect(taskCompletionRatio([], {})).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

// ── TK10: taskCompletionRatio pct in [0,100] ─────────────────────────────────

describe("tasks — TK10: taskCompletionRatio bounds", () => {
  it("pct ∈ [0,100] for any non-empty chore list", () => {
    const chores = [
      { person: "A", chore: "task1" },
      { person: "A", chore: "task2" },
      { person: "B", chore: "task3" },
    ];
    // No done
    const r0 = taskCompletionRatio(chores, {});
    expect(r0.pct).toBeGreaterThanOrEqual(0);
    expect(r0.pct).toBeLessThanOrEqual(100);
    expect(r0.total).toBe(3);
  });
});

// ── TK11: addSubtask length ──────────────────────────────────────────────────

describe("tasks — TK11: addSubtask increases length", () => {
  it("result length = input + 1", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (parentId, person, chore) => {
          const items = [{ person: "X", chore: "existing" }];
          const subtask = { person, chore };
          const result = addSubtask(parentId, subtask, items);
          expect(result.length).toBe(items.length + 1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── TK12: addSubtask sets parentId ───────────────────────────────────────────

describe("tasks — TK12: addSubtask sets parentId", () => {
  it("last item in result has correct parentId", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (parentId, chore) => {
          const subtask = { person: "Bob", chore };
          const result = addSubtask(parentId, subtask, []);
          expect(result[result.length - 1].parentId).toBe(parentId);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── TK13: getSubtasks filters correctly ──────────────────────────────────────

describe("tasks — TK13: getSubtasks filters by parentId", () => {
  it("only items with matching parentId are returned", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (parentA, parentB) => {
          fc.pre(parentA !== parentB);
          const items = [
            { person: "X", chore: "t1", parentId: parentA },
            { person: "Y", chore: "t2", parentId: parentB },
            { person: "Z", chore: "t3", parentId: parentA },
          ];
          const result = getSubtasks(parentA, items);
          expect(result.length).toBe(2);
          for (const r of result) {
            expect(r.parentId).toBe(parentA);
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});
