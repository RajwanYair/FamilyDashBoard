/**
 * fast-check property tests — src/cards/video-news/video-news-adapter.ts
 *
 * Properties under test:
 *  VNA1. listChannels: returns exactly 6 channel ids
 *  VNA2. listChannels: all entries are non-empty strings
 *  VNA3. listChannels: "c14" is always present
 *  VNA4. getStreamDescriptor: any known id → descriptor.id matches the input
 *  VNA5. getStreamDescriptor: mode is always "iframe" for all channels
 *  VNA6. getStreamDescriptor: url always starts with "https://"
 *  VNA7. getStreamDescriptor: only c14 is unmuted; all others have muted=true
 *  VNA8. getStreamDescriptor: unknown id falls back to c14 descriptor
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getStreamDescriptor, listChannels } from "@/cards/video-news/video-news-adapter";

const KNOWN_CHANNELS = ["c14", "i24he", "kan11", "n12", "keshet13", "arutz7"] as const;
type KnownChannel = (typeof KNOWN_CHANNELS)[number];

// ── VNA1: listChannels returns exactly 6 ─────────────────────────────────────

describe("video-news-adapter — VNA1: listChannels count", () => {
  it("returns exactly 6 channel ids", () => {
    expect(listChannels()).toHaveLength(6);
  });
});

// ── VNA2: all channel ids are non-empty strings ───────────────────────────────

describe("video-news-adapter — VNA2: listChannels non-empty strings", () => {
  it("every channel id is a non-empty string", () => {
    for (const id of listChannels()) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

// ── VNA3: c14 always present ──────────────────────────────────────────────────

describe("video-news-adapter — VNA3: listChannels includes c14", () => {
  it("c14 is always in the channel list", () => {
    expect(listChannels()).toContain("c14");
  });
});

// ── VNA4: known id → descriptor.id matches ───────────────────────────────────

describe("video-news-adapter — VNA4: getStreamDescriptor id roundtrip", () => {
  it("descriptor.id equals the queried channel id for all known channels", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KNOWN_CHANNELS), (ch: KnownChannel) => {
        const desc = getStreamDescriptor(ch);
        expect(desc.id).toBe(ch);
      }),
      { numRuns: 6 },
    );
  });
});

// ── VNA5: mode is always "iframe" ─────────────────────────────────────────────

describe("video-news-adapter — VNA5: mode is iframe", () => {
  it("every channel descriptor has mode = 'iframe'", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KNOWN_CHANNELS), (ch: KnownChannel) => {
        const desc = getStreamDescriptor(ch);
        expect(desc.mode).toBe("iframe");
      }),
      { numRuns: 6 },
    );
  });
});

// ── VNA6: url starts with https:// ────────────────────────────────────────────

describe("video-news-adapter — VNA6: url is https", () => {
  it("every channel url starts with 'https://'", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KNOWN_CHANNELS), (ch: KnownChannel) => {
        const desc = getStreamDescriptor(ch);
        expect(desc.url).toMatch(/^https:\/\//);
      }),
      { numRuns: 6 },
    );
  });
});

// ── VNA7: only c14 is unmuted ────────────────────────────────────────────────

describe("video-news-adapter — VNA7: mute policy", () => {
  it("c14 starts unmuted (muted = false)", () => {
    expect(getStreamDescriptor("c14").muted).toBe(false);
  });

  it("all other channels start muted (muted = true)", () => {
    const others = KNOWN_CHANNELS.filter((ch) => ch !== "c14");
    fc.assert(
      fc.property(fc.constantFrom(...others), (ch: KnownChannel) => {
        expect(getStreamDescriptor(ch).muted).toBe(true);
      }),
      { numRuns: 5 },
    );
  });
});

// ── VNA8: unknown id falls back to c14 ───────────────────────────────────────

describe("video-news-adapter — VNA8: unknown id fallback", () => {
  it("returns c14 descriptor for an unrecognised id", () => {
    const c14 = getStreamDescriptor("c14");
    const fallback = getStreamDescriptor("unknown-channel" as never);
    expect(fallback.id).toBe(c14.id);
    expect(fallback.url).toBe(c14.url);
  });
});
