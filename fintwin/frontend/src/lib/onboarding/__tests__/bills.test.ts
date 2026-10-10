import { describe, expect, it } from "vitest";

import {
  EMPTY_BILL_INPUT,
  addBill,
  billToInput,
  looksLikeHousing,
  removeBill,
  staleBillErrors,
  updateBill,
  validateBillInput,
  type BillInput,
} from "@/lib/onboarding/bills";
import type { ProfileBill } from "@/types/profile";

const TODAY = "2026-10-12";

const phone: ProfileBill = {
  id: "bill_phone",
  name: "Phone",
  category: "phone",
  amountCents: 6_000,
  frequency: "monthly",
  dueDay: 8,
};

const netflix: ProfileBill = {
  id: "bill_netflix",
  name: "Netflix",
  category: "subscriptions",
  amountCents: 1_599,
  frequency: "monthly",
  dueDay: 22,
};

function input(overrides: Partial<BillInput>): BillInput {
  return {
    ...EMPTY_BILL_INPUT,
    name: "Electric",
    category: "utilities",
    amountCents: 9_000,
    frequency: "monthly",
    dueDay: 14,
    ...overrides,
  };
}

let counter = 0;
const options = (existing: ProfileBill[] = [], editingId?: string) => ({
  existing,
  today: TODAY,
  editingId,
  createId: () => `bill_${++counter}`,
});

describe("validateBillInput", () => {
  it("requires a name, category, amount, frequency and due date", () => {
    const result = validateBillInput(EMPTY_BILL_INPUT, options());

    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.errors).sort()).toEqual([
      "amount",
      "category",
      "frequency",
      "name",
    ]);
  });

  it("asks for the schedule that matches the frequency", () => {
    const missing = (overrides: Partial<BillInput>) => {
      const result = validateBillInput(input(overrides), options());

      return result.ok ? {} : result.errors;
    };

    expect(missing({ dueDay: null })).toHaveProperty("dueDay");
    expect(missing({ frequency: "weekly", nextDueDate: null })).toHaveProperty("nextDueDate");
    expect(missing({ frequency: "semimonthly", dueDays: [1, null] })).toHaveProperty("dueDays");
    expect(missing({ frequency: "semimonthly", dueDays: [5, 5] })).toHaveProperty("dueDays");
  });

  it("rejects a $0 bill", () => {
    const result = validateBillInput(input({ amountCents: 0 }), options());

    expect(result.ok ? null : result.errors.amount).toMatch(/above \$0/);
  });

  it("keeps the next due date within one cycle, and in the future", () => {
    const error = (overrides: Partial<BillInput>) => {
      const result = validateBillInput(input(overrides), options());

      return result.ok ? null : (result.errors.nextDueDate ?? null);
    };

    expect(error({ frequency: "weekly", nextDueDate: TODAY })).toMatch(/after today/);
    expect(error({ frequency: "weekly", nextDueDate: "2026-10-19" })).toBeNull();
    expect(error({ frequency: "weekly", nextDueDate: "2026-10-20" })).toMatch(/7 days/);
    expect(error({ frequency: "biweekly", nextDueDate: "2026-10-26" })).toBeNull();
    expect(error({ frequency: "biweekly", nextDueDate: "2026-10-27" })).toMatch(/14 days/);
    expect(error({ frequency: "one_time", nextDueDate: "2027-10-12" })).toBeNull();
    expect(error({ frequency: "one_time", nextDueDate: "2027-10-13" })).toMatch(/365 days/);
  });

  it("builds a bill with a tidy name and sorted twice-monthly days", () => {
    const result = validateBillInput(
      input({ name: "  Car   loan ", frequency: "semimonthly", dueDays: [20, 5] }),
      options(),
    );

    expect(result.ok && result.bill).toMatchObject({
      name: "Car loan",
      frequency: "semimonthly",
      dueDays: [5, 20],
    });
  });

  it("round-trips a saved bill through the edit form", () => {
    const result = validateBillInput(billToInput(phone), options([phone], phone.id));

    expect(result).toEqual({ ok: true, bill: phone });
  });
});

describe("duplicate prevention", () => {
  it("rejects a bill with the same name, ignoring case, spacing and punctuation", () => {
    for (const name of ["Netflix", "netflix", "  NETFLIX ", "Net-flix", "net flix"]) {
      const result = validateBillInput(input({ name }), options([netflix]));

      expect(result.ok).toBe(false);
    }
  });

  it("lets a bill keep its own name while it is edited", () => {
    const result = validateBillInput(
      input({ name: "Netflix", amountCents: 2_299 }),
      options([netflix, phone], netflix.id),
    );

    expect(result.ok && result.bill).toMatchObject({ id: netflix.id, amountCents: 2_299 });
  });

  it("rejects renaming a bill to another bill's name", () => {
    const result = validateBillInput(input({ name: "phone" }), options([netflix, phone], netflix.id));

    expect(result.ok).toBe(false);
  });

  it("rejects rent or mortgage, which has its own question", () => {
    for (const name of ["Rent", "rent payment", "Mortgage", "Home mortgage (escrow)"]) {
      expect(looksLikeHousing(name)).toBe(true);
      expect(validateBillInput(input({ name }), options()).ok).toBe(false);
    }

    // Whole words only.
    expect(looksLikeHousing("Parent PLUS loan")).toBe(false);
    expect(looksLikeHousing("Car rental")).toBe(false);
  });
});

describe("bill list operations", () => {
  it("adds, edits and removes bills", () => {
    let bills = addBill([], phone);

    bills = addBill(bills, netflix);
    expect(bills.map((bill) => bill.name)).toEqual(["Phone", "Netflix"]);

    bills = updateBill(bills, { ...netflix, amountCents: 2_299 });
    expect(bills.find((bill) => bill.id === netflix.id)?.amountCents).toBe(2_299);
    expect(bills).toHaveLength(2);

    bills = removeBill(bills, phone.id);
    expect(bills.map((bill) => bill.id)).toEqual([netflix.id]);
  });

  it("does not mutate the list it was given", () => {
    const original = [phone];

    addBill(original, netflix);
    removeBill(original, phone.id);

    expect(original).toEqual([phone]);
  });

  it("refuses duplicates even if validation was bypassed", () => {
    expect(() => addBill([netflix], { ...netflix, id: "other" })).toThrow(/Duplicate/);
    expect(() => updateBill([netflix, phone], { ...phone, name: "Netflix" })).toThrow(/Duplicate/);
  });
});

describe("staleBillErrors", () => {
  it("flags dated bills whose date has passed", () => {
    const gym: ProfileBill = {
      id: "gym",
      name: "Gym",
      category: "subscriptions",
      amountCents: 2_900,
      frequency: "weekly",
      nextDueDate: "2026-10-12",
    };

    expect(staleBillErrors([phone, gym], TODAY)).toMatch(/“Gym” has a due date/);
    expect(staleBillErrors([phone], TODAY)).toBeNull();
  });
});
