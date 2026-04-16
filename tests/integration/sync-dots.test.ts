/**
 * Integration: Sync-dot registration + state transitions
 *
 * Tests that registering sync dots and calling setSync() + syncBurst() correctly
 * updates the CSS class on the registered DOM element.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerSyncDot, setSync, syncBurst, clearSyncDots } from "@/core/sync";

describe("Sync dot — registration + state", () => {
  let dot: HTMLElement;

  beforeEach(() => {
    dot = document.createElement("div");
    dot.id = "sync-test";
    document.body.appendChild(dot);
  });

  afterEach(() => {
    dot.remove();
    clearSyncDots();
  });

  it("registered dot gets 'loading' class on setSync → loading", () => {
    registerSyncDot("test-pane", dot);
    setSync("test-pane", "loading");
    expect(dot.classList.contains("loading")).toBe(true);
  });

  it("registered dot keeps only 'sync-dot' class on setSync → ok", () => {
    registerSyncDot("test-pane", dot);
    setSync("test-pane", "ok");
    expect(dot.className).toBe("sync-dot");
  });

  it("registered dot gets 'error' class on setSync → error", () => {
    registerSyncDot("test-pane", dot);
    setSync("test-pane", "error");
    expect(dot.classList.contains("error")).toBe(true);
  });

  it("syncBurst applies 'burst' class momentarily", () => {
    registerSyncDot("test-pane", dot);
    setSync("test-pane", "ok");
    syncBurst("test-pane");
    expect(dot.classList.contains("burst")).toBe(true);
  });

  it("unregistered pane names are ignored without throwing", () => {
    expect(() => setSync("ghost-pane", "ok")).not.toThrow();
    expect(() => syncBurst("ghost-pane")).not.toThrow();
  });

  it("re-registering a pane uses the new element", () => {
    const dot2 = document.createElement("span");
    document.body.appendChild(dot2);
    registerSyncDot("test-pane", dot);
    registerSyncDot("test-pane", dot2);
    setSync("test-pane", "ok");
    // setSync 'ok' sets className to 'sync-dot' (no extra class)
    expect(dot2.className).toBe("sync-dot");
    dot2.remove();
  });
});
