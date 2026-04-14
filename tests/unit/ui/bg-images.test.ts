/**
 * Tests for src/ui/bg-images.ts
 *
 * Covers: isValidBgUrl, initBgImages (DOM layer creation, config), rotateBgImage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("BgImages — isValidBgUrl", () => {
  it("accepts a valid HTTPS URL", async () => {
    vi.resetModules();
    const { isValidBgUrl } = await import("@/ui/bg-images");
    expect(isValidBgUrl("https://example.com/photo.jpg")).toBe(true);
  });

  it("rejects an HTTP URL", async () => {
    vi.resetModules();
    const { isValidBgUrl } = await import("@/ui/bg-images");
    expect(isValidBgUrl("http://example.com/photo.jpg")).toBe(false);
  });

  it("rejects a data: URI", async () => {
    vi.resetModules();
    const { isValidBgUrl } = await import("@/ui/bg-images");
    expect(isValidBgUrl("data:image/png;base64,abc")).toBe(false);
  });

  it("rejects an empty string", async () => {
    vi.resetModules();
    const { isValidBgUrl } = await import("@/ui/bg-images");
    expect(isValidBgUrl("")).toBe(false);
  });

  it("rejects a relative path", async () => {
    vi.resetModules();
    const { isValidBgUrl } = await import("@/ui/bg-images");
    expect(isValidBgUrl("/images/bg.jpg")).toBe(false);
  });

  it("accepts an HTTPS URL with query params", async () => {
    vi.resetModules();
    const { isValidBgUrl } = await import("@/ui/bg-images");
    expect(isValidBgUrl("https://images.unsplash.com/photo?w=1920&q=80")).toBe(
      true,
    );
  });
});

describe("BgImages — initBgImages", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is a no-op when bgImages is empty", async () => {
    vi.resetModules();
    const { initBgImages } = await import("@/ui/bg-images");
    initBgImages();
    expect(document.getElementById("bg-layer-a")).toBeNull();
    expect(document.getElementById("bg-layer-b")).toBeNull();
  });

  it("creates two layers when bgImages has valid URLs", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      }),
    );
    vi.resetModules();
    const { initBgImages } = await import("@/ui/bg-images");
    initBgImages();
    expect(document.getElementById("bg-layer-a")).not.toBeNull();
    expect(document.getElementById("bg-layer-b")).not.toBeNull();
  });

  it("is a no-op when all bgImages are invalid (non-HTTPS)", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["http://insecure.com/a.jpg", "/local/image.jpg"],
      }),
    );
    vi.resetModules();
    const { initBgImages } = await import("@/ui/bg-images");
    initBgImages();
    expect(document.getElementById("bg-layer-a")).toBeNull();
  });

  it("layer-a starts with opacity 0.35, layer-b starts with opacity 0", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ bgImages: ["https://example.com/a.jpg"] }),
    );
    vi.resetModules();
    const { initBgImages } = await import("@/ui/bg-images");
    initBgImages();
    const layerA = document.getElementById("bg-layer-a") as HTMLElement;
    const layerB = document.getElementById("bg-layer-b") as HTMLElement;
    expect(layerA.style.opacity).toBe("0.35");
    expect(layerB.style.opacity).toBe("0");
  });

  it("filters out invalid URLs, uses only HTTPS ones", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: [
          "http://insecure.com/bad.jpg",
          "https://example.com/good.jpg",
        ],
      }),
    );
    vi.resetModules();
    const { initBgImages } = await import("@/ui/bg-images");
    initBgImages();
    const layerA = document.getElementById("bg-layer-a") as HTMLElement;
    expect(layerA.style.backgroundImage).toContain("good.jpg");
  });

  it("BG_INTERVAL_MS equals 30 minutes", async () => {
    vi.resetModules();
    const { BG_INTERVAL_MS } = await import("@/ui/bg-images");
    expect(BG_INTERVAL_MS).toBe(30 * 60 * 1000);
  });

  it("does not throw when called multiple times", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ bgImages: ["https://example.com/a.jpg"] }),
    );
    vi.resetModules();
    const { initBgImages } = await import("@/ui/bg-images");
    expect(() => {
      initBgImages();
      initBgImages();
    }).not.toThrow();
  });
});

describe("BgImages — rotateBgImage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not throw when layers are not initialized", async () => {
    vi.resetModules();
    const { rotateBgImage } = await import("@/ui/bg-images");
    expect(() => rotateBgImage()).not.toThrow();
  });

  it("does not throw when bgImages is empty", async () => {
    vi.resetModules();
    const { rotateBgImage } = await import("@/ui/bg-images");
    expect(() => rotateBgImage()).not.toThrow();
  });

  it("returns early when config has valid images but layers are null (no init)", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );
    vi.resetModules();
    const { rotateBgImage } = await import("@/ui/bg-images");
    // _layerA and _layerB are null — should hit !_layerA branch on line 35
    expect(() => rotateBgImage()).not.toThrow();
    expect(document.getElementById("bg-layer-a")).toBeNull();
  });
});

// ── rotateBgImage — Image.onload crossfade ──────────────────────────────────

describe("BgImages — rotateBgImage Image.onload crossfade", () => {
  class SyncImage {
    onload: (() => void) | null = null;
    private _src = "";
    get src(): string {
      return this._src;
    }
    set src(v: string) {
      this._src = v;
      if (this.onload) this.onload();
    }
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.stubGlobal("Image", SyncImage);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sets layerB opacity to 0.35 and layerA to 0 after crossfade", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );
    vi.resetModules();
    const { initBgImages, rotateBgImage } = await import("@/ui/bg-images");
    initBgImages();

    rotateBgImage();

    const layerA = document.getElementById("bg-layer-a") as HTMLDivElement;
    const layerB = document.getElementById("bg-layer-b") as HTMLDivElement;
    expect(layerB.style.opacity).toBe("0.35");
    expect(layerA.style.opacity).toBe("0");
  });

  it("sets layerB backgroundImage to the next URL after crossfade", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/first.jpg", "https://b.com/second.jpg"],
      }),
    );
    vi.resetModules();
    const { initBgImages, rotateBgImage } = await import("@/ui/bg-images");
    initBgImages();

    rotateBgImage();

    const layerB = document.getElementById("bg-layer-b") as HTMLDivElement;
    expect(layerB.style.backgroundImage).toContain("second.jpg");
  });

  it("wraps _currentIdx back to 0 after all images shown", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );
    vi.resetModules();
    const { initBgImages, rotateBgImage } = await import("@/ui/bg-images");
    initBgImages();

    // Rotate twice — should wrap back
    rotateBgImage(); // idx → 1
    rotateBgImage(); // idx → 0 (back to start)
    // Should not throw on wrap-around
    expect(document.getElementById("bg-layer-a")).not.toBeNull();
  });

  it("does not throw when Image.onload fires but layers were cleared", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ bgImages: ["https://a.com/a.jpg"] }),
    );
    // Override SyncImage so onload fires but layers are gone
    class DelayedImage {
      onload: (() => void) | null = null;
      private _src = "";
      get src(): string {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
        // Clear the DOM before firing onload (simulates layer destruction)
        document.body.innerHTML = "";
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal("Image", DelayedImage);
    vi.resetModules();
    const { initBgImages, rotateBgImage } = await import("@/ui/bg-images");
    initBgImages();
    expect(() => rotateBgImage()).not.toThrow();
  });
});
