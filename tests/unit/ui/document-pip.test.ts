/**
 * Tests for document-pip helper (Sprint 137 / Roadmap #22).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isDocumentPipSupported,
  isPipActive,
  enterDocumentPip,
  exitDocumentPip,
  _resetDocumentPip,
} from "@/ui/document-pip";

interface FakePipWindow extends Pick<Window, "close" | "closed"> {
  document: { body: HTMLElement };
  addEventListener: (type: string, listener: EventListener, options?: { once?: boolean }) => void;
  _trigger: (type: string) => void;
}

function makeFakePipWindow(): FakePipWindow {
  const listeners = new Map<string, EventListener[]>();
  const body = document.createElement("body");
  return {
    closed: false,
    close() {
      this.closed = true;
    },
    document: { body },
    addEventListener(type, listener) {
      const arr = listeners.get(type) ?? [];
      arr.push(listener);
      listeners.set(type, arr);
    },
    _trigger(type: string) {
      const arr = listeners.get(type) ?? [];
      arr.forEach((l) => l(new Event(type)));
    },
  };
}

describe("document-pip (Sprint 137)", () => {
  beforeEach(() => {
    _resetDocumentPip();
    Reflect.deleteProperty(window, "documentPictureInPicture");
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "documentPictureInPicture");
  });

  it("isDocumentPipSupported() returns false when API absent", () => {
    expect(isDocumentPipSupported()).toBe(false);
  });

  it("isDocumentPipSupported() returns true when API present", () => {
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn(), window: null },
    });
    expect(isDocumentPipSupported()).toBe(true);
  });

  it("enterDocumentPip resolves false on unsupported browsers", async () => {
    const el = document.createElement("div");
    expect(await enterDocumentPip(el)).toBe(false);
    expect(isPipActive()).toBe(false);
  });

  it("enterDocumentPip moves the element into the PiP window", async () => {
    const fake = makeFakePipWindow();
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    const host = document.createElement("section");
    const el = document.createElement("div");
    host.appendChild(el);
    document.body.appendChild(host);

    const ok = await enterDocumentPip(el);
    expect(ok).toBe(true);
    expect(isPipActive()).toBe(true);
    expect(fake.document.body.contains(el)).toBe(true);
    expect(host.contains(el)).toBe(false);

    document.body.removeChild(host);
  });

  it("exitDocumentPip restores the element to its original parent", async () => {
    const fake = makeFakePipWindow();
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    const host = document.createElement("section");
    const el = document.createElement("div");
    host.appendChild(el);
    document.body.appendChild(host);

    await enterDocumentPip(el);
    exitDocumentPip();

    expect(host.contains(el)).toBe(true);
    expect(isPipActive()).toBe(false);
    document.body.removeChild(host);
  });

  it("enterDocumentPip resolves false when requestWindow rejects", async () => {
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockRejectedValue(new Error("denied")), window: null },
    });

    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(await enterDocumentPip(el)).toBe(false);
    expect(isPipActive()).toBe(false);
    document.body.removeChild(el);
  });

  it("re-entering PiP closes the existing window first", async () => {
    const fake1 = makeFakePipWindow();
    const fake2 = makeFakePipWindow();
    const requestWindow = vi
      .fn()
      .mockResolvedValueOnce(fake1)
      .mockResolvedValueOnce(fake2);
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow, window: null },
    });

    const host = document.createElement("section");
    const el = document.createElement("div");
    host.appendChild(el);
    document.body.appendChild(host);

    await enterDocumentPip(el);
    await enterDocumentPip(el);

    expect(fake1.closed).toBe(true);
    expect(requestWindow).toHaveBeenCalledTimes(2);
    document.body.removeChild(host);
  });
});
