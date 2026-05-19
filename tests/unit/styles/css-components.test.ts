/**
 * — CSS component classes existence tests
 *
 * Verifies that key CSS selectors exist in components.css.
 * Since happy-dom doesn't process CSS, we verify via text matching.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../../src/styles/components.css"), "utf-8");

describe("CSS card-shell anatomy ", () => {
  it("defines .card__header", () => {
    expect(css).toContain(".card__header");
  });
  it("defines .card__body", () => {
    expect(css).toContain(".card__body");
  });
  it("defines .card__footer", () => {
    expect(css).toContain(".card__footer");
  });
  it("defines .card__title", () => {
    expect(css).toContain(".card__title");
  });
});

describe("Shared stale-chip ", () => {
  it("defines .stale-chip", () => {
    expect(css).toContain(".stale-chip");
  });
});

describe("Shared error state ", () => {
  it("defines .card-error", () => {
    expect(css).toContain(".card-error");
  });
  it("card-error icon is rendered via ::before pseudo-element (Stream F v7.22)", () => {
    expect(css).toContain(".card-error::before");
  });
});

describe("Shared empty state ", () => {
  it("defines .card-empty", () => {
    expect(css).toContain(".card-empty");
  });
});

describe("Metric tile ", () => {
  it("defines .metric-tile", () => {
    expect(css).toContain(".metric-tile");
  });
  it("defines .metric-tile__value", () => {
    expect(css).toContain(".metric-tile__value");
  });
  it("defines .metric-tile__label", () => {
    expect(css).toContain(".metric-tile__label");
  });
  it("defines .metric-tile--primary modifier", () => {
    expect(css).toContain(".metric-tile--primary");
  });
  it("defines .metric-tile--secondary modifier", () => {
    expect(css).toContain(".metric-tile--secondary");
  });
});

// ── Animation CSS tests ────────────────────────────────────

const animCss = readFileSync(resolve(__dirname, "../../../src/styles/animations.css"), "utf-8");

describe("Card badge pulse animation ", () => {
  it("defines .card-badge-new class", () => {
    expect(animCss).toContain(".card-badge-new");
  });
  it("defines badge-pulse keyframes", () => {
    expect(animCss).toContain("@keyframes badge-pulse");
  });
  it("badge uses pointer-events: none", () => {
    expect(animCss).toContain("pointer-events: none");
  });
});

describe("Card enter/leave animations ", () => {
  it("defines card-enter keyframes", () => {
    expect(animCss).toContain("@keyframes card-enter");
  });
  it("defines card-leave keyframes", () => {
    expect(animCss).toContain("@keyframes card-leave");
  });
  it("defines .card--hiding class", () => {
    expect(animCss).toContain(".card.card--hiding");
  });
});

// ── Stream F (v7.21): card-loading state ─────────────────────────────────────

describe("Card loading state (Stream F v7.21)", () => {
  it("defines .card-loading", () => {
    expect(css).toContain(".card-loading");
  });
  it("defines .card-loading__spinner", () => {
    expect(css).toContain(".card-loading__spinner");
  });
  it("defines .card-loading__label", () => {
    expect(css).toContain(".card-loading__label");
  });
  it("defines card-spin keyframe", () => {
    expect(css).toContain("@keyframes card-spin");
  });
  it("respects prefers-reduced-motion for spinner", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});

// ── Stream F (v7.22): shared UI state classes ─────────────────────────────────

describe("Card empty state (Stream F v7.22)", () => {
  it("defines .card-empty", () => {
    expect(css).toContain(".card-empty");
  });
  it("card-empty uses flex centering", () => {
    expect(css).toMatch(/\.card-empty\s*\{[^}]*display:\s*flex/s);
  });
});

describe("Card error state (Stream F v7.22)", () => {
  it("defines .card-error", () => {
    expect(css).toContain(".card-error");
  });
  it("card-error uses error color token", () => {
    expect(css).toMatch(/\.card-error\s*\{[^}]*color:\s*var\(--error/s);
  });
  it("defines .card-error::before for icon", () => {
    expect(css).toContain(".card-error::before");
  });
});

describe("Card stale state (Stream F v7.22)", () => {
  it("defines .card-stale", () => {
    expect(css).toContain(".card-stale");
  });
  it("defines .card-stale__chip", () => {
    expect(css).toContain(".card-stale__chip");
  });
  it("stale chip uses accent color token", () => {
    expect(css).toMatch(/\.card-stale__chip\s*\{[^}]*color:\s*var\(--accent\)/s);
  });
});

describe("Card skeleton state (Stream F v7.22)", () => {
  it("defines .card-skeleton", () => {
    expect(css).toContain(".card-skeleton");
  });
  it("defines skeleton-shimmer keyframe", () => {
    expect(css).toContain("@keyframes skeleton-shimmer");
  });
  it("skeleton items use shimmer animation", () => {
    expect(css).toContain("skeleton-shimmer");
  });
  it("respects prefers-reduced-motion for skeleton", () => {
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*card-skeleton/);
  });
});
