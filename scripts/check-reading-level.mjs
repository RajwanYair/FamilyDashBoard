#!/usr/bin/env node
/**
 * check-reading-level.mjs — V13-A11Y
 *
 * WCAG 3.1.5 (AAA) reading-level gate.
 *
 * Verifies that:
 *   1. tokens.css declares the four WCAG text-spacing tokens with values
 *      meeting the SC 1.4.12 minima:
 *        --ts-line-height  ≥ 1.5
 *        --ts-letter-spacing ≥ 0.12em
 *        --ts-word-spacing   ≥ 0.16em
 *        --reading-lh        ≥ 1.5 (RTL prose, target 1.6)
 *   2. a11y.css applies --reading-lh to the canonical prose selectors
 *      (.moti-text, .news-desc, .alert-item-desc, .hcal-parasha-text).
 *
 * Exits 0 on success, 1 on failure.
 * Designed for use in `npm run check` and CI.
 *
 * Usage: node scripts/check-reading-level.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse CSS custom-property declarations of the form `--name: <value>;`.
 * Returns a Map of property name → raw value string (trimmed).
 * @param {string} cssText - Raw CSS file contents.
 * @returns {Map<string, string>}
 */
export function parseTokenValues(cssText) {
  const result = new Map();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    result.set(m[1].trim(), m[2].trim());
  }
  return result;
}

/**
 * Extract numeric value from a CSS dimension string.
 * Supports bare numbers ("1.6"), "em" units ("0.16em"), and "px" units ("24px").
 * Returns NaN for values it cannot parse.
 * @param {string} raw - Raw value string, e.g. "1.6" or "0.12em".
 * @returns {number}
 */
export function extractNumber(raw) {
  const match = raw.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) : NaN;
}

/**
 * Check that the prose selector classes use `--reading-lh` in a11y.css.
 * Returns an array of missing selector names.
 * @param {string} a11yCssText - Raw a11y.css contents.
 * @param {string[]} selectors - CSS class selectors to check (e.g. ".moti-text").
 * @returns {string[]}
 */
export function findMissingProseSelectors(a11yCssText, selectors) {
  return selectors.filter((sel) => {
    const escaped = sel.replace(".", "\\.");
    // selector must appear AND reading-lh must be referenced after it within ~500 chars
    const idx = a11yCssText.indexOf(sel);
    if (idx === -1) return true;
    const block = a11yCssText.slice(idx, idx + 500);
    return !block.includes("--reading-lh");
  });
}

// ── Main audit ────────────────────────────────────────────────────────────────

const TOKENS_CSS = resolve(ROOT, "src", "styles", "tokens.css");
const A11Y_CSS = resolve(ROOT, "src", "styles", "a11y.css");

/** @type {{ token: string; min: number; unit: string }[]} */
const REQUIRED_TOKENS = [
  { token: "--ts-line-height",     min: 1.5,  unit: "number" },
  { token: "--ts-letter-spacing",  min: 0.12, unit: "em" },
  { token: "--ts-word-spacing",    min: 0.16, unit: "em" },
  { token: "--reading-lh",         min: 1.5,  unit: "number" },
];

const PROSE_SELECTORS = [
  ".moti-text",
  ".news-desc",
  ".alert-item-desc",
  ".hcal-parasha-text",
];

const isMain =
  process.argv[1] != null &&
  (process.argv[1].endsWith("check-reading-level.mjs") ||
    process.argv[1].includes("check-reading-level"));

/** Run the audit and return { ok: boolean, messages: string[] }. */
export function runAudit() {
  const messages = [];
  let ok = true;

  // 1. Read files
  let tokensCss, a11yCss;
  try {
    tokensCss = readFileSync(TOKENS_CSS, "utf-8");
  } catch {
    return { ok: false, messages: [`❌  Cannot read ${TOKENS_CSS}`] };
  }
  try {
    a11yCss = readFileSync(A11Y_CSS, "utf-8");
  } catch {
    return { ok: false, messages: [`❌  Cannot read ${A11Y_CSS}`] };
  }

  // 2. Parse token values from tokens.css
  const tokens = parseTokenValues(tokensCss);

  // 3. Check each required token
  for (const { token, min } of REQUIRED_TOKENS) {
    const raw = tokens.get(token);
    if (raw == null) {
      messages.push(`❌  Missing token ${token} in tokens.css`);
      ok = false;
      continue;
    }
    const num = extractNumber(raw);
    if (isNaN(num)) {
      messages.push(`❌  Cannot parse numeric value for ${token}: "${raw}"`);
      ok = false;
      continue;
    }
    if (num < min) {
      messages.push(
        `❌  ${token} = ${String(num)} is below minimum ${String(min)} (WCAG SC 1.4.12 / reading level)`,
      );
      ok = false;
    } else {
      messages.push(`✅  ${token} = ${raw}`);
    }
  }

  // 4. Check prose selectors reference --reading-lh in a11y.css
  const missing = findMissingProseSelectors(a11yCss, PROSE_SELECTORS);
  if (missing.length > 0) {
    messages.push(
      `❌  These prose selectors do not reference --reading-lh in a11y.css: ${missing.join(", ")}`,
    );
    ok = false;
  } else {
    messages.push(`✅  All prose selectors reference --reading-lh in a11y.css`);
  }

  return { ok, messages };
}

if (isMain) {
  const { ok, messages } = runAudit();
  for (const msg of messages) console.log(msg);
  if (!ok) {
    console.error("\n❌  Reading-level audit failed.");
    process.exit(1);
  }
  console.log("\n✅  Reading-level audit passed.");
}
