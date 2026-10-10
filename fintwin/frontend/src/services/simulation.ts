/**
 * The integration seam for the Phase 2 Monte Carlo engine.
 *
 * There is no engine yet, so nothing here produces a probability, and the UI
 * shows "Simulation not yet available" rather than inventing one. What exists
 * is the contract the engine will consume:
 *
 *  - `buildSimulationConfig` assembles the engine's input from the same
 *    canonical events the illustrative forecast uses. There is no second
 *    timeline.
 *  - Every config carries a fingerprint of all its inputs. A result records
 *    the fingerprint it was computed from, and `isSimulationResultCurrent`
 *    rejects it as soon as any input — an onboarding answer, a preference,
 *    the selected account — changes. Stale results are never shown.
 *  - A profile without transaction history declares that the engine must use
 *    the disclosed `FALLBACK_VOLATILITY` assumptions instead of learned ones.
 */

import { expandCashFlowEvents, forwardWindow } from "@/lib/calculations";
import { EMERGENCY_ASSUMPTIONS, FALLBACK_VOLATILITY } from "@/lib/constants";
import { fingerprint } from "@/lib/fingerprint";
import type {
  CashFlowEvent,
  FinancialDataset,
  ForecastHorizon,
} from "@/types/financial";

export type VolatilitySource =
  | { kind: "transaction_history"; transactionCount: number }
  | {
      kind: "fallback_assumptions";
      everydaySpendingVariation: number;
      incomeDelayProbability: number;
    };

export interface SimulationConfig {
  /** Fingerprint of every field below. */
  fingerprint: string;
  datasetKey: string;
  accountId: string;
  referenceDate: string;
  startingBalance: number;
  protectedMinimumBalance: number;
  /** Target probability of staying above the minimum, as a fraction. */
  targetConfidence: number;
  horizonDays: ForecastHorizon;
  /** The canonical events across the horizon, identical to the forecast's. */
  events: CashFlowEvent[];
  volatility: VolatilitySource;
  /** `null` when the profile leaves unexpected expenses out. */
  emergencies: { averageCost: number; eventsPerYear: number } | null;
}

export interface SimulationResult {
  /** The `SimulationConfig.fingerprint` this result was computed from. */
  configFingerprint: string;
  completedAt: string;
  /** Share of simulated paths that stayed above the protected minimum. */
  probabilityAboveMinimum: number;
  iterations: number;
}

/** The engine's contract. No implementation exists in Phase 1. */
export interface SimulationEngine {
  run(config: SimulationConfig): Promise<SimulationResult>;
}

export interface SimulationConfigOptions {
  dataset: FinancialDataset;
  accountId: string;
  protectedMinimumBalance: number;
  targetConfidence: number;
  horizonDays: ForecastHorizon;
  /** Whether the profile includes the unexpected-expense allowance. */
  emergenciesEnabled: boolean;
}

export function buildSimulationConfig({
  dataset,
  accountId,
  protectedMinimumBalance,
  targetConfidence,
  horizonDays,
  emergenciesEnabled,
}: SimulationConfigOptions): SimulationConfig {
  const account = dataset.accounts.find((candidate) => candidate.id === accountId);

  if (!account) {
    throw new Error(`Unknown account: ${accountId}`);
  }

  const { start, end } = forwardWindow(dataset.referenceDate, horizonDays);
  const transactionCount = dataset.transactions.filter(
    (transaction) => transaction.accountId === accountId,
  ).length;

  const volatility: VolatilitySource =
    transactionCount > 0
      ? { kind: "transaction_history", transactionCount }
      : { kind: "fallback_assumptions", ...FALLBACK_VOLATILITY };

  const inputs: Omit<SimulationConfig, "fingerprint"> = {
    datasetKey: dataset.key,
    accountId,
    referenceDate: dataset.referenceDate,
    startingBalance: account.currentBalance,
    protectedMinimumBalance,
    targetConfidence,
    horizonDays,
    events: expandCashFlowEvents({
      accountId,
      start,
      end,
      bills: dataset.bills,
      incomeSources: dataset.incomeSources,
      oneOffEvents: dataset.oneOffEvents,
    }),
    volatility,
    emergencies: emergenciesEnabled
      ? {
          averageCost: EMERGENCY_ASSUMPTIONS.averageCostCents / 100,
          eventsPerYear: EMERGENCY_ASSUMPTIONS.eventsPerYear,
        }
      : null,
  };

  return { ...inputs, fingerprint: fingerprint(inputs) };
}

/** `false` whenever any input changed after the result was computed. */
export function isSimulationResultCurrent(
  result: SimulationResult | null | undefined,
  config: SimulationConfig,
): result is SimulationResult {
  return result?.configFingerprint === config.fingerprint;
}
