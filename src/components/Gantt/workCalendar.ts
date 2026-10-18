/**
 * Date-only working-day calendar for Gantt schedules.
 * Arithmetic stays on YYYY-MM-DD strings so tests do not depend on the host timezone.
 * `enabled: false` is today's calendar-day behaviour.
 */

export type WeekendPattern = 'sat-sun' | 'fri-sat';

export interface WorkCalendar {
  /** `workdays: on`. Off keeps calendar-day scheduling. */
  enabled: boolean;
  weekend: WeekendPattern;
  /** ISO dates, unique, source order. */
  holidays: string[];
}

export const DEFAULT_WORK_CALENDAR: WorkCalendar = {
  enabled: false,
  weekend: 'sat-sun',
  holidays: [],
};

const DAY_MS = 86_400_000;
const MAX_SPAN = 3660;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/** UTC calendar date for ISO instants; local calendar date for other instants. */
export function dateToIso(date: Date): string {
  const utcMidnight = date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
  const year = utcMidnight ? date.getUTCFullYear() : date.getFullYear();
  const month = (utcMidnight ? date.getUTCMonth() : date.getMonth()) + 1;
  const day = utcMidnight ? date.getUTCDate() : date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isoToUtcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffIsoDays(later: string, earlier: string): number {
  const [y1, m1, d1] = earlier.split('-').map(Number);
  const [y2, m2, d2] = later.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** Last day the bar covers. `end` is exclusive, matching `duration:` today. */
export function barFinishIso(start: Date, end: Date): string {
  const startIso = dateToIso(start);
  const endIso = dateToIso(end);
  if (endIso <= startIso) return startIso;
  return addIsoDays(endIso, -1);
}

function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekend(iso: string, weekend: WeekendPattern): boolean {
  const day = weekdayIndex(iso);
  if (weekend === 'fri-sat') return day === 5 || day === 6;
  return day === 0 || day === 6;
}

export function isWorkingDay(iso: string, calendar: WorkCalendar): boolean {
  if (!calendar.enabled) return true;
  if (calendar.holidays.includes(iso)) return false;
  return !isWeekend(iso, calendar.weekend);
}

export function nextWorkingDay(iso: string, calendar: WorkCalendar): string {
  let cursor = iso;
  for (let i = 0; i < MAX_SPAN; i += 1) {
    if (isWorkingDay(cursor, calendar)) return cursor;
    cursor = addIsoDays(cursor, 1);
  }
  return cursor;
}

/** Working days in [start, end). */
export function countWorkingDays(startIso: string, endIso: string, calendar: WorkCalendar): number {
  if (endIso <= startIso) return 0;
  let count = 0;
  let cursor = startIso;
  let guard = 0;
  while (cursor < endIso && guard < MAX_SPAN) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = addIsoDays(cursor, 1);
    guard += 1;
  }
  return count;
}

/**
 * Exclusive end after `workingDays` working days.
 * The start day counts when it is a working day. A non-working start
 * does not count; the count begins on the next working day.
 */
export function exclusiveEndAfterWorkingDays(
  startIso: string,
  workingDays: number,
  calendar: WorkCalendar,
): string {
  if (workingDays <= 0) return startIso;
  let cursor = isWorkingDay(startIso, calendar) ? startIso : nextWorkingDay(startIso, calendar);
  let left = workingDays;
  let guard = 0;
  while (left > 0 && guard < MAX_SPAN) {
    if (isWorkingDay(cursor, calendar)) left -= 1;
    cursor = addIsoDays(cursor, 1);
    guard += 1;
  }
  return cursor;
}

/** Date that is `workingDays` working days after `startIso` (0 returns start). */
export function dateAfterWorkingDays(startIso: string, workingDays: number, calendar: WorkCalendar): string {
  if (workingDays <= 0) return startIso;
  let cursor = startIso;
  let left = workingDays;
  let guard = 0;
  while (left > 0 && guard < MAX_SPAN) {
    cursor = addIsoDays(cursor, 1);
    if (isWorkingDay(cursor, calendar)) left -= 1;
    guard += 1;
  }
  return cursor;
}

/** DSL lines for a calendar. Defaults are omitted so old boards stay unchanged. */
export function formatWorkCalendarLines(calendar?: WorkCalendar): string[] {
  if (!calendar) return [];
  const lines: string[] = [];
  if (calendar.enabled) lines.push('workdays: on');
  if (calendar.weekend === 'fri-sat') lines.push('weekend: fri-sat');
  if (calendar.holidays.length > 0) lines.push(`holidays: ${calendar.holidays.join(', ')}`);
  return lines;
}
