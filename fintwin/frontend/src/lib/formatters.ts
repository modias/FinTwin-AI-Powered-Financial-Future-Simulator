/**
 * Display formatters.
 *
 * All formatters pin an explicit locale so server-rendered markup matches the
 * client and hydration stays clean.
 */

const LOCALE = "en-US";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** `$1,234.56` */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** `$1,235` — for large headline figures where cents add noise. */
export function formatWholeCurrency(amount: number): string {
  return wholeCurrencyFormatter.format(amount);
}

/** `$1.2K` — for chart axes. */
export function formatCompactCurrency(amount: number): string {
  return compactCurrencyFormatter.format(amount);
}

/** `+$1,500.00` / `−$75.00`, using a true minus sign. */
export function formatSignedCurrency(
  amount: number,
  direction: "income" | "expense",
): string {
  const sign = direction === "income" ? "+" : "\u2212";

  return `${sign}${currencyFormatter.format(Math.abs(amount))}`;
}

/** Splits a currency string so the dollars and cents can be styled apart. */
export function splitCurrency(amount: number): {
  whole: string;
  fraction: string;
} {
  const [whole, fraction] = currencyFormatter.format(amount).split(".");

  return { whole, fraction: fraction ?? "00" };
}

/** `42.5%` */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/**
 * A probability given as a fraction, as `95.3%`. Never rounds to a certainty
 * the simulation didn't show: 9,999 safe paths out of 10,000 reads `>99.9%`,
 * not `100.0%`, and a single breach reads `<0.1%`, not `0.0%`.
 */
export function formatProbability(probability: number): string {
  if (probability > 0.999 && probability < 1) return ">99.9%";
  if (probability > 0 && probability < 0.001) return "<0.1%";

  return `${(probability * 100).toFixed(1)}%`;
}

/** A change in percentage points: `+2.4 pts`, `−11.0 pts`, `No change`. */
export function formatPointChange(points: number): string {
  const rounded = Math.round(points * 10) / 10;

  if (rounded === 0) return points === 0 ? "No change" : points > 0 ? "+<0.1 pts" : "\u2212<0.1 pts";

  return `${rounded > 0 ? "+" : "\u2212"}${Math.abs(rounded).toFixed(1)} pts`;
}

/** `Everyday Checking •••• 4821`, or just the name for an account without a mask. */
export function formatAccountLabel(name: string, mask: string | null): string {
  return mask ? `${name} •••• ${mask}` : name;
}
