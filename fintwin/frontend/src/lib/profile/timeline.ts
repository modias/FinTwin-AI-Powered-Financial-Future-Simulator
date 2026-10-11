/**
 * Converts a personal `FinancialProfile` into the canonical cash-flow inputs.
 *
 * The output is the same `Bill` / `IncomeSource` / `CashFlowEvent` shapes the
 * demo dataset is written in, expanded by the same `expandCashFlowEvents` and
 * simulated by the same Monte Carlo engine. Nothing here forecasts; it only
 * describes the user's schedule.
 *
 * Rules the conversion keeps:
 *  - Housing becomes exactly one bill. Onboarding rejects a recurring bill
 *    that duplicates it, so rent is never counted twice.
 *  - Recurring bills are `scheduled`; everyday spending and the
 *    unexpected-expense allowance are `estimated`, so the simulation varies
 *    them and the UI labels them as estimates.
 *  - Everyday spending is entered without fixed bills (the questionnaire says
 *    so), so it is added once, split into an essential estimate (groceries
 *    and transportation) and a discretionary one, which the simulation lets
 *    vary by different amounts.
 *  - Dates come from the user: paydays and due dates are anchors they entered,
 *    never guessed. Irregular income enters only as the payments they listed.
 *  - No history is replayed: the forecast starts from the entered balance on
 *    the day it was entered.
 *
 * Profile amounts are integer cents; the domain types are dollars. This is
 * the one place the conversion happens.
 */

import { addDays, anchorForDayOfMonth } from "@/lib/dates";
import { fingerprint } from "@/lib/fingerprint";
import { centsToDollars } from "@/lib/money";
import { billCategoryToDomain, variableSpendingToDomain } from "@/lib/profile/labels";
import {
  monthlyBillCents,
  monthlyVariableSpendingByCategory,
  monthlyVariableSpendingCents,
  weeklyEmergencyAllowanceCents,
} from "@/lib/profile/normalize";
import type {
  Account,
  Bill,
  CashFlowEvent,
  FinancialDataset,
  IncomeSource,
  SpendingEstimate,
  TransactionCategory,
  UserProfile,
} from "@/types/financial";
import {
  VARIABLE_SPENDING_CATEGORIES,
  type FinancialProfile,
  type ProfileBill,
  type VariableSpendingCategory,
} from "@/types/profile";

export const PERSONAL_ACCOUNT_ID = "acc_personal_checking";

/**
 * Days after the reference date the first weekly spending estimate lands.
 * Mid-week, so a 30-day window holds four weekly estimates rather than five.
 */
const WEEKLY_ESTIMATE_OFFSET_DAYS = 4;

export const HOUSING_BILL_ID = "profile_housing";
export const ESSENTIAL_SPENDING_BILL_ID = "profile_essential_spending";
export const DISCRETIONARY_SPENDING_BILL_ID = "profile_discretionary_spending";
export const EMERGENCY_ALLOWANCE_BILL_ID = "profile_unexpected_expenses";

/** Everyday spending that is hard to cut back; the rest is discretionary. */
export const ESSENTIAL_SPENDING_CATEGORIES: readonly VariableSpendingCategory[] = [
  "groceries",
  "transportation",
];

interface TimelineInputs {
  bills: Bill[];
  incomeSources: IncomeSource[];
  oneOffEvents: CashFlowEvent[];
}

function baseBill(
  id: string,
  name: string,
  category: TransactionCategory,
  amountCents: number,
): Omit<Bill, "cadence" | "anchorDate"> {
  return {
    id,
    accountId: PERSONAL_ACCOUNT_ID,
    name,
    category,
    amount: centsToDollars(amountCents),
    confidence: "scheduled",
    autoPay: false,
  };
}

function recurringBillInputs(
  bill: ProfileBill,
  referenceDate: string,
): Pick<TimelineInputs, "bills" | "oneOffEvents"> {
  const base = baseBill(
    `profile_bill_${bill.id}`,
    bill.name,
    billCategoryToDomain[bill.category],
    bill.amountCents,
  );

  switch (bill.frequency) {
    case "weekly":
    case "biweekly":
      return {
        bills: [{ ...base, cadence: bill.frequency, anchorDate: bill.nextDueDate }],
        oneOffEvents: [],
      };
    case "monthly":
      return {
        bills: [
          {
            ...base,
            cadence: "monthly",
            anchorDate: anchorForDayOfMonth(bill.dueDay, referenceDate),
          },
        ],
        oneOffEvents: [],
      };
    case "semimonthly":
      return {
        bills: bill.dueDays.map((day, index) => ({
          ...base,
          id: `${base.id}_${index + 1}`,
          cadence: "monthly" as const,
          anchorDate: anchorForDayOfMonth(day, referenceDate),
        })),
        oneOffEvents: [],
      };
    case "one_time":
      return {
        bills: [],
        oneOffEvents: [
          {
            id: `${base.id}@${bill.nextDueDate}`,
            accountId: PERSONAL_ACCOUNT_ID,
            name: bill.name,
            category: base.category,
            amount: base.amount,
            date: bill.nextDueDate,
            direction: "expense",
            confidence: "scheduled",
            sourceId: base.id,
          },
        ],
      };
  }
}

function incomeInputs(
  profile: FinancialProfile,
  referenceDate: string,
): Pick<TimelineInputs, "incomeSources" | "oneOffEvents"> {
  const { income } = profile;
  const base = {
    accountId: PERSONAL_ACCOUNT_ID,
    name: "Paycheck",
    payer: "Take-home pay",
    confidence: "scheduled" as const,
  };

  switch (income.frequency) {
    case "weekly":
    case "biweekly":
    case "monthly":
      return {
        incomeSources: [
          {
            ...base,
            id: "profile_paycheck",
            amount: centsToDollars(income.paycheckAmountCents),
            cadence: income.frequency,
            anchorDate: income.nextPayday,
          },
        ],
        oneOffEvents: [],
      };
    case "semimonthly":
      return {
        incomeSources: income.semimonthlyPaydays.map((day, index) => ({
          ...base,
          id: `profile_paycheck_${index + 1}`,
          amount: centsToDollars(income.paycheckAmountCents),
          cadence: "monthly" as const,
          anchorDate: anchorForDayOfMonth(day, referenceDate),
        })),
        oneOffEvents: [],
      };
    case "irregular":
      return {
        incomeSources: [],
        oneOffEvents: income.expectedPayments.map((payment) => ({
          id: `profile_income_${payment.id}@${payment.date}`,
          accountId: PERSONAL_ACCOUNT_ID,
          name: "Expected payment",
          category: "Income",
          amount: centsToDollars(payment.amountCents),
          date: payment.date,
          direction: "income",
          confidence: "estimated",
          sourceId: `profile_income_${payment.id}`,
        })),
      };
    case "none":
      return { incomeSources: [], oneOffEvents: [] };
  }
}

/** The bills, income sources and one-off events a profile describes. */
export function profileTimelineInputs(profile: FinancialProfile): TimelineInputs {
  const referenceDate = profile.account.balanceAsOf;
  const bills: Bill[] = [];
  const oneOffEvents: CashFlowEvent[] = [];

  if (profile.housing.amountCents > 0 && profile.housing.dueDay !== null) {
    bills.push({
      ...baseBill(HOUSING_BILL_ID, "Rent or mortgage", "Housing", profile.housing.amountCents),
      cadence: "monthly",
      anchorDate: anchorForDayOfMonth(profile.housing.dueDay, referenceDate),
    });
  }

  for (const bill of profile.recurringBills) {
    const inputs = recurringBillInputs(bill, referenceDate);

    bills.push(...inputs.bills);
    oneOffEvents.push(...inputs.oneOffEvents);
  }

  const weeklyEstimateAnchor = addDays(referenceDate, WEEKLY_ESTIMATE_OFFSET_DAYS);
  const { amountsCents, period } = profile.variableSpending;
  const spendingGroups = [
    {
      id: ESSENTIAL_SPENDING_BILL_ID,
      name: "Essential spending (your estimate)",
      kind: "essential" as const,
      includes: (category: VariableSpendingCategory) =>
        ESSENTIAL_SPENDING_CATEGORIES.includes(category),
    },
    {
      id: DISCRETIONARY_SPENDING_BILL_ID,
      name: "Discretionary spending (your estimate)",
      kind: "discretionary" as const,
      includes: (category: VariableSpendingCategory) =>
        !ESSENTIAL_SPENDING_CATEGORIES.includes(category),
    },
  ];

  for (const group of spendingGroups) {
    const monthlyCents = monthlyVariableSpendingCents(
      Object.fromEntries(
        VARIABLE_SPENDING_CATEGORIES.filter(group.includes).map((category) => [
          category,
          amountsCents[category],
        ]),
      ),
      period,
    );

    if (monthlyCents <= 0) continue;

    bills.push({
      ...baseBill(group.id, group.name, "Other", Math.round((monthlyCents * 12) / 52)),
      cadence: "weekly",
      anchorDate: weeklyEstimateAnchor,
      confidence: "estimated",
      spendingKind: group.kind,
    });
  }

  if (profile.emergencies.enabled) {
    bills.push({
      ...baseBill(
        EMERGENCY_ALLOWANCE_BILL_ID,
        "Unexpected expenses allowance",
        "Other",
        weeklyEmergencyAllowanceCents(),
      ),
      cadence: "weekly",
      anchorDate: weeklyEstimateAnchor,
      confidence: "estimated",
      spendingKind: "unexpected",
    });
  }

  const income = incomeInputs(profile, referenceDate);

  return {
    bills,
    incomeSources: income.incomeSources,
    oneOffEvents: [...oneOffEvents, ...income.oneOffEvents],
  };
}

/**
 * Monthly spending by domain category: housing, recurring bills and everyday
 * spending. One-time bills are not monthly costs, and the unexpected-expense
 * allowance is a buffer rather than spending, so both are left out.
 */
export function profileSpendingEstimates(profile: FinancialProfile): SpendingEstimate[] {
  const totals = new Map<TransactionCategory, number>();
  const add = (category: TransactionCategory, cents: number) => {
    if (cents > 0) totals.set(category, (totals.get(category) ?? 0) + cents);
  };

  add("Housing", profile.housing.amountCents);

  for (const bill of profile.recurringBills) {
    add(billCategoryToDomain[bill.category], monthlyBillCents(bill));
  }

  const variable = monthlyVariableSpendingByCategory(
    profile.variableSpending.amountsCents,
    profile.variableSpending.period,
  );

  for (const category of VARIABLE_SPENDING_CATEGORIES) {
    add(variableSpendingToDomain[category], variable[category]);
  }

  return [...totals.entries()]
    .map(([category, cents]) => ({ category, monthlyAmount: centsToDollars(cents) }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

/**
 * The parts of a profile that change what the dashboard computes. Timestamps
 * and preferences are excluded: preferences travel with each request instead,
 * so moving the protected-minimum control does not discard every cached result.
 */
function datasetInputs(profile: FinancialProfile) {
  return {
    account: profile.account,
    income: profile.income,
    housing: profile.housing,
    recurringBills: profile.recurringBills,
    variableSpending: profile.variableSpending,
    emergencies: profile.emergencies,
  };
}

export function profileDatasetKey(profile: FinancialProfile): string {
  return `profile:${profile.id}:${fingerprint(datasetInputs(profile))}`;
}

export function profileToDataset(profile: FinancialProfile): FinancialDataset {
  const account: Account = {
    id: PERSONAL_ACCOUNT_ID,
    name: "Checking",
    institution: "Entered by you",
    type: "checking",
    mask: null,
    currentBalance: centsToDollars(profile.account.balanceCents),
    currency: "USD",
    isPrimary: true,
  };

  const user: UserProfile = {
    id: `user_${profile.id}`,
    name: null,
    email: null,
    initials: null,
    accountType: "checking",
    primaryAccountId: PERSONAL_ACCOUNT_ID,
  };

  return {
    key: profileDatasetKey(profile),
    source: "user_entered",
    referenceDate: profile.account.balanceAsOf,
    user,
    accounts: [account],
    transactions: [],
    ...profileTimelineInputs(profile),
    spendingEstimates: profileSpendingEstimates(profile),
  };
}
