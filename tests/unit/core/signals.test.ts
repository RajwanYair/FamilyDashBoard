/**
 * tests/unit/core/signals.test.ts — *
 * Verifies the zero-dep Signal/Computed/Effect primitive in src/core/signals.ts.
 */

import { describe, it, expect, vi } from "vitest";
import { signal, computed, effect, batch, untrack, isSignal } from "@/core/signals";

describe("signal()", () => {
  it("returns the initial value", () => {
    const s = signal(42);
    expect(s.value).toBe(42);
  });

  it("updates the stored value when assigned", () => {
    const s = signal("a");
    s.value = "b";
    expect(s.value).toBe("b");
  });

  it("does not notify when set to a value equal under Object.is", () => {
    const s = signal(1);
    const fn = vi.fn();
    effect(() => {
      void s.value;
      fn();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    s.value = 1;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("treats NaN as equal to NaN (Object.is)", () => {
    const s = signal(Number.NaN);
    const fn = vi.fn();
    effect(() => {
      void s.value;
      fn();
    });
    s.value = Number.NaN;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("peek() reads without registering a dependency", () => {
    const s = signal(1);
    const fn = vi.fn();
    effect(() => {
      void s.peek();
      fn();
    });
    s.value = 2;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("computed()", () => {
  it("derives lazily from signal sources", () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);
    expect(sum.value).toBe(5);
    a.value = 10;
    expect(sum.value).toBe(13);
  });

  it("caches the value until a dependency changes", () => {
    const a = signal(1);
    const fn = vi.fn(() => a.value * 2);
    const c = computed(fn);
    expect(c.value).toBe(2);
    expect(c.value).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    a.value = 5;
    expect(c.value).toBe(10);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("supports nested computeds", () => {
    const a = signal(1);
    const double = computed(() => a.value * 2);
    const quad = computed(() => double.value * 2);
    expect(quad.value).toBe(4);
    a.value = 3;
    expect(quad.value).toBe(12);
  });

  it("notify() is a no-op when already dirty (unread computed changed twice)", () => {
    // computed starts dirty; two consecutive signal writes both call notify()
    // the second notify() should hit the `if (this._dirty) return` early path.
    const a = signal(0);
    const fn = vi.fn(() => a.value * 2);
    const c = computed(fn);
    // Do NOT read c — it remains dirty.
    a.value = 1; // notify() with _dirty=true → early return
    a.value = 2; // notify() with _dirty=true → early return again
    expect(c.value).toBe(4); // reads once — recomputes with latest value
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("effect()", () => {
  it("runs synchronously on creation", () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-runs when a tracked signal changes", () => {
    const s = signal(0);
    const fn = vi.fn(() => {
      void s.value;
    });
    effect(fn);
    s.value = 1;
    s.value = 2;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("dispose() detaches from all dependencies", () => {
    const s = signal(0);
    const fn = vi.fn(() => {
      void s.value;
    });
    const dispose = effect(fn);
    dispose();
    s.value = 99;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dispose() is idempotent", () => {
    const s = signal(0);
    const dispose = effect(() => {
      void s.value;
    });
    dispose();
    expect(() => dispose()).not.toThrow();
  });

  it("disposed effect ignores notifications from re-subscribed deps (notify guards)", () => {
    // When an effect self-disposes during a re-run, runTracked may
    // re-subscribe it to deps after dispose().  A subsequent signal write
    // calls notify() on the (disposed) effect — which must return early.
    const a = signal(0);
    let callCount = 0;
    // Use a ref so the closure picks up the real disposer after effect() returns.
    const ref = { dispose: (() => void 0) as () => void };

    ref.dispose = effect(() => {
      void a.value; // subscribe to a
      callCount++;
      // First call: ref.dispose is the initial no-op (effect not created yet).
      // Second call (re-run): ref.dispose is the real disposer → self-dispose.
      ref.dispose();
    });

    // Initial run: callCount=1, effect still active (no-op dispose called).
    expect(callCount).toBe(1);

    // Trigger re-run: effect's fn calls real dispose (_disposed=true),
    // but runTracked re-subscribes a AFTER fn returns.
    a.value = 1;
    expect(callCount).toBe(2); // re-ran and self-disposed

    // Now effect is _disposed=true but still subscribed to a via runTracked.
    // Changing a calls notify() on the disposed effect → guard returns early.
    a.value = 2;
    expect(callCount).toBe(2); // must NOT re-run
  });
});

describe("batch()", () => {
  it("collapses multiple writes into a single effect run", () => {
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn(() => {
      void a.value;
      void b.value;
    });
    effect(fn);
    batch(() => {
      a.value = 10;
      b.value = 20;
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns the value produced by the inner function", () => {
    expect(batch(() => 7)).toBe(7);
  });

  it("nested batches collapse to the outermost", () => {
    const a = signal(0);
    const fn = vi.fn(() => {
      void a.value;
    });
    effect(fn);
    batch(() => {
      batch(() => {
        a.value = 1;
        a.value = 2;
      });
      a.value = 3;
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(a.value).toBe(3);
  });
});

describe("untrack()", () => {
  it("reads without registering a dependency", () => {
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn(() => {
      void a.value;
      untrack(() => {
        void b.value;
      });
    });
    effect(fn);
    b.value = 99;
    expect(fn).toHaveBeenCalledTimes(1);
    a.value = 5;
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("isSignal()", () => {
  it("returns true for signal()", () => {
    expect(isSignal(signal(0))).toBe(true);
  });

  it("returns true for computed()", () => {
    expect(isSignal(computed(() => 1))).toBe(true);
  });

  it("returns false for plain values", () => {
    expect(isSignal(0)).toBe(false);
    expect(isSignal({ value: 1 })).toBe(false);
    expect(isSignal(null)).toBe(false);
    expect(isSignal(undefined)).toBe(false);
  });
});

// ── peek() on dirty Computed ─────────────────────────────────────

describe("computed().peek() on dirty signal ", () => {
  it("peek() recomputes when called on a dirty computed (dependency changed, not yet read)", () => {
    const a = signal(1);
    const fn = vi.fn(() => a.value * 3);
    const c = computed(fn);
    // Read once to prime the value
    expect(c.value).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);

    // Change dependency — makes c dirty without reading it
    a.value = 5;
    // Call peek() — the _dirty branch in peek() must trigger _recompute()
    const result = c.peek();
    expect(result).toBe(15);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("peek() on never-read computed triggers initial computation via dirty branch", () => {
    const a = signal(7);
    const fn = vi.fn(() => a.value + 10);
    const c = computed(fn);
    // Do not call c.value — c is dirty from creation
    // peek() should trigger _recompute via the _dirty branch
    const result = c.peek();
    expect(result).toBe(17);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
