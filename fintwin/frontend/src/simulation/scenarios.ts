/**
 * Hypothetical scenarios as dated cash changes.
 *
 * Every supported scenario — a purchase, a recurring expense, an emergency,
 * an income or rent change — is a set of known amounts on known days. None
 * of them changes how spending or emergencies are distributed, so a scenario
 * is applied by adding its cumulative cash change to the stored baseline
 * paths. Every scenario therefore sees exactly the same random draws as the
 * baseline and as every other scenario (common random numbers): differences
 * between them come from the decision alone, not from sampling noise.
 *
 * Scenario changes apply after the day's scheduled and random events (see
 * `cashflow.ts`), so a payday raise lands after that day's bills: the
 * cautious order.
 */

import { formatMediumDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { dayIndexOf, horizonEnd, recurringDates } from "@/simulation/recurrence";
import type {
  FinancialScenario,
  ScenarioCashFlow,
  ScenarioType,
  SimulationInput,
  TimelineEvent,
} from "@/simulation/types";

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  one_time_purchase: "One-time purchase",
  delayed_purchase: "Delayed purchase",
  recurring_expense: "Recurring expense",
  emergency_expense: "Unexpected expense",
  income_increase: "Income increase",
  income_decrease: "Income reduction",
  rent_increase: "Rent increase",
  rent_decrease: "Rent decrease",
};

/** Problems with a scenario relative to the forecast it is tested against. */
export function scenarioIssues(scenario: FinancialScenario, input: SimulationInput): string[] {
  const issues: string[] = [];
  const end = horizonEnd(input.referenceDate, input.horizonDays);

  if (scenario.effectiveDate < input.referenceDate) {
    issues.push(`The date can’t be before ${formatMediumDate(input.referenceDate)}.`);
  }

  if (scenario.effectiveDate > end) {
    issues.push(`The date must be within the ${input.horizonDays}-day forecast, by ${formatMediumDate(end)}.`);
  }

  if (scenario.type === "delayed_purchase" && scenario.effectiveDate <= input.referenceDate) {
    issues.push("A delayed purchase must be after today. Use a one-time purchase for today.");
  }

  return issues;
}

function isRent(event: TimelineEvent): boolean {
  return event.recurring && event.category === "Housing";
}

/** The dated cash changes a scenario makes inside the horizon. */
export function scenarioCashFlows(
  scenario: FinancialScenario,
  input: SimulationInput,
): { cashFlows: ScenarioCashFlow[]; warnings: string[] } {
  const { referenceDate } = input;
  const end = horizonEnd(referenceDate, input.horizonDays);
  const from = scenario.effectiveDate;
  const warnings: string[] = [];
  const flow = (date: string, amountCents: number): ScenarioCashFlow => ({
    date,
    dayIndex: dayIndexOf(referenceDate, date),
    amountCents,
  });

  let cashFlows: ScenarioCashFlow[];

  switch (scenario.type) {
    case "one_time_purchase":
    case "delayed_purchase":
    case "emergency_expense":
      cashFlows = [flow(from, -scenario.amountCents)];

      if (scenario.amountCents > input.openingBalanceCents && from === referenceDate) {
        warnings.push("This is more than your current balance.");
      }
      break;

    case "recurring_expense":
      cashFlows = recurringDates(from, scenario.frequency ?? "monthly", end).map((date) =>
        flow(date, -scenario.amountCents),
      );
      break;

    case "income_increase":
    case "income_decrease": {
      const paychecks = input.scheduledIncome.filter(
        (event) => event.recurring && event.date >= from,
      );
      const isIncrease = scenario.type === "income_increase";

      // A reduction can take a paycheck to zero, not below it.
      cashFlows = paychecks.map((event) =>
        flow(
          event.date,
          isIncrease ? scenario.amountCents : -Math.min(scenario.amountCents, event.amountCents),
        ),
      );

      if (paychecks.length === 0) {
        warnings.push(
          `No recurring income is scheduled from ${formatMediumDate(from)} within the forecast, so this change has no effect.`,
        );
      } else if (!isIncrease && paychecks.some((event) => scenario.amountCents > event.amountCents)) {
        warnings.push("The reduction is capped at each payment’s full amount.");
      }
      break;
    }

    case "rent_increase":
    case "rent_decrease": {
      const payments = input.scheduledBills.filter(
        (event) => isRent(event) && event.date >= from,
      );
      const isIncrease = scenario.type === "rent_increase";

      // A decrease can make rent free, not pay the user.
      cashFlows = payments.map((event) =>
        flow(
          event.date,
          isIncrease ? -scenario.amountCents : Math.min(scenario.amountCents, event.amountCents),
        ),
      );

      if (payments.length === 0) {
        warnings.push(
          `No rent or mortgage payment falls from ${formatMediumDate(from)} within the forecast, so this change has no effect.`,
        );
      } else if (!isIncrease && payments.some((event) => scenario.amountCents > event.amountCents)) {
        warnings.push("The decrease is capped at the full rent payment.");
      }
      break;
    }
  }

  return { cashFlows, warnings };
}

/** Cumulative cash change through each day: `cumulative[d]` sums every flow on days `0..d`. */
export function cumulativeChange(cashFlows: ScenarioCashFlow[], dayCount: number): Float64Array {
  const daily = new Float64Array(dayCount);

  for (const cashFlow of cashFlows) daily[cashFlow.dayIndex] += cashFlow.amountCents;

  const cumulative = new Float64Array(dayCount);
  let running = 0;

  for (let day = 0; day < dayCount; day += 1) {
    running += daily[day];
    cumulative[day] = running;
  }

  return cumulative;
}

export function describeScenario(scenario: FinancialScenario): string {
  const amount = formatCents(scenario.amountCents);
  const date = formatMediumDate(scenario.effectiveDate);

  switch (scenario.type) {
    case "one_time_purchase":
      return `Spend ${amount} on ${date}`;
    case "delayed_purchase":
      return `Spend ${amount}, delayed to ${date}`;
    case "recurring_expense":
      return `${amount} ${scenario.frequency ?? "monthly"} from ${date}`;
    case "emergency_expense":
      return `An unexpected ${amount} expense on ${date}`;
    case "income_increase":
      return `${amount} more per paycheck from ${date}`;
    case "income_decrease":
      return `${amount} less per paycheck from ${date}`;
    case "rent_increase":
      return `Rent ${amount} higher from ${date}`;
    case "rent_decrease":
      return `Rent ${amount} lower from ${date}`;
  }
}
