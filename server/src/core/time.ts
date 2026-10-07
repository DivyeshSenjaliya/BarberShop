/**
 * Date and time helpers for schedules.
 *
 * Conventions used across the platform:
 * - Calendar days are ISO strings (`2026-10-07`) and are interpreted in the
 *   shop's local time.
 * - Clock times are minutes since local midnight (`540` = `09:00`).
 * - Timestamps stored in the database are UTC ISO strings.
 */

export type MinutesOfDay = number;
export type DayKey = string; // YYYY-MM-DD

export class TimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeError';
  }
}

export const MINUTES_PER_DAY = 24 * 60;

export interface TimeRange {
  start: MinutesOfDay;
  end: MinutesOfDay;
}

const TimePattern = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DayPattern = /^\d{4}-\d{2}-\d{2}$/;

/** `"09:30"` → `570`. Accepts `9:30` as well. */
export function parseTime(value: string): MinutesOfDay {
  const match = TimePattern.exec(value.trim());
  if (!match) throw new TimeError(`invalid time '${value}', expected HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** `570` → `"09:30"`. */
export function formatTime(minutes: MinutesOfDay): string {
  assertMinutesOfDay(minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function assertMinutesOfDay(minutes: number): MinutesOfDay {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new TimeError(`minutes of day out of range: ${minutes}`);
  }
  return minutes;
}

export function isValidTime(value: string): boolean {
  return TimePattern.test(value.trim());
}

/** Validate and normalise a calendar day key. */
export function parseDay(day: DayKey): { year: number; month: number; day: number } {
  if (!DayPattern.test(day)) throw new TimeError(`invalid day '${day}', expected YYYY-MM-DD`);
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(year, month - 1, date));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== date
  ) {
    throw new TimeError(`invalid calendar day '${day}'`);
  }
  return { year, month, day: date };
}

export function isValidDay(day: string): boolean {
  if (!DayPattern.test(day)) return false;
  try {
    parseDay(day);
    return true;
  } catch {
    return false;
  }
}

/** UTC-based day key for a date — timestamps are converted by the caller. */
export function dayKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

export function dayOfWeek(day: DayKey): number {
  const { year, month, day: date } = parseDay(day);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay(); // 0 = Sunday
}

export function addDays(day: DayKey, amount: number): DayKey {
  const { year, month, day: date } = parseDay(day);
  const shifted = new Date(Date.UTC(year, month - 1, date + amount));
  return dayKey(shifted);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  const left = parseDay(from);
  const right = parseDay(to);
  const leftMs = Date.UTC(left.year, left.month - 1, left.day);
  const rightMs = Date.UTC(right.year, right.month - 1, right.day);
  return Math.round((rightMs - leftMs) / 86_400_000);
}

export function compareDays(a: DayKey, b: DayKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function rangeOf(range: TimeRange): number {
  assertRange(range);
  return range.end - range.start;
}

export function assertRange(range: TimeRange): TimeRange {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) {
    throw new TimeError(`range has non-integer bounds: ${JSON.stringify(range)}`);
  }
  if (range.start < 0 || range.end > MINUTES_PER_DAY || range.start >= range.end) {
    throw new TimeError(`invalid time range: ${formatRange(range)}`);
  }
  return range;
}

export function formatRange(range: TimeRange): string {
  return `${formatTime(range.start)}-${formatTime(range.end)}`;
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when `inner` sits entirely inside `outer`. */
export function contains(outer: TimeRange, inner: TimeRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/** Sort ranges and merge any that touch or overlap. */
export function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TimeRange[] = [{ ...sorted[0]! }];
  for (const range of sorted.slice(1)) {
    const current = merged[merged.length - 1]!;
    if (range.start <= current.end) {
      current.end = Math.max(current.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Free gaps inside `window` after removing every block in `blocked`.
 * The result is sorted and non-overlapping.
 */
export function gapsBetween(window: TimeRange, blocked: readonly TimeRange[]): TimeRange[] {
  assertRange(window);
  const relevant = mergeRanges(blocked).filter((range) => overlaps(range, window));
  const gaps: TimeRange[] = [];
  let cursor = window.start;
  for (const range of relevant) {
    const start = Math.max(range.start, window.start);
    const end = Math.min(range.end, window.end);
    if (start > cursor) gaps.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
    if (cursor >= window.end) return gaps;
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps;
}

/** Does `range` fit entirely inside one of `available`? */
export function fitsWithin(range: TimeRange, available: readonly TimeRange[]): boolean {
  return available.some((slot) => contains(slot, range));
}

export function totalMinutes(ranges: readonly TimeRange[]): number {
  return mergeRanges(ranges).reduce((sum, range) => sum + rangeOf(range), 0);
}

/** `"2026-10-07T09:00:00Z"` + timezone offset → minutes since local midnight. */
export function minutesOfDayInZone(timestamp: string | Date, offsetMinutes: number): MinutesOfDay {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) throw new TimeError(`invalid timestamp: ${timestamp}`);
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Local wall-clock time on `day` → UTC ISO timestamp. */
export function zonedTimeToUtc(day: DayKey, minutes: MinutesOfDay, offsetMinutes: number): string {
  assertMinutesOfDay(minutes);
  const { year, month, day: date } = parseDay(day);
  const utcMs = Date.UTC(year, month - 1, date, 0, 0, 0, 0) + (minutes - offsetMinutes) * 60_000;
  return new Date(utcMs).toISOString();
}

export function durationLabel(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new TimeError(`invalid duration: ${minutes}`);
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}
