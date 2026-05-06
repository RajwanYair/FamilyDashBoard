/**
 * fast-check property tests — src/cards/video-news/ (Sprint 529)
 *
 * Properties under test:
 *  VN1. getStreamDescriptor: known channel → correct id field
 *  VN2. getStreamDescriptor: unknown id → fallback to c14
 *  VN3. listChannels: returns non-empty array
 *  VN4. listChannels: all entries are valid VideoChannelIds
 *  VN5. getStreamDescriptor: mode is always "iframe"
 *  VN6. getStreamDescriptor: url is always a valid URL string
 *  VN7. c14 starts unmuted, others muted
 */

import { describe, it, expect } from "vitest";
import {
  getStreamDescriptor,
  listChannels,
} from "@/cards/video-news/video-news-adapter";

const KNOWN_CHANNELS = ["c14", "i24he", "kan11", "n12", "keshet13", "arutz7"] as const;

// ── VN1: known channel → correct id ─────────────────────────────────────────

describe("video-news — VN1: known channel returns correct id", () => {
  it("each known channel has matching id field", () => {
    for (const ch of KNOWN_CHANNELS) {
      const desc = getStreamDescriptor(ch);
      expect(desc.id).toBe(ch);
    }
  });
});

// ── VN2: unknown id → fallback c14 ──────────────────────────────────────────

describe("video-news — VN2: unknown id fallback", () => {
  it("returns c14 for unrecognized id", () => {
    const desc = getStreamDescriptor("nonexistent" as never);
    expect(desc.id).toBe("c14");
  });
});

// ── VN3: listChannels non-empty ──────────────────────────────────────────────

describe("video-news — VN3: listChannels", () => {
  it("returns non-empty array", () => {
    expect(listChannels().length).toBeGreaterThan(0);
  });
});

// ── VN4: all entries are valid ids ───────────────────────────────────────────

describe("video-news — VN4: listChannels valid", () => {
  it("each id exists in KNOWN_CHANNELS", () => {
    const channels = listChannels();
    for (const ch of channels) {
      expect(KNOWN_CHANNELS).toContain(ch);
    }
  });
});

// ── VN5: mode always "iframe" ────────────────────────────────────────────────

describe("video-news — VN5: mode is iframe", () => {
  it("all channels use iframe mode", () => {
    for (const ch of KNOWN_CHANNELS) {
      expect(getStreamDescriptor(ch).mode).toBe("iframe");
    }
  });
});

// ── VN6: url is valid ────────────────────────────────────────────────────────

describe("video-news — VN6: url valid", () => {
  it("all channels have a valid URL", () => {
    for (const ch of KNOWN_CHANNELS) {
      const desc = getStreamDescriptor(ch);
      expect(() => new URL(desc.url)).not.toThrow();
    }
  });
});

// ── VN7: c14 unmuted, others muted ──────────────────────────────────────────

describe("video-news — VN7: mute policy", () => {
  it("c14 is unmuted", () => {
    expect(getStreamDescriptor("c14").muted).toBe(false);
  });

  it("all non-c14 channels are muted", () => {
    for (const ch of KNOWN_CHANNELS) {
      if (ch === "c14") continue;
      expect(getStreamDescriptor(ch).muted).toBe(true);
    }
  });
});
