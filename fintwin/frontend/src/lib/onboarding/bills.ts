/**
 * The recurring-bills list in step 2: the add/edit form's validation and the
 * list operations. Pure functions, so the rules are unit-tested rather than
 * buried in a component.
 */

import { addDays } from "@/lib/dates";
import type { FieldErrors } from "@/lib/onboarding/validation";
import type {
  BillCategory,
  BillFrequency,
  DayOfMonth,
  ProfileBill,
} from "@/types/profile";

/** How far ahead a one-time bill may be scheduled. */
export const ONE_TIME_BILL_MAX_DAYS = 365;

/** For a bill that repeats every N days, the next due date is at most N days away. */
const CYCLE_DAYS: Partial<Record<BillFrequency, number>> = {
  weekly: 7,
  biweekly: 14,
};

/** The add/edit form's state. Everything starts empty. */
export interface BillInput {
  name: string;
  category: BillCategory | null;
  amountCents: number | null;
  frequency: BillFrequency | null;
  nextDueDate: string | null;
  dueDay: DayOfMonth | null;
  dueDays: [DayOfMonth | null, DayOfMonth | null];
}

export const EMPTY_BILL_INPUT: BillInput = {
  name: "",
  category: null,
  amountCents: null,
  frequency: null,
  nextDueDate: null,
  dueDay: null,
  dueDays: [null, null],
};

export function billToInput(bill: ProfileBill): BillInput {
  return {
    ...EMPTY_BILL_INPUT,
    name: bill.name,
    category: bill.category,
    amountCents: bill.amountCents,
    frequency: bill.frequency,
    nextDueDate: "nextDueDate" in bill ? bill.nextDueDate : null,
    dueDay: "dueDay" in bill ? bill.dueDay : null,
    dueDays: "dueDays" in bill ? bill.dueDays : [null, null],
  };
}

/** Case-, spacing- and punctuation-insensitive name used for duplicate checks. */
export function normalizeBillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Housing has its own question; a bill like this would count it twice. */
export function looksLikeHousing(name: string): boolean {
  return /\b(rent|mortgage)\b/.test(normalizeBillName(name));
}

/** "Net-flix", "net flix" and "Netflix" all compare equal. */
function duplicateKey(name: string): string {
  return normalizeBillName(name).replace(/ /g, "");
}

export function findDuplicateBill(
  name: string,
  bills: readonly ProfileBill[],
  ignoreId?: string,
): ProfileBill | undefined {
  const key = duplicateKey(name);

  return bills.find((bill) => bill.id !== ignoreId && duplicateKey(bill.name) === key);
}

/** Validates a future date entered for a bill. `null` when it is acceptable. */
export function futureDateError(
  date: string | null,
  today: string,
  maxDaysAhead: number,
  missingMessage: string,
): string | null {
  if (!date) return missingMessage;
  if (date <= today) return "Choose a date after today.";
  if (date > addDays(today, maxDaysAhead)) {
    return `Choose a date within the next ${maxDaysAhead} days.`;
  }

  return null;
}

export type BillValidation =
  | { ok: true; bill: ProfileBill }
  | { ok: false; errors: FieldErrors };

interface ValidateBillOptions {
  existing: readonly ProfileBill[];
  today: string;
  /** Set when editing, so the bill is not a duplicate of itself. */
  editingId?: string;
  createId: () => string;
}

export function validateBillInput(
  input: BillInput,
  { existing, today, editingId, createId }: ValidateBillOptions,
): BillValidation {
  const errors: FieldErrors = {};
  const name = input.name.trim().replace(/\s+/g, " ");

  if (!name) {
    errors.name = "Give this bill a name, like “Electric” or “Car insurance”.";
  } else if (name.length > 60) {
    errors.name = "Keep the name under 60 characters.";
  } else if (looksLikeHousing(name)) {
    errors.name =
      "Rent and mortgage go in the housing question above, so they are only counted once.";
  } else {
    const duplicate = findDuplicateBill(name, existing, editingId);

    if (duplicate) {
      errors.name = `You already added “${duplicate.name}”. Edit that bill instead, or use a different name.`;
    }
  }

  if (!input.category) errors.category = "Choose a category.";

  if (input.amountCents === null) {
    errors.amount = "Enter the amount.";
  } else if (input.amountCents === 0) {
    errors.amount = "Enter an amount above $0.";
  }

  if (!input.frequency) {
    errors.frequency = "Choose how often it’s due.";
  } else if (
    input.frequency === "weekly" ||
    input.frequency === "biweekly" ||
    input.frequency === "one_time"
  ) {
    const error = futureDateError(
      input.nextDueDate,
      today,
      CYCLE_DAYS[input.frequency] ?? ONE_TIME_BILL_MAX_DAYS,
      "Choose the next date it’s due.",
    );

    if (error) errors.nextDueDate = error;
  } else if (input.frequency === "monthly") {
    if (input.dueDay === null) errors.dueDay = "Choose the day of the month it’s due.";
  } else {
    const [first, second] = input.dueDays;

    if (first === null || second === null) {
      errors.dueDays = "Choose both due days.";
    } else if (first === second) {
      errors.dueDays = "Choose two different days.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const base = {
    id: editingId ?? createId(),
    name,
    category: input.category!,
    amountCents: input.amountCents!,
  };

  switch (input.frequency!) {
    case "weekly":
    case "biweekly":
    case "one_time":
      return {
        ok: true,
        bill: { ...base, frequency: input.frequency!, nextDueDate: input.nextDueDate! } as ProfileBill,
      };
    case "monthly":
      return { ok: true, bill: { ...base, frequency: "monthly", dueDay: input.dueDay! } };
    case "semimonthly": {
      const [first, second] = input.dueDays as [DayOfMonth, DayOfMonth];

      return {
        ok: true,
        bill: {
          ...base,
          frequency: "semimonthly",
          dueDays: first < second ? [first, second] : [second, first],
        },
      };
    }
  }
}

/** Errors for bills saved earlier whose dates have since passed. */
export function staleBillErrors(
  bills: readonly ProfileBill[],
  today: string,
): string | null {
  const stale = bills.filter(
    (bill) => "nextDueDate" in bill && bill.nextDueDate <= today,
  );

  if (stale.length === 0) return null;

  const names = stale.map((bill) => `“${bill.name}”`).join(", ");

  return `${names} ${stale.length === 1 ? "has a due date" : "have due dates"} that already passed. Edit ${stale.length === 1 ? "it" : "them"} to a future date or remove ${stale.length === 1 ? "it" : "them"}.`;
}

export function addBill(bills: readonly ProfileBill[], bill: ProfileBill): ProfileBill[] {
  if (findDuplicateBill(bill.name, bills)) {
    throw new Error(`Duplicate bill: ${bill.name}`);
  }

  return [...bills, bill];
}

export function updateBill(
  bills: readonly ProfileBill[],
  bill: ProfileBill,
): ProfileBill[] {
  if (findDuplicateBill(bill.name, bills, bill.id)) {
    throw new Error(`Duplicate bill: ${bill.name}`);
  }

  return bills.map((existing) => (existing.id === bill.id ? bill : existing));
}

export function removeBill(bills: readonly ProfileBill[], id: string): ProfileBill[] {
  return bills.filter((bill) => bill.id !== id);
}
