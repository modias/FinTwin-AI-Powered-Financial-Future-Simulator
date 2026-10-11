/**
 * Recurring schedules inside a simulation horizon.
 *
 * The canonical timeline's own recurrence lives in `lib/dates`
 * (`occurrencesBetween`), which clamps monthly dates to short months and
 * returns to the anchor's day afterwards. Scenarios reuse it, so a
 * hypothetical bill due on the 31st behaves exactly like a real one.
 */

import { addDays, differenceInDays, occurrencesBetween } from "@/lib/dates";
import type { ScenarioFrequency } from "@/simulation/types";

/** Day 0 is the reference date. */
export function dayIndexOf(referenceDate: string, date: string): number {
  return differenceInDays(referenceDate, date);
}

export function horizonEnd(referenceDate: string, horizonDays: number): string {
  return addDays(referenceDate, horizonDays);
}

/** Every date from `firstDate` repeating at `frequency`, up to and including `end`. */
export function recurringDates(
  firstDate: string,
  frequency: ScenarioFrequency,
  end: string,
): string[] {
  return occurrencesBetween(firstDate, frequency, firstDate, end);
}

/** Calendar days one occurrence of a cadence stands for. */
export const PERIOD_DAYS: Record<"weekly" | "biweekly" | "monthly", number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 365.25 / 12,
};
