/**
 * Tests for src/core/first-run-tour.ts
 *
 * Validates localStorage-based first-run gate, dialog showModal(),
 * dismiss behaviour, and idempotency.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initTour, _resetTour } from "@/core/first-run-tour";

/** Build a minimal HTMLDialogElement mock wired to the document. */
function buildTourDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog") as HTMLDialogElement;
  dialog.id = "tour-overlay";

  const inner = document.createElement("div");
  inner.className = "tour-inner";

  const btn = document.createElement("button");
  btn.id = "tour-dismiss-btn";
  btn.type = "button";
  inner.appendChild(btn);

  dialog.appendChild(inner);
  document.body.appendChild(dialog);

  // happy-dom may not implement showModal/close — shim them
  if (typeof dialog.showModal !== "function") {
    dialog.showModal = vi.fn(() => {
      dialog.setAttribute("open", "");
    });
  } else {
    vi.spyOn(dialog, "showModal");
  }
  if (typeof dialog.close !== "function") {
    dialog.close = vi.fn(() => {
      dialog.removeAttribute("open");
    });
  } else {
    vi.spyOn(dialog, "close");
  }

  return dialog;
}

describe("first-run-tour — initTour()", () => {
  let dialog: HTMLDialogElement;

  beforeEach(() => {
    localStorage.clear();
    _resetTour();
    dialog = buildTourDialog();
  });

  afterEach(() => {
    dialog.remove();
    localStorage.clear();
    _resetTour();
  });

  it("calls showModal() when tour has not been seen", () => {
    initTour();
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  it("does NOT call showModal() when dash_tour_seen is set", () => {
    localStorage.setItem("dash_tour_seen", "1");
    initTour();
    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  it("is idempotent — calling initTour() twice only opens once", () => {
    initTour();
    initTour();
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  it("sets dash_tour_seen and closes dialog when dismiss button clicked", () => {
    initTour();
    const btn = document.getElementById("tour-dismiss-btn") as HTMLButtonElement;
    btn.click();
    expect(localStorage.getItem("dash_tour_seen")).toBe("1");
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it("closes dialog when backdrop (dialog element itself) is clicked", () => {
    initTour();
    // Simulate click directly on <dialog> (not on inner content)
    const evt = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(evt, "target", { value: dialog, writable: false });
    dialog.dispatchEvent(evt);
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(localStorage.getItem("dash_tour_seen")).toBe("1");
  });

  it("does nothing when #tour-overlay is absent from DOM", () => {
    dialog.remove();
    expect(() => initTour()).not.toThrow();
  });
});

describe("first-run-tour — _resetTour()", () => {
  it("clears the localStorage flag", () => {
    localStorage.setItem("dash_tour_seen", "1");
    _resetTour();
    expect(localStorage.getItem("dash_tour_seen")).toBeNull();
  });
});
