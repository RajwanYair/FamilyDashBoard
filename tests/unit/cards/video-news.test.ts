/**
 * Tests for the video-news card adapter and core logic.
 * The card's DOM-heavy initVideoNews() is exercised by the fdb-video-news tests.
 * This file focuses on the adapter (pure functions) and the type contracts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStreamDescriptor, listChannels } from "@/cards/video-news/video-news-adapter";
import type { VideoChannelId } from "@/types/stream";

// ── Adapter tests ─────────────────────────────────────────────────────────

describe("getStreamDescriptor", () => {
  it("returns a descriptor for each known channel", () => {
    const ids: VideoChannelId[] = ["c14", "i24", "now14", "arutz7"];
    for (const id of ids) {
      const desc = getStreamDescriptor(id);
      expect(desc.id).toBe(id);
      expect(typeof desc.titleHe).toBe("string");
      expect(typeof desc.titleEn).toBe("string");
      expect(["hls", "iframe", "worker-hls"]).toContain(desc.mode);
      expect(typeof desc.url).toBe("string");
      expect(desc.cspHosts).toBeDefined();
    }
  });

  it("falls back to c14 for an unknown channel id", () => {
    const desc = getStreamDescriptor("unknown" as VideoChannelId);
    expect(desc.id).toBe("c14");
  });

  it("all cspHosts arrays are arrays (not undefined)", () => {
    for (const id of listChannels()) {
      const desc = getStreamDescriptor(id);
      if (desc.cspHosts.connect !== undefined) {
        expect(Array.isArray(desc.cspHosts.connect)).toBe(true);
      }
      if (desc.cspHosts.media !== undefined) {
        expect(Array.isArray(desc.cspHosts.media)).toBe(true);
      }
    }
  });

  it("frame-src is not specified for non-iframe channels", () => {
    for (const id of listChannels()) {
      const desc = getStreamDescriptor(id);
      if (desc.mode !== "iframe") {
        expect(desc.cspHosts.frame).toBeUndefined();
      }
    }
  });
});

describe("listChannels", () => {
  it("returns exactly 4 channels", () => {
    expect(listChannels().length).toBe(4);
  });

  it("includes c14 as the first channel", () => {
    expect(listChannels()[0]).toBe("c14");
  });

  it("returns all expected channel ids", () => {
    const channels = listChannels();
    expect(channels).toContain("c14");
    expect(channels).toContain("i24");
    expect(channels).toContain("now14");
    expect(channels).toContain("arutz7");
  });
});

// ── video-news.ts logic (headless subset) ────────────────────────────────

describe("video-news module — muted / channel state (headless)", () => {
  // We test the state-management functions without wiring real DOM elements.
  // loadChannel + initVideoNews require a DOM environment; cycleChannel and
  // toggleMute are pure state mutations that work even without DOM refs.

  let isMuted: typeof import("@/cards/video-news/video-news").isMuted;
  let getActiveChannel: typeof import("@/cards/video-news/video-news").getActiveChannel;
  let cycleChannel: typeof import("@/cards/video-news/video-news").cycleChannel;
  let toggleMute: typeof import("@/cards/video-news/video-news").toggleMute;
  let loadChannel: typeof import("@/cards/video-news/video-news").loadChannel;
  let destroyVideoNews: typeof import("@/cards/video-news/video-news").destroyVideoNews;

  beforeEach(async () => {
    // Re-import module fresh each time via vi.resetModules if needed.
    // Since isolate:false is set on the pool, we import once per describe run.
    const mod = await import("@/cards/video-news/video-news");
    isMuted = mod.isMuted;
    getActiveChannel = mod.getActiveChannel;
    cycleChannel = mod.cycleChannel;
    toggleMute = mod.toggleMute;
    loadChannel = mod.loadChannel;
    destroyVideoNews = mod.destroyVideoNews;
  });

  it("starts muted", () => {
    expect(isMuted()).toBe(true);
  });

  it("starts with c14 as active channel after loadChannel('c14')", () => {
    loadChannel("c14");
    expect(getActiveChannel()).toBe("c14");
  });

  it("cycleChannel advances to the next channel", () => {
    loadChannel("c14");
    cycleChannel();
    const next = getActiveChannel();
    expect(next).not.toBe("c14");
    expect(listChannels()).toContain(next);
  });

  it("cycleChannel wraps back to the first channel after the last", () => {
    loadChannel("arutz7"); // last channel
    cycleChannel();
    expect(getActiveChannel()).toBe("c14"); // wraps to first
  });

  it("toggleMute flips the mute state", () => {
    // Reset to known state
    loadChannel("c14");
    // After module load, default is muted=true; toggleMute → false
    if (!isMuted()) toggleMute(); // ensure starting muted
    expect(isMuted()).toBe(true);
    toggleMute();
    expect(isMuted()).toBe(false);
    toggleMute();
    expect(isMuted()).toBe(true);
  });

  it("destroyVideoNews does not throw", () => {
    expect(() => { destroyVideoNews(); }).not.toThrow();
  });
});
