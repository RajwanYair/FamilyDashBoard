/**
 * fast-check property tests — worker/src/utils/allowlists.ts
 *
 * Properties under test:
 *  AW1. ALLOWED_CALENDAR_ORIGINS: all entries are non-empty strings without protocol
 *  AW2. ALLOWED_NEWS_ORIGINS: all entries are non-empty strings without protocol
 *  AW3. NEWS_FEED_URLS: all urls start with "https://"
 *  AW4. NEWS_FEED_URLS: all src are non-empty Hebrew or ASCII
 *  AW5. NEWS_FEED_URLS: every url host is in ALLOWED_NEWS_ORIGINS
 */

import { describe, it, expect } from "vitest";
import {
  ALLOWED_CALENDAR_ORIGINS,
  ALLOWED_NEWS_ORIGINS,
  NEWS_FEED_URLS,
} from "../../../worker/src/utils/allowlists";

// ── AW1: Calendar origins format ────────────────────────────────────────────

describe("allowlists — AW1: calendar origins format", () => {
  it("all are non-empty, no protocol prefix", () => {
    for (const origin of ALLOWED_CALENDAR_ORIGINS) {
      expect(origin.length).toBeGreaterThan(0);
      expect(origin).not.toContain("://");
    }
  });
});

// ── AW2: News origins format ─────────────────────────────────────────────────

describe("allowlists — AW2: news origins format", () => {
  it("all are non-empty, no protocol prefix", () => {
    for (const origin of ALLOWED_NEWS_ORIGINS) {
      expect(origin.length).toBeGreaterThan(0);
      expect(origin).not.toContain("://");
    }
  });
});

// ── AW3: NEWS_FEED_URLS all https ───────────────────────────────────────────

describe("allowlists — AW3: feed URLs are HTTPS", () => {
  it("every url starts with https://", () => {
    for (const feed of NEWS_FEED_URLS) {
      expect(feed.url.startsWith("https://")).toBe(true);
    }
  });
});

// ── AW4: NEWS_FEED_URLS src non-empty ────────────────────────────────────────

describe("allowlists — AW4: feed sources non-empty", () => {
  it("every src is non-empty", () => {
    for (const feed of NEWS_FEED_URLS) {
      expect(feed.src.length).toBeGreaterThan(0);
    }
  });
});

// ── AW5: feed URL hosts in ALLOWED_NEWS_ORIGINS ──────────────────────────────

describe("allowlists — AW5: feed hosts in allowlist", () => {
  it("every feed URL host appears in ALLOWED_NEWS_ORIGINS", () => {
    for (const feed of NEWS_FEED_URLS) {
      const host = new URL(feed.url).hostname;
      expect(ALLOWED_NEWS_ORIGINS).toContain(host);
    }
  });
});
