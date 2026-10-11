/**
 * Types for the Monte Carlo engine.
 *
 * Money is integer cents throughout, dates are `YYYY-MM-DD` calendar days and
 * days are counted from the reference date: day 0 is the day the opening
 * balance was recorded, day `horizonDays` is the last simulated day.
 */

import type {
  EventConfidence,
  ForecastHorizon,
  TransactionCategory,
} from "@/types/financial";

/** Kinds of variable spending the engine draws at random. */
export type VariableSpendingKind = "essential" | "discretionary";

/** A known, dated movement on the canonical timeline. Identical on every path. */
export interface TimelineEvent {
  id: string;
  /** The bill, income source or one-off event this occurrence came from. */
  sourceId: string;
  name: string;
  category: TransactionCategory;
  date: string;
  dayIndex: number;
  /** Always positive; see `direction`. */
  amountCents: number;
  direction: "income" | "expense";
  /** `estimated` income (an expected invoice) is still applied as dated. */
  confidence: EventConfidence;
  /** Generated from a recurring bill or income source rather than a one-off. */
  recurring: boolean;
}

/**
 * One estimated spending occurrence. Its expected amount comes from the
 * timeline (the user's estimate) or from history; each path draws its own
 * amount around that expectation.
 */
export interface VariableSpendingOccurrence {
  id: string;
  sourceId: string;
  name: string;
  date: string;
  dayIndex: number;
  kind: VariableSpendingKind;
  expectedCents: number;
  /** Coefficient of variation of this occurrence's amount. */
  variation: number;
  /** Where the expected amount comes from. */
  basis: "estimate" | "transaction_history";
}

/** How one kind of variable spending is modelled. */
export interface SpendingKindAssumptions {
  kind: VariableSpendingKind;
  /** `transaction_history` when enough history was measured, otherwise `fallback`. */
  basis: "transaction_history" | "fallback";
  /** Coefficient of variation of one week of spending. */
  weeklyVariation: number;
  /**
   * Coefficient of variation of a per-path factor that scales every
   * occurrence of this kind: how far the typical level itself may be off.
   */
  levelVariation: number;
  /** What was measured, when `basis` is `transaction_history`. */
  history: {
    weeks: number;
    transactions: number;
    weeklyMeanCents: number;
  } | null;
}

export interface SpendingModel {
  /** Amounts are lognormal: never negative, skewed towards overspending. */
  distribution: "lognormal";
  essential: SpendingKindAssumptions;
  discretionary: SpendingKindAssumptions;
}

/** Assumptions for randomly occurring unexpected expenses. Not facts about the user. */
export interface EmergencyAssumptions {
  basis: "assumption";
  /** Average number per year; arrivals are a Poisson process. */
  eventsPerYear: number;
  /** Mean cost of one emergency. */
  meanCostCents: number;
  /** Coefficient of variation of the lognormal cost. */
  costVariation: number;
  /** Costs are capped here, which bounds the tail. */
  maxCostCents: number;
}

export type ModelWarningCode =
  | "limited_history"
  | "below_minimum_today"
  | "no_income_in_horizon"
  | "estimated_income";

export interface ModelWarning {
  code: ModelWarningCode;
  message: string;
}

/**
 * Everything one simulation needs. Built by `buildSimulationInput` from the
 * active dataset and preferences; plain data, so it can cross to the worker.
 */
export interface SimulationInput {
  /** Fingerprint of every field below. Results carry it to detect staleness. */
  fingerprint: string;
  /**
   * Fingerprint of the fields that shape the random paths. The protected
   * minimum and target do not, so changing them reuses cached paths.
   */
  pathsKey: string;
  datasetKey: string;
  dataSource: "demo" | "user_entered";
  accountId: string;
  referenceDate: string;
  horizonDays: ForecastHorizon;
  openingBalanceCents: number;
  protectedMinimumCents: number;
  /** Required share of safe paths, as a fraction: 0.9, 0.95 or 0.99. */
  targetConfidence: number;
  pathCount: number;
  seed: number;
  scheduledIncome: TimelineEvent[];
  scheduledBills: TimelineEvent[];
  variableSpending: VariableSpendingOccurrence[];
  spendingModel: SpendingModel;
  /** `null` when the user leaves unexpected expenses out. */
  emergencies: EmergencyAssumptions | null;
  warnings: ModelWarning[];
}

/**
 * The simulated paths, kept where they were computed (the worker) so
 * scenarios can be applied to them without drawing new random numbers.
 */
export interface SimulatedPaths {
  pathCount: number;
  /** `horizonDays + 1`. */
  dayCount: number;
  openingBalanceCents: number;
  /**
   * Closing balance of every path on every day, day-major:
   * `closing[day * pathCount + path]`. Day 0 is the opening balance.
   */
  closing: Float64Array;
  /** Total variable spending drawn on each path. */
  variableSpendingTotal: Float64Array;
  /** Total unexpected expenses drawn on each path. */
  emergencyTotal: Float64Array;
  emergencyCount: Uint16Array;
}

export interface SafetyMetrics {
  /** Paths that never fell below the protected minimum at any checkpoint. */
  safePaths: number;
  pathCount: number;
  /** `safePaths / pathCount`. */
  safetyProbability: number;
  /** `1 − safetyProbability`. */
  breachProbability: number;
  /**
   * Share of paths that merely *end* at or above the minimum. Always at least
   * the safety probability; shown only to explain why the two differ.
   */
  endingAboveMinimumProbability: number;
}

/** Daily percentiles across paths. The 10th–90th band is the middle 80% of balances. */
export interface ForecastBand {
  date: string;
  dayIndex: number;
  p10Cents: number;
  p50Cents: number;
  p90Cents: number;
  /** The deterministic schedule for the day, for context. */
  scheduledIncomeCents: number;
  scheduledBillsCents: number;
  /** Expected (not sampled) variable spending for the day. */
  expectedSpendingCents: number;
  /** Cash moved by a hypothetical scenario on this day; `0` for the baseline. */
  scenarioCents: number;
}

export type SafeToSpendStatus =
  | "meets_target"
  | "baseline_below_target"
  | "below_minimum_today";

export interface SafeToSpendResult {
  /** The largest immediate purchase that keeps the target. Never negative. */
  amountCents: number;
  status: SafeToSpendStatus;
  protectedMinimumCents: number;
  targetConfidence: number;
  /** Safety with nothing extra spent. */
  baselineSafetyProbability: number;
  /** Safety after spending `amountCents` today, verified on the same paths. */
  safetyAtAmount: number;
  /** Paths that must stay safe: `ceil(target × pathCount)`. */
  requiredSafePaths: number;
  /** What capped the amount. */
  limitedBy: "safety_target" | "available_balance" | "baseline";
  warning: string | null;
}

export interface RiskDriver {
  id: string;
  title: string;
  detail: string;
  /** Where the figure comes from, so the UI can label it. */
  source: "scheduled" | "estimated" | "simulated" | "assumption";
  tone: "neutral" | "caution" | "risk";
}

export interface RiskMetrics {
  medianEndingBalanceCents: number;
  /** 5th percentile of each path's lowest balance. */
  minimumBalanceP5Cents: number;
  medianMinimumBalanceCents: number;
  /** The day the 10th-percentile balance is lowest. */
  tightestDay: { date: string; p10Cents: number; p50Cents: number };
  /** Median day the first breach happened, among paths that breach. */
  medianFirstBreach: { date: string; dayIndex: number } | null;
  /** Median depth below the minimum among paths that breach. */
  medianShortfallCents: number | null;
  variableSpending: { expectedCents: number; p10Cents: number; p90Cents: number };
  emergencies: {
    /** Share of paths with at least one unexpected expense. */
    probabilityOfAny: number;
    /** Breach rates among paths with and without one. */
    breachWithAny: number | null;
    breachWithNone: number | null;
  } | null;
  drivers: RiskDriver[];
}

export interface TimelineTotals {
  scheduledIncomeCents: number;
  scheduledIncomeCount: number;
  scheduledBillsCents: number;
  scheduledBillsCount: number;
  expectedEssentialCents: number;
  expectedDiscretionaryCents: number;
  nextIncome: { date: string; amountCents: number } | null;
}

export interface SimulationResult {
  /** The `SimulationInput.fingerprint` this was computed from. */
  inputFingerprint: string;
  pathsKey: string;
  pathCount: number;
  seed: number;
  referenceDate: string;
  horizonDays: number;
  openingBalanceCents: number;
  protectedMinimumCents: number;
  targetConfidence: number;
  safety: SafetyMetrics;
  safeToSpend: SafeToSpendResult;
  forecast: ForecastBand[];
  risk: RiskMetrics;
  totals: TimelineTotals;
  spendingModel: SpendingModel;
  emergencies: EmergencyAssumptions | null;
  warnings: ModelWarning[];
}

export const SCENARIO_TYPES = [
  "one_time_purchase",
  "delayed_purchase",
  "recurring_expense",
  "emergency_expense",
  "income_increase",
  "income_decrease",
  "rent_increase",
  "rent_decrease",
] as const;

export type ScenarioType = (typeof SCENARIO_TYPES)[number];

export const SCENARIO_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

export type ScenarioFrequency = (typeof SCENARIO_FREQUENCIES)[number];

/** A hypothetical change to test against the baseline. */
export interface FinancialScenario {
  id: string;
  type: ScenarioType;
  /** Positive. Income and rent changes are per paycheck or per payment. */
  amountCents: number;
  /** First day the change applies. */
  effectiveDate: string;
  /** Required for `recurring_expense`, otherwise `null`. */
  frequency: ScenarioFrequency | null;
  description: string;
}

export interface ScenarioCashFlow {
  date: string;
  dayIndex: number;
  /** Signed: negative takes money out of the account. */
  amountCents: number;
}

export interface ScenarioResult {
  scenario: FinancialScenario;
  cashFlows: ScenarioCashFlow[];
  netChangeCents: number;
  safety: SafetyMetrics;
  /** Percentage points: `(scenario − baseline) × 100`. */
  safetyChangePoints: number;
  meetsTarget: boolean;
  /** Safe-to-spend that would remain after this change. */
  safeToSpendAfter: SafeToSpendResult;
  medianEndingBalanceCents: number;
  minimumBalanceP5Cents: number;
  tightestDay: { date: string; p10Cents: number };
  forecast: ForecastBand[];
  warnings: string[];
}

export interface ScenarioComparison {
  inputFingerprint: string;
  pathsKey: string;
  baseline: SimulationResult;
  scenarios: ScenarioResult[];
}
