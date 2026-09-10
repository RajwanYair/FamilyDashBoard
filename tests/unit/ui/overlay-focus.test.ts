/**
 * Tests for non-native overlay focus management.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  captureOverlayFocus,
  getOverlayFocusableElements,
  restoreOverlayFocus,
  trapOverlayTab,
} from "@/ui/overlay-focus";

describe("overlay focus helpers", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("returns focus to the element that opened the overlay", () => {
    const trigger = document.createElement("button");
    const overlay = document.createElement("div");
    overlay.append(document.createElement("button"));
    document.body.append(trigger, overlay);

    trigger.focus();
    captureOverlayFocus("test-overlay", overlay);
    overlay.querySelector("button")?.focus();
    restoreOverlayFocus("test-overlay");

    expect(document.activeElement).toBe(trigger);
  });

  it("does not restore a removed or disabled trigger", () => {
    const trigger = document.createElement("button");
    const overlay = document.createElement("div");
    document.body.append(trigger, overlay);

    trigger.focus();
    captureOverlayFocus("removed-overlay", overlay);
    trigger.remove();
    expect(() => restoreOverlayFocus("removed-overlay")).not.toThrow();

    document.body.append(trigger);
    trigger.disabled = true;
    trigger.focus();
    captureOverlayFocus("disabled-overlay", overlay);
    restoreOverlayFocus("disabled-overlay");
    expect(document.activeElement).not.toBe(trigger);
  });

  it("excludes hidden and inactive settings controls", () => {
    const overlay = document.createElement("div");
    const active = document.createElement("button");
    const inactiveSection = document.createElement("div");
    inactiveSection.className = "cfg-section";
    const inactive = document.createElement("button");
    inactiveSection.append(inactive);
    const hidden = document.createElement("button");
    hidden.hidden = true;
    overlay.append(active, inactiveSection, hidden);
    document.body.append(overlay);

    expect(getOverlayFocusableElements(overlay)).toEqual([active]);
  });

  it("wraps Tab focus in both directions", () => {
    const overlay = document.createElement("div");
    const first = document.createElement("button");
    const last = document.createElement("button");
    overlay.append(first, last);
    document.body.append(overlay);

    last.focus();
    const forward = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapOverlayTab(forward, overlay);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const backward = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
    });
    trapOverlayTab(backward, overlay);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});
