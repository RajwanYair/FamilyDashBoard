/**
 * Tests for Provider Adapter types (Sprint 88).
 * Type-level assertions + runtime shape checks.
 */

import { describe, it, expect } from "vitest";
import type {
  ProviderAdapter,
  ProviderResult,
  ProviderAdapterOptions,
} from "@/types/provider";
import type { ProviderStatus } from "@/core/provider";

describe("ProviderAdapter types (Sprint 88)", () => {
  it("ProviderResult success shape", () => {
    const result: ProviderResult<number> = { ok: true, data: 42 };
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(42);
    }
  });

  it("ProviderResult failure shape", () => {
    const result: ProviderResult<string> = {
      ok: false,
      error: "timeout",
      stale: "cached-val",
    };
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("timeout");
      expect(result.stale).toBe("cached-val");
    }
  });

  it("ProviderAdapter interface can be implemented", () => {
    const adapter: ProviderAdapter<number> = {
      id: "test-provider",
      displayName: "Test Provider",
      cacheKey: "test",
      cacheTtl: 60_000,
      async fetch() {
        return { ok: true, data: 123 };
      },
      status(): ProviderStatus {
        return "ok";
      },
    };
    expect(adapter.id).toBe("test-provider");
    expect(adapter.cacheTtl).toBe(60_000);
  });

  it("ProviderAdapterOptions has optional fields", () => {
    const opts: ProviderAdapterOptions = {};
    expect(opts.cacheTtl).toBeUndefined();
    expect(opts.timeout).toBeUndefined();
  });

  it("ProviderAdapterOptions accepts values", () => {
    const opts: ProviderAdapterOptions = { cacheTtl: 30_000, timeout: 8_000 };
    expect(opts.cacheTtl).toBe(30_000);
    expect(opts.timeout).toBe(8_000);
  });
});
