/**
 * fast-check property tests — src/core/first-run-tour.ts
 *
 * Properties under test:
 *  FRT1. initTour() is idempotent — N calls open dialog at most once.
 *  FRT2. initTour() no-ops when localStorage already holds the tour key.
 *  FRT3. _resetTour() always restores a pristine state, regardless of prior calls.
 *  FRT4. initTour() is a no-op when no dialog element is present in the DOM.
 *  FRT5. dismiss via button sets TOUR_KEY in localStorage exactly once.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

// ── helpers ───────────────────────────────────────────────────────────────────

function buildDialog(): HTMLDialogElement {
  const dlg = document.createElement("dialog") as HTMLDialogElement;
  dlg.id = "tour-overlay";
  const inner = document.createElement("div");
  const btn = document.createElement("button");
  btn.id = "tour-dismiss-btn";
  inner.appendChild(btn);
  dlg.appendChild(inner);
  document.body.appendChild(dlg);
  dlg.showModal = vi.fn();
  dlg.close = vi.fn();
  return dlg;
}

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.resetModules();
});

// ── FRT1: idempotency ─────────────────────────────────────────────────────────

describe("first-run-tour — FRT1: initTour() opens dialog at most once per session", () => {
  it("calling initTour() N times shows modal exactly once", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
        vi.resetModules();
        document.body.innerHTML = "";
        localStorage.clear();
        const dlg = buildDialog();
        const { initTour, _resetTour } = await import("@/core/first-run-tour");
        _resetTour();
        for (let i = 0; i < n; i++) initTour();
        expect(dlg.showModal).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 10 },
    );
  });
});

// ── FRT2: already-seen gate ────────────────────────────────────────────────────

describe("first-run-tour — FRT2: initTour() is a no-op when tour key is set", () => {
  it("showModal is never called when localStorage tour key is present", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        async (_label) => {
          vi.resetModules();
          document.body.innerHTML = "";
          localStorage.clear();
          const dlg = buildDialog();
          const { initTour, _resetTour } = await import("@/core/first-run-tour");
          _resetTour();
          // Set the key AFTER _resetTour() so it is not wiped by the reset
          localStorage.setItem("dash_tour_seen", "1");
          initTour();
          expect(dlg.showModal).not.toHaveBeenCalled();
          localStorage.clear();
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── FRT3: _resetTour() restores pristine state ────────────────────────────────

describe("first-run-tour — FRT3: _resetTour() always produces a clean state", () => {
  it("after reset, initTour() can open the dialog again", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (priorCalls) => {
        vi.resetModules();
        document.body.innerHTML = "";
        localStorage.clear();
        const dlg = buildDialog();
        const { initTour, _resetTour } = await import("@/core/first-run-tour");
        _resetTour();
        for (let i = 0; i < priorCalls; i++) initTour();
        // Verify first batch opened the modal
        expect(dlg.showModal).toHaveBeenCalledTimes(1);
        // Reset state fully, replace spy, verify second open works independently
        _resetTour();
        localStorage.clear(); // belt+suspenders if dismissTour ran
        dlg.showModal = vi.fn(); // fresh spy for the second open
        initTour();
        expect(dlg.showModal).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 8 },
    );
  });
});

// ── FRT4: no dialog element → silent no-op ────────────────────────────────────

describe("first-run-tour — FRT4: initTour() is silent when no dialog exists", () => {
  it("does not throw even when #tour-overlay is absent from DOM", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        document.body.innerHTML = "";
        localStorage.clear();
        const { initTour, _resetTour } = await import("@/core/first-run-tour");
        _resetTour();
        expect(() => initTour()).not.toThrow();
      }),
      { numRuns: 5 },
    );
  });
});

// ── FRT5: dismiss sets localStorage key exactly once ─────────────────────────

describe("first-run-tour — FRT5: dismiss sets TOUR_KEY in localStorage", () => {
  it("clicking dismiss button stores tour-seen flag exactly once", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (clicks) => {
        vi.resetModules();
        document.body.innerHTML = "";
        localStorage.clear();
        buildDialog();
        const { initTour, _resetTour } = await import("@/core/first-run-tour");
        _resetTour();
        initTour();
        const btn = document.getElementById("tour-dismiss-btn")!;
        for (let i = 0; i < clicks; i++) btn.click();
        expect(localStorage.getItem("dash_tour_seen")).toBe("1");
      }),
      { numRuns: 8 },
    );
  });
});
