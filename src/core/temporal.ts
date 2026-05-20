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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

/**
 * Return a new Date equal to `d` plus `n` weeks (7 × n days).
 * Non-mutating — creates a clone.
 *
 * Temporal: `Temporal.PlainDate.from(d).add({ weeks: n })`
 */
export function addWeeks(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 7 * MS_PER_DAY);
}

/**
 * Return `true` when `d` falls on the same calendar day as today (local time).
 *
 * Temporal: `Temporal.PlainDate.from(d).equals(Temporal.Now.plainDateISO())`
 */
export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/**
 * Return `true` when `d` is tomorrow (local time).
 *
 * Temporal: `Temporal.PlainDate.from(d).equals(Temporal.Now.plainDateISO().add({ days: 1 }))`
 */
export function isTomorrow(d: Date): boolean {
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return isSameDay(d, tom);
}

/**
 * Return `true` when `d` is yesterday (local time).
 *
 * Temporal: `Temporal.PlainDate.from(d).equals(Temporal.Now.plainDateISO().subtract({ days: 1 }))`
 */
export function isYesterday(d: Date): boolean {
  const yst = new Date();
  yst.setDate(yst.getDate() - 1);
  return isSameDay(d, yst);
}

// ── Epoch-ms conversion ─────────────────────────────────────────────────────

/**
 * Create a Date from epoch-milliseconds.
 * Syntactic sugar to eliminate `new Date(ms)` call-sites.
 *
 * Temporal: `Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZoneId)`
 */
export function fromEpochMs(ms: number): Date {
  return new Date(ms);
}

/**
 * Construct a Date from local year/month/day components.
 * `month` is **1-indexed** (January = 1) — matching ISO 8601 and Temporal.
 *
 * Temporal: `Temporal.PlainDate.from({ year, month, day }).toZonedDateTime(timeZoneId)`
 */
export function fromParts(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/**
 * Parse any date string and return its epoch-milliseconds.
 * Returns `NaN` when the string is malformed.
 *
 * Temporal: `Temporal.Instant.from(str).epochMilliseconds`
 */
export function parseEpochMs(str: string): number {
  return new Date(str).getTime();
}

/**
 * Parse an ISO date-time string (e.g. `"2026-05-20T06:30:00+03:00"`) into a Date.
 * Eliminates `new Date(isoString)` call-sites throughout card code.
 *
 * Temporal: `Temporal.Instant.from(iso).toZonedDateTimeISO(timeZoneId)`
 */
export function fromISOString(iso: string): Date {
  return new Date(iso);
}

/**
 * Create a Date from Unix epoch-seconds (integer seconds since 1970-01-01T00:00:00Z).
 * Eliminates `new Date(ts * 1000)` call-sites.
 *
 * Temporal: `Temporal.Instant.fromEpochSeconds(sec).toZonedDateTimeISO(timeZoneId)`
 */
export function fromEpochSec(sec: number): Date {
  return new Date(sec * 1000);
}

/**
 * Add or subtract milliseconds from a Date, returning a new Date.
 * Eliminates `new Date(d.getTime() + offset)` call-sites.
 *
 * Temporal: `instant.add({ milliseconds: ms })`
 */
export function addMs(d: Date, ms: number): Date {
  return new Date(d.getTime() + ms);
}

/**
 * Parse a date string (any format accepted by `Date` constructor) into a Date.
 * Use for non-ISO strings such as locale-formatted timezone conversions.
 * Eliminates remaining `new Date(someString)` call-sites.
 *
 * Temporal: `Temporal.PlainDateTime.from(str)` or `Temporal.Instant.from(str)`
 */
export function fromDateString(str: string): Date {
  return new Date(str);
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Return `today().toISOString()` — shortcut for the most common pattern.
 *
 * Temporal: `Temporal.Now.instant().toString()`
 */
export function nowISO(): string {
  return new Date().toISOString();
}

// ── Progress helpers ──────────────────────────────────────────────────────────

/**
 * Percentage of the current day elapsed (0–100), based on local time.
 * `(hours × 60 + minutes) / 1440 × 100`
 *
 * Temporal: `Temporal.Now.plainTimeISO()` arithmetic
 */
export function dayProgressPct(now?: Date): number {
  const d = now ?? new Date();
  return ((d.getHours() * 60 + d.getMinutes()) / 1440) * 100;
}

/**
 * Percentage of the current calendar year elapsed (0–100).
 *
 * Temporal: `Temporal.Now.plainDateISO().dayOfYear / daysInYear × 100`
 */
export function yearProgressPct(now?: Date): number {
  const d = now ?? new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const endOfYear = new Date(d.getFullYear() + 1, 0, 1);
  return ((d.getTime() - startOfYear.getTime()) / (endOfYear.getTime() - startOfYear.getTime())) * 100;
}
