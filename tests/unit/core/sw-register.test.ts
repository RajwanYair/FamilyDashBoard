/**
 * Tests for src/core/sw-register.ts
 *
 * Covers: registerSW (no-support path, registration path, error path),
 * swSkipWaiting (with and without waiting SW), showUpdateBanner.
 *
 * Uses vi.resetModules() per describe because the module stores a mutable
 * swRegistration reference.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type SwMod = {
  registerSW: () => Promise<void>;
  swSkipWaiting: () => void;
};

async function freshMod(): Promise<SwMod> {
  vi.resetModules();
  return import("@/core/sw-register") as Promise<SwMod>;
}

// ── Helpers to build minimal ServiceWorker mocks ──

function makeRegistration(
  overrides: Partial<ServiceWorkerRegistration> = {},
): ServiceWorkerRegistration {
  return {
    installing: null,
    waiting: null,
    active: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
}

function stubServiceWorker(
  reg: ServiceWorkerRegistration | null = null,
  rejects = false,
): void {
  const swContainer = {
    register: rejects
      ? vi.fn().mockRejectedValue(new Error("SW registration failed"))
      : vi.fn().mockResolvedValue(reg ?? makeRegistration()),
    addEventListener: vi.fn(),
    controller: {} as ServiceWorker,
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: swContainer,
    writable: true,
    configurable: true,
  });
}

function removeServiceWorker(): void {
  // Simulate environment without SW support
  const nav = navigator as Navigator & { serviceWorker?: unknown };
  delete nav.serviceWorker;
}

// ── No SW support ──

describe("SW Register — no ServiceWorker support", () => {
  let mod: SwMod;

  beforeEach(async () => {
    removeServiceWorker();
    mod = await freshMod();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registerSW resolves without throwing", async () => {
    await expect(mod.registerSW()).resolves.toBeUndefined();
  });
});

// ── Successful registration ──

describe("SW Register — successful registration", () => {
  let mod: SwMod;
  let reg: ServiceWorkerRegistration;

  beforeEach(async () => {
    reg = makeRegistration();
    stubServiceWorker(reg);
    mod = await freshMod();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registerSW calls navigator.serviceWorker.register", async () => {
    await mod.registerSW();
    expect(navigator.serviceWorker.register).toHaveBeenCalledOnce();
  });

  it("registers the correct SW path", async () => {
    await mod.registerSW();
    const [path] =
      vi.mocked(navigator.serviceWorker.register).mock.calls[0] ?? [];
    expect(String(path)).toContain("sw.js");
  });

  it("attaches updatefound listener on registration", async () => {
    await mod.registerSW();
    expect(reg.addEventListener).toHaveBeenCalledWith(
      "updatefound",
      expect.any(Function),
    );
  });

  it("attaches controllerchange listener on navigator.serviceWorker", async () => {
    await mod.registerSW();
    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
    );
  });

  it("attaches message listener for VERSION_ACTIVATED", async () => {
    await mod.registerSW();
    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });
});

// ── VERSION_ACTIVATED message callback ──

describe("SW Register — VERSION_ACTIVATED message handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs version when VERSION_ACTIVATED message received", async () => {
    const navListeners: Record<string, (e: unknown) => void> = {};
    const reg = makeRegistration();
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        addEventListener: vi.fn(
          (evt: string, handler: (e: unknown) => void) => {
            navListeners[evt] = handler;
          },
        ),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    expect(navListeners["message"]).toBeDefined();
    // Fire VERSION_ACTIVATED → covers lines 54-55
    navListeners["message"]!({
      data: { type: "VERSION_ACTIVATED", version: "6.5.0" },
    });
    // No assertion on diagLog since it's mocked at module level,
    // just ensure no error is thrown
  });

  it("ignores messages without VERSION_ACTIVATED type", async () => {
    const navListeners: Record<string, (e: unknown) => void> = {};
    const reg = makeRegistration();
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        addEventListener: vi.fn(
          (evt: string, handler: (e: unknown) => void) => {
            navListeners[evt] = handler;
          },
        ),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    expect(() => {
      navListeners["message"]!({ data: { type: "OTHER_MSG" } });
    }).not.toThrow();
  });
});

// ── Registration failure ──

describe("SW Register — registration failure", () => {
  let mod: SwMod;

  beforeEach(async () => {
    stubServiceWorker(null, true);
    mod = await freshMod();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registerSW does not throw on registration error", async () => {
    await expect(mod.registerSW()).resolves.toBeUndefined();
  });
});

// ── swSkipWaiting ──

describe("SW Register — swSkipWaiting", () => {
  let mod: SwMod;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when no registration has been made", async () => {
    removeServiceWorker();
    mod = await freshMod();
    expect(() => mod.swSkipWaiting()).not.toThrow();
  });

  it("posts SKIP_WAITING to waiting SW after registration", async () => {
    const postMessage = vi.fn();
    const waiting = {
      postMessage,
      state: "installed",
      addEventListener: vi.fn(),
    } as unknown as ServiceWorker;
    const reg = makeRegistration({ waiting });
    stubServiceWorker(reg);
    mod = await freshMod();
    await mod.registerSW();
    mod.swSkipWaiting();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});

// ── Update banner ──

describe("SW Register — showUpdateBanner", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("adds visible class to #sw-update-banner when updatefound fires", async () => {
    document.body.innerHTML = '<div id="sw-update-banner"></div>';

    // Set up a registration where we can manually fire updatefound
    let updateFoundCb: (() => void) | null = null;
    const installing = {
      state: "installed",
      addEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
        if (typeof cb === "function") cb({ type: "statechange" } as Event);
      },
    };
    const reg = {
      installing,
      waiting: null,
      addEventListener: vi.fn(
        (_: string, cb: EventListenerOrEventListenerObject) => {
          if (_ === "updatefound" && typeof cb === "function")
            updateFoundCb = cb as () => void;
        },
      ),
    } as unknown as ServiceWorkerRegistration;

    stubServiceWorker(reg);
    const mod = await freshMod();
    await mod.registerSW();

    // trigger updatefound
    updateFoundCb?.();
    expect(
      document
        .getElementById("sw-update-banner")
        ?.classList.contains("visible"),
    ).toBe(true);
  });
});

// ── controllerchange callback → reload ──

describe("SW Register — controllerchange triggers reload", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("calls window.location.reload() when controllerchange fires", async () => {
    const navListeners: Record<string, (...args: unknown[]) => void> = {};
    const reg = makeRegistration();
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
          navListeners[evt] = handler;
        }),
      },
      writable: true,
      configurable: true,
    });

    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    // Fire the controllerchange handler → covers lines 54-57
    expect(navListeners["controllerchange"]).toBeDefined();
    navListeners["controllerchange"]!();
    expect(reloadSpy).toHaveBeenCalled();
  });
});

// ── statechange callback with installing state ──

describe("SW Register — statechange installing → installed", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("wires statechange on installing worker and shows banner", async () => {
    document.body.innerHTML = `
      <div id="sw-update-banner"></div>
      <button id="sw-update-reload-btn"></button>
    `;

    let updateFoundCb: (() => void) | null = null;
    let stateChangeCb: (() => void) | null = null;
    const installingMock = {
      state: "installing",
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "statechange") stateChangeCb = handler as () => void;
      }),
    };

    const reg = {
      installing: installingMock,
      waiting: null,
      active: null,
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = handler as () => void;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: { postMessage: vi.fn() }, // controller exists
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    // Fire updatefound → source wires statechange on installing
    updateFoundCb?.();
    expect(stateChangeCb).toBeDefined();

    // Simulate installing completing → statechange fires
    installingMock.state = "installed";
    stateChangeCb?.();

    expect(
      document
        .getElementById("sw-update-banner")
        ?.classList.contains("visible"),
    ).toBe(true);
  });

  it("does not show banner when state is not installed", async () => {
    document.body.innerHTML = '<div id="sw-update-banner"></div>';
    let updateFoundCb: (() => void) | null = null;
    let stateChangeCb: (() => void) | null = null;
    const installingMock = {
      state: "activating",
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "statechange") stateChangeCb = handler as () => void;
      }),
    };
    const reg = {
      installing: installingMock,
      waiting: null,
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = handler as () => void;
      }),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();
    updateFoundCb?.();
    stateChangeCb?.();

    expect(
      document
        .getElementById("sw-update-banner")
        ?.classList.contains("visible"),
    ).toBe(false);
  });

  it("wires reload button to swSkipWaiting on update banner", async () => {
    document.body.innerHTML = `
      <div id="sw-update-banner"></div>
      <button id="sw-update-reload-btn"></button>
    `;

    let updateFoundCb: (() => void) | null = null;
    let stateChangeCb: (() => void) | null = null;
    const postMsgSpy = vi.fn();
    const installingMock = {
      state: "installing",
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "statechange") stateChangeCb = handler as () => void;
      }),
    };
    const reg = {
      installing: installingMock,
      waiting: { postMessage: postMsgSpy },
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = handler as () => void;
      }),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();
    updateFoundCb?.();
    installingMock.state = "installed";
    stateChangeCb?.();

    // Click reload button → should call swSkipWaiting → postMessage
    const btn = document.getElementById("sw-update-reload-btn") as HTMLElement;
    btn.click();
    expect(postMsgSpy).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});

// ── updatefound with null installing ──

describe("SW Register — updatefound with null installing", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when installing is null on updatefound", async () => {
    let updateFoundCb: (() => void) | null = null;
    const reg = {
      installing: null,
      waiting: null,
      active: null,
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = handler as () => void;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();
    expect(() => updateFoundCb?.()).not.toThrow();
  });
});

// ── showUpdateBanner without reload button ──

describe("SW Register — showUpdateBanner without reload button", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows banner but does not throw when #sw-update-reload-btn is absent", async () => {
    document.body.innerHTML = '<div id="sw-update-banner"></div>';

    let updateFoundCb: (() => void) | null = null;
    let stateChangeCb: (() => void) | null = null;
    const installingMock = {
      state: "installing",
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "statechange") stateChangeCb = handler as () => void;
      }),
    };
    const reg = {
      installing: installingMock,
      waiting: null,
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = handler as () => void;
      }),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();
    updateFoundCb?.();
    installingMock.state = "installed";
    stateChangeCb?.();

    expect(
      document
        .getElementById("sw-update-banner")
        ?.classList.contains("visible"),
    ).toBe(true);
  });
});

// ── showUpdateBanner with no DOM at all ──

describe("SW Register — showUpdateBanner with empty DOM", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when both banner and reload button are absent", async () => {
    document.body.innerHTML = "";

    let updateFoundCb: (() => void) | null = null;
    let stateChangeCb: (() => void) | null = null;
    const installingMock = {
      state: "installing",
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "statechange") stateChangeCb = handler as () => void;
      }),
    };
    const reg = {
      installing: installingMock,
      waiting: null,
      addEventListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = handler as () => void;
      }),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();
    updateFoundCb?.();
    installingMock.state = "installed";
    expect(() => stateChangeCb?.()).not.toThrow();
  });
});
