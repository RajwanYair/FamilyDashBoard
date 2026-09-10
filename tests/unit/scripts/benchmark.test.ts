import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "../../../scripts/check-benchmark.mjs"),
  "utf8",
);
const runner = source.slice(
  source.indexOf("function runTests()"),
  source.indexOf("function formatMs"),
);

function startRunner() {
  const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
  let reportExists = false;
  let spawnInvocation: [string, string[]] | undefined;
  const exit = vi.fn();
  const result = runInNewContext(`${runner}\nrunTests();`, {
    RUN_TIMEOUT_MS: 10000,
    HEARTBEAT_MS: 1000,
    BENCHMARK_JSON: "benchmark.json",
    PROJECT_ROOT: ".",
    Date,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console: { log: vi.fn(), error: vi.fn() },
    process: { platform: "win32", execPath: "node.exe", env: {}, exit },
    join: (...parts: string[]) => parts.join("/"),
    dirname: (path: string) => path.replace(/[\\/][^\\/]*$/, ""),
    tmpdir: () => "temp",
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    existsSync: () => reportExists,
    statSync: () => ({ size: 2048, mtimeMs: Date.now() }),
    spawn: (executable: string, args: string[]) => {
      spawnInvocation = [executable, args];
      return child;
    },
  }) as Promise<number>;
  return {
    child,
    result,
    exit,
    spawnInvocation: () => spawnInvocation,
    writeReport: () => {
      reportExists = true;
    },
  };
}

describe("benchmark process completion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for the real exit even after a report is available", async () => {
    const run = startRunner();
    const settled = vi.fn();
    void run.result.then(settled);
    run.writeReport();
    await vi.advanceTimersByTimeAsync(6000);
    expect(settled).not.toHaveBeenCalled();
    run.child.emit("close", 1);
    await expect(run.result).resolves.toBe(1);
  });

  it("rejects signal termination with an otherwise complete report", async () => {
    const run = startRunner();
    run.writeReport();
    run.child.emit("close", null, "SIGTERM");
    await expect(run.result).resolves.toBe(1);
  });

  it("accepts a zero exit with a report", async () => {
    const run = startRunner();
    const [, args] = run.spawnInvocation() ?? ["", []];
    expect(run.spawnInvocation()?.[0]).toBe("node.exe");
    expect(args[0]).toContain("npm-cli.js");
    run.writeReport();
    run.child.emit("close", 0);
    await expect(run.result).resolves.toBe(0);
  });

  it("rejects missing output even after a zero exit", async () => {
    const run = startRunner();
    run.child.emit("close", 0);
    await expect(run.result).resolves.toBe(1);
  });

  it("fails a hung process even if it wrote a report", async () => {
    const run = startRunner();
    run.writeReport();
    await vi.advanceTimersByTimeAsync(10000);
    await expect(run.result).resolves.toBe(1);
    expect(run.child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("fails when the child cannot start", async () => {
    const run = startRunner();
    run.child.emit("error", new Error("spawn failed"));
    await expect(run.result).resolves.toBe(1);
  });
});
