/**
 * Tests for src/core/state.ts — EventTarget-based reactive state store (v8.0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { state } from "@/core/state";

// Reset state between tests by seeding known values
beforeEach(() => {
  // Clear config slice
  state.set("config.tempUnit", undefined);
  state.set("config.theme", undefined);
  state.set("ui.overlay", undefined);
  state.set("cache.weather", undefined);
});

describe("state.get / state.set", () => {
  it("returns undefined for keys that have never been set", () => {
    expect(state.get("config.newKey")).toBeUndefined();
  });

  it("stores and retrieves a string value", () => {
    state.set("config.tempUnit", "C");
    expect(state.get("config.tempUnit")).toBe("C");
  });

  it("stores and retrieves a number value", () => {
    state.set("config.fontScale", 1.2);
    expect(state.get("config.fontScale")).toBe(1.2);
  });

  it("stores and retrieves a boolean value", () => {
    state.set("config.alertsEnabled", true);
    expect(state.get("config.alertsEnabled")).toBe(true);
  });

  it("stores and retrieves an object value", () => {
    const obj = { city: "ירושלים", lat: 31.78 };
    state.set("cache.weather", obj);
    expect(state.get("cache.weather")).toEqual(obj);
  });

  it("overwrites existing value", () => {
    state.set("config.tempUnit", "C");
    state.set("config.tempUnit", "F");
    expect(state.get("config.tempUnit")).toBe("F");
  });

  it("stores ui slice values", () => {
    state.set("ui.overlay", "diag");
    expect(state.get("ui.overlay")).toBe("diag");
  });
});

describe("state.on — subscribe to changes", () => {
  it("calls callback when value changes", () => {
    const spy = vi.fn();
    state.on("config.theme", spy);
    state.set("config.theme", "blue");
    expect(spy).toHaveBeenCalledWith("blue", "config.theme");
    state.off("config.theme", spy as unknown as EventListener);
  });

  it("does NOT call callback for no-op writes (same value)", () => {
    state.set("config.tempUnit", "C");
    const spy = vi.fn();
    state.on("config.tempUnit", spy);
    state.set("config.tempUnit", "C"); // same value — no event
    expect(spy).not.toHaveBeenCalled();
    state.off("config.tempUnit", spy as unknown as EventListener);
  });

  it("calls callback with new value and key", () => {
    const received: { value: unknown; key: string }[] = [];
    const handler = (v: unknown, k: string) => received.push({ value: v, key: k });
    state.on("config.fontScale", handler);
    state.set("config.fontScale", 1.5);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ value: 1.5, key: "config.fontScale" });
    state.off("config.fontScale", handler as unknown as EventListener);
  });

  it("calls multiple subscribers for the same key", () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    state.on("ui.overlay", spy1);
    state.on("ui.overlay", spy2);
    state.set("ui.overlay", "bookmarks");
    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
    state.off("ui.overlay", spy1 as unknown as EventListener);
    state.off("ui.overlay", spy2 as unknown as EventListener);
  });
});

describe("state.seedConfig", () => {
  it("seeds multiple config fields at once", () => {
    state.seedConfig({ tempUnit: "F", fontScale: 1.0, theme: "matrix" });
    expect(state.get("config.tempUnit")).toBe("F");
    expect(state.get("config.fontScale")).toBe(1.0);
    expect(state.get("config.theme")).toBe("matrix");
  });

  it("fires change events for each seeded field", () => {
    const spy = vi.fn();
    state.on("config.tempUnit", spy);
    state.set("config.tempUnit", undefined); // reset
    state.seedConfig({ tempUnit: "C" });
    expect(spy).toHaveBeenCalledWith("C", "config.tempUnit");
    state.off("config.tempUnit", spy as unknown as EventListener);
  });

  it("does not fire events for unchanged fields", () => {
    state.set("config.tempUnit", "F");
    const spy = vi.fn();
    state.on("config.tempUnit", spy);
    state.seedConfig({ tempUnit: "F" }); // same value — no event
    expect(spy).not.toHaveBeenCalled();
    state.off("config.tempUnit", spy as unknown as EventListener);
  });
});

describe("state.snapshot", () => {
  it("returns an object with config, cache, ui slices", () => {
    const snap = state.snapshot();
    expect(snap).toHaveProperty("config");
    expect(snap).toHaveProperty("cache");
    expect(snap).toHaveProperty("ui");
  });

  it("snapshot is a shallow copy, not a live reference", () => {
    state.set("config.tempUnit", "C");
    const snap1 = state.snapshot();
    state.set("config.tempUnit", "F");
    const snap2 = state.snapshot();
    // snap1 is not affected by the later set
    expect(snap1.config["tempUnit"]).toBe("C");
    expect(snap2.config["tempUnit"]).toBe("F");
  });
});

describe("state — invalid/unknown slice key", () => {
  it("silently ignores writes to unknown slice", () => {
    // TypeScript would prevent this, but runtime guard should not throw
    expect(() => state.set("unknown.key" as Parameters<typeof state.set>[0], "val")).not.toThrow();
  });
});
