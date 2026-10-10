import { describe, expect, it } from "vitest";

import {
  centsToInputText,
  dollarsToCents,
  parseCurrencyToCents,
  sanitizeCurrencyInput,
} from "@/lib/money";

describe("parseCurrencyToCents", () => {
  it.each([
    ["1500", 150_000],
    ["1,500.50", 150_050],
    ["$1,500.5", 150_050],
    ["  42.07 ", 4_207],
    [".99", 99],
    ["0.29", 29],
    ["0", 0],
    ["0.00", 0],
    ["1.", 100],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseCurrencyToCents(input)).toBe(cents);
  });

  it.each(["", "  ", "$", ".", "-5", "1.234", "12abc", "1e3", "NaN"])(
    "rejects %j",
    (input) => {
      expect(parseCurrencyToCents(input)).toBeNull();
    },
  );

  it("is exact where float multiplication is not", () => {
    // 0.29 * 100 === 28.999999999999996 in floating point.
    expect(parseCurrencyToCents("0.29")).toBe(29);
    expect(parseCurrencyToCents("1.13")).toBe(113);
    expect(parseCurrencyToCents("4.35")).toBe(435);
  });

  it("always returns an integer", () => {
    for (const input of ["19.99", "0.07", "1,234,567.89"]) {
      expect(Number.isInteger(parseCurrencyToCents(input))).toBe(true);
    }
  });
});

describe("sanitizeCurrencyInput", () => {
  it("keeps digits, commas and one decimal point with at most two decimals", () => {
    expect(sanitizeCurrencyInput("$1,2a00.4567")).toBe("1,200.45");
    expect(sanitizeCurrencyInput("1.2.3")).toBe("1.23");
    expect(sanitizeCurrencyInput("-50")).toBe("50");
  });
});

describe("round trips", () => {
  it("formats cents as editable text and parses it back", () => {
    for (const cents of [0, 5, 99, 100, 150_050, 123_456_789]) {
      expect(parseCurrencyToCents(centsToInputText(cents))).toBe(cents);
    }

    expect(centsToInputText(150_000)).toBe("1500");
    expect(centsToInputText(150_005)).toBe("1500.05");
    expect(centsToInputText(null)).toBe("");
  });

  it("converts domain dollars to cents without drift", () => {
    expect(dollarsToCents(15.99)).toBe(1_599);
    expect(dollarsToCents(2143)).toBe(214_300);
  });
});
