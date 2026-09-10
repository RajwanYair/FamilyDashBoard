/**
 * Tests for src/core/config-backup.ts — Config Auto-Backup to IDB (S60)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  backupConfigToIdb,
  getConfigBackups,
  restoreConfigFromIdb,
  startConfigAutoBackup,
  stopConfigAutoBackup,
} from "@/core/config-backup";
import * as idbCache from "@/core/idb-cache";
import { CONFIG_VERSION } from "@/types/config";

vi.mock("@/core/idb-cache", () => {
  let store: Record<string, unknown> = {};
  return {
    idbSet: vi.fn(async (key: string, data: unknown) => {
      store[key] = data;
      return true;
    }),
    idbGet: vi.fn(async (key: string) => store[key] ?? null),
    idbGetEntry: vi.fn(async () => null),
    idbKeys: vi.fn(async () => []),
    idbClear: vi.fn(async () => {
      store = {};
    }),
    idbDel: vi.fn(async () => {}),
    _resetIdb: vi.fn(),
    _resetStore: () => {
      store = {};
    },
  };
});

describe("Config Auto-Backup (S60)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (idbCache as unknown as { _resetStore: () => void })._resetStore();
    stopConfigAutoBackup();
    // Set up localStorage with a config
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ theme: "blue", configVersion: CONFIG_VERSION }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    stopConfigAutoBackup();
    localStorage.clear();
  });

  it("backupConfigToIdb stores config in IDB", async () => {
    await backupConfigToIdb();
    const backups = await getConfigBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0]!.config.theme).toBe("blue");
    expect(backups[0]!.ts).toBeGreaterThan(0);
  });

  it("keeps only 3 most recent backups", async () => {
    await backupConfigToIdb();
    vi.advanceTimersByTime(1000);
    await backupConfigToIdb();
    vi.advanceTimersByTime(1000);
    await backupConfigToIdb();
    vi.advanceTimersByTime(1000);
    await backupConfigToIdb();
    const backups = await getConfigBackups();
    expect(backups).toHaveLength(3);
  });

  it("restoreConfigFromIdb returns latest backup", async () => {
    await backupConfigToIdb();
    const restored = await restoreConfigFromIdb();
    expect(restored).not.toBeNull();
    expect(restored!.theme).toBe("blue");
  });

  it("restoreConfigFromIdb returns null when no backups", async () => {
    const restored = await restoreConfigFromIdb();
    expect(restored).toBeNull();
  });

  it("skips malformed backups and restores the newest valid config", async () => {
    const rawBackups = [
      { config: { theme: "not-a-theme" }, ts: 3000 },
      { config: { theme: "blue", configVersion: CONFIG_VERSION }, ts: 2000 },
      { config: { theme: "amber" }, ts: Number.NaN },
    ] as never;
    vi.mocked(idbCache.idbGet).mockResolvedValueOnce(rawBackups).mockResolvedValueOnce(rawBackups);

    const backups = await getConfigBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0]?.config.theme).toBe("blue");
    expect((await restoreConfigFromIdb())?.theme).toBe("blue");
  });

  it("does not report a failed IDB write as a saved backup", async () => {
    vi.mocked(idbCache.idbSet).mockResolvedValueOnce(false);

    await backupConfigToIdb();

    expect(await getConfigBackups()).toHaveLength(0);
  });

  it("startConfigAutoBackup creates periodic interval", async () => {
    startConfigAutoBackup(60000);
    // Wait for microtasks (initial backup is void-async)
    await vi.advanceTimersByTimeAsync(100);
    const backups1 = await getConfigBackups();
    expect(backups1.length).toBeGreaterThanOrEqual(1);
  });
});
