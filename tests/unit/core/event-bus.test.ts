/**
 * Tests for src/core/event-bus.ts
 *
 * (X2 · ): signals-based pub/sub cross-card channels.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  globalSync,
  globalAlertChannel,
  globalThemeChannel,
  globalOffline,
  broadcastSync,
  broadcastAlert,
  broadcastTheme,
  initOfflineTracking,
  _resetBusForTesting,
  type AlertEvent,
} from "@/core/event-bus";
import { effect } from "@/core/signals";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Read the current value of a reactive signal as a snapshot. */
function snapshot<T>(read: () => T): T {
  return read();
}

// Full bus reset before each test — prevents state leaking between cases.
beforeEach(() => {
  _resetBusForTesting();
});

// ── globalSync ────────────────────────────────────────────────────────────────

describe("globalSync", () => {
  it("defaults to 'ok' when no cards are registered", () => {
    expect(globalSync.value).toBe("ok");
  });

  it("returns 'loading' when any card is loading", () => {
    broadcastSync("wx", "loading");
    expect(globalSync.value).toBe("loading");
  });

  it("returns 'error' when a card errored (none loading)", () => {
    broadcastSync("wx", "error");
    expect(globalSync.value).toBe("error");
  });

  it("'loading' takes priority over 'error'", () => {
    broadcastSync("wx", "error");
    broadcastSync("cal", "loading");
    expect(globalSync.value).toBe("loading");
  });

  it("returns 'ok' after all cards transition back to ok", () => {
    broadcastSync("wx", "error");
    broadcastSync("wx", "ok");
    expect(globalSync.value).toBe("ok");
  });

  it("is a no-op when broadcasting the same state", () => {
    broadcastSync("wx", "ok");
    const reads: string[] = [];
    const dispose = effect(() => {
      reads.push(globalSync.value);
    });
    broadcastSync("wx", "ok"); // same state — should not re-trigger
    dispose();
    expect(reads).toHaveLength(1); // only the initial effect run
  });

  it("tracks multiple cards independently", () => {
    broadcastSync("wx", "ok");
    broadcastSync("cal", "error");
    broadcastSync("cur", "loading");
    expect(globalSync.value).toBe("loading");

    broadcastSync("cur", "ok");
    expect(globalSync.value).toBe("error");

    broadcastSync("cal", "ok");
    expect(globalSync.value).toBe("ok");
  });
});

// ── globalAlertChannel ────────────────────────────────────────────────────────

describe("globalAlertChannel", () => {
  it("defaults to null", () => {
    expect(globalAlertChannel.value).toBeNull();
  });

  it("broadcastAlert sets the channel value", () => {
    const evt: AlertEvent = { source: "alerts", type: "pause" };
    broadcastAlert(evt);
    expect(globalAlertChannel.value).toEqual(evt);
  });

  it("broadcastAlert(null) clears the channel", () => {
    broadcastAlert({ source: "alerts", type: "pause" });
    broadcastAlert(null);
    expect(globalAlertChannel.value).toBeNull();
  });

  it("supports both pause and resume types", () => {
    broadcastAlert({ source: "alerts", type: "pause" });
    expect(globalAlertChannel.value?.type).toBe("pause");

    broadcastAlert({ source: "alerts", type: "resume" });
    expect(globalAlertChannel.value?.type).toBe("resume");
  });

  it("notifies subscribers on change", () => {
    const received: Array<AlertEvent | null> = [];
    const dispose = effect(() => {
      received.push(globalAlertChannel.value);
    });
    broadcastAlert({ source: "test", type: "pause" });
    broadcastAlert(null);
    dispose();
    expect(received).toHaveLength(3); // initial + pause + null
  });
});

// ── globalThemeChannel ────────────────────────────────────────────────────────

describe("globalThemeChannel", () => {
  it("defaults to 'black'", () => {
    expect(globalThemeChannel.value).toBe("black");
  });

  it("broadcastTheme updates the channel", () => {
    broadcastTheme("matrix");
    expect(globalThemeChannel.value).toBe("matrix");
  });

  it("accepts all 6 theme names", () => {
    const themes = ["black", "blue", "matrix", "amber", "purple", "rose"] as const;
    for (const t of themes) {
      broadcastTheme(t);
      expect(globalThemeChannel.value).toBe(t);
    }
  });
});

// ── globalOffline ─────────────────────────────────────────────────────────────

describe("globalOffline", () => {
  it("defaults to false (online)", () => {
    expect(globalOffline.value).toBe(false);
  });

  it("can be set to true to simulate offline", () => {
    globalOffline.value = true;
    expect(globalOffline.value).toBe(true);
  });

  it("can be restored to false", () => {
    globalOffline.value = true;
    globalOffline.value = false;
    expect(globalOffline.value).toBe(false);
  });
});

// ── initOfflineTracking ───────────────────────────────────────────────────────

describe("initOfflineTracking", () => {
  it("registers online/offline listeners on window", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    initOfflineTracking();
    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain("online");
    expect(calls).toContain("offline");
    addSpy.mockRestore();
  });

  it("sets globalOffline to true on 'offline' event", () => {
    initOfflineTracking();
    window.dispatchEvent(new Event("offline"));
    expect(globalOffline.value).toBe(true);
  });

  it("sets globalOffline to false on 'online' event", () => {
    globalOffline.value = true;
    initOfflineTracking();
    window.dispatchEvent(new Event("online"));
    expect(globalOffline.value).toBe(false);
  });
});

// ── reactivity cross-channel ──────────────────────────────────────────────────

describe("reactivity", () => {
  it("effect() on globalSync fires when state changes", () => {
    const states: string[] = [];
    const dispose = effect(() => {
      states.push(globalSync.value);
    });
    broadcastSync("wx", "loading");
    broadcastSync("wx", "ok");
    dispose();
    expect(states).toEqual(["ok", "loading", "ok"]);
  });

  it("snapshot helper reads without subscribing", () => {
    broadcastSync("wx", "error");
    const val = snapshot(() => globalSync.value);
    expect(val).toBe("error");
  });
});

// ── fast-check property tests for event-bus ──────────

import * as fc from "fast-check";

const SYNC_STATES = ["ok", "loading", "error"] as const;
type SyncStateVal = (typeof SYNC_STATES)[number];

const arbitrarySyncState = (): fc.Arbitrary<SyncStateVal> =>
  fc.oneof(fc.constant("ok"), fc.constant("loading"), fc.constant("error"));

const arbitraryCardId = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0);

describe("event-bus fast-check properties (EP1-EP5 )", () => {
  beforeEach(() => {
    _resetBusForTesting();
  });

  it("EP1: globalSync always returns a valid SyncState regardless of card set", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbitraryCardId(), arbitrarySyncState()), {
          minLength: 1,
          maxLength: 10,
        }),
        (pairs) => {
          _resetBusForTesting();
          for (const [id, state] of pairs) {
            broadcastSync(id, state);
          }
          const result = globalSync.value;
          return result === "ok" || result === "loading" || result === "error";
        },
      ),
    );
  });

  it("EP2: broadcastSync is idempotent — same state twice does not change the aggregated result", () => {
    fc.assert(
      fc.property(arbitraryCardId(), arbitrarySyncState(), (cardId, state) => {
        _resetBusForTesting();
        broadcastSync(cardId, state);
        const after1 = globalSync.value;
        broadcastSync(cardId, state); // same again
        return globalSync.value === after1;
      }),
    );
  });

  it("EP3: globalSync returns 'loading' whenever any card is 'loading'", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbitraryCardId(), arbitrarySyncState()), { minLength: 1, maxLength: 8 }),
        arbitraryCardId(),
        (pairs, loadingId) => {
          _resetBusForTesting();
          for (const [id, state] of pairs) {
            broadcastSync(id, state);
          }
          broadcastSync(loadingId, "loading");
          return globalSync.value === "loading";
        },
      ),
    );
  });

  it("EP4: globalSync returns 'ok' when every card is 'ok'", () => {
    fc.assert(
      fc.property(
        fc
          .array(arbitraryCardId(), { minLength: 1, maxLength: 10 })
          .filter((ids) => new Set(ids).size === ids.length),
        (cardIds) => {
          _resetBusForTesting();
          for (const id of cardIds) {
            broadcastSync(id, "ok");
          }
          return globalSync.value === "ok";
        },
      ),
    );
  });

  it("EP5: broadcastAlert accepts any non-empty source string with valid type without throwing", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.oneof(fc.constant("pause"), fc.constant("resume")) as fc.Arbitrary<"pause" | "resume">,
        (source, type) => {
          _resetBusForTesting();
          let threw = false;
          try {
            broadcastAlert({ source, type });
          } catch {
            threw = true;
          }
          return !threw && globalAlertChannel.value?.source === source;
        },
      ),
    );
  });
});

// ── broadcastSync no-op branch ────────────────────────────────────────────────

describe("broadcastSync — unchanged state no-op branch", () => {
  beforeEach(() => {
    _resetBusForTesting();
  });

  it("does not create a new Map when setting the same state twice", () => {
    broadcastSync("wx", "loading");
    broadcastSync("wx", "loading"); // triggers early return
    // globalSync still reflects the state correctly
    expect(globalSync.value).toBe("loading");
  });

  it("does not notify effects when broadcastSync is called with same state", () => {
    const calls: string[] = [];
    broadcastSync("cal", "ok");
    const dispose = effect(() => {
      calls.push(globalSync.value);
    });
    broadcastSync("cal", "ok"); // no-op — should NOT trigger effect
    // Effect fires once on creation, not again
    expect(calls).toHaveLength(1);
    dispose();
  });
});
