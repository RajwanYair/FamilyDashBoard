/**
 * Shared fake-timer helpers for FamilyDashBoard unit tests.
 *
 * Usage:
 *   import { withFakeTimers, advanceMinutes, setFakeDate } from "@tests/helpers";
 *
 *   const { advance, restore } = withFakeTimers();
 *   afterEach(restore);
 *   await advance(5 * 60_000); // advance 5 minutes
 */

import { vi } from "vitest";

export interface FakeTimerHandle {
  /** Advance fake clock by `ms` milliseconds, flushing all queued timers. */
  advance: (ms: number) => Promise<void>;
  /** Restore real timers. Call in afterEach. */
  restore: () => void;
}

/**
 * Install fake timers and return a handle with helpers.
 * Only call this when a test actually needs to advance time.
 *
 * @example
 *   const timers = withFakeTimers();
 *   afterEach(timers.restore);
 *   await timers.advance(60_000); // 1 min
 */
export function withFakeTimers(
  opts: Parameters<typeof vi.useFakeTimers>[0] = {},
): FakeTimerHandle {
  vi.useFakeTimers(opts);

  return {
    advance: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    },
    restore: () => {
      vi.useRealTimers();
    },
  };
}

/**
 * Set the system clock to a specific date/time for testing.
 * Requires vi.useFakeTimers() to have been called first.
 *
 * @example
 *   vi.useFakeTimers();
 *   setFakeDate(new Date("2025-04-19T09:00:00"));
 */
export function setFakeDate(date: Date | string | number): void {
  vi.setSystemTime(typeof date === "string" || typeof date === "number" ? new Date(date) : date);
}

/** Advance by N minutes (shorthand for advance(N * 60_000)). */
export async function advanceMinutes(handle: FakeTimerHandle, n: number): Promise<void> {
  await handle.advance(n * 60_000);
}

/** Advance by N hours. */
export async function advanceHours(handle: FakeTimerHandle, n: number): Promise<void> {
  await handle.advance(n * 3_600_000);
}
