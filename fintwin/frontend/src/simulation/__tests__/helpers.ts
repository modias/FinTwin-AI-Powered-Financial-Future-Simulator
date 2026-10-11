import { buildSimulationInput, type SimulationInputOptions } from "@/simulation/timeline";
import type { FinancialScenario, SimulationInput } from "@/simulation/types";
import type {
  Bill,
  Cadence,
  CashFlowEvent,
  FinancialDataset,
  IncomeSource,
  Transaction,
} from "@/types/financial";

export const REFERENCE_DATE = "2026-10-12";
export const ACCOUNT_ID = "acc_test";

export function bill(
  id: string,
  amount: number,
  anchorDate: string,
  cadence: Cadence = "monthly",
  extra: Partial<Bill> = {},
): Bill {
  return {
    id,
    accountId: ACCOUNT_ID,
    name: id,
    category: "Utilities",
    amount,
    cadence,
    anchorDate,
    confidence: "scheduled",
    autoPay: true,
    ...extra,
  };
}

export function paycheck(
  id: string,
  amount: number,
  anchorDate: string,
  cadence: Cadence = "biweekly",
): IncomeSource {
  return {
    id,
    accountId: ACCOUNT_ID,
    name: id,
    payer: "Employer",
    amount,
    cadence,
    anchorDate,
    confidence: "scheduled",
  };
}

/** A hand-built single-account dataset, amounts in dollars like the domain types. */
export function makeDataset({
  balance = 2_000,
  bills = [],
  income = [],
  oneOff = [],
  transactions = [],
  referenceDate = REFERENCE_DATE,
}: {
  balance?: number;
  bills?: Bill[];
  income?: IncomeSource[];
  oneOff?: CashFlowEvent[];
  transactions?: Transaction[];
  referenceDate?: string;
} = {}): FinancialDataset {
  return {
    key: `test:${referenceDate}`,
    source: "user_entered",
    referenceDate,
    user: {
      id: "user_test",
      name: null,
      email: null,
      initials: null,
      accountType: "checking",
      primaryAccountId: ACCOUNT_ID,
    },
    accounts: [
      {
        id: ACCOUNT_ID,
        name: "Checking",
        institution: "Test",
        type: "checking",
        mask: null,
        currentBalance: balance,
        currency: "USD",
        isPrimary: true,
      },
    ],
    transactions,
    bills,
    incomeSources: income,
    oneOffEvents: oneOff,
    spendingEstimates: null,
  };
}

export function makeInput(
  dataset: FinancialDataset,
  options: Partial<Omit<SimulationInputOptions, "dataset">> = {},
): SimulationInput {
  return buildSimulationInput({
    dataset,
    accountId: dataset.user.primaryAccountId,
    protectedMinimumCents: 30_000,
    targetConfidence: 0.95,
    horizonDays: 30,
    emergenciesEnabled: false,
    pathCount: 2_000,
    ...options,
  });
}

export function purchase(
  amountCents: number,
  effectiveDate: string,
  overrides: Partial<FinancialScenario> = {},
): FinancialScenario {
  return {
    id: `purchase_${amountCents}_${effectiveDate}`,
    type: "one_time_purchase",
    amountCents,
    effectiveDate,
    frequency: null,
    description: "Purchase",
    ...overrides,
  };
}
