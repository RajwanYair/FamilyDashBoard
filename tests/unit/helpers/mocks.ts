/**
 * Shared vi.mock() factory helpers for FamilyDashBoard unit tests.
 *
 * These factories produce consistent mock objects for the most frequently
 * mocked modules: cache, fetch, and config. Use them in vi.mock() factories
 * to keep test boilerplate minimal and consistent.
 *
 * Usage:
 *   import { makeCacheMocks, makeFetchMocks, makeConfigMocks } from "@tests/helpers";
 *
 *   vi.mock("@/core/cache", () => makeCacheMocks());
 *   vi.mock("@/core/fetch", () => makeFetchMocks());
 *   vi.mock("@/core/config", () => makeConfigMocks());
 */

import { vi } from "vitest";
import type { DashboardConfig } from "@/types/config";

// ── Cache mocks ───────────────────────────────────────────────────────────────

export interface CacheMocks {
  cGet: ReturnType<typeof vi.fn>;
  cGetStale: ReturnType<typeof vi.fn>;
  cSet: ReturnType<typeof vi.fn>;
  cEvict: ReturnType<typeof vi.fn>;
}

/**
 * Returns a vi.mock() factory for `@/core/cache`.
 * By default: cGet → null, cGetStale → null, cSet → no-op.
 *
 * @example
 *   vi.mock("@/core/cache", () => makeCacheMocks());
 *
 * To configure per-test:
 *   vi.mocked(cGet).mockReturnValue(fixture);
 */
export function makeCacheMocks(): CacheMocks {
  return {
    cGet: vi.fn().mockReturnValue(null),
    cGetStale: vi.fn().mockReturnValue(null),
    cSet: vi.fn(),
    cEvict: vi.fn(),
  };
}

// ── Fetch mocks ───────────────────────────────────────────────────────────────

export interface FetchMocks {
  fetchWithTimeout: ReturnType<typeof vi.fn>;
  acquireLock: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
  diagLog: ReturnType<typeof vi.fn>;
}

/**
 * Returns a vi.mock() factory for `@/core/fetch`.
 * By default: fetchWithTimeout rejects (network down), locks return false.
 *
 * @example
 *   vi.mock("@/core/fetch", () => makeFetchMocks());
 *
 * To simulate a successful response:
 *   vi.mocked(fetchWithTimeout).mockResolvedValue({
 *     ok: true,
 *     json: () => Promise.resolve(fixture),
 *   } as Response);
 */
export function makeFetchMocks(): FetchMocks {
  return {
    fetchWithTimeout: vi.fn().mockRejectedValue(new Error("network mocked")),
    acquireLock: vi.fn().mockReturnValue(false),
    releaseLock: vi.fn(),
    diagLog: vi.fn(),
  };
}

/** Returns a mock JSON Response for fetchWithTimeout. */
export function mockOkResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

/** Returns a mock failed Response (ok: false) for fetchWithTimeout. */
export function mockErrResponse(status = 500): Response {
  return {
    ok: false,
    status,
    json: vi.fn(),
    text: vi.fn(),
  } as unknown as Response;
}

// ── Config mocks ──────────────────────────────────────────────────────────────

/** Minimal valid DashboardConfig for tests that need a populated config. */
export const DEFAULT_TEST_CONFIG: Partial<DashboardConfig> = {
  tempUnit: "C",
  interfaceLanguage: "he",
  homeLat: 31.7683,
  homeLon: 35.2137,
  homeName: "Jerusalem",
  familyName: "Test Family",
} as unknown as Partial<DashboardConfig>;

export interface ConfigMocks {
  loadConfig: ReturnType<typeof vi.fn>;
  saveConfig: ReturnType<typeof vi.fn>;
  getConfig: ReturnType<typeof vi.fn>;
}

/**
 * Returns a vi.mock() factory for `@/core/config`.
 * By default: loadConfig returns DEFAULT_TEST_CONFIG.
 *
 * @example
 *   vi.mock("@/core/config", () => makeConfigMocks());
 */
export function makeConfigMocks(overrides: Partial<DashboardConfig> = {}): ConfigMocks {
  const cfg = { ...DEFAULT_TEST_CONFIG, ...overrides };
  return {
    loadConfig: vi.fn().mockReturnValue(cfg),
    saveConfig: vi.fn(),
    getConfig: vi.fn().mockReturnValue(cfg),
  };
}

// ── Diag/sync mocks ───────────────────────────────────────────────────────────

export interface DiagMocks {
  diagLog: ReturnType<typeof vi.fn>;
  diagError: ReturnType<typeof vi.fn>;
}

export function makeDiagMocks(): DiagMocks {
  return {
    diagLog: vi.fn(),
    diagError: vi.fn(),
  };
}

export interface SyncMocks {
  setSync: ReturnType<typeof vi.fn>;
}

export function makeSyncMocks(): SyncMocks {
  return {
    setSync: vi.fn(),
  };
}
