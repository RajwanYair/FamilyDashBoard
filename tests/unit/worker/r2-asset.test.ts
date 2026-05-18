/**
 * Tests for worker/src/routes/r2-asset.ts
 *
 * Covers: parameter validation, allowlist enforcement, R2 cache hit/miss,
 * origin fetch fallback, error handling, and Content-Type inference.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleR2Asset } from "../../../worker/src/routes/r2-asset";
import type { Env } from "../../../worker/src/types";

// ── Stubs ────────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<Env>): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
    },
    ...overrides,
  } as unknown as Env;
}

function makeR2Bucket(hitData?: ArrayBuffer, contentType = "image/jpeg") {
  return {
    get: vi.fn().mockResolvedValue(
      hitData !== undefined
        ? {
            arrayBuffer: async () => hitData,
            httpMetadata: { contentType },
          }
        : null,
    ),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
  };
}

function makeRequest(url: string): Request {
  return new Request(url);
}

// ── Validation tests ──────────────────────────────────────────────────────────

describe("handleR2Asset — input validation", () => {
  it("returns 400 when url param is missing", async () => {
    const req = makeRequest("https://worker.dev/api/r2-asset");
    const res = await handleR2Asset(req, makeEnv());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("missing_url");
  });

  it("returns 400 when url param exceeds 512 chars", async () => {
    const long = "https://picsum.photos/" + "a".repeat(500);
    const req = makeRequest(`https://worker.dev/api/r2-asset?url=${encodeURIComponent(long)}`);
    const res = await handleR2Asset(req, makeEnv());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("url_too_long");
  });

  it("returns 400 when url param is not a valid URL", async () => {
    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("not-a-url")}`,
    );
    const res = await handleR2Asset(req, makeEnv());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("invalid_url");
  });

  it("returns 400 when url is HTTP (not HTTPS)", async () => {
    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("http://picsum.photos/200/300")}`,
    );
    const res = await handleR2Asset(req, makeEnv());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("https_required");
  });

  it("returns 403 when host is not in the allowlist", async () => {
    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("https://evil.example.com/img.jpg")}`,
    );
    const res = await handleR2Asset(req, makeEnv());
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("origin_not_allowed");
  });
});

// ── R2 cache hit ──────────────────────────────────────────────────────────────

describe("handleR2Asset — R2 cache hit", () => {
  it("serves bytes from R2 when cache hit exists", async () => {
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    const bucket = makeR2Bucket(imageBytes, "image/jpeg");
    const env = makeEnv({ R2_ASSETS: bucket as unknown as Env["R2_ASSETS"] });

    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("https://picsum.photos/200/300")}`,
    );
    const res = await handleR2Asset(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(res.headers.get("Cache-Control")).toContain("max-age=86400");
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(bucket.get).toHaveBeenCalledOnce();
  });
});

// ── R2 cache miss → origin fetch ──────────────────────────────────────────────

describe("handleR2Asset — R2 miss, origin fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches from origin on R2 miss and returns MISS header", async () => {
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    const bucket = makeR2Bucket(undefined); // R2 miss
    const env = makeEnv({ R2_ASSETS: bucket as unknown as Env["R2_ASSETS"] });

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(imageBytes, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("https://picsum.photos/200/300")}`,
    );
    const res = await handleR2Asset(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(mockFetch).toHaveBeenCalledOnce();
    // R2 put should have been called to store the asset
    expect(bucket.put).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("serves from origin when R2_ASSETS binding is absent (pass-through)", async () => {
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    const env = makeEnv({ R2_ASSETS: undefined });

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(imageBytes, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("https://picsum.photos/200/300.png")}`,
    );
    const res = await handleR2Asset(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    vi.unstubAllGlobals();
  });

  it("returns 502 when origin fetch throws", async () => {
    const bucket = makeR2Bucket(undefined);
    const env = makeEnv({ R2_ASSETS: bucket as unknown as Env["R2_ASSETS"] });

    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("https://picsum.photos/200/300")}`,
    );
    const res = await handleR2Asset(req, env);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("origin_unavailable");
    vi.unstubAllGlobals();
  });

  it("returns origin error status when origin returns 404", async () => {
    const bucket = makeR2Bucket(undefined);
    const env = makeEnv({ R2_ASSETS: bucket as unknown as Env["R2_ASSETS"] });

    const mockFetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      `https://worker.dev/api/r2-asset?url=${encodeURIComponent("https://picsum.photos/notfound.jpg")}`,
    );
    const res = await handleR2Asset(req, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });
});

// ── Allowlisted hostnames ─────────────────────────────────────────────────────

describe("handleR2Asset — allowed origins", () => {
  const allowedUrls = [
    "https://picsum.photos/200/300",
    "https://fastly.picsum.photos/200/300",
    "https://images.unsplash.com/photo-1",
    "https://images.pexels.com/photos/1",
    "https://flagcdn.com/il.svg",
    "https://i.ytimg.com/vi/abc/hq.jpg",
  ];

  for (const url of allowedUrls) {
    it(`allows ${new URL(url).hostname}`, async () => {
      const env = makeEnv({ R2_ASSETS: undefined });
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(new ArrayBuffer(4), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const req = makeRequest(
        `https://worker.dev/api/r2-asset?url=${encodeURIComponent(url)}`,
      );
      const res = await handleR2Asset(req, env);
      expect(res.status).toBe(200);
      vi.unstubAllGlobals();
    });
  }
});
