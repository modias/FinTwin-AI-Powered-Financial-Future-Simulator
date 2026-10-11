import { describe, expect, it } from "vitest";

import { expandCashFlowEvents, forwardWindow } from "@/lib/calculations";
import {
  EMERGENCY_ALLOWANCE_BILL_ID,
  DISCRETIONARY_SPENDING_BILL_ID,
  ESSENTIAL_SPENDING_BILL_ID,
  HOUSING_BILL_ID,
  PERSONAL_ACCOUNT_ID,
  profileDatasetKey,
  profileSpendingEstimates,
  profileToDataset,
} from "@/lib/profile/timeline";
import { getFinancialService } from "@/services/financial-service";
import type { FinancialProfile } from "@/types/profile";

import { TODAY, makeProfile } from "./fixtures";

const NO_INCOME = { frequency: "none", paycheckAmountCents: 0 } as const;
const NO_HOUSING = { amountCents: 0, dueDay: null };

/** Every canonical event the profile produces over `days`, as the forecast sees them. */
function eventsFor(profile: FinancialProfile, days = 90) {
  const dataset = profileToDataset(profile);
  const { start, end } = forwardWindow(dataset.referenceDate, days);

  return expandCashFlowEvents({
    accountId: PERSONAL_ACCOUNT_ID,
    start,
    end,
    bills: dataset.bills,
    incomeSources: dataset.incomeSources,
    oneOffEvents: dataset.oneOffEvents,
  });
}

function datesOf(events: ReturnType<typeof eventsFor>, sourceId: string) {
  return events.filter((event) => event.sourceId === sourceId).map((event) => event.date);
}

describe("paychecks on the canonical timeline", () => {
  it("repeats a weekly paycheck every 7 days from the payday the user entered", () => {
    const events = eventsFor(
      makeProfile({
        income: { frequency: "weekly", paycheckAmountCents: 80_000, nextPayday: "2026-10-16" },
        housing: NO_HOUSING,
      }),
    );
    const paydays = datesOf(events, "profile_paycheck");

    expect(paydays.slice(0, 3)).toEqual(["2026-10-16", "2026-10-23", "2026-10-30"]);
    // 2026-10-16 through 2027-01-08 inside the 90-day window ending 2027-01-10.
    expect(paydays).toHaveLength(13);
    expect(paydays.at(-1)).toBe("2027-01-08");
    expect(events.every((event) => event.direction === "income" ? event.amount === 800 : true)).toBe(true);
  });

  it("repeats a biweekly paycheck every 14 days", () => {
    const paydays = datesOf(
      eventsFor(makeProfile({ housing: NO_HOUSING })),
      "profile_paycheck",
    );

    expect(paydays).toEqual([
      "2026-10-16",
      "2026-10-30",
      "2026-11-13",
      "2026-11-27",
      "2026-12-11",
      "2026-12-25",
      "2027-01-08",
    ]);
  });

  it("pays twice a month on both chosen days, using the last day of short months", () => {
    const events = eventsFor(
      makeProfile({
        income: { frequency: "semimonthly", paycheckAmountCents: 120_000, semimonthlyPaydays: [15, 31] },
        housing: NO_HOUSING,
      }),
    );
    const paydays = events
      .filter((event) => event.direction === "income")
      .map((event) => event.date);

    expect(paydays).toEqual([
      "2026-10-15",
      "2026-10-31",
      "2026-11-15",
      "2026-11-30",
      "2026-12-15",
      "2026-12-31",
    ]);
  });

  it("adds nothing for no regular income", () => {
    const profile = makeProfile({ income: NO_INCOME });
    const dataset = profileToDataset(profile);

    expect(dataset.incomeSources).toEqual([]);
    expect(eventsFor(profile).filter((event) => event.direction === "income")).toEqual([]);
  });

  it("adds irregular income only as the payments the user listed, marked estimated", () => {
    const events = eventsFor(
      makeProfile({
        income: {
          frequency: "irregular",
          paycheckAmountCents: 0,
          expectedPayments: [
            { id: "p1", date: "2026-10-28", amountCents: 45_000 },
            { id: "p2", date: "2026-12-02", amountCents: 30_050 },
          ],
        },
      }),
    );
    const income = events.filter((event) => event.direction === "income");

    expect(income.map(({ date, amount, confidence }) => ({ date, amount, confidence }))).toEqual([
      { date: "2026-10-28", amount: 450, confidence: "estimated" },
      { date: "2026-12-02", amount: 300.5, confidence: "estimated" },
    ]);
  });
});

describe("monthly bills late in the month", () => {
  // A window that includes February.
  const profile = (dueDay: 29 | 30 | 31) =>
    makeProfile({
      account: { balanceCents: 100_000, currency: "USD", balanceAsOf: "2027-01-20" },
      income: NO_INCOME,
      housing: NO_HOUSING,
      recurringBills: [
        { id: "late", name: "Late bill", category: "utilities", amountCents: 5_000, frequency: "monthly", dueDay },
      ],
    });

  it.each([
    [29, ["2027-01-29", "2027-02-28", "2027-03-29"]],
    [30, ["2027-01-30", "2027-02-28", "2027-03-30"]],
    [31, ["2027-01-31", "2027-02-28", "2027-03-31"]],
  ] as const)("a bill due on the %ith falls on the last day of February", (dueDay, expected) => {
    expect(datesOf(eventsFor(profile(dueDay)), "profile_bill_late")).toEqual(expected);
  });

  it("returns to the 31st after a short month", () => {
    const withLongWindow = makeProfile({
      income: NO_INCOME,
      housing: NO_HOUSING,
      recurringBills: [
        { id: "late", name: "Late bill", category: "utilities", amountCents: 5_000, frequency: "monthly", dueDay: 31 },
      ],
    });

    expect(datesOf(eventsFor(withLongWindow), "profile_bill_late")).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("schedules a twice-monthly bill on both days", () => {
    const events = eventsFor(
      makeProfile({
        income: NO_INCOME,
        housing: NO_HOUSING,
        recurringBills: [
          { id: "loan", name: "Loan", category: "student_loans", amountCents: 10_000, frequency: "semimonthly", dueDays: [1, 30] },
        ],
      }),
      60,
    );

    expect(events.map((event) => event.date)).toEqual([
      "2026-10-30",
      "2026-11-01",
      "2026-11-30",
      "2026-12-01",
    ]);
  });
});

describe("housing and bills", () => {
  it("adds rent exactly once a month", () => {
    const events = eventsFor(makeProfile({ income: NO_INCOME }));

    expect(datesOf(events, HOUSING_BILL_ID)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(events.filter((event) => event.category === "Housing")).toHaveLength(3);
  });

  it("adds no housing bill when the user pays no rent or mortgage", () => {
    const dataset = profileToDataset(makeProfile({ housing: NO_HOUSING }));

    expect(dataset.bills.some((bill) => bill.category === "Housing")).toBe(false);
    expect(profileSpendingEstimates(makeProfile({ housing: NO_HOUSING }))).toEqual([]);
  });

  it("places one-time bills on their date only", () => {
    const events = eventsFor(
      makeProfile({
        income: NO_INCOME,
        housing: NO_HOUSING,
        recurringBills: [
          { id: "car", name: "Car repair", category: "car_payment", amountCents: 42_000, frequency: "one_time", nextDueDate: "2026-11-03" },
        ],
      }),
    );

    expect(events.map(({ date, amount, category }) => ({ date, amount, category }))).toEqual([
      { date: "2026-11-03", amount: 420, category: "Transportation" },
    ]);
  });
});

describe("estimated spending", () => {
  it("adds everyday spending once, as a weekly estimate equal to the monthly total", () => {
    const profile = makeProfile({
      income: NO_INCOME,
      housing: NO_HOUSING,
      variableSpending: {
        period: "weekly",
        amountsCents: { groceries: 8_000, transportation: 2_000, dining: 0, shopping: 0, entertainment: 0, personal_care: 0, other: 0 },
      },
    });
    const { bills } = profileToDataset(profile);

    expect(bills.find((candidate) => candidate.id === ESSENTIAL_SPENDING_BILL_ID)).toMatchObject({
      amount: 100,
      cadence: "weekly",
      confidence: "estimated",
      spendingKind: "essential",
    });
    // Nothing discretionary was entered, so there is no second estimate.
    expect(bills.some((candidate) => candidate.id === DISCRETIONARY_SPENDING_BILL_ID)).toBe(false);
    // Four weekly estimates in the first 30 days, not five.
    expect(datesOf(eventsFor(profile, 30), ESSENTIAL_SPENDING_BILL_ID)).toHaveLength(4);
  });

  it("separates essential from discretionary spending without changing the total", () => {
    const { bills } = profileToDataset(
      makeProfile({
        variableSpending: {
          period: "weekly",
          amountsCents: { groceries: 8_000, transportation: 2_000, dining: 3_000, shopping: 1_500, entertainment: 500, personal_care: 0, other: 0 },
        },
      }),
    );
    const essential = bills.find((bill) => bill.id === ESSENTIAL_SPENDING_BILL_ID);
    const discretionary = bills.find((bill) => bill.id === DISCRETIONARY_SPENDING_BILL_ID);

    expect(essential).toMatchObject({ amount: 100, spendingKind: "essential" });
    expect(discretionary).toMatchObject({ amount: 50, spendingKind: "discretionary" });
  });

  it("adds the unexpected-expense allowance only when the user includes it", () => {
    const withAllowance = profileToDataset(makeProfile({ emergencies: { enabled: true } }));
    const without = profileToDataset(makeProfile({ emergencies: { enabled: false } }));

    expect(withAllowance.bills.find((bill) => bill.id === EMERGENCY_ALLOWANCE_BILL_ID)).toMatchObject({
      amount: 34.62,
      cadence: "weekly",
      confidence: "estimated",
      spendingKind: "unexpected",
    });
    expect(without.bills.some((bill) => bill.id === EMERGENCY_ALLOWANCE_BILL_ID)).toBe(false);
  });

  it("summarises monthly spending by category from the answers", () => {
    const estimates = profileSpendingEstimates(
      makeProfile({
        recurringBills: [
          { id: "phone", name: "Phone", category: "phone", amountCents: 6_000, frequency: "monthly", dueDay: 8 },
          { id: "power", name: "Power", category: "utilities", amountCents: 9_000, frequency: "monthly", dueDay: 14 },
          { id: "trip", name: "Trip", category: "other", amountCents: 50_000, frequency: "one_time", nextDueDate: "2026-11-01" },
        ],
        variableSpending: {
          period: "monthly",
          amountsCents: { groceries: 30_000, transportation: 0, dining: 10_000, shopping: 0, entertainment: 0, personal_care: 0, other: 0 },
        },
      }),
    );

    expect(estimates).toEqual([
      { category: "Housing", monthlyAmount: 1200 },
      { category: "Food", monthlyAmount: 400 },
      { category: "Utilities", monthlyAmount: 150 },
    ]);
  });
});

describe("profile datasets", () => {
  it("never mixes in the demo's transactions or identity", () => {
    const dataset = profileToDataset(makeProfile());

    expect(dataset.source).toBe("user_entered");
    expect(dataset.transactions).toEqual([]);
    expect(dataset.accounts).toHaveLength(1);
    expect(dataset.accounts[0]).toMatchObject({ id: PERSONAL_ACCOUNT_ID, currentBalance: 2000, mask: null });
    expect(dataset.user).toMatchObject({ name: null, email: null });
    expect(dataset.referenceDate).toBe(TODAY);
    expect(
      [...dataset.bills, ...dataset.incomeSources, ...dataset.oneOffEvents].every(
        (item) => item.accountId === PERSONAL_ACCOUNT_ID,
      ),
    ).toBe(true);
  });

  it("changes its key whenever an answer that affects the dashboard changes", () => {
    const base = makeProfile();
    const keys = new Set([
      profileDatasetKey(base),
      profileDatasetKey({ ...base, account: { ...base.account, balanceCents: 1 } }),
      profileDatasetKey({ ...base, housing: { amountCents: 99_000, dueDay: 1 } }),
      profileDatasetKey({ ...base, emergencies: { enabled: true } }),
    ]);

    expect(keys.size).toBe(4);
  });

  it("keeps its key when only preferences or timestamps change", () => {
    const base = makeProfile();

    expect(
      profileDatasetKey({
        ...base,
        preferences: { ...base.preferences, protectedMinimumCents: 0 },
        updatedAt: "2026-10-13T00:00:00.000Z",
      }),
    ).toBe(profileDatasetKey(base));
  });

  it("feeds edited answers straight through to the dashboard figures", async () => {
    const before = makeProfile();
    const after = makeProfile({
      account: { ...before.account, balanceCents: 350_000 },
      housing: { amountCents: 0, dueDay: null },
    });
    const request = {
      accountId: PERSONAL_ACCOUNT_ID,
      referenceDate: TODAY,
      protectedBalance: 300,
    };

    const original = await getFinancialService(profileToDataset(before)).getFinancialSummary(request);
    const edited = await getFinancialService(profileToDataset(after)).getFinancialSummary(request);

    expect(original.currentBalance).toBe(2000);
    expect(edited.currentBalance).toBe(3500);
    // Rent on Nov 1 falls inside the 30-day window before the edit only.
    expect(original.upcomingBillsTotal).toBe(1200);
    expect(edited.upcomingBillsTotal).toBe(0);
  });

  it("serves estimate-based spending when there is no transaction history", async () => {
    const dataset = profileToDataset(
      makeProfile({
        variableSpending: {
          period: "monthly",
          amountsCents: { groceries: 30_000, transportation: 0, dining: 0, shopping: 0, entertainment: 0, personal_care: 0, other: 0 },
        },
      }),
    );
    const service = getFinancialService(dataset);
    const spending = await service.getSpendingSummary({
      accountId: PERSONAL_ACCOUNT_ID,
      referenceDate: TODAY,
      periodDays: 30,
    });

    expect(await service.getTransactions()).toEqual([]);
    expect(spending.basis).toBe("estimates");
    expect(spending.transactionCount).toBe(0);
    // Rent plus groceries.
    expect(spending.total).toBe(1500);
  });
});
