/**
 * Tests for src/ui/keyboard.ts
 *
 * Covers: registerKey, getKeyboardActions, initKeyboard (built-in shortcuts),
 * keydown dispatch, closeAllOverlays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerKey,
  getKeyboardActions,
  initKeyboard,
  closeAllOverlays,
} from "@/ui/keyboard";

describe("Keyboard — registerKey / getKeyboardActions", () => {
  it("registers a key action", () => {
    const handler = vi.fn();
    registerKey("x", "test action", handler);
    const actions = getKeyboardActions();
    expect(
      actions.some((a) => a.key === "x" && a.description === "test action"),
    ).toBe(true);
  });

  it("stores key in lowercase", () => {
    registerKey("Q", "uppercase test", vi.fn());
    const actions = getKeyboardActions();
    expect(actions.some((a) => a.key === "q")).toBe(true);
  });

  it("getKeyboardActions returns readonly array", () => {
    const actions = getKeyboardActions();
    expect(Array.isArray(actions)).toBe(true);
    // Should not be mutated externally
    expect(typeof actions.length).toBe("number");
  });
});

describe("Keyboard — initKeyboard built-in shortcuts", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<select id="theme-select"><option value="black">Black</option></select>';
    document.body.classList.add("theme-black");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("registers T key for theme cycle", () => {
    initKeyboard();
    const actions = getKeyboardActions();
    expect(actions.some((a) => a.key === "t")).toBe(true);
  });

  it("registers P key for print", () => {
    initKeyboard();
    const actions = getKeyboardActions();
    expect(actions.some((a) => a.key === "p")).toBe(true);
  });

  it("dispatches action on keydown event", () => {
    const handler = vi.fn();
    registerKey("z", "unit test dispatch", handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    // initKeyboard() may have been called multiple times in previous tests,
    // creating multiple listeners. We only check the handler was called at least once.
    expect(handler).toHaveBeenCalled();
  });

  it("ignores keydown when target is INPUT", () => {
    const handler = vi.fn();
    registerKey("w", "should ignore in input", handler);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "w", bubbles: true }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores keydown when target is TEXTAREA", () => {
    const handler = vi.fn();
    registerKey("e", "should ignore in textarea", handler);
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores keydown when target is SELECT", () => {
    const handler = vi.fn();
    registerKey("r", "should ignore in select", handler);
    const sel = document.createElement("select");
    document.body.appendChild(sel);
    sel.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Keyboard — closeAllOverlays", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="config-overlay" class="visible"></div>
      <div id="help-overlay" class="visible"></div>
      <div id="diag-overlay" class="visible"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("removes visible class from all known overlays", () => {
    closeAllOverlays();
    expect(
      document.getElementById("config-overlay")?.classList.contains("visible"),
    ).toBe(false);
    expect(
      document.getElementById("help-overlay")?.classList.contains("visible"),
    ).toBe(false);
    expect(
      document.getElementById("diag-overlay")?.classList.contains("visible"),
    ).toBe(false);
  });

  it("does not throw when overlays are missing", () => {
    document.body.innerHTML = "";
    expect(() => closeAllOverlays()).not.toThrow();
  });

  it("calls close() on an open <dialog> element (line 75 branch)", () => {
    document.body.innerHTML = `
      <dialog id="config-overlay"></dialog>
      <dialog id="help-overlay"></dialog>
      <dialog id="diag-overlay"></dialog>
    `;
    // Polyfill dialog methods (happy-dom may not implement showModal/close)
    ["config-overlay", "help-overlay", "diag-overlay"].forEach((id) => {
      const d = document.getElementById(id) as HTMLDialogElement & {
        show?: () => void;
        close?: () => void;
      };
      if (typeof d.show !== "function") {
        d.show = function () {
          this.setAttribute("open", "");
        };
        d.close = function () {
          this.removeAttribute("open");
        };
      }
      // Mark as open
      d.setAttribute("open", "");
    });
    expect(() => closeAllOverlays()).not.toThrow();
    // After close, dialogs should not be open
    const config = document.getElementById("config-overlay");
    expect(config?.hasAttribute("open")).toBe(false);
  });
});
// ── keyboard: "p" key → window.print() (line 42 fn coverage) ────────────────

describe("Keyboard — p key dispatches window.print (line 42 handler)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("calls window.print when p keydown is dispatched (covers the print handler fn)", () => {
    // happy-dom doesn't define window.print — stub it before spying
    const printMock = vi.fn();
    vi.stubGlobal("print", printMock);
    initKeyboard();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    expect(printMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});