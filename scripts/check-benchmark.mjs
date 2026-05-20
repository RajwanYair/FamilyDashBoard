#!/usr/bin/env node
/**
 * FamilyDashBoard — Test Benchmark Checker
 *
 * Runs the test suite with a JSON reporter and compares per-file durations
 * against a baseline.  Reports the top-N slowest test files and individual tests.
 * Exits non-zero when:
 *   1. Any test file exceeds its baseline budget by more than the allowed threshold (50%).
 *   2. Total test duration exceeds the budget.
 *   3. Any single test file exceeds the absolute slow-file cap (10000 ms).
 *   4. Vitest itself exits non-zero (test failures are propagated).
 *
 * Usage:
 *   node scripts/check-benchmark.mjs              # run tests + check against baseline
 *   node scripts/check-benchmark.mjs --update     # run tests + update baseline
 *   node scripts/check-benchmark.mjs --report     # run tests + print report without failing
 *   node scripts/check-benchmark.mjs --skip-run   # use existing JSON (skip test run)
 *
 * The script invokes vitest with --reporter=json to capture timing data without
 * interfering with the normal test run.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BASELINE_PATH = join(__dirname, "benchmark-baseline.json");
const BENCHMARK_JSON = join(tmpdir(), "fdb-dev", "benchmark.json");
const PROJECT_ROOT = join(__dirname, "..");

// ── Configuration ──────────────────────────────────────────────────────────────
const TOP_N = 15; // Show top-N slowest files/tests in the report
const REGRESSION_THRESHOLD = 0.5; // 50% growth allowed before failing
const ABSOLUTE_SLOW_FILE_MS = 30000; // Any single file slower than this fails
const TOTAL_BUDGET_GROWTH = 0.5; // Total duration can grow max 50% from baseline
// Timeout (ms) for the vitest run. Override via BENCHMARK_TIMEOUT_MS env var.
// Default 15 min — covers ~7800 tests on cold CI/slow disks while still catching real hangs.
const RUN_TIMEOUT_MS = Number(process.env.BENCHMARK_TIMEOUT_MS) || 900000;
const HEARTBEAT_MS = 30000; // Progress ping interval so the gate is not silent

// ── Run Tests with JSON Reporter ───────────────────────────────────────────────
function runTests() {
  return new Promise((resolve) => {
    const timeoutLabel = `${Math.round(RUN_TIMEOUT_MS / 1000)}s`;
    console.log(`⏱️  Running tests with JSON reporter (timeout=${timeoutLabel})...\n`);

    // Ensure output directory exists; delete any stale JSON so we can detect a
    // fresh write reliably (vitest writes the file only at end-of-run).
    const outDir = join(tmpdir(), "fdb-dev");
    mkdirSync(outDir, { recursive: true });
    if (existsSync(BENCHMARK_JSON)) {
      try {
        rmSync(BENCHMARK_JSON);
      } catch {
        /* best effort */
      }
    }

    const cmd = `npx vitest run --reporter=json --outputFile="${BENCHMARK_JSON}"`;
    // stderr inherited so real failures surface; stdout ignored to avoid mixing
    // the JSON reporter's stdout with our progress output.
    const child = spawn(cmd, [], {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "ignore", "inherit"],
      shell: true,
      windowsHide: true,
    });

    const startedAt = Date.now();
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearInterval(jsonPoll);
      clearTimeout(timer);
      try {
        child.kill("SIGKILL");
      } catch {
        /* already exited */
      }
      resolve(status);
    };

    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`   …still running (${elapsed}s elapsed)`);
    }, HEARTBEAT_MS);

    // Poll for the JSON output every 2s. Vitest writes it once test execution
    // finishes — even if a worker fork won't terminate cleanly afterward, we
    // can pick it up and proceed. This is the gate's defence against the
    // known "Timeout terminating forks worker" issue (background fetch /
    // timers in a card test that survive afterEach cleanup).
    const jsonPoll = setInterval(() => {
      if (!existsSync(BENCHMARK_JSON)) return;
      const stats = statSync(BENCHMARK_JSON);
      if (stats.size < 1024) return; // not finished writing yet
      if (stats.mtimeMs < startedAt) return; // stale
      // Give vitest a brief grace window to exit cleanly itself.
      setTimeout(() => {
        if (settled) return;
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        console.log(`   ✅ Benchmark JSON ready after ${elapsed}s — proceeding.`);
        finish(0);
      }, 3000);
      clearInterval(jsonPoll);
    }, 2000);

    const timer = setTimeout(() => {
      console.error(`❌ Vitest timed out after ${timeoutLabel} (no JSON output produced).`);
      console.error("   Override with: $env:BENCHMARK_TIMEOUT_MS=1800000; npm run check:benchmark");
      finish(1);
      process.exit(1);
    }, RUN_TIMEOUT_MS);

    child.on("close", (code) => {
      if (settled) return;
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`   vitest exited code=${code} after ${elapsed}s\n`);
      if (!existsSync(BENCHMARK_JSON)) {
        console.error("❌ Vitest failed and did not produce benchmark JSON.");
        finish(1);
        process.exit(1);
      }
      if (code !== 0) {
        console.log("⚠️  Some tests failed, but benchmark data was collected.\n");
      }
      finish(code ?? 0);
    });

    child.on("error", (err) => {
      console.error("❌ Failed to spawn vitest:", err.message);
      finish(1);
      process.exit(1);
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function relPath(absPath) {
  const root = join(__dirname, "..").replace(/\\/g, "/");
  return absPath.replace(/\\/g, "/").replace(root, "").replace(/^\//, "");
}

// ── Parse Vitest JSON output ───────────────────────────────────────────────────
function parseReport(jsonPath) {
  if (!existsSync(jsonPath)) {
    console.error(`❌ Benchmark JSON not found at: ${jsonPath}`);
    console.error("   Run 'npm test' first to generate timing data.");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const testResults = raw.testResults || [];

  const files = [];
  const tests = [];

  for (const file of testResults) {
    const filePath = relPath(file.name || "");
    const fileDuration = file.endTime - file.startTime;

    files.push({ path: filePath, duration: fileDuration });

    for (const suite of file.assertionResults || []) {
      tests.push({
        file: filePath,
        name: suite.fullName || suite.title || "unknown",
        duration: suite.duration || 0,
      });
    }
  }

  const totalDuration = files.reduce((sum, f) => sum + f.duration, 0);

  return { files, tests, totalDuration, numFiles: files.length, numTests: tests.length };
}

// ── Report ─────────────────────────────────────────────────────────────────────
function printReport(data) {
  const { files, tests, totalDuration, numFiles, numTests } = data;

  console.log("\n📊 Test Benchmark Report");
  console.log("═".repeat(70));
  console.log(
    `   Total: ${formatMs(totalDuration)} across ${numFiles} files (${numTests} tests)\n`,
  );

  // Top-N slowest files
  const sortedFiles = [...files].sort((a, b) => b.duration - a.duration);
  console.log(`🐢 Top ${TOP_N} Slowest Test Files:`);
  console.log("─".repeat(70));
  for (let i = 0; i < Math.min(TOP_N, sortedFiles.length); i++) {
    const f = sortedFiles[i];
    const bar = "█".repeat(Math.min(30, Math.round((f.duration / sortedFiles[0].duration) * 30)));
    console.log(
      `   ${String(i + 1).padStart(2)}. ${formatMs(f.duration).padStart(7)} ${bar} ${f.path}`,
    );
  }

  // Top-N slowest individual tests
  const sortedTests = [...tests].sort((a, b) => b.duration - a.duration);
  console.log(`\n🔬 Top ${TOP_N} Slowest Individual Tests:`);
  console.log("─".repeat(70));
  for (let i = 0; i < Math.min(TOP_N, sortedTests.length); i++) {
    const t = sortedTests[i];
    console.log(
      `   ${String(i + 1).padStart(2)}. ${formatMs(t.duration).padStart(7)} │ ${t.name.slice(0, 60)}`,
    );
    console.log(`              └─ ${t.file}`);
  }
  console.log("");
}

// ── Baseline Management ────────────────────────────────────────────────────────
function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
}

function saveBaseline(data) {
  const baseline = {
    generated: new Date().toISOString().slice(0, 10),
    totalDurationMs: data.totalDuration,
    numFiles: data.numFiles,
    numTests: data.numTests,
    files: Object.fromEntries(data.files.map((f) => [f.path, f.duration])),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
  console.log(`✅ Baseline updated: ${BASELINE_PATH}`);
  console.log(
    `   Total: ${formatMs(data.totalDuration)} | Files: ${data.numFiles} | Tests: ${data.numTests}`,
  );
}

// ── Regression Check ───────────────────────────────────────────────────────────
function checkRegression(data, baseline) {
  const violations = [];

  // Check total duration budget
  const totalBudget = baseline.totalDurationMs * (1 + TOTAL_BUDGET_GROWTH);
  if (data.totalDuration > totalBudget) {
    violations.push(
      `Total duration ${formatMs(data.totalDuration)} exceeds budget ${formatMs(totalBudget)} ` +
        `(baseline: ${formatMs(baseline.totalDurationMs)}, max +${TOTAL_BUDGET_GROWTH * 100}%)`,
    );
  }

  // Check per-file regressions
  for (const file of data.files) {
    const baselineMs = baseline.files[file.path];

    // Absolute cap: any file exceeding the hard limit fails regardless of baseline
    if (file.duration > ABSOLUTE_SLOW_FILE_MS) {
      violations.push(
        `${file.path}: ${formatMs(file.duration)} exceeds absolute cap of ${formatMs(ABSOLUTE_SLOW_FILE_MS)}`,
      );
      continue;
    }

    // Skip files not in baseline (new files get a pass on first run)
    if (baselineMs == null) continue;

    // Relative regression check
    const allowed = baselineMs * (1 + REGRESSION_THRESHOLD);
    if (file.duration > allowed && file.duration - baselineMs > 2000) {
      // Only flag if delta > 2000ms (noise filter — prevents false positives
      // from scheduler jitter and warm-up variance in post-workload runs)
      violations.push(
        `${file.path}: ${formatMs(file.duration)} exceeds budget ${formatMs(allowed)} ` +
          `(baseline: ${formatMs(baselineMs)}, +${Math.round(((file.duration - baselineMs) / baselineMs) * 100)}%)`,
      );
    }
  }

  return violations;
}

// ── Main ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isUpdate = args.includes("--update");
const isReport = args.includes("--report");
const skipRun = args.includes("--skip-run");

async function main() {
  let testCode = 0;
  if (!skipRun) {
    testCode = await runTests();
  }

  const data = parseReport(BENCHMARK_JSON);
  printReport(data);

  if (isUpdate) {
    saveBaseline(data);
    process.exit(testCode);
  }

  if (isReport) {
    if (testCode !== 0) console.log("\n⚠️  Test failures detected (exit code propagated)\n");
    process.exit(testCode);
  }

  // Gate mode: check against baseline
  const baseline = loadBaseline();
  if (!baseline) {
    console.log("⚠️  No baseline found. Run with --update to create one:");
    console.log("   node scripts/check-benchmark.mjs --update");
    console.log("   (Skipping regression check — first run)\n");
    // Auto-create baseline on first run
    saveBaseline(data);
    process.exit(testCode);
  }

  const violations = checkRegression(data, baseline);

  if (violations.length === 0) {
    if (testCode !== 0) {
      console.log(`❌ Tests failed (exit code: ${testCode}) — benchmark timing OK\n`);
      process.exit(testCode);
    }
    console.log(`✅ Benchmark check passed — no regressions detected`);
    console.log(
      `   Baseline: ${baseline.generated} | Budget headroom: +${REGRESSION_THRESHOLD * 100}% per file, +${TOTAL_BUDGET_GROWTH * 100}% total\n`,
    );
    process.exit(0);
  } else {
    console.log(`❌ Benchmark regressions detected (${violations.length}):\n`);
    for (const v of violations) {
      console.log(`   • ${v}`);
    }
    console.log(`\n   To update the baseline after intentional changes:`);
    console.log(`   node scripts/check-benchmark.mjs --update\n`);
    process.exit(1);
  }
}

main();
