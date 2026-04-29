/**
 * Tests for the video-news card adapter and core logic.
 * The card's DOM-heavy initVideoNews() is exercised by the fdb-video-news tests.
 * This file focuses on the adapter (pure functions) and the type contracts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getStreamDescriptor, listChannels } from "@/cards/video-news/video-news-adapter";
import type { VideoChannelId } from "@/types/stream";

// ── Adapter tests ─────────────────────────────────────────────────────────

describe("getStreamDescriptor", () => {
  it("returns a descriptor for each known channel", () => {
    const ids: VideoChannelId[] = ["c14", "i24he", "kan11", "n12", "keshet13", "arutz7"];
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

  it("all channels use iframe mode", () => {
    for (const id of listChannels()) {
      const desc = getStreamDescriptor(id);
      expect(desc.mode).toBe("iframe");
    }
  });

  it("all iframe channels have frame-src CSP entries", () => {
    for (const id of listChannels()) {
      const desc = getStreamDescriptor(id);
      expect(Array.isArray(desc.cspHosts.frame)).toBe(true);
      expect((desc.cspHosts.frame ?? []).length).toBeGreaterThan(0);
    }
  });

  it("all channel URLs are non-empty strings starting with https://", () => {
    for (const id of listChannels()) {
      const desc = getStreamDescriptor(id);
      expect(desc.url).toMatch(/^https:\/\//);
    }
  });
});

describe("listChannels", () => {
  it("returns 6 channels", () => {
    expect(listChannels().length).toBe(6);
  });

  it("includes c14 as the first channel", () => {
    expect(listChannels()[0]).toBe("c14");
  });

  it("includes all expected channel ids", () => {
    const channels = listChannels();
    expect(channels).toContain("c14");
    expect(channels).toContain("i24he");
    expect(channels).toContain("kan11");
    expect(channels).toContain("n12");
    expect(channels).toContain("keshet13");
    expect(channels).toContain("arutz7");
  });
});

// ── video-news.ts logic (headless subset) ────────────────────────────────

describe("video-news module — channel state (headless)", () => {
  let isMuted: typeof import("@/cards/video-news/video-news").isMuted;
  let getActiveChannel: typeof import("@/cards/video-news/video-news").getActiveChannel;
  let cycleChannel: typeof import("@/cards/video-news/video-news").cycleChannel;
  let toggleMute: typeof import("@/cards/video-news/video-news").toggleMute;
  let loadChannel: typeof import("@/cards/video-news/video-news").loadChannel;
  let destroyVideoNews: typeof import("@/cards/video-news/video-news").destroyVideoNews;
  let switchChannel: typeof import("@/cards/video-news/video-news").switchChannel;

  beforeEach(async () => {
    const mod = await import("@/cards/video-news/video-news");
    isMuted = mod.isMuted;
    getActiveChannel = mod.getActiveChannel;
    cycleChannel = mod.cycleChannel;
    toggleMute = mod.toggleMute;
    loadChannel = mod.loadChannel;
    destroyVideoNews = mod.destroyVideoNews;
    switchChannel = mod.switchChannel;
  });

  it("c14 starts unmuted — isMuted() returns false", () => {
    loadChannel("c14");
    expect(isMuted()).toBe(false); // c14 is the only unmuted channel
  });

  it("all channels except c14 start muted — isMuted() returns true", () => {
    const others: VideoChannelId[] = ["i24he", "kan11", "n12", "keshet13", "arutz7"];
    for (const id of others) {
      loadChannel(id);
      expect(isMuted()).toBe(true);
    }
  });

  it("toggleMute is a no-op and does not throw", () => {
    loadChannel("c14");
    expect(() => {
      toggleMute();
    }).not.toThrow();
    // mute state is controlled by iframe URL params — stays per-channel
    expect(isMuted()).toBe(false); // still c14
  });

  it("starts with c14 as active channel after loadChannel('c14')", () => {
    loadChannel("c14");
    expect(getActiveChannel()).toBe("c14");
  });

  it("switchChannel updates active channel", () => {
    switchChannel("kan11");
    expect(getActiveChannel()).toBe("kan11");
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

  it("destroyVideoNews does not throw", () => {
    expect(() => {
      destroyVideoNews();
    }).not.toThrow();
  });
});

// ── Sprint 183 / V1 — listPinnedChannels ─────────────────────────────────

describe("video-news — listPinnedChannels (Sprint 183 V1)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns all 6 channels when no pinned config is set", async () => {
    const { listPinnedChannels } = await import("@/cards/video-news/video-news");
    expect(listPinnedChannels().length).toBe(6);
  });

  it("returns only pinned channels when config is set", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({
      configVersion: 12,
      cards: { "video-news": { settings: { pinnedChannels: "c14,kan11" } } },
    }));
    const { listPinnedChannels } = await import("@/cards/video-news/video-news");
    const result = listPinnedChannels();
    expect(result).toEqual(["c14", "kan11"]);
  });

  it("ignores invalid channel IDs in pinned config", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({
      configVersion: 12,
      cards: { "video-news": { settings: { pinnedChannels: "c14,invalid,kan11" } } },
    }));
    const { listPinnedChannels } = await import("@/cards/video-news/video-news");
    const result = listPinnedChannels();
    expect(result).toEqual(["c14", "kan11"]);
  });

  it("caps at 4 channels even if more are pinned", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({
      configVersion: 12,
      cards: { "video-news": { settings: { pinnedChannels: "c14,kan11,n12,keshet13,arutz7" } } },
    }));
    const { listPinnedChannels } = await import("@/cards/video-news/video-news");
    const result = listPinnedChannels();
    expect(result.length).toBe(4);
  });

  it("falls back to all channels if all pinned IDs are invalid", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({
      configVersion: 12,
      cards: { "video-news": { settings: { pinnedChannels: "invalid1,invalid2" } } },
    }));
    const { listPinnedChannels } = await import("@/cards/video-news/video-news");
    const result = listPinnedChannels();
    expect(result.length).toBe(6);
  });
});
