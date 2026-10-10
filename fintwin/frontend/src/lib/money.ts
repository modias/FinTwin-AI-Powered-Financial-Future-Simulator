/**
 * Integer-cent helpers for amounts the user types.
 *
 * Typed amounts are parsed with string arithmetic rather than
 * `Math.round(parseFloat(x) * 100)`, so `"0.29"` is exactly 29 cents and no
 * input can pick up float error on its way into storage.
 */

import { formatCurrency } from "@/lib/formatters";

const AMOUNT_PATTERN = /^(\d*)(?:\.(\d{0,2}))?$/;

/**
 * Parses what a user typed into a currency field.
 *
 * Accepts `1500`, `1,500.50`, `$1,500.5`, `.99` and surrounding whitespace.
 * Returns `null` for empty input and for anything that is not a non-negative
 * amount with at most two decimal places, including negatives and `1.234`.
 */
export function parseCurrencyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  const match = AMOUNT_PATTERN.exec(cleaned);

  if (!match) return null;

  const [, whole, fraction = ""] = match;

  if (whole === "" && fraction === "") return null;

  const cents =
    Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0") || "0");

  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Filters a keystroke-by-keystroke value down to characters a currency field
 * can hold: digits, grouping commas and at most one decimal point followed by
 * two digits.
 */
export function sanitizeCurrencyInput(input: string): string {
  const stripped = input.replace(/[^\d.,]/g, "");
  const [whole, ...rest] = stripped.split(".");

  if (rest.length === 0) return whole;

  return `${whole}.${rest.join("").replace(/,/g, "").slice(0, 2)}`;
}

/** Plain editable text for a cents value: `150050` → `"1500.50"`, `150000` → `"1500"`. */
export function centsToInputText(cents: number | null): string {
  if (cents === null) return "";

  const whole = Math.trunc(cents / 100);
  const fraction = cents % 100;

  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** The single conversion from stored cents to the dollar-valued domain types. */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** `$1,500.50` */
export function formatCents(cents: number): string {
  return formatCurrency(centsToDollars(cents));
}
