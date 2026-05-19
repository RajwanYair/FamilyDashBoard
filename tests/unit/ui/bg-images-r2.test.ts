/**
 * Tests for src/ui/bg-images.ts — R2 asset proxy wiring (ADR-050 / S21)
 *
 * Covers buildR2AssetUrl behaviour under worker-enabled and worker-disabled paths.
 * Uses vi.mock to control isWorkerEnabled without contaminating other test files.
 */

import { describe, it, expect, vi } from "vitest";

// ── Mock @/core/constants so we control isWorkerEnabled in this file ──────────

vi.mock("@/core/constants", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/constants")>();
  return {
    ...real,
    WORKER_BASE_URL: "https://fdb.rajwanyair.workers.dev",
    isWorkerEnabled: vi.fn().mockReturnValue(true),
    _resetWorkerEnabled: vi.fn(),
  };
});

import { buildR2AssetUrl } from "@/ui/bg-images";
import * as constantsMod from "@/core/constants";

// ── buildR2AssetUrl ───────────────────────────────────────────────────────────

describe("BgImages — buildR2AssetUrl (ADR-050 R2 wiring)", () => {
  afterEach(() => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(true);
  });

  it("returns R2-proxied URL when worker is enabled", () => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(true);
    const direct = "https://images.unsplash.com/photo?w=1920";
    const result = buildR2AssetUrl(direct);
    expect(result).toBe(
      `https://fdb.rajwanyair.workers.dev/api/r2-asset?url=${encodeURIComponent(direct)}`,
    );
  });

  it("returns direct URL when worker is disabled (file:// or unconfigured)", () => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(false);
    const direct = "https://images.unsplash.com/photo?w=1920";
    expect(buildR2AssetUrl(direct)).toBe(direct);
  });

  it("R2 URL contains the encoded original URL as the ?url= param", () => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(true);
    const url = "https://picsum.photos/1920/1080?random=42";
    const r2 = buildR2AssetUrl(url);
    const parsed = new URL(r2);
    expect(parsed.searchParams.get("url")).toBe(url);
  });

  it("R2 URL uses the correct /api/r2-asset path", () => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(true);
    const r2 = buildR2AssetUrl("https://example.com/bg.jpg");
    const parsed = new URL(r2);
    expect(parsed.pathname).toBe("/api/r2-asset");
  });

  it("R2 URL host matches WORKER_BASE_URL host", () => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(true);
    const r2 = buildR2AssetUrl("https://example.com/bg.jpg");
    expect(r2.startsWith("https://fdb.rajwanyair.workers.dev/")).toBe(true);
  });

  it("handles URLs with percent-unsafe characters without double-encoding", () => {
    vi.mocked(constantsMod.isWorkerEnabled).mockReturnValue(true);
    const url = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a%20space.jpg";
    const r2 = buildR2AssetUrl(url);
    const parsed = new URL(r2);
    // The decoded ?url= param must match the original URL exactly
    expect(parsed.searchParams.get("url")).toBe(url);
  });
});
