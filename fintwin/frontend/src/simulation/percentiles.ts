/**
 * Percentiles over simulated paths.
 *
 * Uses linear interpolation between order statistics (Hyndman & Fan type 7,
 * the default in NumPy and R): for `n` sorted values and probability `p`,
 * position `h = (n − 1) · p` and the value is interpolated between
 * `x[floor(h)]` and `x[ceil(h)]`.
 */

import type { SimulatedPaths } from "@/simulation/types";

export function quantileSorted(sorted: ArrayLike<number>, probability: number): number {
  const count = sorted.length;

  if (count === 0) throw new Error("Cannot take a quantile of no values");
  if (probability < 0 || probability > 1) {
    throw new Error(`Probability must be within [0, 1], got ${probability}`);
  }

  const position = (count - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, count - 1);

  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
}

/** Sorts a copy ascending; typed-array sort is numeric. */
export function sortedCopy(values: ArrayLike<number>): Float64Array {
  return Float64Array.from(values).sort();
}

export function quantile(values: ArrayLike<number>, probability: number): number {
  return quantileSorted(sortedCopy(values), probability);
}

export interface DailyPercentiles {
  p10: Float64Array;
  p50: Float64Array;
  p90: Float64Array;
}

/** 10th, 50th and 90th percentile closing balance for every day, in cents. */
export function dailyPercentiles(paths: SimulatedPaths): DailyPercentiles {
  const { pathCount, dayCount, closing } = paths;
  const p10 = new Float64Array(dayCount);
  const p50 = new Float64Array(dayCount);
  const p90 = new Float64Array(dayCount);
  const column = new Float64Array(pathCount);

  for (let day = 0; day < dayCount; day += 1) {
    column.set(closing.subarray(day * pathCount, (day + 1) * pathCount));
    column.sort();
    p10[day] = Math.round(quantileSorted(column, 0.1));
    p50[day] = Math.round(quantileSorted(column, 0.5));
    p90[day] = Math.round(quantileSorted(column, 0.9));
  }

  return { p10, p50, p90 };
}
