/**
 * Calendar-date helpers.
 *
 * Dates in FinTwin are plain `YYYY-MM-DD` calendar days, not instants. Every
 * function here parses and formats in UTC so that a bill due on the 1st is the
 * 1st regardless of the viewer's timezone, and so server-rendered output
 * matches the client exactly.
 */

import type { Cadence } from "@/types/financial";

const MS_PER_DAY = 86_400_000;

export type IsoDate = string;

export function parseIsoDate(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/**
 * The viewer's own calendar day for an instant. Unlike `toIsoDate`, which is
 * UTC, this is what "today" means to the person filling in a form.
 */
export function localIsoDate(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** `true` only for a real calendar day in `YYYY-MM-DD` form; rejects `2026-02-30`. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * An anchor date for a monthly event due on `day` (1–31), for use with
 * `occurrencesBetween`.
 *
 * Monthly occurrences repeat the anchor's day of month, clamping it in shorter
 * months. The anchor must therefore fall in a month that actually has `day`:
 * anchoring "the 31st" on Sep 30 would make every later occurrence the 30th.
 * This walks back from the reference month to the nearest month long enough.
 */
export function anchorForDayOfMonth(day: number, referenceDate: IsoDate): IsoDate {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid day of month: ${day}`);
  }

  const reference = parseIsoDate(referenceDate);
  let year = reference.getUTCFullYear();
  let monthIndex = reference.getUTCMonth();

  while (daysInMonth(year, monthIndex) < day) {
    monthIndex -= 1;

    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }

  return toIsoDate(new Date(Date.UTC(year, monthIndex, day)));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(date).getTime() + days * MS_PER_DAY));
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const parsed = parseIsoDate(date);
  const targetMonth = parsed.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(parsed.getUTCFullYear(), targetMonth + 1, 0),
  ).getUTCDate();

  return toIsoDate(
    new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        targetMonth,
        Math.min(parsed.getUTCDate(), lastDayOfTargetMonth),
      ),
    ),
  );
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function differenceInDays(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY,
  );
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive on both ends. */
export function isWithinRange(
  date: IsoDate,
  start: IsoDate,
  end: IsoDate,
): boolean {
  return date >= start && date <= end;
}

const stepDaysByCadence: Record<Exclude<Cadence, "monthly">, number> = {
  weekly: 7,
  biweekly: 14,
};

/**
 * Every occurrence of a recurring event that falls inside `[start, end]`.
 *
 * Fixed-interval cadences step from the anchor date, monthly cadences repeat
 * the anchor's day of month (clamped to shorter months). The anchor itself may
 * sit before, inside, or after the window.
 */
export function occurrencesBetween(
  anchorDate: IsoDate,
  cadence: Cadence,
  start: IsoDate,
  end: IsoDate,
): IsoDate[] {
  if (start > end) {
    return [];
  }

  if (cadence === "monthly") {
    const monthsToStart = monthsBetween(anchorDate, start);
    const occurrences: IsoDate[] = [];

    // Walk one month either side of the window so that day-of-month clamping
    // near month boundaries cannot drop a valid occurrence.
    for (
      let offset = monthsToStart - 1;
      offset <= monthsBetween(anchorDate, end) + 1;
      offset += 1
    ) {
      const candidate = addMonths(anchorDate, offset);

      if (isWithinRange(candidate, start, end)) {
        occurrences.push(candidate);
      }
    }

    return occurrences;
  }

  const stepDays = stepDaysByCadence[cadence];
  const firstStep = Math.ceil(differenceInDays(anchorDate, start) / stepDays);
  const occurrences: IsoDate[] = [];

  for (let step = firstStep; ; step += 1) {
    const candidate = addDays(anchorDate, step * stepDays);

    if (candidate > end) {
      break;
    }

    if (candidate >= start) {
      occurrences.push(candidate);
    }
  }

  return occurrences;
}

function monthsBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);

  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth())
  );
}

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const mediumDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `Oct 12` */
export function formatShortDate(date: IsoDate): string {
  return shortDateFormatter.format(parseIsoDate(date));
}

/** `Oct 12, 2026` */
export function formatMediumDate(date: IsoDate): string {
  return mediumDateFormatter.format(parseIsoDate(date));
}

/** `Mon` */
export function formatWeekday(date: IsoDate): string {
  return weekdayFormatter.format(parseIsoDate(date));
}

/** `October 2026` */
export function formatMonth(date: IsoDate): string {
  return monthFormatter.format(parseIsoDate(date));
}

/** `in 4 days`, `tomorrow`, `today`, `3 days ago` */
export function formatRelativeDay(date: IsoDate, reference: IsoDate): string {
  const days = differenceInDays(reference, date);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;

  return `${Math.abs(days)} days ago`;
}
