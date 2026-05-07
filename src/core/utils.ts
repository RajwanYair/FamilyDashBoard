/**
 * FamilyDashBoard — Core utility functions
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

// ── pad2 ──────────────────────────────────────────────────────────────────────

/**
 * Zero-pad a number to at least 2 digits.
 */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ── decomposeDuration ─────────────────────────────────────────────────────────

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Decompose a non-negative duration in milliseconds into days/hours/minutes/seconds.
 * Negative values are clamped to zero.
 */
export function decomposeDuration(ms: number): DurationParts {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

// ── Moon phase ────────────────────────────────────────────────────────────────

export interface MoonPhaseResult {
  emoji: string;
  label: string;
}

const MOON_PHASES: readonly MoonPhaseResult[] = [
  { emoji: "🌑", label: "ירח חדש" },
  { emoji: "🌒", label: "ירח גדל" },
  { emoji: "🌓", label: "רבע ראשון" },
  { emoji: "🌔", label: "ירח כמעט מלא" },
  { emoji: "🌕", label: "ירח מלא" },
  { emoji: "🌖", label: "ירח פוחת" },
  { emoji: "🌗", label: "רבע אחרון" },
  { emoji: "🌘", label: "ירח דועך" },
];

const KNOWN_NEW_MOON_MS = 947_182_440_000; // 2000-01-06T18:14:00Z
const SYNODIC_DAYS = 29.530588853;
const SYNODIC_MS = SYNODIC_DAYS * 86_400_000;

/**
 * Compute the approximate moon phase for a given date.
 * Returns emoji + Hebrew label based on synodic month algorithm.
 * Uses 8 phase bins, each 0.125 wide, centered on the phase midpoints.
 */
export function computeMoonPhase(date: Date = new Date()): MoonPhaseResult {
  const elapsed = (((date.getTime() - KNOWN_NEW_MOON_MS) % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS;
  const frac = elapsed / SYNODIC_MS;
  if (frac < 0.0625) return MOON_PHASES[0] ?? { emoji: "🌑", label: "ירח חדש" };
  if (frac < 0.1875) return MOON_PHASES[1] ?? { emoji: "🌒", label: "ירח גדל" };
  if (frac < 0.3125) return MOON_PHASES[2] ?? { emoji: "🌓", label: "רבע ראשון" };
  if (frac < 0.4375) return MOON_PHASES[3] ?? { emoji: "🌔", label: "ירח כמעט מלא" };
  if (frac < 0.5625) return MOON_PHASES[4] ?? { emoji: "🌕", label: "ירח מלא" };
  if (frac < 0.6875) return MOON_PHASES[5] ?? { emoji: "🌖", label: "ירח פוחת" };
  if (frac < 0.8125) return MOON_PHASES[6] ?? { emoji: "🌗", label: "רבע אחרון" };
  if (frac < 0.9375) return MOON_PHASES[7] ?? { emoji: "🌘", label: "ירח דועך" };
  return MOON_PHASES[0] ?? { emoji: "🌑", label: "ירח חדש" };
}
