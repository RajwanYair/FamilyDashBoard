/**
 * Compute Pressure API helper tests.
 *
 * Verifies feature-detection, observer wiring, state propagation, and clean
 * teardown. Uses a stub `PressureObserver` constructor to avoid relying on
 * any browser implementation.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initPressureObserver,
  getPressureState,
  destroyPressureObserver,
} from "../../../src/cards/system-info/system-info";

interface CapturedObserver {
  callback: (records: ReadonlyArray<{ state: string; source: string; time: number }>) => void;
  observed: string[];
  disconnected: boolean;
}

function installStub(): { last: () => CapturedObserver | null; remove: () => void } {
  let captured: CapturedObserver | null = null;
  class StubPressureObserver {
    private cb: CapturedObserver["callback"];
    public _meta: CapturedObserver;
    constructor(cb: CapturedObserver["callback"]) {
      this.cb = cb;
      this._meta = { callback: cb, observed: [], disconnected: false };
      captured = this._meta;
    }
    observe(source: "cpu"): Promise<void> {
      this._meta.observed.push(source);
      return Promise.resolve();
    }
    disconnect(): void {
      this._meta.disconnected = true;
    }
  }
  (globalThis as unknown as { PressureObserver: unknown }).PressureObserver = StubPressureObserver;
  return {
    last: () => captured,
    remove: () => {
      delete (globalThis as unknown as { PressureObserver?: unknown }).PressureObserver;
    },
  };
}

describe("Compute Pressure helper ", () => {
  afterEach(() => {
    destroyPressureObserver();
    delete (globalThis as unknown as { PressureObserver?: unknown }).PressureObserver;
  });

  it("returns 'unsupported' when PressureObserver is absent", () => {
    expect(getPressureState()).toBe("unsupported");
    initPressureObserver();
    expect(getPressureState()).toBe("unsupported");
  });

  it("subscribes to cpu source and updates state from the latest record", () => {
    const stub = installStub();
    initPressureObserver();
    const obs = stub.last();
    expect(obs).not.toBeNull();
    expect(obs?.observed).toEqual(["cpu"]);

    obs?.callback([
      { state: "nominal", source: "cpu", time: 1 },
      { state: "serious", source: "cpu", time: 2 },
    ]);
    expect(getPressureState()).toBe("serious");

    obs?.callback([{ state: "critical", source: "cpu", time: 3 }]);
    expect(getPressureState()).toBe("critical");
  });

  it("disconnects the observer and resets state on destroy", () => {
    installStub();
    initPressureObserver();
    destroyPressureObserver();
    expect(getPressureState()).toBe("unsupported");
  });

  it("init is idempotent — second call does not create a second observer", () => {
    const stub = installStub();
    initPressureObserver();
    const first = stub.last();
    initPressureObserver();
    const second = stub.last();
    expect(first).toBe(second);
  });

  it("sets state to unsupported when PressureObserver constructor throws (line 574)", () => {
    // A constructor that throws — covers the outer catch in initPressureObserver.
    (globalThis as unknown as { PressureObserver: unknown }).PressureObserver = function () {
      throw new Error("PressureObserver not allowed");
    };
    initPressureObserver();
    expect(getPressureState()).toBe("unsupported");
  });

  it("sets state to unsupported when observe('cpu') promise rejects (line 570)", async () => {
    // observe returns a rejected promise → the .catch callback fires.
    class RejectingObserver {
      observe(_source: string): Promise<void> {
        return Promise.reject(new Error("cpu observe denied"));
      }
      disconnect(): void {}
    }
    (globalThis as unknown as { PressureObserver: unknown }).PressureObserver = RejectingObserver;
    initPressureObserver();
    // Flush the microtask queue so the .catch() callback executes.
    await Promise.resolve();
    expect(getPressureState()).toBe("unsupported");
  });

  beforeEach(() => {
    destroyPressureObserver();
  });
});
