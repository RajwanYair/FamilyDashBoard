/**
 * tests/unit/core/sw-constants.test.ts — Sprint 44
 *
 * Tests for typed SW message constants and type-guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SW_MSG_SKIP_WAITING,
  SW_MSG_VERSION_ACTIVATED,
  isVersionActivatedMsg,
  isSkipWaitingMsg,
  postMessageToSW,
} from "../../../src/core/sw-constants";

describe("SW Constants — string values", () => {
  it("SW_MSG_SKIP_WAITING equals 'SKIP_WAITING'", () => {
    expect(SW_MSG_SKIP_WAITING).toBe("SKIP_WAITING");
  });

  it("SW_MSG_VERSION_ACTIVATED equals 'VERSION_ACTIVATED'", () => {
    expect(SW_MSG_VERSION_ACTIVATED).toBe("VERSION_ACTIVATED");
  });
});

describe("SW Constants — isVersionActivatedMsg", () => {
  it("returns true for a valid VERSION_ACTIVATED message", () => {
    expect(isVersionActivatedMsg({ type: "VERSION_ACTIVATED", version: "1.0.0" })).toBe(true);
  });

  it("returns false for SKIP_WAITING message", () => {
    expect(isVersionActivatedMsg({ type: "SKIP_WAITING" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isVersionActivatedMsg(null)).toBe(false);
  });

  it("returns false for a non-object", () => {
    expect(isVersionActivatedMsg("VERSION_ACTIVATED")).toBe(false);
    expect(isVersionActivatedMsg(42)).toBe(false);
  });

  it("returns false for an object without type", () => {
    expect(isVersionActivatedMsg({ version: "1.0.0" })).toBe(false);
  });
});

describe("SW Constants — isSkipWaitingMsg", () => {
  it("returns true for a valid SKIP_WAITING message", () => {
    expect(isSkipWaitingMsg({ type: "SKIP_WAITING" })).toBe(true);
  });

  it("returns false for VERSION_ACTIVATED message", () => {
    expect(isSkipWaitingMsg({ type: "VERSION_ACTIVATED", version: "1.0.0" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSkipWaitingMsg(null)).toBe(false);
  });

  it("returns false for a bare string", () => {
    expect(isSkipWaitingMsg("SKIP_WAITING")).toBe(false);
  });
});

describe("SW Constants — postMessageToSW", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls postMessage on the active controller", () => {
    const mockPostMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: { postMessage: mockPostMessage } },
      writable: true,
      configurable: true,
    });
    postMessageToSW({ type: "SKIP_WAITING" });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("does not throw when serviceWorker is undefined", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => postMessageToSW({ type: "SKIP_WAITING" })).not.toThrow();
  });

  it("does not throw when controller is null", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: null },
      writable: true,
      configurable: true,
    });
    expect(() => postMessageToSW({ type: "SKIP_WAITING" })).not.toThrow();
  });
});
