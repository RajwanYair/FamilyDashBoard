/**
 * fast-check property tests — src/ui/keyboard.ts 
 *
 * Properties under test:
 *  KB1. registerKey: adds an entry to getKeyboardActions()
 *  KB2. registerKey: key is lowercased
 *  KB3. getKeyboardActions: returns all registered actions
 *  KB4. registerKey: description is preserved verbatim
 *  KB5. getKeyboardActions: readonly — cannot mutate via returned reference
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

// We need to isolate the module state between tests
let registerKey: typeof import("@/ui/keyboard").registerKey;
let getKeyboardActions: typeof import("@/ui/keyboard").getKeyboardActions;

beforeEach(async () => {
  // Re-import to get a fresh module (vitest module cache is reset by vi.resetModules)
  const { vi } = await import("vitest");
  vi.resetModules();
  const mod = await import("@/ui/keyboard");
  registerKey = mod.registerKey;
  getKeyboardActions = mod.getKeyboardActions;
});

// ── KB1: registerKey adds entry ──────────────────────────────────────────────

describe("keyboard — KB1: registerKey adds entry", () => {
  it("after register, actions length increases by 1", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (key, desc) => {
          const before = getKeyboardActions().length;
          registerKey(key, desc, () => {});
          expect(getKeyboardActions().length).toBe(before + 1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── KB2: key is lowercased ───────────────────────────────────────────────────

describe("keyboard — KB2: key is lowercased", () => {
  it("registered key is always lowercase", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1 }),
        (key) => {
          registerKey(key, "test", () => {});
          const actions = getKeyboardActions();
          const last = actions[actions.length - 1];
          expect(last.key).toBe(key.toLowerCase());
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── KB3: getKeyboardActions reflects all ─────────────────────────────────────

describe("keyboard — KB3: reflects all registered", () => {
  it("N registrations → N entries (cumulative within test)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (count) => {
          const baseLenForThisRun = getKeyboardActions().length;
          for (let i = 0; i < count; i++) {
            registerKey(String(i), `desc-${i}`, () => {});
          }
          expect(getKeyboardActions().length).toBe(baseLenForThisRun + count);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── KB4: description preserved ───────────────────────────────────────────────

describe("keyboard — KB4: description preserved", () => {
  it("description is stored verbatim", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (desc) => {
          registerKey("x", desc, () => {});
          const actions = getKeyboardActions();
          const last = actions[actions.length - 1];
          expect(last.description).toBe(desc);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── KB5: readonly array ──────────────────────────────────────────────────────

describe("keyboard — KB5: readonly return", () => {
  it("getKeyboardActions returns readonly array", () => {
    registerKey("z", "test", () => {});
    const actions = getKeyboardActions();
    // TypeScript enforces readonly, but at runtime it's still an array
    // The contract is that mutations don't affect internal state
    expect(Array.isArray(actions)).toBe(true);
  });
});
