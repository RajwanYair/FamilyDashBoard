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

// Clean up between tests
beforeEach(() => {
  store.clear();
  document.body.innerHTML = "";
  document.body.className = "";
});
