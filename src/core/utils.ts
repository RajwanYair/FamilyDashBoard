/**
 * FamilyDashBoard — Core utility functions (Sprint 29)
 *
 * Pure, zero-dependency utilities used across multiple modules.
 * All functions are exported for direct import and unit testing.
 */

// ── debounce ─────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that delays invocation by `wait` ms.
 * Subsequent calls within the wait window reset the timer.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

// ── throttle ─────────────────────────────────────────────────────────────────

/**
 * Returns a throttled version of `fn` that invokes at most once per `wait` ms.
 * The leading call fires immediately; trailing calls within the window are
 * suppressed until the window expires.
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ── clamp ─────────────────────────────────────────────────────────────────────

/**
 * Clamps `value` to the range [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
