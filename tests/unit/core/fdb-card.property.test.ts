/**
 * Property-based tests for src/core/fdb-card.ts (FdbCard base class).
 *
 * FDB1 — setLoading(arbitrary bool) always sets aria-busy to "true"/"false"
 * FDB2 — setError(arbitrary string | null) always sets / clears aria-label
 * FDB3 — cardId getter always returns a string, never throws
 * FDB4 — cardSize getter defaults to "md" for invalid values; accepts valid sizes
 * FDB5 — attributeChangedCallback never throws for arbitrary name/old/new values
 * FDB6 — scheduleRefresh/clearRefresh cycle never throws for arbitrary intervals
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { FdbCard } from "@/core/fdb-card";

// ── Top-level mocks (hoisted by vitest) ──────────────────────────────────────

vi.mock("@/core/sync", () => ({ setSync: vi.fn() }));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));
vi.mock("@/core/idle", () => ({ isPageVisible: vi.fn().mockReturnValue(true) }));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/i18n", () => ({ getInterfaceLanguage: vi.fn().mockReturnValue("he") }));
vi.mock("@/core/state", () => ({
  state: { get: vi.fn(), set: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("@/core/signals", () => ({ effect: vi.fn().mockReturnValue(() => {}) }));
vi.mock("@/core/event-bus", () => ({
  globalThemeChannel: { value: "black" },
  globalAlertChannel: { value: null },
}));

// ── Concrete subclass for property tests ─────────────────────────────────────

class PropTestCard extends FdbCard {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes];
  }
  override connect(): void {
    /* no-op */
  }
  override disconnect(): void {
    /* no-op */
  }
}

const TAG = "fdb-prop-test-card";
if (!customElements.get(TAG)) {
  customElements.define(TAG, PropTestCard);
}

function makeCard(): PropTestCard {
  const el = document.createElement(TAG) as PropTestCard;
  document.body.appendChild(el);
  return el;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbCard — property tests", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("FDB1 — setLoading(bool) always sets aria-busy correctly", () => {
    fc.assert(
      fc.property(fc.boolean(), (loading) => {
        const card = makeCard();
        card.setLoading(loading);
        expect(card.getAttribute("aria-busy")).toBe(loading ? "true" : "false");
      }),
      { numRuns: 20 },
    );
  });

  it("FDB2 — setError(string | null) always sets / clears aria-label correctly", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ minLength: 1, maxLength: 200 }), fc.constant(null), fc.constant("")),
        (msg) => {
          const card = makeCard();
          card.setError(msg);
          if (msg) {
            const label = card.getAttribute("aria-label");
            expect(label).not.toBeNull();
            expect(label).toContain(msg);
          } else {
            expect(card.getAttribute("aria-label")).toBeNull();
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it("FDB3 — cardId getter always returns a string", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.constant(null as unknown as string),
        ),
        (id) => {
          const card = makeCard();
          if (id !== null) card.setAttribute("data-card-id", id);
          expect(typeof card.cardId).toBe("string");
          // null attribute → empty string
          if (id === null) expect(card.cardId).toBe("");
          else expect(card.cardId).toBe(id);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("FDB4 — cardSize defaults to 'md' for invalid values; accepts sm/md/lg/xl", () => {
    const VALID_SIZES = ["sm", "md", "lg", "xl"] as const;
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...VALID_SIZES),
          fc.string({ minLength: 1, maxLength: 20 }), // garbage values
          fc.constant(""),
        ),
        (size) => {
          const card = makeCard();
          card.setAttribute("data-card-size", size);
          const result = card.cardSize;
          if ((VALID_SIZES as readonly string[]).includes(size)) {
            expect(result).toBe(size);
          } else {
            expect(result).toBe("md");
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it("FDB5 — attributeChangedCallback never throws for arbitrary inputs", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.option(fc.string({ maxLength: 100 }), { nil: null }),
        fc.option(fc.string({ maxLength: 100 }), { nil: null }),
        (name, oldValue, newValue) => {
          const card = makeCard();
          expect(() => card.attributeChangedCallback(name, oldValue, newValue)).not.toThrow();
        },
      ),
      { numRuns: 15 },
    );
  });

  it("FDB6 — scheduleRefresh with arbitrary intervals never throws", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 600000 }), (intervalMs) => {
        const card = makeCard();
        const cb = vi.fn().mockResolvedValue(undefined);
        expect(() => card.scheduleRefresh(cb, intervalMs)).not.toThrow();
        // Cleanup — disconnectedCallback clears the timer
        document.body.removeChild(card);
      }),
      { numRuns: 10 },
    );
  });
});
