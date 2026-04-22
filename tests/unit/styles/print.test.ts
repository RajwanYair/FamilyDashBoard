/**
 * Sprint 114 — Print stylesheet improvements test
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../../src/styles/print.css"), "utf-8");

describe("Print stylesheet (Sprint 114)", () => {
  it("contains @media print block", () => {
    expect(css).toContain("@media print");
  });

  it("styles card__header for print", () => {
    expect(css).toContain(".card__header");
  });

  it("styles metric-tile for B&W print", () => {
    expect(css).toContain(".metric-tile");
  });

  it("styles tables with visible borders", () => {
    expect(css).toContain("border-collapse");
  });

  it("includes @page margin rule", () => {
    expect(css).toContain("@page");
  });
});
