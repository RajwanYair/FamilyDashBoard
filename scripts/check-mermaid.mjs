#!/usr/bin/env node
// @ts-check
/**
 * scripts/check-mermaid.mjs — Sprint 109 (V14-FOUNDATIONS)
 *
 * Lightweight static validator for fenced ```mermaid blocks across all
 * Markdown files. Checks:
 *  - Block has a recognized diagram type as its first non-blank line
 *    (flowchart, graph, sequenceDiagram, classDiagram, stateDiagram,
 *     erDiagram, gantt, journey, pie, mindmap, timeline, gitGraph,
 *     C4Context, sankey, xychart, quadrantChart, requirementDiagram)
 *  - Brackets and braces balance ({}, [], ())
 *  - Each fence is closed (no orphan ```mermaid)
 *
 * Not a parser. Catches *structural* mistakes that a hand-edited diagram
 * is most likely to introduce. Full Mermaid validation requires headless
 * rendering and is out of scope for the CI gate.
 *
 * Exit code: 1 on any defect, 0 on clean. Prints file:line for every issue.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);
const RECOGNIZED = new Set([
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "journey",
  "pie",
  "mindmap",
  "timeline",
  "gitGraph",
  "C4Context",
  "C4Container",
  "C4Component",
  "sankey-beta",
  "xychart-beta",
  "quadrantChart",
  "requirementDiagram",
  "block-beta",
  "packet-beta",
]);

/**
 * @param {string} dir
 * @param {string[]} acc
 * @returns {Promise<string[]>}
 */
async function walk(dir, acc = []) {
  const entries = await readdir(dir);
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const st = await stat(path);
    if (st.isDirectory()) {
      // Skip nested node_modules under worker/, etc.
      if (name === "node_modules") continue;
      await walk(path, acc);
    } else if (name.endsWith(".md")) {
      acc.push(path);
    }
  }
  return acc;
}

/**
 * @param {string} src
 * @returns {Array<{ start: number; body: string }>}
 */
function extractMermaidBlocks(src) {
  const lines = src.split(/\r?\n/);
  /** @type {Array<{ start: number; body: string }>} */
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (/^```mermaid\s*$/.test(line)) {
      const start = i + 1; // 1-indexed line of opening fence
      const body = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      if (i >= lines.length) {
        blocks.push({ start, body: "__UNCLOSED__" });
        return blocks;
      }
      blocks.push({ start, body: body.join("\n") });
    }
    i += 1;
  }
  return blocks;
}

/**
 * @param {string} body
 * @returns {string[]}
 */
function checkBlock(body) {
  const issues = [];
  if (body === "__UNCLOSED__") {
    return ["fenced ```mermaid block is not closed"];
  }
  // Find first non-blank, non-comment line.
  const firstReal = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("%%"));
  if (!firstReal) {
    issues.push("empty mermaid block");
  } else {
    const head = firstReal.split(/\s/)[0] ?? "";
    if (!RECOGNIZED.has(head)) {
      issues.push(`unrecognized diagram type "${head}" (expected one of: ${[...RECOGNIZED].slice(0, 5).join(", ")}, …)`);
    }
  }
  // Balance check on body excluding text inside double-quoted node labels.
  const stripped = body.replace(/"([^"\\]|\\.)*"/g, '""');
  /** @type {Record<string, number>} */
  const counts = { "{": 0, "}": 0, "[": 0, "]": 0, "(": 0, ")": 0 };
  for (const ch of stripped) {
    if (ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  if ((counts["{"] ?? 0) !== (counts["}"] ?? 0)) {
    issues.push(`unbalanced braces: ${counts["{"]} '{' vs ${counts["}"]} '}'`);
  }
  if ((counts["["] ?? 0) !== (counts["]"] ?? 0)) {
    issues.push(`unbalanced brackets: ${counts["["]} '[' vs ${counts["]"]} ']'`);
  }
  if ((counts["("] ?? 0) !== (counts[")"] ?? 0)) {
    issues.push(`unbalanced parens: ${counts["("]} '(' vs ${counts[")"]} ')'`);
  }
  return issues;
}

async function main() {
  const files = await walk(ROOT);
  let totalBlocks = 0;
  let totalIssues = 0;
  for (const file of files) {
    const src = await readFile(file, "utf8");
    if (!src.includes("```mermaid")) continue;
    const blocks = extractMermaidBlocks(src);
    for (const { start, body } of blocks) {
      totalBlocks += 1;
      const issues = checkBlock(body);
      for (const issue of issues) {
        totalIssues += 1;
        const rel = file.replace(ROOT + "\\", "").replace(ROOT + "/", "");
        // eslint-disable-next-line no-console
        console.error(`${rel}:${start}: ${issue}`);
      }
    }
  }
  if (totalIssues > 0) {
    // eslint-disable-next-line no-console
    console.error(`✖ Mermaid validation: ${totalIssues} issue(s) across ${totalBlocks} block(s)`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`✅ Mermaid validation: ${totalBlocks} block(s) clean`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("check-mermaid failed:", err);
  process.exit(1);
});
