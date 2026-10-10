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

/** `Everyday Checking •••• 4821`, or just the name for an account without a mask. */
export function formatAccountLabel(name: string, mask: string | null): string {
  return mask ? `${name} •••• ${mask}` : name;
}
