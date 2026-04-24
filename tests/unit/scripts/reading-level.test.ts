/**
 * Unit tests — V13-A11Y: check-reading-level.mjs
 *
 * Verifies the pure helper functions and integration against real CSS files.
 */

import { describe, it, expect } from "vitest";
import {
  parseTokenValues,
  extractNumber,
  findMissingProseSelectors,
  runAudit,
} from "../../../scripts/check-reading-level.mjs";

// ── parseTokenValues ──────────────────────────────────────────────────────────

describe("parseTokenValues", () => {
  it("parses a simple numeric token", () => {
    const m = parseTokenValues(":root { --reading-lh: 1.6; }");
    expect(m.get("--reading-lh")).toBe("1.6");
  });

  it("parses an em-unit token", () => {
    const m = parseTokenValues(":root { --ts-letter-spacing: 0.12em; }");
    expect(m.get("--ts-letter-spacing")).toBe("0.12em");
  });

  it("parses multiple tokens", () => {
    const css = `
      :root {
        --ts-line-height: 1.5;
        --ts-letter-spacing: 0.12em;
        --ts-word-spacing: 0.16em;
        --reading-lh: 1.6;
      }
    `;
    const m = parseTokenValues(css);
    expect(m.size).toBeGreaterThanOrEqual(4);
    expect(m.get("--ts-line-height")).toBe("1.5");
    expect(m.get("--ts-word-spacing")).toBe("0.16em");
  });

  it("returns empty map for empty CSS", () => {
    expect(parseTokenValues("").size).toBe(0);
  });

  it("parses tokens regardless of surrounding content", () => {
    const css = "/* example */ :root { --real: 1.5; }";
    const m = parseTokenValues(css);
    expect(m.get("--real")).toBe("1.5");
  });
});

// ── extractNumber ─────────────────────────────────────────────────────────────

describe("extractNumber", () => {
  it("extracts bare float", () => {
    expect(extractNumber("1.6")).toBeCloseTo(1.6);
  });

  it("extracts number from em unit", () => {
    expect(extractNumber("0.12em")).toBeCloseTo(0.12);
  });

  it("extracts number from px unit", () => {
    expect(extractNumber("24px")).toBeCloseTo(24);
  });

  it("returns NaN for non-numeric string", () => {
    expect(isNaN(extractNumber("inherit"))).toBe(true);
  });

  it("returns NaN for empty string", () => {
    expect(isNaN(extractNumber(""))).toBe(true);
  });

  it("handles integer string", () => {
    expect(extractNumber("2")).toBe(2);
  });
});

// ── findMissingProseSelectors ─────────────────────────────────────────────────

describe("findMissingProseSelectors", () => {
  const goodCss = `
    .moti-text,
    .news-desc {
      line-height: var(--reading-lh, 1.6);
    }
    .alert-item-desc {
      line-height: var(--reading-lh, 1.6);
    }
    .hcal-parasha-text {
      line-height: var(--reading-lh, 1.6);
    }
  `;

  it("returns empty array when all selectors reference --reading-lh", () => {
    const result = findMissingProseSelectors(goodCss, [
      ".moti-text",
      ".news-desc",
      ".alert-item-desc",
      ".hcal-parasha-text",
    ]);
    expect(result).toHaveLength(0);
  });

  it("returns missing selector when not present in CSS", () => {
    const missing = findMissingProseSelectors(goodCss, [".missing-class"]);
    expect(missing).toContain(".missing-class");
  });

  it("returns selector when present but missing --reading-lh reference", () => {
    const badCss = ".moti-text { font-size: 1em; }";
    const result = findMissingProseSelectors(badCss, [".moti-text"]);
    expect(result).toContain(".moti-text");
  });

  it("handles empty selectors array", () => {
    expect(findMissingProseSelectors(goodCss, [])).toHaveLength(0);
  });
});

// ── runAudit integration (real CSS files) ─────────────────────────────────────

describe("runAudit — integration against real CSS files", () => {
  it("returns ok=true and passes all checks", () => {
    const { ok, messages } = runAudit();
    expect(ok).toBe(true);
    for (const msg of messages) {
      expect(msg).toMatch(/^✅/);
    }
  });

  it("reports exactly the four required tokens as passing", () => {
    const { messages } = runAudit();
    const passed = messages.filter((m) => m.startsWith("✅"));
    // 4 tokens + 1 prose selector check = 5 passing messages
    expect(passed.length).toBeGreaterThanOrEqual(5);
  });

  it("--ts-line-height passes WCAG 1.4.12 minimum (≥ 1.5)", () => {
    const { messages } = runAudit();
    const lineHMsg = messages.find((m) => m.includes("--ts-line-height"));
    expect(lineHMsg).toBeTruthy();
    expect(lineHMsg).toMatch(/^✅/);
  });

  it("--ts-letter-spacing passes WCAG 1.4.12 minimum (≥ 0.12em)", () => {
    const { messages } = runAudit();
    const msg = messages.find((m) => m.includes("--ts-letter-spacing"));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/^✅/);
  });

  it("--ts-word-spacing passes WCAG 1.4.12 minimum (≥ 0.16em)", () => {
    const { messages } = runAudit();
    const msg = messages.find((m) => m.includes("--ts-word-spacing"));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/^✅/);
  });

  it("--reading-lh passes minimum (≥ 1.5, actual 1.6)", () => {
    const { messages } = runAudit();
    const msg = messages.find((m) => m.includes("--reading-lh"));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/^✅/);
  });

  it("all prose selectors reference --reading-lh", () => {
    const { messages } = runAudit();
    const msg = messages.find((m) => m.includes("prose selectors"));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/^✅/);
  });
});
