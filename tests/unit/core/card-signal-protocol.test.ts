/**
 * card-signal-protocol unit tests.
 * Spec: docs/adr/ADR-067-x12-card-signal-protocol.md
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setCardSignal,
  getCardSignal,
  onCardSignal,
  _resetCardSignals,
} from "../../../src/core/card-signal-protocol";

describe("card-signal-protocol (X12 / )", () => {
  beforeEach(() => {
    _resetCardSignals();
  });

  it("getCardSignal returns null for absent signal", () => {
    expect(getCardSignal("weather", "current")).toBeNull();
  });

  it("setCardSignal then getCardSignal returns the value", () => {
    setCardSignal("weather", "current", { tempC: 22 });
    const sig = getCardSignal<{ tempC: number }>("weather", "current");
    expect(sig).not.toBeNull();
    expect(sig!.value.tempC).toBe(22);
    expect(sig!.cardId).toBe("weather");
    expect(sig!.key).toBe("current");
    expect(sig!.v).toBe(1);
    expect(typeof sig!.ts).toBe("number");
  });

  it("payload is deep-frozen — consumer cannot mutate", () => {
    const data = { nested: { count: 1 } };
    setCardSignal("calendar", "next", data);
    const sig = getCardSignal<typeof data>("calendar", "next");
    expect(Object.isFrozen(sig!.value)).toBe(true);
    expect(Object.isFrozen(sig!.value.nested)).toBe(true);
    expect(() => {
      (sig!.value.nested as { count: number }).count = 99;
    }).toThrow();
  });

  it("onCardSignal receives subsequent updates via microtask", async () => {
    const cb = vi.fn();
    const unsub = onCardSignal<{ x: number }>("stocks", "top", cb);
    setCardSignal("stocks", "top", { x: 1 });
    setCardSignal("stocks", "top", { x: 2 });
    expect(cb).not.toHaveBeenCalled(); // microtask deferred
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[0]![0].value.x).toBe(1);
    expect(cb.mock.calls[1]![0].value.x).toBe(2);
    unsub();
  });

  it("onCardSignal does NOT fire for the current value", async () => {
    setCardSignal("alerts", "active", { count: 3 });
    const cb = vi.fn();
    onCardSignal("alerts", "active", cb);
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it("unsubscribe stops further callbacks", async () => {
    const cb = vi.fn();
    const unsub = onCardSignal("countdown", "next", cb);
    setCardSignal("countdown", "next", { hrs: 5 });
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    setCardSignal("countdown", "next", { hrs: 4 });
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("listener errors do not break the producer", async () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    onCardSignal("hebrew-cal", "zman", bad);
    onCardSignal("hebrew-cal", "zman", good);
    expect(() => setCardSignal("hebrew-cal", "zman", { name: "mincha" })).not.toThrow();
    await Promise.resolve();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("isolates by composite key (cardId + key)", () => {
    setCardSignal("a", "x", 1);
    setCardSignal("a", "y", 2);
    setCardSignal("b", "x", 3);
    expect(getCardSignal<number>("a", "x")!.value).toBe(1);
    expect(getCardSignal<number>("a", "y")!.value).toBe(2);
    expect(getCardSignal<number>("b", "x")!.value).toBe(3);
  });
});
