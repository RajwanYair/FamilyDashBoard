/**
 * Vitest global test setup.
 *
 * happy-dom provides window, document, etc.
 * We provide a proper localStorage mock since Node.js 25's built-in
 * localStorage conflicts with happy-dom.
 */

// Provide a full localStorage mock
const store = new Map<string, string>();
const mockStorage = {
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    store.set(key, String(value));
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  clear(): void {
    store.clear();
  },
  key(index: number): string | null {
    return [...store.keys()][index] ?? null;
  },
  get length(): number {
    return store.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

// Neutralise <iframe> network loading. happy-dom otherwise issues real HTTP
// requests when iframe.src is assigned (video-news card sets YouTube /
// i24news URLs). Those sockets stay open after tests finish and cause
// "close timed out" hangs in CLI runs and indefinite hangs in the VS Code
// Vitest test pane.
//
// Done as a one-shot prototype patch (guarded by a symbol so re-running this
// setup file in the same fork doesn't re-define the property — isolate=false
// shares the HTMLIFrameElement prototype across test files in a fork).
const IFRAME_PATCHED = Symbol.for("fdb.iframe-src-patched");
const _IframeProto = globalThis.HTMLIFrameElement?.prototype as
  | (HTMLIFrameElement & { [k: symbol]: boolean })
  | undefined;
if (_IframeProto && !_IframeProto[IFRAME_PATCHED]) {
  Object.defineProperty(_IframeProto, "src", {
    configurable: true,
    enumerable: true,
    get(this: HTMLIFrameElement): string {
      return this.getAttribute("data-src") ?? "";
    },
    set(this: HTMLIFrameElement, value: string): void {
      this.setAttribute("data-src", String(value));
      this.setAttribute("src", "about:blank");
    },
  });
  Object.defineProperty(_IframeProto, IFRAME_PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

// Permanent network block. Background timers in cards (auto-refresh intervals)
// can fire between tests — after `vi.unstubAllGlobals()` has restored the
// "original" fetch but before the next beforeEach re-stubs. If that "original"
// is the real Node fetch, it opens real sockets to the worker / proxy URLs and
// keeps the fork worker alive past test completion ("Timeout terminating forks
// worker"). By installing our own blocker as the module-level fetch, every
// vi.unstubAllGlobals() restore reverts to THIS blocker rather than real fetch.
const _blockingFetch = (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  // Allow data: URIs synchronously — they're inert.
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return Promise.resolve(new Response("", { status: 200 }));
  }
  return Promise.reject(new Error(`fetch blocked in tests: ${url}`));
};
globalThis.fetch = _blockingFetch as typeof globalThis.fetch;

// Clean up between tests
beforeEach(() => {
  store.clear();
  document.body.innerHTML = "";
  document.body.className = "";
  // Default: freeze any real fetch to prevent background network connections from
  // unawaited init*Card() calls. Individual tests override this in their own beforeEach.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => new Promise(() => {})),
  );
});

// Restore all globals after each test (vi.restoreAllMocks does NOT restore stubGlobal)
afterEach(() => {
  vi.unstubAllGlobals();
});
