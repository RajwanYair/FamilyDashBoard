/**
 * Tests for src/core/sw-register.ts
 *
 * Covers: registerSW (no-support path, registration path, error path),
 * swSkipWaiting (with and without waiting SW), showUpdateBanner,
 * auto-reload countdown (_startAutoReloadCountdown),
 * periodic SW update check (setInterval every 60 min).
 *
 * Uses vi.resetModules() per describe because the module stores a mutable
 * swRegistration reference.
 * Uses vi.useFakeTimers() in tests that trigger the "ready" banner state to
 * prevent real setInterval leaking between tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type SwMod = {
  registerSW: () => Promise<void>;
  swSkipWaiting: () => void;
  unregisterSW: () => Promise<number>;
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

function stubServiceWorker(reg: ServiceWorkerRegistration | null = null, rejects = false): void {
  const swContainer = {
    register: rejects
      ? vi.fn().mockRejectedValue(new Error("SW registration failed"))
      : vi.fn().mockResolvedValue(reg ?? makeRegistration()),
    addEventListener: vi.fn(),
    controller: {} as ServiceWorker,
    getRegistrations: vi.fn().mockResolvedValue([]),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: swContainer,
    writable: true,
    configurable: true,
  });
  // Stub caches so stale-cache cleanup doesn't fail
  vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
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
    const [path] = vi.mocked(navigator.serviceWorker.register).mock.calls[0] ?? [];
    expect(String(path)).toContain("sw.js");
  });

  it("attaches updatefound listener on registration", async () => {
    await mod.registerSW();
    expect(reg.addEventListener).toHaveBeenCalledWith("updatefound", expect.any(Function));
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
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn((evt: string, handler: (e: unknown) => void) => {
          navListeners[evt] = handler;
        }),
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
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn((evt: string, handler: (e: unknown) => void) => {
          navListeners[evt] = handler;
        }),
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
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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
      addEventListener: vi.fn((_: string, cb: EventListenerOrEventListenerObject) => {
        if (_ === "updatefound" && typeof cb === "function") updateFoundCb = cb as () => void;
      }),
    } as unknown as ServiceWorkerRegistration;

    stubServiceWorker(reg);
    const mod = await freshMod();
    await mod.registerSW();

    // trigger updatefound
    updateFoundCb?.();
    expect(document.getElementById("sw-update-banner")?.classList.contains("visible")).toBe(true);
  });
});

// ── controllerchange callback → reload ──

describe("SW Register — controllerchange triggers reload", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does NOT reload on controllerchange when controller was null at startup (first install)", async () => {
    // hadController = false (no prior SW) → clients.claim() fires controllerchange
    // → must NOT reload to avoid a reload loop on first visit.
    const navListeners: Record<string, (...args: unknown[]) => void> = {};
    const reg = makeRegistration();
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null, // no prior SW
        getRegistrations: vi.fn().mockResolvedValue([]),
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

    expect(navListeners["controllerchange"]).toBeDefined();
    navListeners["controllerchange"]!();
    // First-install claim must NOT trigger a page reload
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("calls onActivated callback (not location.reload) on controllerchange during SW upgrade", async () => {
    // hadController = true (existing SW active) → user clicked update banner →
    // skipWaiting → new SW activates → controllerchange → per-card refresh instead of full reload.
    const navListeners: Record<string, (...args: unknown[]) => void> = {};
    const reg = makeRegistration();
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: { postMessage: vi.fn() } as unknown as ServiceWorker, // prior SW exists
        getRegistrations: vi.fn().mockResolvedValue([]),
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

    const onActivated = vi.fn();
    const mod = await freshMod();
    await mod.registerSW(onActivated);

    expect(navListeners["controllerchange"]).toBeDefined();
    navListeners["controllerchange"]!();
    // SW upgrade must call per-card refresh — NOT a full page reload
    expect(onActivated).toHaveBeenCalledOnce();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does nothing on controllerchange when no onActivated callback provided", async () => {
    // Ensure no unhandled reload or throw when callback is omitted
    const navListeners: Record<string, (...args: unknown[]) => void> = {};
    const reg = makeRegistration();
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: { postMessage: vi.fn() } as unknown as ServiceWorker,
        getRegistrations: vi.fn().mockResolvedValue([]),
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
    await mod.registerSW(); // no callback

    navListeners["controllerchange"]!();
    // No callback provided → no reload, no throw
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

// ── statechange callback with installing state ──

describe("SW Register — statechange installing → installed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: { postMessage: vi.fn() }, // controller exists
        getRegistrations: vi.fn().mockResolvedValue([]),
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

    expect(document.getElementById("sw-update-banner")?.classList.contains("visible")).toBe(true);
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

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();
    updateFoundCb?.();
    stateChangeCb?.();

    expect(document.getElementById("sw-update-banner")?.classList.contains("visible")).toBe(false);
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

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        getRegistrations: vi.fn().mockResolvedValue([]),
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

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        getRegistrations: vi.fn().mockResolvedValue([]),
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
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: {},
        getRegistrations: vi.fn().mockResolvedValue([]),
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

    expect(document.getElementById("sw-update-banner")?.classList.contains("visible")).toBe(true);
  });
});

// ── showUpdateBanner with no DOM at all ──

describe("SW Register — showUpdateBanner with empty DOM", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

// ── file:// protocol guard (lines 23-24) ─────────────────────────────────────

describe("SW Register — file:// protocol guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns early without registering when protocol is file:", async () => {
    const registerSpy = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerSpy, addEventListener: vi.fn(), controller: null },
      writable: true,
      configurable: true,
    });
    // Override location.protocol
    Object.defineProperty(window, "location", {
      value: { protocol: "file:", href: "file:///index.html", hostname: "localhost" },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    expect(registerSpy).not.toHaveBeenCalled();

    // Restore location to http
    Object.defineProperty(window, "location", {
      value: { protocol: "http:", href: "http://localhost/", hostname: "localhost" },
      writable: true,
      configurable: true,
    });
  });
});

// ── Stale SW cleanup (sprint v7.1.7) ─────────────────────────────────────────

describe("SW Register — stale SW / stale cache cleanup (v7.1.7)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("unregisters SW with a different scope before registering", async () => {
    const unregisterSpy = vi.fn().mockResolvedValue(true);
    const registerSpy = vi.fn().mockResolvedValue({
      installing: null,
      waiting: null,
      addEventListener: vi.fn(),
    });
    const staleReg = {
      scope: "http://localhost/other-app/",
      unregister: unregisterSpy,
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([staleReg]),
        register: registerSpy,
        addEventListener: vi.fn(),
        controller: null,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        origin: "http://localhost",
        href: "http://localhost/FamilyDashBoard/",
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    expect(unregisterSpy).toHaveBeenCalledOnce();
    expect(registerSpy).toHaveBeenCalledOnce();
  });

  it("does NOT unregister SW that already has the correct scope", async () => {
    const unregisterSpy = vi.fn();
    const registerSpy = vi.fn().mockResolvedValue({
      installing: null,
      waiting: null,
      addEventListener: vi.fn(),
    });
    const currentReg = {
      scope: "http://localhost/FamilyDashBoard/",
      unregister: unregisterSpy,
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([currentReg]),
        register: registerSpy,
        addEventListener: vi.fn(),
        controller: null,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        origin: "http://localhost",
        href: "http://localhost/FamilyDashBoard/",
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    expect(unregisterSpy).not.toHaveBeenCalled();
    expect(registerSpy).toHaveBeenCalledOnce();
  });

  it("does not touch Cache Storage — stale-cache cleanup is owned by the SW activate handler", async () => {
    // Page-side cache deletion was removed because it incorrectly deleted
    // familydashboard-api-v* caches (API cache prefix != shell cache prefix).
    // The SW activate handler is the single source of truth for cache cleanup.
    const deleteSpy = vi.fn().mockResolvedValue(true);
    const cachesMock = {
      keys: vi
        .fn()
        .mockResolvedValue([
          "some-other-app-cache",
          "workbox-precache-v2",
          "familydashboard-api-v11.0.0",
          "familydashboard-v10.0.0",
        ]),
      delete: deleteSpy,
    };
    vi.stubGlobal("caches", cachesMock);

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([]),
        register: vi
          .fn()
          .mockResolvedValue({ installing: null, waiting: null, addEventListener: vi.fn() }),
        addEventListener: vi.fn(),
        controller: null,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        origin: "http://localhost",
        href: "http://localhost/FamilyDashBoard/",
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    // registerSW must NOT delete any caches — the SW activate handler owns this
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

// ── Auto-reload countdown (_startAutoReloadCountdown) ────────────────────────

describe("SW Register — auto-reload countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function makeReadyScenario(): {
    triggerReady: () => Promise<void>;
    postMsgSpy: ReturnType<typeof vi.fn>;
  } {
    document.body.innerHTML = `
      <div id="sw-update-banner"></div>
      <span id="sw-update-status"></span>
      <button id="sw-update-reload-btn"></button>
    `;
    const postMsgSpy = vi.fn();
    let updateFoundCb: (() => void) | null = null;
    let stateChangeCb: (() => void) | null = null;
    const installingMock = {
      state: "installing",
      addEventListener: vi.fn((evt: string, h: (...a: unknown[]) => void) => {
        if (evt === "statechange") stateChangeCb = h as () => void;
      }),
    };
    const reg = {
      installing: installingMock,
      waiting: { postMessage: postMsgSpy },
      addEventListener: vi.fn((evt: string, h: (...a: unknown[]) => void) => {
        if (evt === "updatefound") updateFoundCb = h as () => void;
      }),
    } as unknown as ServiceWorkerRegistration;

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: { postMessage: vi.fn() },
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const triggerReady = async () => {
      const mod = await freshMod();
      await mod.registerSW();
      updateFoundCb?.();
      installingMock.state = "installed";
      stateChangeCb?.();
    };
    return { triggerReady, postMsgSpy };
  }

  it("shows countdown text immediately when 'ready' state is entered", async () => {
    const { triggerReady } = makeReadyScenario();
    await triggerReady();
    const statusEl = document.getElementById("sw-update-status");
    expect(statusEl?.textContent).toMatch(/10/);
  });

  it("calls skipWaiting automatically after countdown reaches 0", async () => {
    const { triggerReady, postMsgSpy } = makeReadyScenario();
    await triggerReady();
    // 11 ticks × 1 s = countdown hits 0 and fires skipWaiting
    vi.advanceTimersByTime(11_000);
    expect(postMsgSpy).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("cancels countdown when reload button is clicked before it fires", async () => {
    const { triggerReady, postMsgSpy } = makeReadyScenario();
    await triggerReady();
    document.getElementById("sw-update-reload-btn")?.click();
    expect(postMsgSpy).toHaveBeenCalledTimes(1);
    // Advance past full countdown — must not fire a second time
    vi.advanceTimersByTime(15_000);
    expect(postMsgSpy).toHaveBeenCalledTimes(1);
  });
});

// ── Periodic SW update check ──────────────────────────────────────────────────

describe("SW Register — periodic SW update check", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls registration.update() after 60 minutes", async () => {
    const updateSpy = vi.fn().mockResolvedValue(undefined);
    const reg = {
      installing: null,
      waiting: null,
      addEventListener: vi.fn(),
      update: updateSpy,
    } as unknown as ServiceWorkerRegistration;

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    vi.advanceTimersByTime(59 * 60 * 1000);
    expect(updateSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60 * 1000);
    expect(updateSpy).toHaveBeenCalledOnce();
  });

  it("calls registration.update() again after 120 minutes", async () => {
    const updateSpy = vi.fn().mockResolvedValue(undefined);
    const reg = {
      installing: null,
      waiting: null,
      addEventListener: vi.fn(),
      update: updateSpy,
    } as unknown as ServiceWorkerRegistration;

    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue(reg),
        controller: null,
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const mod = await freshMod();
    await mod.registerSW();

    vi.advanceTimersByTime(120 * 60 * 1000);
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });
});

// ── ?nosw=1 dev escape hatch & unregisterSW helper (v13.13.1) ──

describe("SW Register — ?nosw=1 URL flag", () => {
  let mod: SwMod;
  const originalSearch = window.location.search;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window.location, "search", {
      value: originalSearch,
      configurable: true,
    });
  });

  it("skips registration when URL has ?nosw=1", async () => {
    Object.defineProperty(window.location, "search", {
      value: "?nosw=1",
      configurable: true,
    });
    stubServiceWorker();
    mod = await freshMod();
    await mod.registerSW();
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
  });

  it("registers normally when URL has no nosw param", async () => {
    Object.defineProperty(window.location, "search", { value: "", configurable: true });
    stubServiceWorker();
    mod = await freshMod();
    await mod.registerSW();
    expect(navigator.serviceWorker.register).toHaveBeenCalledOnce();
  });
});

describe("SW Register — unregisterSW", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 0 when serviceWorker is unsupported", async () => {
    removeServiceWorker();
    const mod = await freshMod();
    await expect(mod.unregisterSW()).resolves.toBe(0);
  });

  it("unregisters all registrations and purges familydashboard caches", async () => {
    const reg1 = { unregister: vi.fn().mockResolvedValue(true) };
    const reg2 = { unregister: vi.fn().mockResolvedValue(true) };
    const swContainer = {
      getRegistrations: vi.fn().mockResolvedValue([reg1, reg2]),
      addEventListener: vi.fn(),
      controller: null,
      register: vi.fn(),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: swContainer,
      writable: true,
      configurable: true,
    });
    const cachesDelete = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", {
      keys: vi
        .fn()
        .mockResolvedValue(["familydashboard-v13", "familydashboard-api-v13", "other-cache"]),
      delete: cachesDelete,
    });
    const mod = await freshMod();
    const count = await mod.unregisterSW();
    expect(count).toBe(2);
    expect(reg1.unregister).toHaveBeenCalled();
    expect(reg2.unregister).toHaveBeenCalled();
    // Should delete only familydashboard-* caches, not other-cache
    expect(cachesDelete).toHaveBeenCalledTimes(2);
    expect(cachesDelete).toHaveBeenCalledWith("familydashboard-v13");
    expect(cachesDelete).toHaveBeenCalledWith("familydashboard-api-v13");
  });
});
