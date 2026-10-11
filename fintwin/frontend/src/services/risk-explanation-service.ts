/**
 * Asks the FastAPI backend to have Gemini explain the current safety score,
 * or how one what-if changes it.
 *
 * The payloads are built only from finished results and the `SimulationInput`
 * they were computed from. Nothing is re-simulated here, and the Gemini key
 * stays in `backend/.env`.
 */

import { API_BASE_URL } from "@/lib/constants";
import { SCENARIO_LABELS } from "@/simulation/scenarios";
import type {
  FinancialScenario,
  SafeToSpendResult,
  ScenarioResult,
  SimulationInput,
  SimulationResult,
} from "@/simulation/types";

const MAX_LISTED_BILLS = 10;
const MAX_WARNINGS = 6;

export interface RiskFactor {
  title: string;
  detail: string;
}

export interface RiskExplanation {
  summary: string;
  factors: RiskFactor[];
}

export interface RiskExplanationRequest {
  safetyProbability: number;
  breachProbability: number;
  endingAboveMinimumProbability: number;
  horizonDays: number;
  referenceDate: string;
  pathCount: number;
  safePaths: number;
  protectedMinimumCents: number;
  openingBalanceCents: number;
  targetConfidence: number;
  nextIncome: {
    name: string;
    date: string;
    amountCents: number;
    confidence: "scheduled" | "estimated";
  } | null;
  upcomingBills: { name: string; amountCents: number; date: string; category: string }[];
  upcomingBillsComplete: boolean;
  scheduledBillsTotalCents: number;
  scheduledBillsCount: number;
  billsBeforeNextPaycheck: { count: number; totalCents: number } | null;
  everydaySpending: {
    expectedCents: number;
    p10Cents: number;
    p90Cents: number;
    essentialExpectedCents: number;
    discretionaryExpectedCents: number;
    essentialBasis: "transaction_history" | "fallback";
    discretionaryBasis: "transaction_history" | "fallback";
  };
  emergencies: {
    eventsPerYear: number;
    meanCostCents: number;
    maxCostCents: number;
    probabilityOfAny: number;
    breachWithAny: number | null;
    breachWithNone: number | null;
  } | null;
  tightestDay: { date: string; p10Cents: number; p50Cents: number };
  medianFirstBreach: { date: string; dayIndex: number } | null;
  medianShortfallCents: number | null;
  minimumBalanceP5Cents: number;
  medianMinimumBalanceCents: number;
  warnings: string[];
}

export class RiskExplanationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RiskExplanationError";
    this.status = status;
  }
}

export function buildRiskExplanationRequest(
  input: SimulationInput,
  result: SimulationResult,
): RiskExplanationRequest {
  const { safety, risk, totals, spendingModel } = result;
  const bills = [...input.scheduledBills].sort((a, b) => a.dayIndex - b.dayIndex);
  const income = input.scheduledIncome[0] ?? null;
  const billsBeforeIncome = income ? bills.filter((bill) => bill.date < income.date) : [];

  return {
    safetyProbability: safety.safetyProbability,
    breachProbability: safety.breachProbability,
    endingAboveMinimumProbability: safety.endingAboveMinimumProbability,
    horizonDays: result.horizonDays,
    referenceDate: result.referenceDate,
    pathCount: safety.pathCount,
    safePaths: safety.safePaths,
    protectedMinimumCents: Math.round(result.protectedMinimumCents),
    openingBalanceCents: Math.round(result.openingBalanceCents),
    targetConfidence: result.targetConfidence,
    nextIncome: income
      ? {
          name: income.name.slice(0, 80),
          date: income.date,
          amountCents: Math.round(income.amountCents),
          confidence: income.confidence,
        }
      : null,
    upcomingBills: bills.slice(0, MAX_LISTED_BILLS).map((bill) => ({
      name: bill.name.slice(0, 80),
      amountCents: Math.round(bill.amountCents),
      date: bill.date,
      category: bill.category.slice(0, 40),
    })),
    upcomingBillsComplete: bills.length <= MAX_LISTED_BILLS,
    scheduledBillsTotalCents: Math.round(totals.scheduledBillsCents),
    scheduledBillsCount: totals.scheduledBillsCount,
    billsBeforeNextPaycheck:
      billsBeforeIncome.length > 0
        ? {
            count: billsBeforeIncome.length,
            totalCents: Math.round(
              billsBeforeIncome.reduce((total, bill) => total + bill.amountCents, 0),
            ),
          }
        : null,
    everydaySpending: {
      expectedCents: Math.round(risk.variableSpending.expectedCents),
      p10Cents: Math.round(risk.variableSpending.p10Cents),
      p90Cents: Math.round(risk.variableSpending.p90Cents),
      essentialExpectedCents: Math.round(totals.expectedEssentialCents),
      discretionaryExpectedCents: Math.round(totals.expectedDiscretionaryCents),
      essentialBasis: spendingModel.essential.basis,
      discretionaryBasis: spendingModel.discretionary.basis,
    },
    emergencies:
      result.emergencies && risk.emergencies
        ? {
            eventsPerYear: result.emergencies.eventsPerYear,
            meanCostCents: Math.round(result.emergencies.meanCostCents),
            maxCostCents: Math.round(result.emergencies.maxCostCents),
            probabilityOfAny: risk.emergencies.probabilityOfAny,
            breachWithAny: risk.emergencies.breachWithAny,
            breachWithNone: risk.emergencies.breachWithNone,
          }
        : null,
    tightestDay: {
      date: risk.tightestDay.date,
      p10Cents: Math.round(risk.tightestDay.p10Cents),
      p50Cents: Math.round(risk.tightestDay.p50Cents),
    },
    medianFirstBreach: risk.medianFirstBreach,
    medianShortfallCents: risk.medianShortfallCents,
    minimumBalanceP5Cents: risk.minimumBalanceP5Cents,
    medianMinimumBalanceCents: risk.medianMinimumBalanceCents,
    warnings: result.warnings.slice(0, MAX_WARNINGS).map((warning) => warning.message),
  };
}

interface OutcomeFact {
  safetyProbability: number;
  breachProbability: number;
  meetsTarget: boolean;
  /** `null` when nothing can be spent today while meeting the target. */
  safeToSpendCents: number | null;
  medianEndingBalanceCents: number;
  minimumBalanceP5Cents: number;
  tightestDay: { date: string; p10Cents: number };
}

export interface ScenarioExplanationRequest {
  scenario: {
    type: FinancialScenario["type"];
    description: string;
    amountCents: number;
    effectiveDate: string;
    frequency: FinancialScenario["frequency"];
    netChangeCents: number;
    cashFlowCount: number;
  };
  referenceDate: string;
  horizonDays: number;
  pathCount: number;
  protectedMinimumCents: number;
  targetConfidence: number;
  openingBalanceCents: number;
  before: OutcomeFact;
  after: OutcomeFact;
  safetyChangePoints: number;
  changeDay: {
    beforeP10Cents: number;
    beforeP50Cents: number;
    afterP10Cents: number;
    afterP50Cents: number;
  } | null;
  nextIncomeAfterChange: RiskExplanationRequest["nextIncome"];
  billsAfterChange: {
    count: number;
    totalCents: number;
    bills: RiskExplanationRequest["upcomingBills"];
    until: "next_paycheck" | "forecast_end";
  };
  spendingUsesDefaults: boolean;
  emergenciesIncluded: boolean;
  warnings: string[];
}

const MAX_BILLS_AFTER_CHANGE = 6;

function safeToSpendCents(result: SafeToSpendResult): number | null {
  return result.status === "meets_target" ? Math.round(result.amountCents) : null;
}

/**
 * Facts for explaining one what-if against the baseline it was compared with.
 * Both sides come from the same simulated paths; nothing is re-simulated here.
 */
export function buildScenarioExplanationRequest(
  input: SimulationInput,
  baseline: SimulationResult,
  result: ScenarioResult,
): ScenarioExplanationRequest {
  const { scenario } = result;
  const changeDate = scenario.effectiveDate;
  const beforeDay = baseline.forecast.find((band) => band.date === changeDate);
  const afterDay = result.forecast.find((band) => band.date === changeDate);
  const income =
    [...input.scheduledIncome]
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .find((event) => event.date >= changeDate) ?? null;
  const bills = [...input.scheduledBills]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .filter((bill) => bill.date >= changeDate && (!income || bill.date < income.date));
  const { essential, discretionary } = baseline.spendingModel;

  return {
    scenario: {
      type: scenario.type,
      description: (scenario.description.trim() || SCENARIO_LABELS[scenario.type]).slice(0, 80),
      amountCents: Math.round(scenario.amountCents),
      effectiveDate: changeDate,
      frequency: scenario.frequency,
      netChangeCents: Math.round(result.netChangeCents),
      cashFlowCount: result.cashFlows.length,
    },
    referenceDate: baseline.referenceDate,
    horizonDays: baseline.horizonDays,
    pathCount: baseline.pathCount,
    protectedMinimumCents: Math.round(baseline.protectedMinimumCents),
    targetConfidence: baseline.targetConfidence,
    openingBalanceCents: Math.round(baseline.openingBalanceCents),
    before: {
      safetyProbability: baseline.safety.safetyProbability,
      breachProbability: baseline.safety.breachProbability,
      meetsTarget: baseline.safety.safePaths >= baseline.safeToSpend.requiredSafePaths,
      safeToSpendCents: safeToSpendCents(baseline.safeToSpend),
      medianEndingBalanceCents: Math.round(baseline.risk.medianEndingBalanceCents),
      minimumBalanceP5Cents: Math.round(baseline.risk.minimumBalanceP5Cents),
      tightestDay: {
        date: baseline.risk.tightestDay.date,
        p10Cents: Math.round(baseline.risk.tightestDay.p10Cents),
      },
    },
    after: {
      safetyProbability: result.safety.safetyProbability,
      breachProbability: result.safety.breachProbability,
      meetsTarget: result.meetsTarget,
      safeToSpendCents: safeToSpendCents(result.safeToSpendAfter),
      medianEndingBalanceCents: Math.round(result.medianEndingBalanceCents),
      minimumBalanceP5Cents: Math.round(result.minimumBalanceP5Cents),
      tightestDay: {
        date: result.tightestDay.date,
        p10Cents: Math.round(result.tightestDay.p10Cents),
      },
    },
    safetyChangePoints: result.safetyChangePoints,
    changeDay:
      beforeDay && afterDay
        ? {
            beforeP10Cents: Math.round(beforeDay.p10Cents),
            beforeP50Cents: Math.round(beforeDay.p50Cents),
            afterP10Cents: Math.round(afterDay.p10Cents),
            afterP50Cents: Math.round(afterDay.p50Cents),
          }
        : null,
    nextIncomeAfterChange: income
      ? {
          name: income.name.slice(0, 80),
          date: income.date,
          amountCents: Math.round(income.amountCents),
          confidence: income.confidence,
        }
      : null,
    billsAfterChange: {
      count: bills.length,
      totalCents: Math.round(bills.reduce((total, bill) => total + bill.amountCents, 0)),
      bills: bills.slice(0, MAX_BILLS_AFTER_CHANGE).map((bill) => ({
        name: bill.name.slice(0, 80),
        amountCents: Math.round(bill.amountCents),
        date: bill.date,
        category: bill.category.slice(0, 40),
      })),
      until: income ? "next_paycheck" : "forecast_end",
    },
    spendingUsesDefaults: essential.basis === "fallback" || discretionary.basis === "fallback",
    emergenciesIncluded: baseline.emergencies !== null,
    warnings: result.warnings.slice(0, MAX_WARNINGS),
  };
}

export function explainRisk(
  payload: RiskExplanationRequest,
  signal?: AbortSignal,
): Promise<RiskExplanation> {
  return requestExplanation("/api/ai/explain-risk", payload, signal);
}

export function explainScenario(
  payload: ScenarioExplanationRequest,
  signal?: AbortSignal,
): Promise<RiskExplanation> {
  return requestExplanation("/api/ai/explain-scenario", payload, signal);
}

async function requestExplanation(
  path: string,
  payload: RiskExplanationRequest | ScenarioExplanationRequest,
  signal?: AbortSignal,
): Promise<RiskExplanation> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;

    throw new RiskExplanationError(
      "Couldn't reach the FinTwin backend for an explanation. Your safety score is unchanged.",
      0,
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : "The explanation isn't available right now. Your safety score is unchanged.";

    throw new RiskExplanationError(detail, response.status);
  }

  return response.json() as Promise<RiskExplanation>;
}
