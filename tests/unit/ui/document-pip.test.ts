/**
 * Tests for document-pip helper ( / ).
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

describe("document-pip ", () => {
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
    const requestWindow = vi.fn().mockResolvedValueOnce(fake1).mockResolvedValueOnce(fake2);
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

  // missed branches

  it("exitDocumentPip is a no-op when no PiP window is active", () => {
    _resetDocumentPip();
    expect(() => exitDocumentPip()).not.toThrow();
    expect(isPipActive()).toBe(false);
  });

  it("enterDocumentPip with orphan element (no parentNode) sets placeholder to null", async () => {
    const fake = makeFakePipWindow();
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    // Orphan element — not in the DOM, no parentNode
    const el = document.createElement("div");
    const ok = await enterDocumentPip(el);
    expect(ok).toBe(true);
    expect(isPipActive()).toBe(true);

    // exitDocumentPip should not throw when no placeholder
    exitDocumentPip();
    expect(isPipActive()).toBe(false);
  });

  it("_onPipClose uses appendChild when nextSibling is null", async () => {
    const fake = makeFakePipWindow();
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    const host = document.createElement("section");
    const el = document.createElement("div");
    host.appendChild(el);
    document.body.appendChild(host);

    // At this point el.nextSibling is null (last child)
    await enterDocumentPip(el);
    exitDocumentPip();

    // el should be back in host (via appendChild since nextSibling was null)
    expect(host.contains(el)).toBe(true);
    document.body.removeChild(host);
  });

  it("exitDocumentPip survives when pipWindow.close() throws", async () => {
    const fake = makeFakePipWindow();
    // Override close to throw
    fake.close = () => {
      throw new Error("already closed");
    };
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    const host = document.createElement("section");
    const el = document.createElement("div");
    host.appendChild(el);
    document.body.appendChild(host);

    await enterDocumentPip(el);
    expect(() => exitDocumentPip()).not.toThrow();
    expect(isPipActive()).toBe(false);
    document.body.removeChild(host);
  });

  it("isPipActive returns false after PiP window is closed externally", async () => {
    const fake = makeFakePipWindow();
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    const el = document.createElement("div");
    await enterDocumentPip(el);
    // Simulate external close
    fake.closed = true;
    expect(isPipActive()).toBe(false);
  });

  // _onPipClose uses insertBefore when nextSibling is still in the same parent
  it("_onPipClose uses insertBefore when nextSibling still belongs to the same parent", async () => {
    const fake = makeFakePipWindow();
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn().mockResolvedValue(fake), window: null },
    });

    const host = document.createElement("section");
    const el = document.createElement("div");
    el.id = "pip-target";
    const sibling = document.createElement("div");
    sibling.id = "pip-sibling";
    host.appendChild(el);
    host.appendChild(sibling);
    document.body.appendChild(host);

    // el is first child; sibling is second — so el.nextSibling === sibling
    await enterDocumentPip(el);
    // el has been moved into the PiP window; sibling remains in host
    // On exit, _onPipClose should call insertBefore(el, sibling) since sibling.parentNode === host
    exitDocumentPip();

    expect(host.contains(el)).toBe(true);
    // el should be re-inserted before sibling (or at least back in host)
    const children = [...host.children];
    expect(children.indexOf(el)).toBeLessThan(children.indexOf(sibling));
    document.body.removeChild(host);
  });
});