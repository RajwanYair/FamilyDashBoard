/**
 * Tests for src/ui/bg-images.ts
 *
 * Covers: isValidBgUrl, initBgImages (DOM layer creation, config), rotateBgImage.
 * Uses _resetForTest() instead of vi.resetModules() (Stream G.1).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidBgUrl,
  initBgImages,
  rotateBgImage,
  BG_INTERVAL_MS,
  buildR2AssetUrl,
  _resetForTest,
} from "@/ui/bg-images";

// ── isValidBgUrl ──────────────────────────────────────────────────────────────

describe("BgImages — isValidBgUrl", () => {
  it("accepts a valid HTTPS URL", () => {
    expect(isValidBgUrl("https://example.com/photo.jpg")).toBe(true);
  });

  it("rejects an HTTP URL", () => {
    expect(isValidBgUrl("http://example.com/photo.jpg")).toBe(false);
  });

  it("rejects a data: URI", () => {
    expect(isValidBgUrl("data:image/png;base64,abc")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidBgUrl("")).toBe(false);
  });

  it("rejects a relative path", () => {
    expect(isValidBgUrl("/images/bg.jpg")).toBe(false);
  });

  it("accepts an HTTPS URL with query params", () => {
    expect(isValidBgUrl("https://images.unsplash.com/photo?w=1920&q=80")).toBe(true);
  });
});

// ── initBgImages ──────────────────────────────────────────────────────────────

describe("BgImages — initBgImages", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    _resetForTest();
  });

  afterEach(() => {
    _resetForTest();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is a no-op when bgImages is empty", () => {
    initBgImages();
    expect(document.getElementById("bg-layer-a")).toBeNull();
    expect(document.getElementById("bg-layer-b")).toBeNull();
  });

  it("creates two layers when bgImages has valid URLs", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      }),
    );
    initBgImages();
    expect(document.getElementById("bg-layer-a")).not.toBeNull();
    expect(document.getElementById("bg-layer-b")).not.toBeNull();
  });

  it("is a no-op when all bgImages are invalid (non-HTTPS)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["http://insecure.com/a.jpg", "/local/image.jpg"],
      }),
    );
    initBgImages();
    expect(document.getElementById("bg-layer-a")).toBeNull();
  });

  it("layer-a starts with opacity 0.35, layer-b starts with opacity 0", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ bgImages: ["https://example.com/a.jpg"] }),
    );
    initBgImages();
    const layerA = document.getElementById("bg-layer-a") as HTMLElement;
    const layerB = document.getElementById("bg-layer-b") as HTMLElement;
    expect(layerA.style.opacity).toBe("0.35");
    expect(layerB.style.opacity).toBe("0");
  });

  it("filters out invalid URLs, uses only HTTPS ones", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["http://insecure.com/bad.jpg", "https://example.com/good.jpg"],
      }),
    );
    initBgImages();
    const layerA = document.getElementById("bg-layer-a") as HTMLElement;
    expect(layerA.style.backgroundImage).toContain("good.jpg");
  });

  it("BG_INTERVAL_MS equals 30 minutes", () => {
    expect(BG_INTERVAL_MS).toBe(30 * 60 * 1000);
  });

  it("does not throw when called multiple times", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ bgImages: ["https://example.com/a.jpg"] }),
    );
    expect(() => {
      initBgImages();
      initBgImages();
    }).not.toThrow();
  });
});

// ── rotateBgImage ─────────────────────────────────────────────────────────────

describe("BgImages — rotateBgImage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    _resetForTest();
  });

  afterEach(() => {
    _resetForTest();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not throw when layers are not initialized", () => {
    expect(() => rotateBgImage()).not.toThrow();
  });

  it("does not throw when bgImages is empty", () => {
    expect(() => rotateBgImage()).not.toThrow();
  });

  it("returns early when config has valid images but layers are null (no init)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );
    // _layerA and _layerB are null — should hit !_layerA branch
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
    _resetForTest();
    vi.stubGlobal("Image", SyncImage);
  });

  afterEach(() => {
    _resetForTest();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sets layerB opacity to 0.35 and layerA to 0 after crossfade", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );
    initBgImages();

    rotateBgImage();

    const layerA = document.getElementById("bg-layer-a") as HTMLDivElement;
    const layerB = document.getElementById("bg-layer-b") as HTMLDivElement;
    expect(layerB.style.opacity).toBe("0.35");
    expect(layerA.style.opacity).toBe("0");
  });

  it("sets layerB backgroundImage to the next URL after crossfade", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/first.jpg", "https://b.com/second.jpg"],
      }),
    );
    initBgImages();

    rotateBgImage();

    const layerB = document.getElementById("bg-layer-b") as HTMLDivElement;
    expect(layerB.style.backgroundImage).toContain("second.jpg");
  });

  it("wraps _currentIdx back to 0 after all images shown", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );
    initBgImages();

    // Rotate twice — should wrap back
    rotateBgImage(); // idx → 1
    rotateBgImage(); // idx → 0 (back to start)
    // Should not throw on wrap-around
    expect(document.getElementById("bg-layer-a")).not.toBeNull();
  });

  it("does not throw when Image.onload fires but layers were cleared", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ bgImages: ["https://a.com/a.jpg"] }));
    // Override so onload fires but layers are gone (simulates layer destruction)
    class DelayedImage {
      onload: (() => void) | null = null;
      private _src = "";
      get src(): string {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
        document.body.innerHTML = "";
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal("Image", DelayedImage);
    initBgImages();
    expect(() => rotateBgImage()).not.toThrow();
  });
});

// ── rotateBgImage img.onload crossfade branch ─────────────────────────────────

describe("BgImages — rotateBgImage img.onload crossfade branch", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    _resetForTest();
  });

  afterEach(() => {
    _resetForTest();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("crossfades layers and swaps references when onload fires", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        bgImages: ["https://a.com/a.jpg", "https://b.com/b.jpg"],
      }),
    );

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
    vi.stubGlobal("Image", SyncImage);

    initBgImages();

    const layerA = document.getElementById("bg-layer-a") as HTMLDivElement;
    const layerB = document.getElementById("bg-layer-b") as HTMLDivElement;
    expect(layerA).not.toBeNull();
    expect(layerB).not.toBeNull();

    rotateBgImage();

    expect(layerB.style.backgroundImage).toContain("b.com");
    expect(layerB.style.opacity).toBe("0.35");
    expect(layerA.style.opacity).toBe("0");
  });

  it("rotateBgImage returns early when validImages is empty (no config)", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ bgImages: [] }));
    // Layers are null (no initBgImages called) → early return
    expect(() => rotateBgImage()).not.toThrow();
  });

  it("rotateBgImage returns early when layers are null and images exist", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ bgImages: ["https://a.com/a.jpg"] }));
    // initBgImages NOT called → _layerA and _layerB are null → early return
    expect(() => rotateBgImage()).not.toThrow();
  });
});

// ── rotateBgImage — validImages empty after init ──────────────────────────────

describe("BgImages — rotateBgImage with config change after init", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    _resetForTest();
  });

  afterEach(() => {
    _resetForTest();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns early when config changes to empty after layers were initialized", () => {
    // Init with valid images → creates layers
    localStorage.setItem("dash_v2_config", JSON.stringify({ bgImages: ["https://a.com/a.jpg"] }));
    initBgImages();
    expect(document.getElementById("bg-layer-a")).not.toBeNull();

    // Config now has no valid images → rotateBgImage hits !validImages.length
    localStorage.setItem("dash_v2_config", JSON.stringify({ bgImages: [] }));
    expect(() => rotateBgImage()).not.toThrow();
  });

  it("returns early when config changes to only invalid URLs after init", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ bgImages: ["https://a.com/a.jpg"] }));
    initBgImages();

    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ bgImages: ["http://insecure.com/bad.jpg"] }),
    );
    expect(() => rotateBgImage()).not.toThrow();
  });
});
