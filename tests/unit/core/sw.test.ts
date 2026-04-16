/**
 * Tests for sw.js — ServiceWorker content validation (R8.7)
 *
 * sw.js is not an ES module — we read it as a string and assert constants,
 * required entries, and structural patterns are present.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SW_PATH = resolve(__dirname, "../../../sw.js");
const swSource = readFileSync(SW_PATH, "utf-8");

describe("ServiceWorker — CACHE_NAME", () => {
  it("defines CACHE_NAME constant", () => {
    expect(swSource).toContain("CACHE_NAME");
  });

  it("CACHE_NAME includes 'familydashboard'", () => {
    expect(swSource).toMatch(/familydashboard/i);
  });

  it("CACHE_NAME includes a version string or build-time placeholder", () => {
    // Accept either a resolved version (e.g. v7.3.0) or the build-time placeholder
    expect(swSource).toMatch(
      /CACHE_NAME\s*=\s*["']familydashboard-v(\d+|__APP_VERSION__)/,
    );
  });
});

describe("ServiceWorker — APP_SHELL", () => {
  it("defines APP_SHELL array", () => {
    expect(swSource).toMatch(/APP_SHELL\s*=/);
  });

  it("APP_SHELL includes BestDashBoard.html", () => {
    expect(swSource).toContain("BestDashBoard.html");
  });

  it("APP_SHELL includes manifest.json", () => {
    expect(swSource).toContain("manifest.json");
  });

  it("APP_SHELL includes sw.js itself", () => {
    expect(swSource).toContain('"./sw.js"');
  });

  it("APP_SHELL includes icon.svg", () => {
    expect(swSource).toContain("icon.svg");
  });
});

describe("ServiceWorker — API_CACHE_ORIGINS", () => {
  it("defines API_CACHE_ORIGINS", () => {
    expect(swSource).toContain("API_CACHE_ORIGINS");
  });

  it("includes open-meteo origin", () => {
    expect(swSource).toContain("api.open-meteo.com");
  });

  it("includes hebcal origin", () => {
    expect(swSource).toContain("www.hebcal.com");
  });

  it("includes exchange rate origin", () => {
    expect(swSource).toMatch(/er-api\.com|exchangerate/);
  });

  it("includes allorigins proxy", () => {
    expect(swSource).toContain("api.allorigins.win");
  });

  it("includes Yahoo Finance origin", () => {
    expect(swSource).toContain("query1.finance.yahoo.com");
  });
});

describe("ServiceWorker — Event Handlers", () => {
  it("has install event listener", () => {
    expect(swSource).toContain('addEventListener("install"');
  });

  it("has activate event listener", () => {
    expect(swSource).toContain('addEventListener("activate"');
  });

  it("has fetch event listener", () => {
    expect(swSource).toContain('addEventListener("fetch"');
  });

  it("has message event listener (for SKIP_WAITING)", () => {
    expect(swSource).toContain('addEventListener("message"');
  });

  it("sends VERSION_ACTIVATED broadcast", () => {
    expect(swSource).toContain("VERSION_ACTIVATED");
  });

  it("handles SKIP_WAITING message", () => {
    expect(swSource).toContain("SKIP_WAITING");
  });
});

describe("ServiceWorker — Offline Fallback", () => {
  it("defines OFFLINE_HTML fallback", () => {
    expect(swSource).toContain("OFFLINE_HTML");
  });

  it("offline HTML is in Hebrew (RTL)", () => {
    expect(swSource).toContain('dir="rtl"');
  });
});
