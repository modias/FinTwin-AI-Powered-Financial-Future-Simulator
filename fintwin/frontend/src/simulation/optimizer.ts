/**
 * Safe-to-spend: the largest purchase today that still meets the target.
 *
 * A purchase of `P` today that changes nothing else lowers every checkpoint
 * after the opening balance by exactly `P` on every path. So a path stays
 * safe with the purchase if and only if its opening balance is at least the
 * minimum `M` and its lowest later checkpoint `m` satisfies `m − P ≥ M`.
 *
 * With `k = ceil(target × paths)` paths required to stay safe, the answer is
 * the k-th largest `m` minus `M`: one sort of the path minima, no
 * re-simulation. The amount is then verified against the same paths, and is
 * never negative and never more than the account holds.
 */

import { sortedCopy } from "@/simulation/percentiles";
import type { SafeToSpendResult } from "@/simulation/types";

export const BASELINE_BELOW_TARGET_WARNING =
  "Your current financial forecast does not meet your selected safety target, even without an additional purchase.";

export const BELOW_MINIMUM_TODAY_WARNING =
  "Your current balance is already below your protected minimum, so there is nothing safe to spend.";

/** Paths that must stay safe, `ceil(target × pathCount)`, immune to float noise like 0.95 × 10,000. */
export function requiredSafePaths(targetConfidence: number, pathCount: number): number {
  return Math.ceil(Math.round(targetConfidence * pathCount * 1e6) / 1e6);
}

/** Paths that stay at or above `minimum` after spending `purchaseCents` today. */
export function countSafePaths(
  openingBalanceCents: number,
  postOpeningMinimum: Float64Array,
  protectedMinimumCents: number,
  purchaseCents = 0,
): number {
  if (openingBalanceCents < protectedMinimumCents) return 0;

  const threshold = protectedMinimumCents + purchaseCents;
  let safe = 0;

  for (let path = 0; path < postOpeningMinimum.length; path += 1) {
    if (postOpeningMinimum[path] >= threshold) safe += 1;
  }

  return safe;
}

export interface OptimizeOptions {
  openingBalanceCents: number;
  /** Each path's lowest checkpoint after the opening balance; see `postOpeningMinimum`. */
  postOpeningMinimum: Float64Array;
  protectedMinimumCents: number;
  targetConfidence: number;
}

export function optimizeSafeToSpend({
  openingBalanceCents,
  postOpeningMinimum,
  protectedMinimumCents,
  targetConfidence,
}: OptimizeOptions): SafeToSpendResult {
  const pathCount = postOpeningMinimum.length;
  const required = requiredSafePaths(targetConfidence, pathCount);
  const baselineSafe = countSafePaths(
    openingBalanceCents,
    postOpeningMinimum,
    protectedMinimumCents,
  );
  const baselineSafetyProbability = baselineSafe / pathCount;
  const base = {
    protectedMinimumCents,
    targetConfidence,
    baselineSafetyProbability,
    requiredSafePaths: required,
  };

  if (openingBalanceCents < protectedMinimumCents) {
    return {
      ...base,
      amountCents: 0,
      status: "below_minimum_today",
      safetyAtAmount: baselineSafetyProbability,
      limitedBy: "baseline",
      warning: BELOW_MINIMUM_TODAY_WARNING,
    };
  }

  if (baselineSafe < required) {
    return {
      ...base,
      amountCents: 0,
      status: "baseline_below_target",
      safetyAtAmount: baselineSafetyProbability,
      limitedBy: "baseline",
      warning: BASELINE_BELOW_TARGET_WARNING,
    };
  }

  const sorted = sortedCopy(postOpeningMinimum);
  // The `required`-th largest path minimum.
  const candidate = Math.floor(sorted[pathCount - required] - protectedMinimumCents);
  const amountCents = Math.max(0, Math.min(candidate, openingBalanceCents));
  const safeAtAmount = countSafePaths(
    openingBalanceCents,
    postOpeningMinimum,
    protectedMinimumCents,
    amountCents,
  );

  if (safeAtAmount < required) {
    throw new Error("Safe-to-spend verification failed: the amount does not meet the target");
  }

  return {
    ...base,
    amountCents,
    status: "meets_target",
    safetyAtAmount: safeAtAmount / pathCount,
    // Spending more would take today's balance itself below the minimum.
    limitedBy:
      amountCents >= openingBalanceCents - protectedMinimumCents
        ? "available_balance"
        : "safety_target",
    warning: null,
  };
}
