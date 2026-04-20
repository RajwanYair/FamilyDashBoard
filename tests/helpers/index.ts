/**
 * tests/helpers/index.ts — Shared test utilities (Stream G.1)
 *
 * Reusable helpers that eliminate boilerplate across test files.
 * Import via the `@tests/helpers` alias (configured in vitest.config.ts).
 *
 * @example
 *   import { createCardDOM, createMockFetch, createMockConfig } from "@tests/helpers";
 */

import { vi } from "vitest";
import { DEFAULT_CONFIG } from "@/types/config";
import type { DashboardConfig } from "@/types/config";

// ── DOM helpers ──────────────────────────────────────────────────────────────

/**
 * Set document.body.innerHTML and return the body element.
 * Each call replaces the previous content.
 */
export function createCardDOM(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

/**
 * Clear document.body to a clean state.
 * Equivalent to the global beforeEach default but callable on demand.
 */
export function cleanupDOM(): void {
  document.body.innerHTML = "";
  document.body.className = "";
}

/**
 * Append one or more HTML elements to document.body without replacing
 * existing content. Returns the appended container element.
 */
export function appendToDOM(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

/**
 * Run a callback inside a fake-timer context.
 * Installs fake timers before calling `fn`, then restores real timers
 * afterward — even if `fn` throws.
 *
 * Use this instead of manual `vi.useFakeTimers()` / `vi.useRealTimers()` pairs
 * in individual tests that need to control time.
 *
 * @example
 *   const result = await withFakeTimers(() => {
 *     scheduleWork();
 *     vi.advanceTimersByTime(5000);
 *     return getWorkResult();
 *   });
 */
export async function withFakeTimers<T>(
  fn: () => T | Promise<T>,
): Promise<T> {
  vi.useFakeTimers();
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

/**
 * Create a vi.fn() that resolves as a successful `fetch()` Response.
 * The body is JSON-serialised from `data`.
 *
 * @example
 *   vi.stubGlobal("fetch", createMockFetch({ temperature: 22 }));
 */
export function createMockFetch(
  data: unknown,
  options: { ok?: boolean; status?: number } = {},
): ReturnType<typeof vi.fn> {
  const { ok = true, status = 200 } = options;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    clone: function () {
      return this;
    },
  });
}

/**
 * Create a vi.fn() that rejects with a network error.
 * Useful for testing proxy-fallback and error-handling paths.
 */
export function createFailingFetch(
  message = "Network error",
): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new TypeError(message));
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

/** Return type for a mock cache object. */
export interface MockCache {
  cGet: ReturnType<typeof vi.fn>;
  cSet: ReturnType<typeof vi.fn>;
  cGetStale: ReturnType<typeof vi.fn>;
  /** Seed the cache with a pre-populated value for `cGet`. */
  seed(key: string, value: unknown): void;
}

/**
 * Create a lightweight mock of the dual-layer cache API.
 * Returned mocks are `vi.fn()` — call `.mockResolvedValue()` etc. as needed.
 *
 * By default:
 * - `cGet` returns `null` (cache miss)
 * - `cSet` is a no-op
 * - `cGetStale` returns `null`
 *
 * @example
 *   const cache = createMockCache();
 *   cache.seed("weather", weatherFixture);
 *   vi.mock("@/core/cache", () => ({ cGet: cache.cGet, cSet: cache.cSet, cGetStale: cache.cGetStale }));
 */
export function createMockCache(): MockCache {
  const store = new Map<string, unknown>();

  const cGet = vi.fn().mockImplementation((key: string) => store.get(key) ?? null);
  const cSet = vi.fn().mockImplementation((key: string, value: unknown) => {
    store.set(key, value);
  });
  const cGetStale = vi.fn().mockImplementation((key: string) => store.get(key) ?? null);

  return {
    cGet,
    cSet,
    cGetStale,
    seed(key, value) {
      store.set(key, value);
    },
  };
}

// ── Config helpers ────────────────────────────────────────────────────────────

/**
 * Return a complete DashboardConfig suitable for tests.
 * Based on DEFAULT_CONFIG with test-friendly overrides applied.
 * Pass additional `overrides` to customise specific fields.
 *
 * @example
 *   const cfg = createMockConfig({ tempUnit: "F", homeCity: "Jerusalem" });
 */
export function createMockConfig(
  overrides: Partial<DashboardConfig> = {},
): DashboardConfig {
  return {
    ...DEFAULT_CONFIG,
    familyName: "Test Family",
    homeCity: "תל אביב",
    geonameid: "293397",
    ...overrides,
  };
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/**
 * Assert that an element exists in the document and return it typed.
 * Throws a descriptive error if the element is not found.
 *
 * @example
 *   const el = getElement<HTMLSpanElement>("#clock");
 */
export function getElement<T extends Element = Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`getElement: no element matches "${selector}"`);
  return el;
}

/**
 * Assert that an element with the given id exists and return it typed.
 */
export function getDomElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`getDomElement: no element with id "${id}"`);
  return el;
}
