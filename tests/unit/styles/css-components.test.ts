/**
 * Sprint 108-112 — CSS component classes existence tests
 *
 * Verifies that key CSS selectors exist in components.css.
 * Since happy-dom doesn't process CSS, we verify via text matching.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(__dirname, "../../../src/styles/components.css"),
  "utf-8",
);

describe("CSS card-shell anatomy (Sprint 108)", () => {
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

describe("Shared stale-chip (Sprint 109)", () => {
  it("defines .stale-chip", () => {
    expect(css).toContain(".stale-chip");
  });
});

describe("Shared error state (Sprint 110)", () => {
  it("defines .card-error", () => {
    expect(css).toContain(".card-error");
  });
  it("defines .card-error__icon", () => {
    expect(css).toContain(".card-error__icon");
  });
});

describe("Shared empty state (Sprint 111)", () => {
  it("defines .card-empty", () => {
    expect(css).toContain(".card-empty");
  });
});

describe("Metric tile (Sprint 112)", () => {
  it("defines .metric-tile", () => {
    expect(css).toContain(".metric-tile");
  });
  it("defines .metric-tile__value", () => {
    expect(css).toContain(".metric-tile__value");
  });
  it("defines .metric-tile__label", () => {
    expect(css).toContain(".metric-tile__label");
  });
});

// ── Sprint 172: Animation CSS tests ────────────────────────────────────

const animCss = readFileSync(
  resolve(__dirname, "../../../src/styles/animations.css"),
  "utf-8",
);

describe("Card badge pulse animation (Sprint 172)", () => {
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

describe("Card enter/leave animations (Sprint 172)", () => {
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
