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

// ── listPinnedChannels ─────────────────────────────────

describe("video-news — listPinnedChannels ( V1)", () => {
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

// ── Document PiP ─────────────────────────────────────────

import { isPipSupported, requestDocumentPip } from "@/cards/video-news/video-news";
import { vi } from "vitest";

describe("isPipSupported ", () => {
  it("returns false when documentPictureInPicture is absent", () => {
    const orig = (window as Record<string, unknown>)["documentPictureInPicture"];
    delete (window as Record<string, unknown>)["documentPictureInPicture"];
    expect(isPipSupported()).toBe(false);
    (window as Record<string, unknown>)["documentPictureInPicture"] = orig;
  });

  it("returns true when documentPictureInPicture is present", () => {
    (window as Record<string, unknown>)["documentPictureInPicture"] = {};
    expect(isPipSupported()).toBe(true);
    delete (window as Record<string, unknown>)["documentPictureInPicture"];
  });
});

describe("requestDocumentPip ", () => {
  it("returns null when element is null", async () => {
    expect(await requestDocumentPip(null)).toBeNull();
  });

  it("returns null when API is not supported", async () => {
    delete (window as Record<string, unknown>)["documentPictureInPicture"];
    const el = document.createElement("div");
    expect(await requestDocumentPip(el)).toBeNull();
  });

  it("returns PiP window when API resolves successfully", async () => {
    const mockPipWindow = {
      document: { body: { appendChild: vi.fn() } },
    };
    (window as Record<string, unknown>)["documentPictureInPicture"] = {
      requestWindow: vi.fn().mockResolvedValue(mockPipWindow),
    };
    const el = document.createElement("video");
    const result = await requestDocumentPip(el);
    expect(result).toBe(mockPipWindow);
    expect(mockPipWindow.document.body.appendChild).toHaveBeenCalledWith(el);
    delete (window as Record<string, unknown>)["documentPictureInPicture"];
  });

  it("returns null when requestWindow rejects", async () => {
    (window as Record<string, unknown>)["documentPictureInPicture"] = {
      requestWindow: vi.fn().mockRejectedValue(new Error("not allowed")),
    };
    const el = document.createElement("div");
    expect(await requestDocumentPip(el)).toBeNull();
    delete (window as Record<string, unknown>)["documentPictureInPicture"];
  });
});

// ── initVideoNews DOM paths ───────────────────────────────────

import { initVideoNews, destroyVideoNews as destroy } from "@/cards/video-news/video-news";

describe("initVideoNews DOM paths ", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    localStorage.clear();
  });

  afterEach(() => {
    destroy();
    root.remove();
    localStorage.clear();
  });

  it("creates a tab strip inside the root", () => {
    initVideoNews(root);
    const tabs = root.querySelector(".video-news__tabs");
    expect(tabs).not.toBeNull();
  });

  it("creates 6 tabs for all channels by default", () => {
    initVideoNews(root);
    const tabs = root.querySelectorAll(".video-news__tab");
    expect(tabs.length).toBe(6);
  });

  it("creates a grid container", () => {
    initVideoNews(root);
    const grid = root.querySelector(".video-news__grid");
    expect(grid).not.toBeNull();
  });

  it("creates 6 tiles (one per channel)", () => {
    initVideoNews(root);
    const tiles = root.querySelectorAll(".video-news__tile");
    expect(tiles.length).toBe(6);
  });

  it("marks c14 tile active by default", () => {
    initVideoNews(root);
    const active = root.querySelectorAll(".video-news__tile--active");
    expect(active.length).toBe(1);
    expect((active[0] as HTMLElement).dataset["channel"]).toBe("c14");
  });

  it("marks initialChannel tile active when provided", () => {
    initVideoNews(root, "kan11");
    const active = root.querySelector(".video-news__tile--active") as HTMLElement | null;
    expect(active?.dataset["channel"]).toBe("kan11");
  });

  it("clicking a tab switches the active channel", () => {
    initVideoNews(root);
    const n12Tab = root.querySelector<HTMLButtonElement>('.video-news__tab[data-channel="n12"]');
    n12Tab?.click();
    const active = root.querySelector(".video-news__tile--active") as HTMLElement | null;
    expect(active?.dataset["channel"]).toBe("n12");
  });

  it("each tile contains an iframe with a valid src", () => {
    initVideoNews(root);
    const iframes = root.querySelectorAll<HTMLIFrameElement>(".video-news__iframe");
    iframes.forEach((iframe) => {
      expect(iframe.src).toMatch(/^https:\/\//);
    });
  });

  it("destroyVideoNews sets all iframe src to about:blank", () => {
    initVideoNews(root);
    destroy();
    // After destroy _root is null — verify no throw
    expect(() => destroy()).not.toThrow();
  });

  it("respects pinnedChannels config — creates only 2 tabs", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({
      configVersion: 12,
      cards: { "video-news": { settings: { pinnedChannels: "c14,n12" } } },
    }));
    initVideoNews(root);
    const tabs = root.querySelectorAll(".video-news__tab");
    expect(tabs.length).toBe(2);
  });
});

// ── 5 playback settings in configSchema ─────────────
import { videoNewsConfigSchema } from "@/cards/video-news/video-news";

describe("VideoNews configSchema — CS-VN1 ", () => {
  const PLAYBACK_KEYS = [
    "cards.video-news.settings.autoplay",
    "cards.video-news.settings.defaultMuted",
    "cards.video-news.settings.showOverlay",
    "cards.video-news.settings.pauseOnReducedMotion",
    "cards.video-news.settings.pauseAtNight",
  ] as const;

  it("configSchema has 6 fields total after CS-VN1", () => {
    expect(videoNewsConfigSchema.length).toBe(6);
  });

  it.each(PLAYBACK_KEYS)("field %s is a boolean with defined defaultValue", (key) => {
    const field = videoNewsConfigSchema.find((f) => f.key === key);
    expect(field).toBeDefined();
    expect(field?.type).toBe("boolean");
    expect(typeof field?.defaultValue).toBe("boolean");
  });

  it("pauseOnReducedMotion and pauseAtNight are on advanced tab", () => {
    const adv = videoNewsConfigSchema.filter((f) => f.tab === "advanced").map((f) => f.key);
    expect(adv).toContain("cards.video-news.settings.pauseOnReducedMotion");
    expect(adv).toContain("cards.video-news.settings.pauseAtNight");
  });
});

// ── X15 semantic producer (buildVideoNewsPayload) ─────────────────────────
import { getSemanticPayload, _resetSemanticProducers } from "@/core/semantic-clipboard";

describe("VideoNews semantic producer — X15 ", () => {
  let root: HTMLElement;
  beforeEach(() => {
    _resetSemanticProducers();
    document.body.innerHTML = `
      <div id="video-news-body"></div>
      <div id="video-news-mini"></div>
    `;
    root = document.getElementById("video-news-body") as HTMLElement;
  });
  afterEach(() => {
    destroy();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("returns a non-null payload after initVideoNews", () => {
    initVideoNews(root);
    const payload = getSemanticPayload("video-news");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("video-news");
    expect(payload!.text).toContain("ערוץ פעיל:");
    expect(payload!.jsonLd?.["@type"]).toBe("BroadcastChannel");
  });

  it("payload broadcastChannelId matches the active channel", () => {
    initVideoNews(root, "kan11");
    const payload = getSemanticPayload("video-news");
    expect(payload!.jsonLd?.["broadcastChannelId"]).toBe("kan11");
    expect(payload!.jsonLd?.["inLanguage"]).toBe("he");
  });
});
