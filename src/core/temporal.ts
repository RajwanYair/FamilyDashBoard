/**
 * src/core/temporal.ts — Date / time abstraction layer (CAL-T / H-T migration scaffold)
 *
 * All date-math in `hebrew-cal`, `calendar`, and `countdown` currently uses the
 * legacy `Date` API.  This module provides thin wrappers whose signatures are
 * designed to match TC39 Temporal semantics so that, once the polyfill gate opens
 * (≤ 10 KB gzip — checked by `scripts/check-temporal-polyfill-size.mjs`), each
 * function body is a one-line swap — no call-site changes required.
 *
 * ROADMAP reference: §6.1 SEMANTIC stream — CAL-T / H-T items (v15 target).
 *
 * Migration map — every export annotates its TC39 Temporal equivalent.
 * Deviations from vanilla `Date` semantics are called out explicitly.
 */

// ── "Now" sources ─────────────────────────────────────────────────────────────

/**
 * Current epoch-milliseconds.
 * Temporal: `Temporal.Now.instant().epochMilliseconds`
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Current local date as a `Date` object (time components set to "now").
 * Temporal: `Temporal.Now.plainDateISO()` (date-only; no time component)
 */
export function today(): Date {
  return new Date();
}

// ── Day-boundary helpers ───────────────────────────────────────────────────────

/**
 * Epoch-ms at the start of `d`'s calendar day in local time (midnight 00:00:00.000).
 * Non-mutating — a clone is used so the original Date is unchanged.
 *
 * **NOTE**: The vanilla pattern `new Date(d).setHours(0, 0, 0, 0)` mutates
 * and then returns a number in one statement, which is easy to misread and
 * produces UTC midnight when called on a string-parsed Date in negative-UTC
 * zones.  This wrapper is explicit and safe.
 *
 * Temporal: `Temporal.PlainDate.from(d).toZonedDateTime(Temporal.Now.timeZoneId()).startOfDay().epochMilliseconds`
 */
export function startOfDayMs(d?: Date): number {
  const clone = d ? new Date(d.getTime()) : new Date();
  clone.setHours(0, 0, 0, 0);
  return clone.getTime();
}

// ── ISO string parsing ─────────────────────────────────────────────────────────

/**
 * Parse a `"YYYY-MM-DD"` ISO date string and return epoch-ms at **local** midnight.
 *
 * **Important difference from `new Date("YYYY-MM-DD")`**: the built-in
 * constructor treats a date-only string as UTC, which shifts the result by the
 * host timezone offset and produces "yesterday" at midnight in UTC+2 / UTC+3
 * zones.  This function always lands at local midnight.
 *
 * Temporal: `Temporal.PlainDate.from(iso).toZonedDateTime(Temporal.Now.timeZoneId()).epochMilliseconds`
 */
export function parsePlainDateMs(iso: string): number {
  const [y, mo, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  // month is 1-indexed in ISO, 0-indexed in Date constructor
  return new Date(y, mo - 1, d).setHours(0, 0, 0, 0);
}

/**
 * Parse an ISO date-time string (`"YYYY-MM-DDTHH:MM"` or `"YYYY-MM-DDTHH:MM:SS"`)
 * and return a `Date`.  Returns an invalid Date when the string is malformed.
 *
 * Temporal: `Temporal.PlainDateTime.from(iso)`
 */
export function parsePlainDateTime(iso: string): Date {
  return new Date(iso);
}

// ── Date arithmetic ────────────────────────────────────────────────────────────

/**
 * Return a new Date equal to `d` plus `n` calendar years.
 * The month and day are preserved.  If the result falls on a day that does not
 * exist in the target month (e.g. 29 Feb → non-leap year), the Date object
 * overflows naturally (as Temporal.PlainDate would also throw — add clamping
 * at migration time if needed).
 *
 * Temporal: `Temporal.PlainDate.from(d).add({ years: n })`
 */
export function addYears(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setFullYear(r.getFullYear() + n);
  return r;
}

/**
 * Return a new Date equal to `d` plus `n` calendar months.
 * If the resulting month is shorter than the original day, the day overflows
 * into the next month (standard JS Date behaviour).
 *
 * Temporal: `Temporal.PlainDate.from(d).add({ months: n })` (Temporal constrains by default)
 */
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + n);
  return r;
}

// ── Date string construction ───────────────────────────────────────────────────

/**
 * Build a `"YYYY-MM-DD"` string from separate year / month / day components.
 * `month` is **1-indexed** (January = 1) — matching ISO 8601 and Temporal.
 *
 * Temporal: `Temporal.PlainDate.from({ year, month, day }).toString()`
 */
export function toISODateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Day arithmetic & comparison ────────────────────────────────────────────────

/** Milliseconds per calendar day (24 × 60 × 60 × 1000). */
const MS_PER_DAY = 86400000;

/**
 * Return a new Date equal to `d` plus `n` calendar days.
 * Non-mutating — creates a clone.
 *
 * Temporal: `Temporal.PlainDate.from(d).add({ days: n })`
 */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/**
 * Return the signed number of whole calendar days from `a` to `b`.
 * Result is positive when `b` is later than `a`.
 * Comparison is done at local-midnight level (sub-day precision discarded).
 *
 * Temporal: `a.until(b, { largestUnit: 'day' }).days`
 */
export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDayMs(b) - startOfDayMs(a)) / MS_PER_DAY);
}

/**
 * Return `true` when two Date objects fall on the same calendar day in local time.
 *
 * Temporal: `Temporal.PlainDate.from(a).equals(Temporal.PlainDate.from(b))`
 */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/**
 * Whole calendar days from today until a future `target` date.
 * Returns 0 when target is today, negative when target is in the past.
 *
 * Temporal: `Temporal.Now.plainDateISO().until(target, { largestUnit: 'day' }).days`
 */
export function daysUntil(target: Date): number {
  return diffDays(new Date(), target);
}
