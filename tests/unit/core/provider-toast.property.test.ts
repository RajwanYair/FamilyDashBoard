/**
 * fast-check property tests — src/core/provider-toast.ts
 *
 * Properties under test:
 *  PT1. First call for any providerId always returns true
 *  PT2. Repeated call within 10 min returns false (rate-limited)
 *  PT3. Call after 10 min returns true (window expired)
 *  PT4. Independent providers don't interfere with each other
 *  PT5. Monotonicity: once suppressed, stays suppressed within window
 *  PT6. Return type is always boolean
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import * as fc from "fast-check";

vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));

import { notifyProviderBlocked, _resetProviderToast } from "@/core/provider-toast";

afterEach(() => {
  _resetProviderToast();
  vi.clearAllMocks();
});

const RATE_LIMIT_MS = 10 * 60 * 1000;

// ── PT1: first call always returns true ─────────────────────────────────────

describe("provider-toast — PT1: first call always true", () => {
  it("first notification for any provider always surfaces", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.nat({ max: 2_000_000_000 }),
        (id, now) => {
          _resetProviderToast();
          expect(notifyProviderBlocked(id, id, now)).toBe(true);
        },
      ),
    );
  });
});

// ── PT2: repeated call within window returns false ──────────────────────────

describe("provider-toast — PT2: within-window suppressed", () => {
  it("second call within 10 min returns false", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.nat({ max: 2_000_000_000 }),
        fc.nat({ max: RATE_LIMIT_MS - 1 }),
        (id, start, delta) => {
          _resetProviderToast();
          notifyProviderBlocked(id, id, start);
          expect(notifyProviderBlocked(id, id, start + delta)).toBe(false);
        },
      ),
    );
  });
});

// ── PT3: call after window expired returns true ─────────────────────────────

describe("provider-toast — PT3: window expiry resets", () => {
  it("call after 10 min returns true again", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.nat({ max: 1_000_000_000 }),
        fc.nat({ max: 1_000_000_000 }),
        (id, start, extra) => {
          _resetProviderToast();
          notifyProviderBlocked(id, id, start);
          const afterWindow = start + RATE_LIMIT_MS + extra;
          expect(notifyProviderBlocked(id, id, afterWindow)).toBe(true);
        },
      ),
    );
  });
});

// ── PT4: independent providers don't interfere ──────────────────────────────

describe("provider-toast — PT4: provider independence", () => {
  it("different providers don't share rate-limit state", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 15 }),
        fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s !== ""),
        fc.nat({ max: 2_000_000_000 }),
        (idA, suffix, now) => {
          const idB = idA + suffix + "_other";
          _resetProviderToast();
          notifyProviderBlocked(idA, idA, now);
          // idB should still succeed even though idA was just called
          expect(notifyProviderBlocked(idB, idB, now)).toBe(true);
        },
      ),
    );
  });
});

// ── PT5: monotonicity within window ─────────────────────────────────────────

describe("provider-toast — PT5: monotonic suppression", () => {
  it("once suppressed, stays suppressed for entire window", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.nat({ max: 1_000_000_000 }),
        fc.array(fc.nat({ max: RATE_LIMIT_MS - 1 }), { minLength: 1, maxLength: 5 }),
        (id, start, deltas) => {
          _resetProviderToast();
          notifyProviderBlocked(id, id, start);
          for (const d of deltas) {
            expect(notifyProviderBlocked(id, id, start + d)).toBe(false);
          }
        },
      ),
    );
  });
});

// ── PT6: return type always boolean ─────────────────────────────────────────

describe("provider-toast — PT6: always returns boolean", () => {
  it("return value is always a boolean", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.nat({ max: 2_000_000_000 }),
        (id, now) => {
          _resetProviderToast();
          const result = notifyProviderBlocked(id, id, now);
          expect(typeof result).toBe("boolean");
        },
      ),
    );
  });
});
