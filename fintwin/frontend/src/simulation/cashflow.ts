/**
 * Walks every simulated path through the horizon.
 *
 * Each day, in this order:
 *   1. start from the previous closing balance;
 *   2. add scheduled income;
 *   3. subtract scheduled bills;
 *   4. subtract the path's sampled variable spending;
 *   5. subtract the path's sampled unexpected expenses;
 *   6. apply hypothetical scenario changes (`scenarios.ts`, on top of these
 *      stored paths);
 *   7. check the protected minimum;
 *   8. record the closing balance.
 *
 * Money arrives before it leaves on the same day. Steps 3–5 only lower the
 * balance, so a day's lowest checkpoint before scenario changes is its
 * closing balance, and storing closing balances is enough to check every
 * checkpoint, including the opening balance on day 0.
 */

import {
  lognormalParameters,
  poissonFromUniform,
} from "@/simulation/distributions";
import { RANDOM_STREAMS, pathRandom } from "@/simulation/random";
import type { SimulatedPaths, SimulationInput } from "@/simulation/types";

export interface DailySchedule {
  dayCount: number;
  incomeCents: Float64Array;
  billsCents: Float64Array;
  expectedSpendingCents: Float64Array;
}

/** The fixed schedule per day, identical on every path. */
export function dailySchedule(input: SimulationInput): DailySchedule {
  const dayCount = input.horizonDays + 1;
  const incomeCents = new Float64Array(dayCount);
  const billsCents = new Float64Array(dayCount);
  const expectedSpendingCents = new Float64Array(dayCount);

  for (const event of input.scheduledIncome) incomeCents[event.dayIndex] += event.amountCents;
  for (const event of input.scheduledBills) billsCents[event.dayIndex] += event.amountCents;
  for (const occurrence of input.variableSpending) {
    expectedSpendingCents[occurrence.dayIndex] += occurrence.expectedCents;
  }

  return { dayCount, incomeCents, billsCents, expectedSpendingCents };
}

export function simulatePaths(input: SimulationInput): SimulatedPaths {
  const { pathCount, seed, openingBalanceCents, variableSpending, spendingModel, emergencies } =
    input;
  const schedule = dailySchedule(input);
  const { dayCount, incomeCents, billsCents } = schedule;

  const closing = new Float64Array(pathCount * dayCount);
  const variableSpendingTotal = new Float64Array(pathCount);
  const emergencyTotal = new Float64Array(pathCount);
  const emergencyCount = new Uint16Array(pathCount);

  // Per-occurrence lognormal parameters, computed once.
  const occurrenceCount = variableSpending.length;
  const occurrenceMu = new Float64Array(occurrenceCount);
  const occurrenceSigma = new Float64Array(occurrenceCount);
  const occurrenceIsEssential = new Uint8Array(occurrenceCount);

  variableSpending.forEach((occurrence, index) => {
    const { mu, sigma } = lognormalParameters(occurrence.variation);
    occurrenceMu[index] = mu;
    occurrenceSigma[index] = sigma;
    occurrenceIsEssential[index] = occurrence.kind === "essential" ? 1 : 0;
  });

  const essentialLevel = lognormalParameters(spendingModel.essential.levelVariation);
  const discretionaryLevel = lognormalParameters(spendingModel.discretionary.levelVariation);
  const emergencyCost = emergencies ? lognormalParameters(emergencies.costVariation) : null;
  const dailyEmergencyRate = emergencies ? emergencies.eventsPerYear / 365.25 : 0;

  const spendingByDay = new Float64Array(dayCount);

  for (let path = 0; path < pathCount; path += 1) {
    spendingByDay.fill(0);

    const spending = pathRandom(seed, path, RANDOM_STREAMS.spending);
    const essentialFactor = Math.exp(
      essentialLevel.mu + essentialLevel.sigma * spending.nextNormal(),
    );
    const discretionaryFactor = Math.exp(
      discretionaryLevel.mu + discretionaryLevel.sigma * spending.nextNormal(),
    );
    let variableTotal = 0;

    for (let index = 0; index < occurrenceCount; index += 1) {
      const level = occurrenceIsEssential[index] ? essentialFactor : discretionaryFactor;
      const noise = Math.exp(occurrenceMu[index] + occurrenceSigma[index] * spending.nextNormal());
      const amount = Math.max(
        0,
        Math.round(variableSpending[index].expectedCents * level * noise),
      );

      spendingByDay[variableSpending[index].dayIndex] += amount;
      variableTotal += amount;
    }

    variableSpendingTotal[path] = variableTotal;

    let emergencyByPath = 0;
    let emergencyEvents = 0;
    const emergencyRandom =
      emergencies && emergencyCost ? pathRandom(seed, path, RANDOM_STREAMS.emergencies) : null;

    let balance = openingBalanceCents;
    closing[path] = balance;

    for (let day = 1; day < dayCount; day += 1) {
      balance += incomeCents[day];
      balance -= billsCents[day];
      balance -= spendingByDay[day];

      if (emergencyRandom && emergencies && emergencyCost) {
        const arrivals = poissonFromUniform(dailyEmergencyRate, emergencyRandom.next());

        for (let arrival = 0; arrival < arrivals; arrival += 1) {
          const cost = Math.min(
            emergencies.maxCostCents,
            Math.max(
              0,
              Math.round(
                emergencies.meanCostCents *
                  Math.exp(emergencyCost.mu + emergencyCost.sigma * emergencyRandom.nextNormal()),
              ),
            ),
          );

          balance -= cost;
          emergencyByPath += cost;
          emergencyEvents += 1;
        }
      }

      closing[day * pathCount + path] = balance;
    }

    emergencyTotal[path] = emergencyByPath;
    emergencyCount[path] = emergencyEvents;
  }

  return {
    pathCount,
    dayCount,
    openingBalanceCents,
    closing,
    variableSpendingTotal,
    emergencyTotal,
    emergencyCount,
  };
}

/**
 * Each path's lowest checkpoint after the opening balance, with a scenario's
 * cumulative cash change applied (`cumulative[d]` is the total through day
 * `d`; all zero for the baseline).
 *
 * Scenario changes apply after the day's other events, so on day `d` the
 * checkpoints are the closing balance with the change through `d − 1` (just
 * before the scenario step) and with the change through `d` (after it).
 */
export function postOpeningMinimum(
  paths: SimulatedPaths,
  cumulative?: Float64Array,
): Float64Array {
  const { pathCount, dayCount, closing, openingBalanceCents } = paths;
  const minimum = new Float64Array(pathCount);
  const dayZero = openingBalanceCents + (cumulative ? cumulative[0] : 0);

  minimum.fill(dayZero);

  for (let day = 1; day < dayCount; day += 1) {
    const shift = cumulative ? Math.min(cumulative[day - 1], cumulative[day]) : 0;
    const offset = day * pathCount;

    for (let path = 0; path < pathCount; path += 1) {
      const value = closing[offset + path] + shift;

      if (value < minimum[path]) minimum[path] = value;
    }
  }

  return minimum;
}
