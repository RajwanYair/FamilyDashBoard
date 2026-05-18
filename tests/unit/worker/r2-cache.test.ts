/**
 * Tests for worker/src/utils/r2-cache.ts
 *
 * Covers: r2Get (hit / miss / R2 error), r2Put (success / error tolerance),
 * r2Delete (success / error tolerance), metadata preservation.
 */

import { describe, it, expect } from "vitest";
import { r2Get, r2Put, r2Delete } from "../../../worker/src/utils/r2-cache";
import type { R2Bucket, R2ObjectBody } from "../../../worker/src/types";

// ── Stub helpers ──────────────────────────────────────────────────────────────

function makeBody(
  data: string,
  contentType = "text/plain",
  contentEncoding?: string,
): R2ObjectBody {
  const buf = new TextEncoder().encode(data).buffer;
  return {
    arrayBuffer: async () => buf,
    text: async () => data,
    httpMetadata: {
      contentType,
      ...(contentEncoding !== undefined ? { contentEncoding } : {}),
    },
  };
}

function makeBucket(overrides: Partial<R2Bucket> = {}): R2Bucket {
  const store = new Map<string, R2ObjectBody>();
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      // Store as a minimal body stub
      const text =
        typeof value === "string" ? value : new TextDecoder().decode(value as ArrayBuffer);
      store.set(key, makeBody(text));
    },
    delete: async (key) => {
      store.delete(key);
    },
    ...overrides,
  };
}

// ── r2Get ─────────────────────────────────────────────────────────────────────

describe("r2Get", () => {
  it("returns null on cache miss", async () => {
    const bucket = makeBucket();
    const result = await r2Get(bucket, "missing.js");
    expect(result).toBeNull();
  });

  it("returns data and content-type on hit", async () => {
    const bucket = makeBucket({
      get: async (key) => {
        if (key === "main.js") return makeBody("console.log(1)", "text/javascript");
        return null;
      },
    });
    const result = await r2Get(bucket, "main.js");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("text/javascript");
    const text = new TextDecoder().decode(result!.data);
    expect(text).toBe("console.log(1)");
  });

  it("preserves content-encoding when present", async () => {
    const bucket = makeBucket({
      get: async () => makeBody("compressed", "text/javascript", "gzip"),
    });
    const result = await r2Get(bucket, "main.js.gz");
    expect(result!.contentEncoding).toBe("gzip");
  });

  it("defaults content-type to application/octet-stream when absent", async () => {
    const bucket = makeBucket({
      get: async () => ({
        arrayBuffer: async () => new ArrayBuffer(4),
        text: async () => "",
        httpMetadata: {},
      }),
    });
    const result = await r2Get(bucket, "blob");
    expect(result!.contentType).toBe("application/octet-stream");
  });

  it("returns null when R2 get throws (error tolerance)", async () => {
    const bucket = makeBucket({
      get: async () => {
        throw new Error("R2 unavailable");
      },
    });
    const result = await r2Get(bucket, "any.js");
    expect(result).toBeNull();
  });

  it("returns null when arrayBuffer() throws", async () => {
    const bucket = makeBucket({
      get: async () => ({
        arrayBuffer: async () => {
          throw new Error("read error");
        },
        text: async () => "",
        httpMetadata: { contentType: "text/plain" },
      }),
    });
    const result = await r2Get(bucket, "broken");
    expect(result).toBeNull();
  });
});

// ── r2Put ─────────────────────────────────────────────────────────────────────

describe("r2Put", () => {
  it("stores value via bucket.put", async () => {
    const puts: Array<{ key: string; value: unknown; options: unknown }> = [];
    const bucket = makeBucket({
      put: async (key, value, options) => {
        puts.push({ key, value, options });
      },
    });
    await r2Put(bucket, "icon.svg", "<svg/>", { contentType: "image/svg+xml" });
    expect(puts).toHaveLength(1);
    expect(puts[0].key).toBe("icon.svg");
    expect(
      (puts[0].options as { httpMetadata: { contentType: string } }).httpMetadata.contentType,
    ).toBe("image/svg+xml");
  });

  it("does not throw when bucket.put fails (fire-and-forget)", async () => {
    const bucket = makeBucket({
      put: async () => {
        throw new Error("R2 write error");
      },
    });
    await expect(r2Put(bucket, "fail.js", "data")).resolves.toBeUndefined();
  });
});

// ── r2Delete ──────────────────────────────────────────────────────────────────

describe("r2Delete", () => {
  it("calls bucket.delete with the key", async () => {
    const deleted: string[] = [];
    const bucket = makeBucket({
      delete: async (key) => {
        deleted.push(key);
      },
    });
    await r2Delete(bucket, "old.js");
    expect(deleted).toContain("old.js");
  });

  it("does not throw when bucket.delete fails (fire-and-forget)", async () => {
    const bucket = makeBucket({
      delete: async () => {
        throw new Error("R2 delete error");
      },
    });
    await expect(r2Delete(bucket, "fail.js")).resolves.toBeUndefined();
  });
});
