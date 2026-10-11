/**
 * Builds the engine's input from the canonical cash-flow timeline.
 *
 * The events come from `expandCashFlowEvents` — the same expansion the
 * upcoming-events list uses — so there is exactly one timeline. This module
 * only sorts them into what is fixed and what is random:
 *
 *  - The opening balance is the account's current balance on the reference
 *    date. It already reflects every past transaction; history is never
 *    replayed into it, only used to measure how spending varies.
 *  - Income and `scheduled` expenses are fixed: identical on every path.
 *  - `estimated` expenses become variable spending, drawn per path around
 *    their expected amount. Each one is a single event on the timeline, so
 *    it is counted once.
 *  - The profile's unexpected-expense allowance is dropped; when unexpected
 *    expenses are on, the engine draws them at random instead.
 *  - With enough history and no recurring estimate of a kind (the demo has
 *    no discretionary estimate), a weekly stream measured from history is
 *    added, so known habits are not silently left out.
 *
 * All amounts are converted to integer cents here, once.
 */

import { expandCashFlowEvents, forwardWindow } from "@/lib/calculations";
import { addDays, occurrencesBetween } from "@/lib/dates";
import { fingerprint } from "@/lib/fingerprint";
import { dollarsToCents } from "@/lib/money";
import {
  DEFAULT_PATH_COUNT,
  DEFAULT_SEED,
  EMERGENCY_MODEL,
  ENGINE_VERSION,
  calibrateSpendingModel,
  occurrenceVariation,
  spendingKindOf,
} from "@/simulation/assumptions";
import { PERIOD_DAYS, dayIndexOf } from "@/simulation/recurrence";
import type {
  ModelWarning,
  SimulationInput,
  TimelineEvent,
  VariableSpendingKind,
  VariableSpendingOccurrence,
} from "@/simulation/types";
import type { FinancialDataset, ForecastHorizon } from "@/types/financial";

/** Weekly streams measured from history land mid-week, like the profile's estimates. */
const HISTORY_STREAM_OFFSET_DAYS = 4;

const VARIABLE_KINDS: readonly VariableSpendingKind[] = ["essential", "discretionary"];

export interface SimulationInputOptions {
  dataset: FinancialDataset;
  accountId: string;
  protectedMinimumCents: number;
  /** As a fraction: 0.9, 0.95 or 0.99. */
  targetConfidence: number;
  horizonDays: ForecastHorizon;
  emergenciesEnabled: boolean;
  pathCount?: number;
  seed?: number;
}

/** A 64-bit content key: two independent 32-bit fingerprints. */
function contentKey(value: unknown): string {
  return `${fingerprint(value)}${fingerprint({ salt: "paths", value })}`;
}

export function buildSimulationInput({
  dataset,
  accountId,
  protectedMinimumCents,
  targetConfidence,
  horizonDays,
  emergenciesEnabled,
  pathCount = DEFAULT_PATH_COUNT,
  seed = DEFAULT_SEED,
}: SimulationInputOptions): SimulationInput {
  const account = dataset.accounts.find((candidate) => candidate.id === accountId);

  if (!account) {
    throw new Error(`Unknown account: ${accountId}`);
  }

  const referenceDate = dataset.referenceDate;
  const { start, end } = forwardWindow(referenceDate, horizonDays);
  const recurringSources = new Set([
    ...dataset.bills.map((bill) => bill.id),
    ...dataset.incomeSources.map((source) => source.id),
  ]);
  const billCadence = new Map(dataset.bills.map((bill) => [bill.id, bill.cadence]));
  const spendingModel = calibrateSpendingModel({
    accountId,
    referenceDate,
    transactions: dataset.transactions,
    bills: dataset.bills,
  });

  const scheduledIncome: TimelineEvent[] = [];
  const scheduledBills: TimelineEvent[] = [];
  const variableSpending: VariableSpendingOccurrence[] = [];

  const events = expandCashFlowEvents({
    accountId,
    start,
    end,
    bills: dataset.bills,
    incomeSources: dataset.incomeSources,
    oneOffEvents: dataset.oneOffEvents,
  });

  for (const event of events) {
    const dayIndex = dayIndexOf(referenceDate, event.date);
    const amountCents = dollarsToCents(event.amount);

    if (event.direction === "income" || event.confidence === "scheduled") {
      const fixed: TimelineEvent = {
        id: event.id,
        sourceId: event.sourceId,
        name: event.name,
        category: event.category,
        date: event.date,
        dayIndex,
        amountCents,
        direction: event.direction,
        confidence: event.confidence,
        recurring: recurringSources.has(event.sourceId),
      };

      (event.direction === "income" ? scheduledIncome : scheduledBills).push(fixed);
      continue;
    }

    const kind = spendingKindOf(event);

    // Replaced by randomly drawn emergencies; never counted twice.
    if (kind === "unexpected") continue;

    const cadence = billCadence.get(event.sourceId);

    variableSpending.push({
      id: event.id,
      sourceId: event.sourceId,
      name: event.name,
      date: event.date,
      dayIndex,
      kind,
      expectedCents: amountCents,
      variation: occurrenceVariation(
        spendingModel[kind].weeklyVariation,
        cadence ? PERIOD_DAYS[cadence] : 7,
      ),
      basis: "estimate",
    });
  }

  for (const kind of VARIABLE_KINDS) {
    const { history, weeklyVariation } = spendingModel[kind];
    const hasRecurringEstimate = dataset.bills.some(
      (bill) =>
        bill.accountId === accountId &&
        bill.confidence === "estimated" &&
        spendingKindOf(bill) === kind,
    );

    if (hasRecurringEstimate || !history) continue;

    const sourceId = `history_${kind}_spending`;

    for (const date of occurrencesBetween(
      addDays(referenceDate, HISTORY_STREAM_OFFSET_DAYS),
      "weekly",
      start,
      end,
    )) {
      variableSpending.push({
        id: `${sourceId}@${date}`,
        sourceId,
        name:
          kind === "essential"
            ? "Essential spending (measured from history)"
            : "Discretionary spending (measured from history)",
        date,
        dayIndex: dayIndexOf(referenceDate, date),
        kind,
        expectedCents: history.weeklyMeanCents,
        variation: weeklyVariation,
        basis: "transaction_history",
      });
    }
  }

  variableSpending.sort(
    (a, b) => a.dayIndex - b.dayIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const openingBalanceCents = dollarsToCents(account.currentBalance);
  const emergencies = emergenciesEnabled ? EMERGENCY_MODEL : null;
  const warnings = modelWarnings({
    dataset,
    accountId,
    spendingModel,
    openingBalanceCents,
    protectedMinimumCents,
    scheduledIncome,
    horizonDays,
  });

  const pathsKey = contentKey({
    engine: ENGINE_VERSION,
    accountId,
    referenceDate,
    horizonDays,
    openingBalanceCents,
    scheduledIncome,
    scheduledBills,
    variableSpending,
    spendingModel,
    emergencies,
    pathCount,
    seed,
  });

  return {
    fingerprint: contentKey({ pathsKey, protectedMinimumCents, targetConfidence, warnings }),
    pathsKey,
    datasetKey: dataset.key,
    dataSource: dataset.source,
    accountId,
    referenceDate,
    horizonDays,
    openingBalanceCents,
    protectedMinimumCents,
    targetConfidence,
    pathCount,
    seed,
    scheduledIncome,
    scheduledBills,
    variableSpending,
    spendingModel,
    emergencies,
    warnings,
  };
}

function modelWarnings({
  dataset,
  accountId,
  spendingModel,
  openingBalanceCents,
  protectedMinimumCents,
  scheduledIncome,
  horizonDays,
}: {
  dataset: FinancialDataset;
  accountId: string;
  spendingModel: SimulationInput["spendingModel"];
  openingBalanceCents: number;
  protectedMinimumCents: number;
  scheduledIncome: TimelineEvent[];
  horizonDays: number;
}): ModelWarning[] {
  const warnings: ModelWarning[] = [];
  const hasHistory = dataset.transactions.some(
    (transaction) => transaction.accountId === accountId,
  );
  const fallbackKinds = VARIABLE_KINDS.filter(
    (kind) => spendingModel[kind].basis === "fallback",
  );

  if (!hasHistory) {
    warnings.push({
      code: "limited_history",
      message:
        "FinTwin has no transaction history for this account, so it has limited information: spending is based on your estimates and how much it varies uses default assumptions. Treat these results as a rough guide.",
    });
  } else if (fallbackKinds.length > 0) {
    warnings.push({
      code: "limited_history",
      message: `There isn’t enough transaction history to measure how your ${fallbackKinds.join(
        " and ",
      )} spending varies, so default assumptions are used for it.`,
    });
  }

  if (openingBalanceCents < protectedMinimumCents) {
    warnings.push({
      code: "below_minimum_today",
      message:
        "Your current balance is already below your protected minimum, so every simulated path starts in breach.",
    });
  }

  if (scheduledIncome.length === 0) {
    warnings.push({
      code: "no_income_in_horizon",
      message: `No income is scheduled in the next ${horizonDays} days, so the forecast only goes down.`,
    });
  }

  const expected = scheduledIncome.filter((event) => event.confidence === "estimated");

  if (expected.length > 0) {
    warnings.push({
      code: "estimated_income",
      message: `${expected.length === 1 ? "One payment" : `${expected.length} payments`} in this forecast ${
        expected.length === 1 ? "is" : "are"
      } expected rather than scheduled (${[...new Set(expected.map((event) => event.name))].join(
        ", ",
      )}). The simulation assumes ${expected.length === 1 ? "it arrives" : "they arrive"} as planned.`,
    });
  }

  return warnings;
}
